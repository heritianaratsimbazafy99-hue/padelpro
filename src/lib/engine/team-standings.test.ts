import { test } from "node:test";
import assert from "node:assert/strict";
import type { EventPlayer, Match, TeamStandingRow } from "../types.ts";
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
  team1: [string | null, string | null],
  team2: [string | null, string | null],
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

function standingStats(row: TeamStandingRow) {
  return {
    played: row.played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    pointsFor: row.pointsFor,
    pointsAgainst: row.pointsAgainst,
    diff: row.diff,
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

test("matches with malformed fixed-team sides are ignored entirely", () => {
  const malformed = [
    result("missing-p2", 1, ["a", null], ["c", "d"], 14, 10),
    result("unknown-p2", 2, ["a", "b"], ["c", "unknown"], 14, 10),
    result("duplicate-p2", 3, ["a", "a"], ["c", "d"], 14, 10),
    result("foreign-p2", 4, ["a", "b"], ["c", "e"], 14, 10),
  ];
  const empty = {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    diff: 0,
  };

  for (const match of malformed) {
    const rows = computeTeamStandings(players, [match]);
    assert.deepEqual(rows.map(standingStats), [empty, empty, empty], match.id);
  }
});

test("malformed direct confrontations do not break a two-team tie", () => {
  const rows = computeTeamStandings(players, [
    result("a-c", 1, ["a", "b"], ["e", "f"], 10, 5),
    result("b-c", 2, ["c", "d"], ["e", "f"], 10, 5),
    result("direct-missing", 3, ["c", null], ["a", "b"], 20, 0),
    result("direct-unknown", 4, ["c", "unknown"], ["a", "b"], 20, 0),
    result("direct-duplicate", 5, ["c", "c"], ["a", "b"], 20, 0),
    result("direct-foreign", 6, ["c", "e"], ["a", "b"], 20, 0),
  ]);

  assert.deepEqual(rows.map((row) => row.teamNumber), [1, 2, 3]);
});

test("reversed orientation keeps complete team statistics symmetric", () => {
  const rows = computeTeamStandings(players, [
    result("reverse-win", 1, ["c", "d"], ["a", "b"], 10, 14),
    result("reverse-draw", 2, ["c", "d"], ["a", "b"], 12, 12),
  ]);
  const first = rows.find((row) => row.teamNumber === 1)!;
  const second = rows.find((row) => row.teamNumber === 2)!;

  assert.deepEqual(standingStats(first), {
    played: 2,
    wins: 1,
    draws: 1,
    losses: 0,
    pointsFor: 26,
    pointsAgainst: 22,
    diff: 4,
  });
  assert.deepEqual(standingStats(first), {
    played: second.played,
    wins: second.losses,
    draws: second.draws,
    losses: second.wins,
    pointsFor: second.pointsAgainst,
    pointsAgainst: second.pointsFor,
    diff: -second.diff,
  });
});
