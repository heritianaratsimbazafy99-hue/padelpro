-- Copie de référence de la migration public_profiles_trophies_side_history
-- appliquée au projet Supabase (pktzbwhsugtcdduxjgfu) via MCP le 2026-07-06.
-- 5 : fiches joueurs publiques, trophées persistés, côté préféré propagé
-- aux événements, historique Elo par joueur (sparkline).

-- 1. Fiches joueurs publiques : la lecture des profils devient ouverte
-- (display_name, bio, côté, raquette, avatar — aucune donnée sensible,
-- l'email reste dans auth.users). L'écriture reste limitée au propriétaire.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select using (true);

-- 2. Trophées persistés : date de déblocage + source des célébrations
create table public.profile_trophies (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  trophy_id text not null check (char_length(trophy_id) <= 40),
  unlocked_at timestamptz not null default now(),
  primary key (profile_id, trophy_id)
);

alter table public.profile_trophies enable row level security;

create policy "profile_trophies_select_all" on public.profile_trophies
  for select using (true);
create policy "profile_trophies_insert_own" on public.profile_trophies
  for insert to authenticated with check (auth.uid() = profile_id);

-- 3. Côté préféré propagé aux fiches d'événement (utilisé par
-- l'appariement équilibré) ; copié depuis le profil au claim.
alter table public.event_players
  add column if not exists preferred_side text check (preferred_side in ('left', 'right', 'both'));

create or replace function public.claim_player(
  p_player_id uuid,
  p_share_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select ep.event_id into v_event_id
    from public.event_players ep
    join public.events e on e.id = ep.event_id
   where ep.id = p_player_id and e.share_code = upper(p_share_code);
  if not found then
    raise exception 'player_or_code_invalid';
  end if;
  update public.event_players ep
     set profile_id = auth.uid(),
         preferred_side = coalesce(
           (select pr.preferred_side from public.profiles pr where pr.id = auth.uid()),
           ep.preferred_side
         )
   where ep.id = p_player_id;
end;
$$;

-- 4. Historique Elo d'un joueur : même calcul que global_leaderboard
-- (K = 32, base 1000, moyenne d'équipe), mais émet un point après chaque
-- match du joueur — alimente la sparkline de la carte licence.
create or replace function public.player_elo_history(p_profile_id uuid)
returns table(h_idx integer, h_elo integer, h_played_at timestamptz)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  mt record;
  t1r numeric;
  t2r numeric;
  expected1 numeric;
  actual1 numeric;
  delta numeric;
  k constant numeric := 32;
  idx integer := 0;
begin
  create temp table _elo_h (pid uuid primary key, rating numeric not null) on commit drop;
  create temp table _hist (i integer, elo integer, at timestamptz) on commit drop;

  insert into _elo_h (pid, rating)
  select pr.id, 1000 from public.profiles pr;

  for mt in
    select
      m.score1,
      m.score2,
      m.created_at,
      ep1.profile_id as a1,
      ep2.profile_id as a2,
      ep3.profile_id as b1,
      ep4.profile_id as b2
    from public.matches m
    left join public.event_players ep1 on ep1.id = m.team1_p1
    left join public.event_players ep2 on ep2.id = m.team1_p2
    left join public.event_players ep3 on ep3.id = m.team2_p1
    left join public.event_players ep4 on ep4.id = m.team2_p2
    where m.status = 'done' and m.score1 is not null and m.score2 is not null
    order by m.created_at, m.id
  loop
    t1r := ((coalesce((select e.rating from _elo_h e where e.pid = mt.a1), 1000))
          + (coalesce((select e.rating from _elo_h e where e.pid = mt.a2), 1000))) / 2;
    t2r := ((coalesce((select e.rating from _elo_h e where e.pid = mt.b1), 1000))
          + (coalesce((select e.rating from _elo_h e where e.pid = mt.b2), 1000))) / 2;

    expected1 := 1 / (1 + power(10::numeric, (t2r - t1r) / 400));
    actual1 := case
      when mt.score1 > mt.score2 then 1
      when mt.score1 < mt.score2 then 0
      else 0.5
    end;
    delta := k * (actual1 - expected1);

    update _elo_h e set rating = e.rating + delta where e.pid in (mt.a1, mt.a2);
    update _elo_h e set rating = e.rating - delta where e.pid in (mt.b1, mt.b2);

    if p_profile_id in (mt.a1, mt.a2, mt.b1, mt.b2) then
      idx := idx + 1;
      insert into _hist (i, elo, at)
      values (idx, round((select e.rating from _elo_h e where e.pid = p_profile_id))::int, mt.created_at);
    end if;
  end loop;

  return query select h.i, h.elo, h.at from _hist h order by h.i;

  drop table _elo_h;
  drop table _hist;
end;
$function$;

grant execute on function public.player_elo_history to anon, authenticated;
