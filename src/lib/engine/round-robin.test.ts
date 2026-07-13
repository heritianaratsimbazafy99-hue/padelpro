import { test } from "node:test";
import assert from "node:assert/strict";
import { auditFixedCycle, generateFixedCycle } from "./round-robin.ts";

const teams = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    teamNumber: i + 1,
    playerIds: [`p${i * 2 + 1}`, `p${i * 2 + 2}`] as [string, string],
  }));

test("3 fixed teams play a complete 3-round cycle", () => {
  const input = teams(3);
  const rounds = generateFixedCycle({
    teams: input,
    courts: 1,
    cycleNumber: 1,
    startRoundNumber: 1,
  });
  assert.equal(rounds.length, 3);
  assert.equal(rounds.flatMap((round) => round.matches).length, 3);
  assert.deepEqual(auditFixedCycle(input, rounds, 1), {
    matchCount: 3,
    missingPairings: 0,
    repeatedPairings: 0,
    membershipConflicts: 0,
    restConflicts: 0,
    teamRoundConflicts: 0,
    courtConflicts: 0,
    playSpread: 0,
    restSpread: 0,
  });
});

test("court waves expand a 5-team cycle", () => {
  const input = teams(5);
  const oneCourt = generateFixedCycle({
    teams: input,
    courts: 1,
    cycleNumber: 1,
    startRoundNumber: 1,
  });
  const twoCourts = generateFixedCycle({
    teams: input,
    courts: 2,
    cycleNumber: 1,
    startRoundNumber: 1,
  });
  assert.equal(oneCourt.length, 10);
  assert.equal(twoCourts.length, 5);
  for (const [rounds, courts] of [
    [oneCourt, 1],
    [twoCourts, 2],
  ] as const) {
    const audit = auditFixedCycle(input, rounds, courts);
    assert.equal(audit.matchCount, 10);
    assert.equal(audit.missingPairings, 0);
    assert.equal(audit.repeatedPairings, 0);
    assert.equal(audit.membershipConflicts, 0);
    assert.equal(audit.restConflicts, 0);
    assert.equal(audit.teamRoundConflicts, 0);
    assert.equal(audit.courtConflicts, 0);
    assert.equal(audit.playSpread, 0);
    assert.equal(audit.restSpread, 0);
  }
});

test("6 fixed teams respect two court waves without duplicate pairings", () => {
  const input = teams(6);
  const rounds = generateFixedCycle({
    teams: input,
    courts: 2,
    cycleNumber: 1,
    startRoundNumber: 1,
  });
  assert.equal(rounds.length, 10);
  assert.deepEqual(auditFixedCycle(input, rounds, 2), {
    matchCount: 15,
    missingPairings: 0,
    repeatedPairings: 0,
    membershipConflicts: 0,
    restConflicts: 0,
    teamRoundConflicts: 0,
    courtConflicts: 0,
    playSpread: 0,
    restSpread: 0,
  });
});

test("14 players form 7 fixed teams with a complete two-court cycle", () => {
  const input = teams(7);
  const rounds = generateFixedCycle({
    teams: input,
    courts: 2,
    cycleNumber: 1,
    startRoundNumber: 1,
  });
  assert.equal(rounds.length, 14);
  assert.deepEqual(auditFixedCycle(input, rounds, 2), {
    matchCount: 21,
    missingPairings: 0,
    repeatedPairings: 0,
    membershipConflicts: 0,
    restConflicts: 0,
    teamRoundConflicts: 0,
    courtConflicts: 0,
    playSpread: 0,
    restSpread: 0,
  });
});

test("audit rejects a mixed team and an incorrect resting list", () => {
  const input = teams(3);
  const rounds = generateFixedCycle({
    teams: input,
    courts: 1,
    cycleNumber: 1,
    startRoundNumber: 1,
  });
  rounds[0].matches[0].team1[1] = rounds[0].matches[0].team2[0];
  rounds[0].resting = [];
  const audit = auditFixedCycle(input, rounds, 1);
  assert.ok(audit.membershipConflicts > 0);
  assert.ok(audit.restConflicts > 0);
});

