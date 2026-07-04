-- 2/3 : RLS + RPC + Realtime
-- Lecture publique des données de scoreboard (partagées par QR code),
-- écriture réservée à l'organisateur ; les participants passent par des
-- fonctions SECURITY DEFINER validées par le share_code.

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_players enable row level security;
alter table public.matches enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "events_select_all" on public.events
  for select using (true);
create policy "events_insert_own" on public.events
  for insert with check (auth.uid() = organizer_id);
create policy "events_update_own" on public.events
  for update using (auth.uid() = organizer_id) with check (auth.uid() = organizer_id);
create policy "events_delete_own" on public.events
  for delete using (auth.uid() = organizer_id);

create policy "event_players_select_all" on public.event_players
  for select using (true);
create policy "event_players_write_organizer" on public.event_players
  for all using (
    exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())
  ) with check (
    exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())
  );

create policy "matches_select_all" on public.matches
  for select using (true);
create policy "matches_write_organizer" on public.matches
  for all using (
    exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())
  ) with check (
    exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())
  );

create or replace function public.report_score(
  p_match_id uuid,
  p_share_code text,
  p_score1 int,
  p_score2 int,
  p_reporter text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_event public.events%rowtype;
  v_points int;
  v_winner_p1 uuid;
  v_winner_p2 uuid;
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found then
    raise exception 'match_not_found';
  end if;

  select * into v_event from public.events where id = v_match.event_id;
  if v_event.share_code is distinct from upper(p_share_code) then
    raise exception 'invalid_share_code';
  end if;
  if v_event.status <> 'active' then
    raise exception 'event_not_active';
  end if;
  if p_score1 < 0 or p_score2 < 0 then
    raise exception 'invalid_score';
  end if;

  if v_event.format in ('americano', 'mexicano') then
    v_points := coalesce((v_event.settings ->> 'points_per_match')::int, 0);
    if v_points > 0 and p_score1 + p_score2 <> v_points then
      raise exception 'score_sum_mismatch';
    end if;
  else
    if p_score1 = p_score2 then
      raise exception 'draw_not_allowed';
    end if;
  end if;

  update public.matches
     set score1 = p_score1,
         score2 = p_score2,
         status = 'done',
         reported_by = coalesce(p_reporter, reported_by)
   where id = p_match_id;

  if v_event.format = 'tournament' and v_match.next_match_pos is not null then
    if p_score1 > p_score2 then
      v_winner_p1 := v_match.team1_p1;
      v_winner_p2 := v_match.team1_p2;
    else
      v_winner_p1 := v_match.team2_p1;
      v_winner_p2 := v_match.team2_p2;
    end if;
    if v_match.next_match_slot = 1 then
      update public.matches
         set team1_p1 = v_winner_p1, team1_p2 = v_winner_p2
       where event_id = v_match.event_id and bracket_pos = v_match.next_match_pos;
    else
      update public.matches
         set team2_p1 = v_winner_p1, team2_p2 = v_winner_p2
       where event_id = v_match.event_id and bracket_pos = v_match.next_match_pos;
    end if;
  end if;
end;
$$;

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
  update public.event_players set profile_id = auth.uid() where id = p_player_id;
end;
$$;

grant execute on function public.report_score to anon, authenticated;
grant execute on function public.claim_player to authenticated;

alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.event_players;
