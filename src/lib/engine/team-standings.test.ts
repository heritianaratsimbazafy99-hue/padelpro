import { test } from "node:test";
import assert from "node:assert/strict";
import type { EventPlayer, Match } from "../types.ts";
import { computeTeamStandings } from "./team-standings.ts";

const players: EventPlayer[] = [
  ["a", "Alice", 1], ["b", "Bob", 1],
  ["c", "Chloé", 2], ["d", "Dany", 2],
  ["e", "Emma", 3], ["f", "Félix", 3],
].map(([id, display_name, team_number]) => ({
  id: String(id),
  event_id: "event-1",
  display_name: String(display_name),
  profile_id: null,
  level: 5,
  seed: 0,
  preferred_side: null,
  team_number: Number(team_number),
  created_at: "2026-07-13T00:00:00.000Z",
}));

function result(
  id: string,
  round: number,
  team1: [string, string],
  team2: [string, string],
  score1: number | null,
  score2: number | null,
  cycle = 1,
): Match {
  return {
    id,
    event_id: "event-1",
    round_number: round,
    cycle_number: cycle,
    court: 1,
    team1_p1: team1[0],
    team1_p2: team1[1],
    team2_p1: team2[0],
    team2_p2: team2[1],
    score1,
    score2,
    status: score1 == null || score2 == null ? "pending" : "done",
    bracket_pos: null,
    next_match_pos: null,
    next_match_slot: null,
    reported_by: null,
    created_at: "2026-07-13T00:00:00.000Z",
  };
}

test("team standings aggregate results and ignore pending matches", () => {
  const rows = computeTeamStandings(players, [
    result("m1", 1, ["a", "b"], ["c", "d"], 14, 10),
    result("m2", 2, ["a", "b"], ["e", "f"], 12, 12),
    result("m3", 3, ["c", "d"], ["e", "f"], null, null),
  ]);
  const first = rows.find((row) => row.teamNumber === 1)!;
  assert.deepEqual(
    { played: first.played, wins: first.wins, draws: first.draws, pointsFor: first.pointsFor, diff: first.diff },
    { played: 2, wins: 1, draws: 1, pointsFor: 26, diff: 4 },
  );
});

test("two tied teams use aggregated direct confrontation", () => {
  const rows = computeTeamStandings(players, [
    result("ab-1", 1, ["a", "b"], ["c", "d"], 14, 10),
    result("ac", 2, ["a", "b"], ["e", "f"], 24, 0),
    result("bc", 3, ["c", "d"], ["e", "f"], 16, 8),
    result("ab-2", 4, ["a", "b"], ["c", "d"], 6, 18, 2),
  ]);
  assert.equal(rows[0].teamNumber, 2);
});

test("three fully tied teams use a stable label", () => {
  const rows = computeTeamStandings(players, [
    result("ab", 1, ["a", "b"], ["c", "d"], 12, 12),
    result("ac", 2, ["a", "b"], ["e", "f"], 12, 12),
    result("bc", 3, ["c", "d"], ["e", "f"], 12, 12),
  ]);
  assert.deepEqual(rows.map((row) => row.label), [...rows.map((row) => row.label)].sort());
});
