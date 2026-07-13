import type { EventPlayer, Match, TeamStandingRow } from "../types.ts";
import { fixedTeamsFromAssignments } from "./fixed-teams.ts";

const baseCompare = (a: TeamStandingRow, b: TeamStandingRow) =>
  b.wins - a.wins || b.diff - a.diff || b.pointsFor - a.pointsFor;

function directStats(
  first: number,
  second: number,
  matches: readonly Match[],
  teamOf: ReadonlyMap<string, number>,
) {
  const stats = new Map([
    [first, { wins: 0, diff: 0, points: 0 }],
    [second, { wins: 0, diff: 0, points: 0 }],
  ]);
  for (const match of matches) {
    if (match.status !== "done" || match.score1 == null || match.score2 == null) continue;
    const team1 = match.team1_p1 ? teamOf.get(match.team1_p1) : undefined;
    const team2 = match.team2_p1 ? teamOf.get(match.team2_p1) : undefined;
    if (new Set([team1, team2]).size !== 2 || ![team1, team2].includes(first) || ![team1, team2].includes(second)) continue;
    const apply = (team: number, own: number, against: number) => {
      const row = stats.get(team)!;
      row.points += own;
      row.diff += own - against;
      if (own > against) row.wins++;
    };
    apply(team1!, match.score1, match.score2);
    apply(team2!, match.score2, match.score1);
  }
  return stats;
}

function rankTeamRows(
  rows: TeamStandingRow[],
  matches: readonly Match[],
  teamOf: ReadonlyMap<string, number>,
): TeamStandingRow[] {
  const base = [...rows].sort((a, b) => baseCompare(a, b) || a.label.localeCompare(b.label));
  const ranked: TeamStandingRow[] = [];
  for (let start = 0; start < base.length; ) {
    let end = start + 1;
    while (end < base.length && baseCompare(base[start], base[end]) === 0) end++;
    const group = base.slice(start, end);
    if (group.length === 2) {
      const stats = directStats(group[0].teamNumber, group[1].teamNumber, matches, teamOf);
      group.sort((a, b) => {
        const left = stats.get(a.teamNumber)!;
        const right = stats.get(b.teamNumber)!;
        return right.wins - left.wins || right.diff - left.diff || right.points - left.points || a.label.localeCompare(b.label);
      });
    } else {
      group.sort((a, b) => a.label.localeCompare(b.label));
    }
    ranked.push(...group);
    start = end;
  }
  return ranked;
}

export function computeTeamStandings(
  players: readonly EventPlayer[],
  matches: readonly Match[],
): TeamStandingRow[] {
  const teams = fixedTeamsFromAssignments(
    players.map((player) => ({
      id: player.id,
      level: player.level,
      side: player.preferred_side,
      teamNumber: player.team_number,
    })),
  );
  const playerById = new Map(players.map((player) => [player.id, player]));
  const teamOf = new Map(teams.flatMap((team) => team.playerIds.map((id) => [id, team.teamNumber] as const)));
  const rows = teams.map<TeamStandingRow>((team) => {
    const members = team.playerIds.map((id) => playerById.get(id)!);
    const names = members.map((member) => member.display_name).sort((a, b) => a.localeCompare(b)) as [string, string];
    return {
      teamNumber: team.teamNumber,
      playerIds: team.playerIds,
      names,
      label: names.join(" & "),
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      diff: 0,
    };
  });
  const rowOf = new Map(rows.map((row) => [row.teamNumber, row]));
  for (const match of matches) {
    if (match.status !== "done" || match.score1 == null || match.score2 == null) continue;
    const first = match.team1_p1 ? teamOf.get(match.team1_p1) : undefined;
    const second = match.team2_p1 ? teamOf.get(match.team2_p1) : undefined;
    if (first == null || second == null || first === second) continue;
    const apply = (teamNumber: number, own: number, against: number) => {
      const row = rowOf.get(teamNumber)!;
      row.played++;
      row.pointsFor += own;
      row.pointsAgainst += against;
      row.diff = row.pointsFor - row.pointsAgainst;
      if (own > against) row.wins++;
      else if (own < against) row.losses++;
      else row.draws++;
    };
    apply(first, match.score1, match.score2);
    apply(second, match.score2, match.score1);
  }
  return rankTeamRows(rows, matches, teamOf);
}
