-- Copie de référence des migrations appliquées au projet Supabase
-- (pktzbwhsugtcdduxjgfu) via MCP le 2026-07-04.
-- 1/3 : schéma central

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Joueur',
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  format text not null check (format in ('americano','mexicano','tournament')),
  status text not null default 'draft' check (status in ('draft','active','completed')),
  share_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  settings jsonb not null default '{}'::jsonb,
  current_round int not null default 0,
  scheduled_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.event_players (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  display_name text not null,
  profile_id uuid references public.profiles(id) on delete set null,
  level int not null default 5 check (level between 1 and 10),
  seed int not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, display_name)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  round_number int not null,
  court int not null default 1,
  team1_p1 uuid references public.event_players(id) on delete cascade,
  team1_p2 uuid references public.event_players(id) on delete cascade,
  team2_p1 uuid references public.event_players(id) on delete cascade,
  team2_p2 uuid references public.event_players(id) on delete cascade,
  score1 int check (score1 >= 0),
  score2 int check (score2 >= 0),
  status text not null default 'pending' check (status in ('pending','done')),
  bracket_pos int,
  next_match_pos int,
  next_match_slot int check (next_match_slot in (1, 2)),
  reported_by text,
  created_at timestamptz not null default now()
);

create index idx_matches_event_round on public.matches (event_id, round_number);
create index idx_event_players_event on public.event_players (event_id);
create index idx_event_players_profile on public.event_players (profile_id) where profile_id is not null;
create index idx_events_organizer on public.events (organizer_id);
create index idx_events_share_code on public.events (share_code);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger interne uniquement : pas d'accès API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
