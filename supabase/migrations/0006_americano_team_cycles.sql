-- 6 : équipes Americano persistées et ajout atomique de cycles.

alter table public.event_players
  add column team_number integer check (team_number is null or team_number > 0);

alter table public.matches
  add column cycle_number integer not null default 1 check (cycle_number > 0);

-- Les lignes historiques ne bloquent pas le déploiement, mais toute nouvelle
-- écriture doit désormais fournir deux scores pour un match terminé.
alter table public.matches
  add constraint matches_done_scores_present
  check (status <> 'done' or (score1 is not null and score2 is not null))
  not valid;

create unique index matches_event_cycle_round_court_unique
  on public.matches (event_id, cycle_number, round_number, court)
  where bracket_pos is null;

-- Toute mutation structurelle du roster passe par replace_event_roster. Le
-- claim d'un joueur reste disponible via sa fonction SECURITY DEFINER.
drop policy if exists "event_players_write_organizer" on public.event_players;

create or replace function public.replace_event_roster(
  p_event_id uuid,
  p_players jsonb,
  p_rounds_per_cycle integer default null
)
returns setof public.event_players
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_player_count integer;
  v_team_count integer;
  v_courts integer;
  v_team_mode text;
  v_active integer;
  v_expected_rounds integer;
  v_logical_rounds integer;
  v_matches_per_logical integer;
  v_staging_prefix text;
  v_upserted_count integer;
