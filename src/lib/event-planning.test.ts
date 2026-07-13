import { test } from "node:test";
import assert from "node:assert/strict";
import type { EventPlayer, Match, PadelEvent } from "./types.ts";
import {
  plannedRoundsFromMatches,
  planAmericanoCycle,
} from "./event-planning.ts";
import { friendlyError } from "./utils.ts";

const ids = ["a", "b", "c", "d", "e", "f"];

function playersWithTeams(teamNumbers: Array<number | null>): EventPlayer[] {
  return ids.map((id, index) => ({
    id,
    event_id: "event-1",
    display_name: `Joueur ${id.toUpperCase()}`,
    profile_id: null,
    level: 5,
    seed: index + 1,
    preferred_side: null,
    team_number: teamNumbers[index],
    created_at: "2026-07-13T00:00:00.000Z",
  }));
}

const fixedPlayers = () => playersWithTeams([1, 1, 2, 2, 3, 3]);
const remixedPlayers = () => playersWithTeams([null, null, null, null, null, null]);

function americanoEvent(
  teamMode: "fixed" | "remixed",
  status: "draft" | "active" | "completed",
): PadelEvent {
  return {
    id: "event-1",
    organizer_id: "organizer-1",
    name: "Cycle test",
    format: "americano",
    status,
    share_code: "ABC123",
    settings: {
      points_per_match: 24,
      courts: 1,
      rounds: 3,
      pairing: "random",
      team_mode: teamMode,
      composition: teamMode === "fixed" ? "manual" : "random",
      rounds_per_cycle: 3,
    },
    current_round: status === "draft" ? 0 : 1,
    created_at: "2026-07-13T00:00:00.000Z",
    scheduled_at: null,
  };
}

const fixedEvent = () => americanoEvent("fixed", "draft");
const remixedEvent = () => americanoEvent("remixed", "active");

function playedMatch(
  id: string,
  round: number,
  team1: [string, string],
  team2: [string, string],
  done = true,
  cycle = 1,
  court = 1,
): Match {
  return {
    id,
    event_id: "event-1",
    round_number: round,
    cycle_number: cycle,
    court,
    team1_p1: team1[0],
    team1_p2: team1[1],
    team2_p1: team2[0],
    team2_p2: team2[1],
    score1: done ? 12 : null,
    score2: done ? 12 : null,
    status: done ? "done" : "pending",
    bracket_pos: null,
    next_match_pos: null,
    next_match_slot: null,
    reported_by: done ? "test" : null,
    created_at: "2026-07-13T00:00:00.000Z",
  };
}

const completedCycleOne = () => [
  playedMatch("m1", 1, ["a", "b"], ["c", "d"]),
  playedMatch("m2", 2, ["a", "e"], ["b", "f"]),
  playedMatch("m3", 3, ["c", "e"], ["d", "f"]),
];

const pendingCycleOne = () => [
  ...completedCycleOne().slice(0, 2),
  playedMatch("m3", 3, ["c", "e"], ["d", "f"], false),
];

function asPlayedMatches(
  event: PadelEvent,
  plan: ReturnType<typeof planAmericanoCycle>,
): Match[] {
  return plan.matches.map((row, index) => ({
    ...playedMatch(
      `fixed-${index + 1}`,
      row.round_number,
      [row.team1_p1, row.team1_p2],
      [row.team2_p1, row.team2_p2],
      true,
      plan.expectedCycle,
      row.court,
    ),
    event_id: event.id,
  }));
}

test("fixed initial plan uses persisted teams as complete match sides", () => {
  const players = fixedPlayers();
  const teamOf = new Map(players.map((player) => [player.id, player.team_number]));
  const result = planAmericanoCycle(fixedEvent(), players, []);

  assert.equal(result.expectedCycle, 1);
  assert.deepEqual([...new Set(result.matches.map((row) => row.round_number))], [1, 2, 3]);
  assert.equal(result.matches.length, 3);
  for (const match of result.matches) {
    assert.equal(teamOf.get(match.team1_p1), teamOf.get(match.team1_p2));
    assert.equal(teamOf.get(match.team2_p1), teamOf.get(match.team2_p2));
    assert.notEqual(teamOf.get(match.team1_p1), teamOf.get(match.team2_p1));
  }
});

test("fixed cycle 2 starts at round 4 and reverses each persisted matchup orientation", () => {
  const draft = fixedEvent();
  const players = fixedPlayers();
  const first = planAmericanoCycle(draft, players, []);
  const history = asPlayedMatches(draft, first);
  const second = planAmericanoCycle({ ...draft, status: "active" }, players, history);

  assert.equal(second.expectedCycle, 2);
  assert.deepEqual([...new Set(second.matches.map((row) => row.round_number))], [4, 5, 6]);

  const firstByPairing = new Map(
    first.matches.map((match) => {
      const side1 = [match.team1_p1, match.team1_p2].sort().join("|");
      const side2 = [match.team2_p1, match.team2_p2].sort().join("|");
      return [[side1, side2].sort().join("::"), { side1, side2 }] as const;
    }),
  );
  for (const match of second.matches) {
    const side1 = [match.team1_p1, match.team1_p2].sort().join("|");
    const side2 = [match.team2_p1, match.team2_p2].sort().join("|");
    const previous = firstByPairing.get([side1, side2].sort().join("::"));
    assert.ok(previous);
    assert.equal(side1, previous.side2);
    assert.equal(side2, previous.side1);
  }
});