test("cycle 2 keeps teams, continues rounds and reverses orientation", () => {
  const input = teams(3);
  const first = generateFixedCycle({
    teams: input,
    courts: 1,
    cycleNumber: 1,
    startRoundNumber: 1,
  });
  const second = generateFixedCycle({
    teams: input,
    courts: 1,
    cycleNumber: 2,
    startRoundNumber: 4,
  });
  assert.deepEqual(
    second.map((round) => round.roundNumber),
    [4, 5, 6],
  );
  const pair = first[0].matches[0];
  const pairPlayers = [...pair.team1, ...pair.team2].sort().join("|");
  const reverse = second
    .flatMap((round) => round.matches)
    .find((match) => [...match.team1, ...match.team2].sort().join("|") === pairPlayers);
  assert.ok(reverse);
  assert.deepEqual([...reverse.team1].sort(), [...pair.team2].sort());
  assert.deepEqual([...reverse.team2].sort(), [...pair.team1].sort());
  const audit = auditFixedCycle(input, second, 1);
  assert.equal(audit.missingPairings, 0);
  assert.equal(audit.repeatedPairings, 0);
  assert.equal(audit.membershipConflicts, 0);
  assert.equal(audit.restConflicts, 0);
});

test("fixed cycle rejects invalid lower bounds", () => {
  assert.throws(
    () =>
      generateFixedCycle({
        teams: teams(1),
        courts: 1,
        cycleNumber: 1,
        startRoundNumber: 1,
      }),
    /au moins 2 équipes/i,
  );

  const input = teams(3);
  assert.throws(
    () => generateFixedCycle({ teams: input, courts: 0, cycleNumber: 1, startRoundNumber: 1 }),
    /au moins un terrain/i,
  );
  assert.throws(
    () => generateFixedCycle({ teams: input, courts: 1, cycleNumber: 0, startRoundNumber: 1 }),
    /numéro de cycle ou round invalide/i,
  );
  assert.throws(
    () => generateFixedCycle({ teams: input, courts: 1, cycleNumber: 1, startRoundNumber: 0 }),
    /numéro de cycle ou round invalide/i,
  );
});

test("fixed cycle public numeric parameters must be safe integers", () => {
  const input = teams(3);
  const options = {
    teams: input,
    courts: 1,
    cycleNumber: 1,
    startRoundNumber: 1,
  };
  const invalidValues = [1.5, Number.NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1];
  const cases = [
    ["courts", /terrains.*entier sûr/i],
    ["cycleNumber", /cycle.*entier sûr/i],
    ["startRoundNumber", /round.*entier sûr/i],
  ] as const;

  for (const [option, expectedMessage] of cases) {
    for (const value of invalidValues) {
      assert.throws(
        () => generateFixedCycle({ ...options, [option]: value }),
        expectedMessage,
        `${option}=${value} doit être rejeté`,
      );
    }
  }

  for (const courts of invalidValues) {
    assert.throws(
      () => auditFixedCycle(input, [], courts),
      /terrains.*entier sûr/i,
      `audit courts=${courts} doit être rejeté`,
    );
  }
});

test("fixed cycle rejects a round range that would exceed the safe integer limit", () => {
  const input = teams(3);
  const lastSafeStart = Number.MAX_SAFE_INTEGER - 2;
  const boundary = generateFixedCycle({
    teams: input,
    courts: 1,
    cycleNumber: 1,
    startRoundNumber: lastSafeStart,
  });
  assert.deepEqual(
    boundary.map((round) => round.roundNumber),
    [lastSafeStart, lastSafeStart + 1, Number.MAX_SAFE_INTEGER],
  );

  assert.throws(
    () =>
      generateFixedCycle({
        teams: input,
        courts: 1,
        cycleNumber: 1,
        startRoundNumber: Number.MAX_SAFE_INTEGER,
      }),
    /dernier numéro de round.*entier sûr/i,
  );
});