begin
  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found or auth.uid() is null or v_event.organizer_id is distinct from auth.uid() then
    raise exception 'not_event_organizer';
  end if;
  if v_event.status <> 'draft' or exists (
    select 1 from public.matches m where m.event_id = p_event_id
  ) then
    raise exception 'roster_locked';
  end if;
  if jsonb_typeof(p_players) is distinct from 'array' then
    raise exception 'invalid_roster_payload';
  end if;

  begin
    v_player_count := jsonb_array_length(p_players);
    if exists (
      select 1
      from jsonb_array_elements(p_players) as item(value)
      where jsonb_typeof(item.value) is distinct from 'object'
        or jsonb_typeof(item.value -> 'id') is distinct from 'string'
        or jsonb_typeof(item.value -> 'display_name') is distinct from 'string'
        or jsonb_typeof(item.value -> 'level') is distinct from 'number'
        or jsonb_typeof(item.value -> 'seed') is distinct from 'number'
        or (
          item.value ? 'preferred_side'
          and jsonb_typeof(item.value -> 'preferred_side') not in ('string', 'null')
        )
        or (
          item.value ? 'team_number'
          and jsonb_typeof(item.value -> 'team_number') not in ('number', 'null')
        )
        or mod((item.value ->> 'level')::numeric, 1) <> 0
        or mod((item.value ->> 'seed')::numeric, 1) <> 0
        or (
          jsonb_typeof(item.value -> 'team_number') = 'number'
          and mod((item.value ->> 'team_number')::numeric, 1) <> 0
        )
    ) then
      raise exception 'invalid_roster_payload';
    end if;
    if exists (
      with payload as (
        select * from jsonb_to_recordset(p_players) as x(
          id uuid,
          display_name text,
          level integer,
          seed integer,
          preferred_side text,
          team_number integer
        )
      )
      select 1 from payload
      where id is null
        or display_name is null or btrim(display_name) = ''
        or level is null or level not between 1 and 10
        or seed is null or seed < 0
        or preferred_side not in ('left', 'right', 'both')
        or team_number < 1
    ) or exists (
      select 1
      from jsonb_to_recordset(p_players) as x(id uuid, display_name text)
      group by id having count(*) > 1
    ) or exists (
      select 1
      from jsonb_to_recordset(p_players) as x(id uuid, display_name text)
      group by lower(btrim(display_name)) having count(*) > 1
    ) or exists (
      select 1
      from public.event_players ep
      join jsonb_to_recordset(p_players) as x(id uuid) on x.id = ep.id
      where ep.event_id <> p_event_id
    ) then
      raise exception 'invalid_roster_payload';
    end if;

    if p_rounds_per_cycle is not null then
      if v_event.format <> 'americano' or p_rounds_per_cycle < 1 or v_player_count < 4 then
        raise exception 'invalid_roster_payload';
      end if;
      v_courts := nullif(v_event.settings ->> 'courts', '')::integer;
      v_team_mode := coalesce(v_event.settings ->> 'team_mode', 'remixed');
      if v_courts is null or v_courts < 1 or v_team_mode not in ('remixed', 'fixed') then
        raise exception 'invalid_roster_payload';
      end if;

      if v_team_mode = 'fixed' then
        select count(distinct team_number) into v_team_count
        from jsonb_to_recordset(p_players) as x(team_number integer);
        if v_player_count % 2 <> 0
          or exists (
            select 1
            from jsonb_to_recordset(p_players) as x(team_number integer)
            group by team_number
            having team_number is null or count(*) <> 2
          )
          or v_team_count * 2 <> v_player_count then
          raise exception 'fixed_teams_invalid';
        end if;
        v_logical_rounds := case when v_team_count % 2 = 0 then v_team_count - 1 else v_team_count end;
        v_matches_per_logical := floor(v_team_count / 2.0)::integer;
        v_expected_rounds := v_logical_rounds
          * ((v_matches_per_logical + v_courts - 1) / v_courts);
      else
        v_active := least(v_courts * 4, floor(v_player_count / 4.0)::integer * 4);
        v_expected_rounds := case
          when v_player_count % 4 = 2 then v_player_count / 2
          else v_player_count - 1
        end;
        while (v_expected_rounds * v_active) % v_player_count <> 0 loop
          v_expected_rounds := v_expected_rounds + 1;
        end loop;
      end if;

      if p_rounds_per_cycle <> v_expected_rounds then
        raise exception 'invalid_roster_payload';
      end if;
      v_event.settings := jsonb_set(
        jsonb_set(v_event.settings, '{rounds}', to_jsonb(v_expected_rounds), true),
        '{rounds_per_cycle}', to_jsonb(v_expected_rounds), true
      );
      update public.events set settings = v_event.settings where id = p_event_id;
    end if;

    delete from public.event_players ep
    where ep.event_id = p_event_id
      and not exists (
        select 1 from jsonb_to_recordset(p_players) as x(id uuid) where x.id = ep.id
      );

    -- Les noms des lignes conservées sont d'abord déplacés vers un espace
    -- aléatoire. Ainsi deux IDs peuvent échanger leurs display_name sans
    -- heurter transitoirement l'unicité (event_id, display_name).
    v_staging_prefix := '__roster_stage_' || gen_random_uuid()::text || '_';
    update public.event_players ep
    set display_name = v_staging_prefix || ep.id::text
    where ep.event_id = p_event_id
      and exists (
        select 1 from jsonb_to_recordset(p_players) as x(id uuid) where x.id = ep.id
      );

    insert into public.event_players as ep (
      id, event_id, display_name, level, seed, preferred_side, team_number
    )
    select
      x.id, p_event_id, btrim(x.display_name), x.level, x.seed, x.preferred_side, x.team_number
    from jsonb_to_recordset(p_players) as x(
      id uuid,
      display_name text,
      level integer,
      seed integer,
      preferred_side text,
      team_number integer
    )
    on conflict (id) do update set
      display_name = excluded.display_name,
      level = excluded.level,
      seed = excluded.seed,
      preferred_side = excluded.preferred_side,
      team_number = excluded.team_number
    where ep.event_id = p_event_id;

    get diagnostics v_upserted_count = row_count;
    if v_upserted_count <> v_player_count then
      raise exception 'invalid_roster_payload';
    end if;

    return query
    select * from public.event_players ep
    where ep.event_id = p_event_id
    order by ep.seed, ep.id;
  exception
    when invalid_text_representation
      or numeric_value_out_of_range
      or invalid_parameter_value
      or not_null_violation
      or check_violation
      or unique_violation then
      raise exception 'invalid_roster_payload';
  end;