test("remixed next plan reconstructs history and starts cycle 2 at round 4", () => {
  const result = planAmericanoCycle(remixedEvent(), remixedPlayers(), completedCycleOne());
  assert.equal(result.expectedCycle, 2);
  assert.deepEqual([...new Set(result.matches.map((row) => row.round_number))], [4, 5, 6]);
});

test("planned round adapter sorts rounds and courts and derives resting players", () => {
  const playerIds = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  const matches = [
    playedMatch("r2c2", 2, ["a", "b"], ["c", "d"], true, 1, 2),
    playedMatch("r1c2", 1, ["e", "f"], ["g", "h"], true, 1, 2),
    playedMatch("r1c1", 1, ["a", "c"], ["b", "d"], true, 1, 1),
  ];

  const rounds = plannedRoundsFromMatches(playerIds, matches);

  assert.deepEqual(rounds.map((round) => round.roundNumber), [1, 2]);
  assert.deepEqual(rounds[0].matches.map((match) => match.court), [1, 2]);
  assert.deepEqual(rounds[0].resting, ["i"]);
  assert.deepEqual(rounds[1].resting, ["e", "f", "g", "h", "i"]);
});

test("planned round adapter rejects a database match with a null player slot", () => {
  const invalid = {
    ...playedMatch("invalid", 1, ["a", "b"], ["c", "d"]),
    team2_p2: null,
  };
  assert.throws(
    () => plannedRoundsFromMatches(ids, [invalid]),
    /invalid_cycle_payload/,
  );
});

test("planner rejects a non-Americano event", () => {
  assert.throws(
    () => planAmericanoCycle({ ...fixedEvent(), format: "mexicano" }, fixedPlayers(), []),
    /invalid_event_format/,
  );
});

test("active Americano without any match rejects an unexpected initial cycle", () => {
  assert.throws(
    () => planAmericanoCycle({ ...fixedEvent(), status: "active" }, fixedPlayers(), []),
    /unexpected_cycle/,
  );
});

test("next plan rejects an unfinished current cycle", () => {
  assert.throws(
    () => planAmericanoCycle(remixedEvent(), remixedPlayers(), pendingCycleOne()),
    /cycle_incomplete/,
  );
});

test("done status with a null score still leaves the current cycle incomplete", () => {
  const invalidHistory = completedCycleOne();
  invalidHistory[2] = { ...invalidHistory[2], score2: null };
  assert.throws(
    () => planAmericanoCycle(remixedEvent(), remixedPlayers(), invalidHistory),
    /cycle_incomplete/,
  );
});

test("next plan rejects a completed event", () => {
  assert.throws(
    () =>
      planAmericanoCycle(
        { ...remixedEvent(), status: "completed" },
        remixedPlayers(),
        completedCycleOne(),
      ),
    /event_not_active/,
  );
});

test("fixed planning rejects settings whose configured cycle length disagrees with the engine", () => {
  const event = fixedEvent();
  assert.throws(
    () =>
      planAmericanoCycle(
        {
          ...event,
          settings: { ...event.settings, rounds: 2, rounds_per_cycle: 2 },
        },
        fixedPlayers(),
        [],
      ),
    /invalid_cycle_payload/,
  );
});

test("friendly errors cover every transactional cycle code without losing existing mappings", () => {
  const expected = new Map([
    ["not_event_organizer", "Seul l'organisateur peut effectuer cette action."],
    ["invalid_event_format", "Ce format d'événement ne permet pas cette action."],
    ["invalid_roster_payload", "La liste des joueurs est invalide."],
    ["fixed_teams_invalid", "Chaque équipe fixe doit contenir exactement deux joueurs."],
    ["invalid_cycle_payload", "Le planning du cycle est invalide."],
    ["cycle_incomplete", "Termine tous les matchs du cycle en cours avant de continuer."],
    ["cycle_already_added", "Ce cycle a déjà été ajouté."],
    ["unexpected_cycle", "Le prochain cycle n'est plus à jour. Recharge la page."],
    ["event_not_active", "L'événement n'est pas en cours."],
    ["event_locked", "Cet événement ne peut plus être modifié."],
    ["roster_locked", "La liste des joueurs est verrouillée après le lancement."],
    ["roster_write_forbidden", "Cette modification de la liste des joueurs est interdite."],
    ["match_write_forbidden", "Cette modification des matchs est interdite."],
    [
      "score_sum_mismatch",
      "Le total des deux scores doit être égal aux points du match.",
    ],
    ["invalid_share_code", "Code de partage invalide."],
    ["draw_not_allowed", "Un match de tournoi ne peut pas être nul."],
    ["match_not_found", "Match introuvable."],
  ]);

  for (const [code, message] of expected) {
    assert.equal(friendlyError(`PostgREST: ${code}`), message, code);
  }
});
