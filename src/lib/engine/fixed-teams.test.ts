import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assignmentsFromTeams,
  composeFixedTeams,
  fixedTeamsFromAssignments,
  swapAssignments,
} from "./fixed-teams.ts";

test("persisted manual teams accept non-contiguous team numbers", () => {
  const teams = fixedTeamsFromAssignments([
    { id: "a", level: 8, teamNumber: 2 },
    { id: "b", level: 2, teamNumber: 2 },
    { id: "c", level: 7, teamNumber: 9 },
    { id: "d", level: 3, teamNumber: 9 },
  ]);
  assert.deepEqual(teams.map((team) => team.teamNumber), [2, 9]);
});

test("manual assignments reject incomplete teams", () => {
  assert.throws(
    () =>
      fixedTeamsFromAssignments([
        { id: "a", level: 5, teamNumber: 1 },
        { id: "b", level: 5, teamNumber: 1 },
        { id: "c", level: 5, teamNumber: null },
        { id: "d", level: 5, teamNumber: 2 },
      ]),
    /exactement deux|sans équipe/i,
  );
  assert.throws(
    () => fixedTeamsFromAssignments([
      { id: "a", level: 5, teamNumber: 0 },
      { id: "b", level: 5, teamNumber: 0 },
      { id: "c", level: 5, teamNumber: 2 },
      { id: "d", level: 5, teamNumber: 2 },
    ]),
    /numéro d'équipe/i,
  );
});

test("balanced fixed composition pairs strong with weak", () => {
  const teams = composeFixedTeams(
    [
      { id: "a", level: 10 },
      { id: "b", level: 8 },
      { id: "c", level: 4 },
      { id: "d", level: 1 },
    ],
    "balanced",
  );
  assert.deepEqual(teams[0].playerIds, ["a", "d"]);
  assert.deepEqual(teams[1].playerIds, ["b", "c"]);
});

test("balanced composition avoids identical strict sides when possible", () => {
  const teams = composeFixedTeams(
    [
      { id: "g1", level: 8, side: "left" },
      { id: "g2", level: 7, side: "left" },
      { id: "d1", level: 3, side: "right" },
      { id: "d2", level: 2, side: "right" },
    ],
    "balanced",
  );
  const sideOf = new Map([["g1", "left"], ["g2", "left"], ["d1", "right"], ["d2", "right"]]);
  assert.ok(teams.every((team) => sideOf.get(team.playerIds[0]) !== sideOf.get(team.playerIds[1])));
});

test("balanced composition minimizes side conflicts across all teams", () => {
  const teams = composeFixedTeams(
    [
      { id: "F10", level: 10, side: "both" },
      { id: "L9", level: 9, side: "left" },
      { id: "L8", level: 8, side: "left" },
      { id: "L7", level: 7, side: "left" },
      { id: "F6", level: 6, side: "both" },
      { id: "R1", level: 1, side: "right" },
    ],
    "balanced",
  );
  const leftIds = new Set(["L9", "L8", "L7"]);
  assert.equal(
    teams.filter((team) => team.playerIds.every((id) => leftIds.has(id))).length,
    0,
  );
});

test("fixed composition rejects duplicate player identifiers", () => {
  assert.throws(
    () => composeFixedTeams([
      { id: "a", level: 8 },
      { id: "a", level: 7 },
      { id: "b", level: 3 },
      { id: "c", level: 2 },
    ], "balanced"),
    /identifiant.*dupliqu/i,
  );
});

test("persisted assignments reject duplicate player identifiers", () => {
  assert.throws(
    () => fixedTeamsFromAssignments([
      { id: "a", level: 8, teamNumber: 1 },
      { id: "b", level: 7, teamNumber: 1 },
      { id: "a", level: 3, teamNumber: 2 },
      { id: "c", level: 2, teamNumber: 2 },
    ]),
    /identifiant.*dupliqu/i,
  );
});

test("team assignments reject duplicate player identifiers", () => {
  assert.throws(
    () => assignmentsFromTeams([
      { teamNumber: 1, playerIds: ["a", "b"] },
      { teamNumber: 2, playerIds: ["a", "c"] },
    ]),
    /identifiant.*dupliqu/i,
  );
});

test("random fixed composition is reproducible with an injected source", () => {
  const roster = ["a", "b", "c", "d", "e", "f"].map((id) => ({ id, level: 5 }));
  const constant = () => 0.25;
  assert.deepEqual(
    composeFixedTeams(roster, "random", constant),
    composeFixedTeams(roster, "random", constant),
  );
});

test("swapping two players preserves complete team numbers", () => {
  assert.deepEqual(swapAssignments({ a: 1, b: 1, c: 2, d: 2 }, "b", "c"), {
    a: 1,
    b: 2,
    c: 1,
    d: 2,
  });
});
