-- Copie de référence de la migration padelpro_global_elo appliquée au projet
-- Supabase (pktzbwhsugtcdduxjgfu) via MCP le 2026-07-04, rapatriée depuis la
-- base (pg_get_functiondef) le 2026-07-06.
-- 4 : classement Elo global recalculé à la volée (K = 32, base 1000,
-- rating d'équipe = moyenne des deux joueurs, invités comptés à 1000).

create or replace function public.global_leaderboard()
returns table(p_id uuid, p_name text, p_elo integer, p_played integer, p_wins integer, p_losses integer, p_draws integer)
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
begin
  create temp table _elo (
    pid uuid primary key,
    rating numeric not null,
    played int not null,
    wo int not null,
    lo int not null,
    dr int not null
  ) on commit drop;

  insert into _elo (pid, rating, played, wo, lo, dr)
  select pr.id, 1000, 0, 0, 0, 0 from public.profiles pr;

  for mt in
    select
      m.score1,
      m.score2,
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
    t1r := ((coalesce((select e.rating from _elo e where e.pid = mt.a1), 1000))
          + (coalesce((select e.rating from _elo e where e.pid = mt.a2), 1000))) / 2;
    t2r := ((coalesce((select e.rating from _elo e where e.pid = mt.b1), 1000))
          + (coalesce((select e.rating from _elo e where e.pid = mt.b2), 1000))) / 2;

    expected1 := 1 / (1 + power(10::numeric, (t2r - t1r) / 400));
    actual1 := case
      when mt.score1 > mt.score2 then 1
      when mt.score1 < mt.score2 then 0
      else 0.5
    end;
    delta := k * (actual1 - expected1);

    update _elo e
       set rating = e.rating + delta,
           played = e.played + 1,
           wo = e.wo + case when actual1 = 1 then 1 else 0 end,
           lo = e.lo + case when actual1 = 0 then 1 else 0 end,
           dr = e.dr + case when actual1 = 0.5 then 1 else 0 end
     where e.pid in (mt.a1, mt.a2);

    update _elo e
       set rating = e.rating - delta,
           played = e.played + 1,
           wo = e.wo + case when actual1 = 0 then 1 else 0 end,
           lo = e.lo + case when actual1 = 1 then 1 else 0 end,
           dr = e.dr + case when actual1 = 0.5 then 1 else 0 end
     where e.pid in (mt.b1, mt.b2);
  end loop;

  return query
    select e.pid, pr.display_name, round(e.rating)::int, e.played, e.wo, e.lo, e.dr
      from _elo e
      join public.profiles pr on pr.id = e.pid
     where e.played > 0
     order by e.rating desc, pr.display_name;

  drop table _elo;
end;
$function$;

grant execute on function public.global_leaderboard to anon, authenticated;
