import type { EventPlayer, Match, StandingRow } from "../types";

/**
 * Classement americano/mexicano : cumul des points marqués, puis victoires,
 * puis différence de points. Un joueur au repos ne marque rien.
 */
export function computeStandings(players: EventPlayer[], matches: Match[]): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    players.map((p) => [
      p.id,
      {
        playerId: p.id,
        name: p.display_name,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        diff: 0,
      },
    ]),
  );

  for (const m of matches) {
    if (m.status !== "done" || m.score1 === null || m.score2 === null) continue;
    const team1 = [m.team1_p1, m.team1_p2].filter(Boolean) as string[];
    const team2 = [m.team2_p1, m.team2_p2].filter(Boolean) as string[];
    const apply = (ids: string[], forPts: number, againstPts: number) => {
      for (const id of ids) {
        const row = rows.get(id);
        if (!row) continue;
        row.played += 1;
        row.pointsFor += forPts;
        row.pointsAgainst += againstPts;
        if (forPts > againstPts) row.wins += 1;
        else if (forPts < againstPts) row.losses += 1;
        else row.draws += 1;
      }
    };
    apply(team1, m.score1, m.score2);
    apply(team2, m.score2, m.score1);
  }

  const list = [...rows.values()];
  for (const r of list) r.diff = r.pointsFor - r.pointsAgainst;
  list.sort(
    (a, b) =>
      b.pointsFor - a.pointsFor || b.wins - a.wins || b.diff - a.diff || a.name.localeCompare(b.name),
  );
  return list;
}