end;
$$;

revoke execute on function public.replace_event_roster(uuid, jsonb, integer)
  from public, anon;
grant execute on function public.replace_event_roster(uuid, jsonb, integer)
  to authenticated;

-- Les insertions directes restent nécessaires pour Mexicano et tournoi. Les
-- mises à jour de score/avancement passent déjà par report_score.
drop policy if exists "matches_write_organizer" on public.matches;
drop policy if exists "matches_insert_organizer_non_americano" on public.matches;

create policy "matches_insert_organizer_non_americano" on public.matches
  for insert to authenticated
  with check (exists (
    select 1 from public.events e
    where e.id = matches.event_id
      and e.organizer_id = auth.uid()
      and (
        (e.status = 'draft' and e.format in ('mexicano', 'tournament'))
        or (e.status = 'active' and e.format = 'mexicano')
      )
      and (
        matches.team1_p1 is null
        or exists (
          select 1 from public.event_players ep
          where ep.id = matches.team1_p1 and ep.event_id = matches.event_id
        )
      )
      and (
        matches.team1_p2 is null
        or exists (
          select 1 from public.event_players ep
          where ep.id = matches.team1_p2 and ep.event_id = matches.event_id
        )
      )
      and (
        matches.team2_p1 is null
        or exists (
          select 1 from public.event_players ep
          where ep.id = matches.team2_p1 and ep.event_id = matches.event_id
        )
      )
      and (
        matches.team2_p2 is null
        or exists (
          select 1 from public.event_players ep
          where ep.id = matches.team2_p2 and ep.event_id = matches.event_id
        )
      )
  ));

-- La policy protège l'accès direct; ce trigger verrouille en plus l'événement
-- afin de sérialiser un insert Mexicano avec une complétion concurrente.
create or replace function public.guard_non_americano_match_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
begin
  select * into v_event
  from public.events
  where id = new.event_id
  for update;

  if not found then
    raise exception 'match_write_forbidden';
  end if;
  if new.team1_p1 is not null then
    perform ep.id from public.event_players ep
    where ep.id = new.team1_p1 and ep.event_id = new.event_id;
    if not found then raise exception 'match_write_forbidden'; end if;
  end if;
  if new.team1_p2 is not null then
    perform ep.id from public.event_players ep
    where ep.id = new.team1_p2 and ep.event_id = new.event_id;
    if not found then raise exception 'match_write_forbidden'; end if;
  end if;
  if new.team2_p1 is not null then
    perform ep.id from public.event_players ep
    where ep.id = new.team2_p1 and ep.event_id = new.event_id;
    if not found then raise exception 'match_write_forbidden'; end if;
  end if;
  if new.team2_p2 is not null then
    perform ep.id from public.event_players ep
    where ep.id = new.team2_p2 and ep.event_id = new.event_id;
    if not found then raise exception 'match_write_forbidden'; end if;
  end if;
  if v_event.format = 'americano' then
    return new;
  end if;
  if auth.uid() is null or v_event.organizer_id is distinct from auth.uid() then
    raise exception 'match_write_forbidden';
  end if;
  if not (
    (v_event.status = 'draft' and v_event.format in ('mexicano', 'tournament'))
    or (v_event.status = 'active' and v_event.format = 'mexicano')
  ) then
    raise exception 'match_write_forbidden';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_non_americano_match_insert on public.matches;
create trigger guard_non_americano_match_insert
  before insert on public.matches
  for each row execute function public.guard_non_americano_match_insert();

revoke execute on function public.guard_non_americano_match_insert()
  from public, anon, authenticated;