test("generate and audit reject malformed fixed-team rosters", () => {
  const invalidRosters = [
    {
      label: "non-positive team number",
      roster: [
        { teamNumber: 0, playerIds: ["p1", "p2"] },
        { teamNumber: 2, playerIds: ["p3", "p4"] },
      ],
      message: /numéro d'équipe.*entier sûr positif/i,
    },
    {
      label: "unsafe team number",
      roster: [
        { teamNumber: Number.MAX_SAFE_INTEGER + 1, playerIds: ["p1", "p2"] },
        { teamNumber: 2, playerIds: ["p3", "p4"] },
      ],
      message: /numéro d'équipe.*entier sûr positif/i,
    },
    {
      label: "duplicate team number",
      roster: [
        { teamNumber: 1, playerIds: ["p1", "p2"] },
        { teamNumber: 1, playerIds: ["p3", "p4"] },
      ],
      message: /numéros d'équipe.*uniques/i,
    },
    {
      label: "one player",
      roster: [
        { teamNumber: 1, playerIds: ["p1"] },
        { teamNumber: 2, playerIds: ["p3", "p4"] },
      ],
      message: /exactement deux identifiants/i,
    },
    {
      label: "three players",
      roster: [
        { teamNumber: 1, playerIds: ["p1", "p2", "p3"] },
        { teamNumber: 2, playerIds: ["p4", "p5"] },
      ],
      message: /exactement deux identifiants/i,
    },
    {
      label: "non-string player id",
      roster: [
        { teamNumber: 1, playerIds: ["p1", 42] },
        { teamNumber: 2, playerIds: ["p3", "p4"] },
      ],
      message: /identifiants.*chaînes non vides/i,
    },
    {
      label: "blank player id",
      roster: [
        { teamNumber: 1, playerIds: ["p1", "   "] },
        { teamNumber: 2, playerIds: ["p3", "p4"] },
      ],
      message: /identifiants.*chaînes non vides/i,
    },
    {
      label: "duplicate player within a team",
      roster: [
        { teamNumber: 1, playerIds: ["p1", "p1"] },
        { teamNumber: 2, playerIds: ["p3", "p4"] },
      ],
      message: /joueurs d'une équipe.*distincts/i,
    },
    {
      label: "duplicate player across teams",
      roster: [
        { teamNumber: 1, playerIds: ["p1", "p2"] },
        { teamNumber: 2, playerIds: ["p2", "p4"] },
      ],
      message: /identifiants.*uniques entre les équipes/i,
    },
  ] as const;

  for (const { label, roster: malformedRoster, message } of invalidRosters) {
    const roster = malformedRoster as unknown as ReturnType<typeof teams>;
    assert.throws(
      () =>
        generateFixedCycle({
          teams: roster,
          courts: 1,
          cycleNumber: 1,
          startRoundNumber: 1,
        }),
      message,
      `generate: ${label}`,
    );
    assert.throws(
      () => auditFixedCycle(roster, [], 1),
      message,
      `audit: ${label}`,
    );
  }
});

test("audit rejects non-positive court counts", () => {
  const input = teams(3);
  for (const courts of [0, -1]) {
    assert.throws(
      () => auditFixedCycle(input, [], courts),
      /au moins un terrain/i,
      `audit courts=${courts} doit être rejeté`,
    );
  }
});

test("audit counts every invalid or duplicate match court", () => {
  const input = teams(3);
  for (const invalidCourt of [Number.NaN, 1.5, Number.MAX_SAFE_INTEGER + 1, 0, 2]) {
    const rounds = generateFixedCycle({
      teams: input,
      courts: 1,
      cycleNumber: 1,
      startRoundNumber: 1,
    });
    rounds[0].matches[0].court = invalidCourt;
    assert.equal(
      auditFixedCycle(input, rounds, 1).courtConflicts,
      1,
      `court=${invalidCourt} doit créer un conflit`,
    );
  }

  const fourTeams = teams(4);
  const duplicateCourtRounds = generateFixedCycle({
    teams: fourTeams,
    courts: 2,
    cycleNumber: 1,
    startRoundNumber: 1,
  });
  duplicateCourtRounds[0].matches[1].court = duplicateCourtRounds[0].matches[0].court;
  assert.equal(auditFixedCycle(fourTeams, duplicateCourtRounds, 2).courtConflicts, 1);
});

test("audit keeps tracking a repeated valid team when its opponents are invalid", () => {
  const input = teams(3);
  const rounds = [
    {
      roundNumber: 1,
      matches: [
        {
          court: 1,
          team1: [...input[0].playerIds] as [string, string],
          team2: ["unknown-1", "unknown-2"] as [string, string],
        },
        {
          court: 2,
          team1: ["unknown-3", "unknown-4"] as [string, string],
          team2: [...input[0].playerIds] as [string, string],
        },
      ],
      resting: [...input[1].playerIds, ...input[2].playerIds],
    },
  ];

  const audit = auditFixedCycle(input, rounds, 2);
  assert.equal(audit.membershipConflicts, 2);
  assert.equal(audit.teamRoundConflicts, 1);
  assert.equal(audit.missingPairings, 3);
  assert.equal(audit.repeatedPairings, 0);
  assert.equal(audit.playSpread, 1);
  assert.equal(audit.restSpread, 1);
});