create or replace function public.report_score(
  p_match_id uuid,
  p_share_code text,
  p_score1 integer,
  p_score2 integer,
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
  v_points integer;
  v_winner_p1 uuid;
  v_winner_p2 uuid;
begin
  select * into v_match
  from public.matches
  where id = p_match_id;
  if not found then
    raise exception 'match_not_found';
  end if;

  select * into v_event
  from public.events
  where id = v_match.event_id
    and share_code = upper(p_share_code)
  for update;
  if not found then
    raise exception 'invalid_share_code';
  end if;

  -- Le verrou événement précède toute validation et toute mutation du score.
  select * into v_match
  from public.matches
  where id = p_match_id and event_id = v_event.id
  for update;
  if not found then
    raise exception 'match_not_found';
  end if;

  if v_event.status <> 'active' then
    raise exception 'event_not_active';
  end if;
  if p_score1 is null or p_score2 is null or p_score1 < 0 or p_score2 < 0 then
    raise exception 'invalid_score';
  end if;

  if v_event.format in ('americano', 'mexicano') then
    v_points := coalesce((v_event.settings ->> 'points_per_match')::integer, 0);
    if v_points > 0 and p_score1 + p_score2 <> v_points then
      raise exception 'score_sum_mismatch';
    end if;
  elsif p_score1 = p_score2 then
    raise exception 'draw_not_allowed';
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

revoke execute on function public.report_score(uuid, text, integer, integer, text)
  from public;
grant execute on function public.report_score(uuid, text, integer, integer, text)
  to anon, authenticated;

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
  v_player public.event_players%rowtype;
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- Respecte le même ordre de verrous que replace_event_roster : événement,
  -- puis joueur. La première lecture ne verrouille rien et est revalidée après.
  select ep.event_id into v_event_id
  from public.event_players ep
  where ep.id = p_player_id;
  if not found then
    raise exception 'player_or_code_invalid';
  end if;

  perform e.id
  from public.events e
  where e.id = v_event_id
    and e.share_code = upper(p_share_code)
  for update;
  if not found then
    raise exception 'player_or_code_invalid';
  end if;

  select ep.* into v_player
  from public.event_players ep
  where ep.id = p_player_id and ep.event_id = v_event_id
  for update;

  if not found
    or (v_player.profile_id is not null and v_player.profile_id is distinct from auth.uid()) then
    raise exception 'player_or_code_invalid';
  end if;

  update public.event_players ep
  set profile_id = auth.uid(),
      preferred_side = coalesce(
        (select pr.preferred_side from public.profiles pr where pr.id = auth.uid()),
        ep.preferred_side
      )
  where ep.id = p_player_id
    and (ep.profile_id is null or ep.profile_id = auth.uid());

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'player_or_code_invalid';
  end if;
end;
$$;

revoke execute on function public.claim_player(uuid, text) from public, anon;
grant execute on function public.claim_player(uuid, text) to authenticated;

create or replace function public.guard_event_after_launch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'completed' and new.status <> 'completed' then
    raise exception 'event_locked';
  end if;

  if old.status = 'draft' and new.status = 'active' and not exists (
    select 1 from public.matches m where m.event_id = old.id
  ) then
    raise exception 'event_locked';
  end if;

  if exists (select 1 from public.matches m where m.event_id = old.id) then
    if new.organizer_id is distinct from old.organizer_id
      or new.format is distinct from old.format
      or new.settings is distinct from old.settings
      or new.status = 'draft' then
      raise exception 'event_locked';
    end if;
  end if;

  if new.status = 'completed' and old.status <> 'completed' then
    if old.status <> 'active' then
      raise exception 'event_not_active';
    end if;
    if exists (
      select 1 from public.matches m
      where m.event_id = old.id
        and (m.status <> 'done' or m.score1 is null or m.score2 is null)
    ) then
      raise exception 'cycle_incomplete';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_event_after_launch on public.events;
create trigger guard_event_after_launch
  before update on public.events
  for each row execute function public.guard_event_after_launch();

revoke execute on function public.guard_event_after_launch() from public, anon, authenticated;

create or replace function public.commit_americano_cycle(
  p_event_id uuid,
  p_expected_cycle integer,
  p_matches jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_current_cycle integer;
  v_last_round integer;
  v_courts integer;
  v_rounds_per_cycle integer;
  v_team_mode text;
  v_player_count integer;
  v_team_count integer;
  v_logical_rounds integer;
  v_matches_per_logical integer;
  v_expected_rounds integer;
  v_active integer;
  v_round_count integer;
  v_min_round integer;
  v_max_round integer;
  v_min_appearances integer;
  v_max_appearances integer;
  v_expected_matches_per_round integer;
  v_expected_pairings integer;
begin
  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found or auth.uid() is null or v_event.organizer_id is distinct from auth.uid() then
    raise exception 'not_event_organizer';
  end if;
  if v_event.format <> 'americano' then
    raise exception 'invalid_event_format';
  end if;

  -- Stabilise les affectations pendant toute la validation/insertion du cycle.
  perform ep.id
  from public.event_players ep
  where ep.event_id = p_event_id
  order by ep.id
  for update;

  select coalesce(max(m.cycle_number), 0), coalesce(max(m.round_number), 0)
  into v_current_cycle, v_last_round
  from public.matches m
  where m.event_id = p_event_id;

  if p_expected_cycle is null then
    raise exception 'unexpected_cycle';
  end if;
  if p_expected_cycle <= v_current_cycle then
    raise exception 'cycle_already_added';
  end if;
  if p_expected_cycle <> v_current_cycle + 1 then
    raise exception 'unexpected_cycle';
  end if;
  if p_expected_cycle = 1 and v_event.status <> 'draft' then
    raise exception 'unexpected_cycle';
  end if;
  if p_expected_cycle > 1 and v_event.status <> 'active' then
    raise exception 'event_not_active';
  end if;
  if p_expected_cycle > 1 and exists (
    select 1 from public.matches m
    where m.event_id = p_event_id
      and m.cycle_number = v_current_cycle
      and (m.status <> 'done' or m.score1 is null or m.score2 is null)
  ) then
    raise exception 'cycle_incomplete';
  end if;

  begin
    v_courts := nullif(v_event.settings ->> 'courts', '')::integer;
    v_rounds_per_cycle := coalesce(
      nullif(v_event.settings ->> 'rounds_per_cycle', '')::integer,
      nullif(v_event.settings ->> 'rounds', '')::integer
    );
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'invalid_cycle_payload';
  end;
  v_team_mode := coalesce(v_event.settings ->> 'team_mode', 'remixed');
  select count(*) into v_player_count
  from public.event_players ep where ep.event_id = p_event_id;

  if v_courts is null or v_courts < 1
    or v_rounds_per_cycle is null or v_rounds_per_cycle < 1
    or v_player_count < 4
    or v_team_mode not in ('remixed', 'fixed') then
    raise exception 'invalid_cycle_payload';
  end if;

  if v_team_mode = 'fixed' then
    select count(distinct ep.team_number) into v_team_count
    from public.event_players ep
    where ep.event_id = p_event_id;
    if v_player_count % 2 <> 0
      or exists (
        select 1
        from public.event_players ep
        where ep.event_id = p_event_id
        group by ep.team_number
        having ep.team_number is null or count(*) <> 2
      )
      or v_team_count * 2 <> v_player_count then
      raise exception 'fixed_teams_invalid';
    end if;
  end if;

  if v_event.settings ? 'rounds_per_cycle' then
    if v_team_mode = 'fixed' then
      v_logical_rounds := case
        when v_team_count % 2 = 0 then v_team_count - 1
        else v_team_count
      end;
      v_matches_per_logical := floor(v_team_count / 2.0)::integer;
      v_expected_rounds := v_logical_rounds
        * ((v_matches_per_logical + v_courts - 1) / v_courts);
    else
      v_active := least(v_courts * 4, floor(v_player_count / 4.0)::integer * 4);
      v_expected_rounds := case
        when v_player_count % 4 = 2 then v_player_count / 2
        else v_player_count - 1
      end;
      while (v_expected_rounds * v_active) % v_player_count <> 0 loop
        v_expected_rounds := v_expected_rounds + 1;
      end loop;
    end if;

    if v_expected_rounds <> v_rounds_per_cycle then
      raise exception 'invalid_cycle_payload';
    end if;
  end if;

  if jsonb_typeof(p_matches) is distinct from 'array' then
    raise exception 'invalid_cycle_payload';
  end if;
  if jsonb_array_length(p_matches) = 0 then
    raise exception 'invalid_cycle_payload';
  end if;

  begin
    if exists (
      with payload as (
        select * from jsonb_to_recordset(p_matches) as x(
          round_number integer,
          court integer,
          team1_p1 uuid,
          team1_p2 uuid,
          team2_p1 uuid,
          team2_p2 uuid
        )
      )
      select 1
      from payload p
      where p.round_number is null
        or p.court is null or p.court not between 1 and v_courts
        or p.team1_p1 is null or p.team1_p2 is null
        or p.team2_p1 is null or p.team2_p2 is null
        or p.team1_p1 in (p.team1_p2, p.team2_p1, p.team2_p2)
        or p.team1_p2 in (p.team2_p1, p.team2_p2)
        or p.team2_p1 = p.team2_p2
        or not exists (
          select 1 from public.event_players ep
          where ep.event_id = p_event_id and ep.id = p.team1_p1
        )
        or not exists (
          select 1 from public.event_players ep
          where ep.event_id = p_event_id and ep.id = p.team1_p2
        )
        or not exists (
          select 1 from public.event_players ep
          where ep.event_id = p_event_id and ep.id = p.team2_p1
        )
        or not exists (
          select 1 from public.event_players ep
          where ep.event_id = p_event_id and ep.id = p.team2_p2
        )
    ) then
      raise exception 'invalid_cycle_payload';
    end if;

    if exists (
      with payload as (
        select * from jsonb_to_recordset(p_matches) as x(
          round_number integer,
          court integer,
          team1_p1 uuid,
          team1_p2 uuid,
          team2_p1 uuid,
          team2_p2 uuid
        )
      ), appearances as (
        select p.round_number, a.player_id
        from payload p
        cross join lateral unnest(array[
          p.team1_p1, p.team1_p2, p.team2_p1, p.team2_p2
        ]) as a(player_id)
      )
      select 1
      from appearances a
      group by a.round_number, a.player_id
      having count(*) > 1
    ) or exists (
      select 1
      from jsonb_to_recordset(p_matches) as x(round_number integer, court integer)
      group by round_number, court
      having count(*) > 1
    ) then
      raise exception 'invalid_cycle_payload';
    end if;

    select count(distinct x.round_number), min(x.round_number), max(x.round_number)
    into v_round_count, v_min_round, v_max_round
    from jsonb_to_recordset(p_matches) as x(round_number integer);

    if v_round_count <> v_rounds_per_cycle
      or v_min_round <> v_last_round + 1
      or v_max_round <> v_last_round + v_rounds_per_cycle then
      raise exception 'invalid_cycle_payload';
    end if;

    if v_team_mode = 'remixed' then
      v_expected_matches_per_round := least(v_courts, floor(v_player_count / 4.0)::integer);
      if exists (
        select 1
        from jsonb_to_recordset(p_matches) as x(round_number integer)
        group by x.round_number
        having count(*) <> v_expected_matches_per_round
      ) then
        raise exception 'invalid_cycle_payload';
      end if;

      with payload as (
        select * from jsonb_to_recordset(p_matches) as x(
          round_number integer,
          court integer,
          team1_p1 uuid,
          team1_p2 uuid,
          team2_p1 uuid,
          team2_p2 uuid
        )
      ), appearances as (
        select a.player_id
        from payload p
        cross join lateral unnest(array[
          p.team1_p1, p.team1_p2, p.team2_p1, p.team2_p2
        ]) as a(player_id)
      ), counts as (
        select ep.id, count(a.player_id)::integer as appearances
        from public.event_players ep
        left join appearances a on a.player_id = ep.id
        where ep.event_id = p_event_id
        group by ep.id
      )
      select min(c.appearances), max(c.appearances)
      into v_min_appearances, v_max_appearances
      from counts c;

      if v_max_appearances - v_min_appearances > 1 then
        raise exception 'invalid_cycle_payload';
      end if;
    else
      if exists (
        with payload as (
          select * from jsonb_to_recordset(p_matches) as x(
            round_number integer,
            court integer,
            team1_p1 uuid,
            team1_p2 uuid,
            team2_p1 uuid,
            team2_p2 uuid
          )
        )
        select 1
        from payload p
        join public.event_players ep1 on ep1.id = p.team1_p1 and ep1.event_id = p_event_id
        join public.event_players ep2 on ep2.id = p.team1_p2 and ep2.event_id = p_event_id
        join public.event_players ep3 on ep3.id = p.team2_p1 and ep3.event_id = p_event_id
        join public.event_players ep4 on ep4.id = p.team2_p2 and ep4.event_id = p_event_id
        where ep1.team_number is distinct from ep2.team_number
          or ep3.team_number is distinct from ep4.team_number
          or ep1.team_number is not distinct from ep3.team_number
      ) then
        raise exception 'invalid_cycle_payload';
      end if;

      v_expected_pairings := v_team_count * (v_team_count - 1) / 2;
      if jsonb_array_length(p_matches) <> v_expected_pairings then
        raise exception 'invalid_cycle_payload';
      end if;
      if exists (
        with payload as (
          select * from jsonb_to_recordset(p_matches) as x(
            round_number integer,
            court integer,
            team1_p1 uuid,
            team1_p2 uuid,
            team2_p1 uuid,
            team2_p2 uuid
          )
        ), pairings as (
          select
            least(ep1.team_number, ep3.team_number) as team_a,
            greatest(ep1.team_number, ep3.team_number) as team_b
          from payload p
          join public.event_players ep1 on ep1.id = p.team1_p1 and ep1.event_id = p_event_id
          join public.event_players ep3 on ep3.id = p.team2_p1 and ep3.event_id = p_event_id
        )
        select 1
        from pairings p
        group by p.team_a, p.team_b
        having count(*) <> 1
      ) then
        raise exception 'invalid_cycle_payload';
      end if;
    end if;

    insert into public.matches (
      event_id, cycle_number, round_number, court,
      team1_p1, team1_p2, team2_p1, team2_p2
    )
    select
      p_event_id, p_expected_cycle, x.round_number, x.court,
      x.team1_p1, x.team1_p2, x.team2_p1, x.team2_p2
    from jsonb_to_recordset(p_matches) as x(
      round_number integer,
      court integer,
      team1_p1 uuid,
      team1_p2 uuid,
      team2_p1 uuid,
      team2_p2 uuid
    );
  exception
    when invalid_text_representation
      or numeric_value_out_of_range
      or invalid_parameter_value
      or not_null_violation
      or check_violation then
      raise exception 'invalid_cycle_payload';
  end;

  update public.events
  set status = case when p_expected_cycle = 1 then 'active' else status end,
      current_round = v_last_round + 1
  where id = p_event_id;
end;
$$;

revoke execute on function public.commit_americano_cycle(uuid, integer, jsonb)
  from public, anon;
grant execute on function public.commit_americano_cycle(uuid, integer, jsonb)
  to authenticated;

-- plpgsql_check ne peut pas résoudre statiquement les tables temporaires que
-- ces deux fonctions historiques créent à l'exécution. L'exemption reste
-- limitée à ces fonctions; toutes les fonctions de cette migration sont lintées.
alter function public.global_leaderboard()
  set plpgsql_check.mode to 'disabled';
alter function public.player_elo_history(uuid)
  set plpgsql_check.mode to 'disabled';
