import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateAmericanoSchedule,
  generateRemixedCycle,
  generateMexicanoRound,
  auditSchedule,
  historyFromRounds,
  sideConflict,
  type EnginePlayer,
  type PlannedRound,
} from "./americano.ts";
import { buildBracket, seedOrder, composeTeams, nextPowerOfTwo } from "./bracket.ts";

function makePlayers(n: number): EnginePlayer[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, level: (i % 10) + 1 }));
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function assertRoundIntegrity(players: EnginePlayer[], schedule: PlannedRound[], courts: number) {
  for (const round of schedule) {
    const seen = new Set<string>();
    assert.ok(round.matches.length <= courts, "pas plus de matchs que de terrains");
    for (const m of round.matches) {
      for (const id of [...m.team1, ...m.team2]) {
        assert.ok(!seen.has(id), `joueur ${id} en double dans le round ${round.roundNumber}`);
        seen.add(id);
      }
    }
    for (const id of round.resting) {
      assert.ok(!seen.has(id), `joueur ${id} au repos ET en match`);
      seen.add(id);
    }
    assert.equal(seen.size, players.length, "chaque joueur est soit en match soit au repos");
  }
}

test("remixed cycle for 6 players is fair and continues global rounds", () => {
  const players = makePlayers(6);
  const first = generateRemixedCycle({
    players,
    roundsPerCycle: 3,
    courts: 1,
    mode: "random",
    random: mulberry32(42),
  });
  const second = generateRemixedCycle({
    players,
    roundsPerCycle: 3,
    courts: 1,
    mode: "random",
    previousRounds: first,
    random: mulberry32(84),
  });
  assert.deepEqual(first.map((r) => r.roundNumber), [1, 2, 3]);
  assert.deepEqual(second.map((r) => r.roundNumber), [4, 5, 6]);
  assertRoundIntegrity(players, [...first, ...second], 1);
  const audit = auditSchedule(players, [...first, ...second]);
  assert.equal(audit.byeSpread, 0);
  assert.ok(audit.maxPartnerCount <= 2);
});

test("remixed cycle for 10 players is fair on one and two courts", () => {
  const players = makePlayers(10);
  for (const [courts, expectedRests] of [[1, 3], [2, 1]] as const) {
    const rounds = generateRemixedCycle({
      players,
      roundsPerCycle: 5,
      courts,
      mode: "random",
      random: mulberry32(100 + courts),
    });
    assertRoundIntegrity(players, rounds, courts);
    const history = historyFromRounds(rounds);
    assert.deepEqual(
      [...new Set(players.map((player) => history.byes.get(player.id) ?? 0))],
      [expectedRests],
    );
    assert.equal(auditSchedule(players, rounds).repeatedPartners, 0);
  }
});

test("remixed cycle supports the explicit 14-player target", () => {
  const players = makePlayers(14);
  const rounds = generateRemixedCycle({
    players,
    roundsPerCycle: 7,
    courts: 2,
    mode: "random",
    attempts: 100,
    random: mulberry32(142),
  });
  assert.equal(rounds.length, 7);
  assertRoundIntegrity(players, rounds, 2);
  const history = historyFromRounds(rounds);
  assert.deepEqual(
    [...new Set(players.map((player) => history.byes.get(player.id) ?? 0))],
    [3],
  );
  const audit = auditSchedule(players, rounds);
  assert.equal(audit.byeSpread, 0);
  assert.equal(audit.repeatedPartners, 0);
});

test("a seeded remixed cycle is deterministic", () => {
  const options = {
    players: makePlayers(6),
    roundsPerCycle: 3,
    courts: 1,
    mode: "balanced" as const,
  };
  assert.deepEqual(
    generateRemixedCycle({ ...options, random: mulberry32(2026) }),
    generateRemixedCycle({ ...options, random: mulberry32(2026) }),
  );
});

test("remixed cycle rejects non-safe integer options", () => {
  const options = {
    players: makePlayers(6),
    roundsPerCycle: 3,
    courts: 1,
    mode: "random" as const,
    attempts: 1,
  };
  const invalidValues = [1.5, Number.NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1];
  const cases = [
    ["roundsPerCycle", /rounds.*entier sûr/],
    ["courts", /terrains.*entier sûr/],
    ["attempts", /tentatives.*entier sûr/],
  ] as const;

  for (const [option, expectedMessage] of cases) {
    for (const value of invalidValues) {
      assert.throws(
        () => generateRemixedCycle({ ...options, [option]: value }),
        expectedMessage,
        `${option}=${value} doit être rejeté`,
      );
    }
  }
});

test("americano 8 joueurs / 7 rounds / 2 terrains : rotation parfaite des partenaires", () => {
  const players = makePlayers(8);
  const schedule = generateAmericanoSchedule(players, 7, 2, "random");
  assertRoundIntegrity(players, schedule, 2);
  const audit = auditSchedule(players, schedule);
  assert.equal(audit.repeatedPartners, 0, "aucun partenaire répété sur 7 rounds à 8 joueurs");
  assert.equal(audit.byeSpread, 0, "aucun bye nécessaire");
});

test("americano 4 joueurs / 3 rounds / 1 terrain : chacun joue avec chacun", () => {
  const players = makePlayers(4);
  const schedule = generateAmericanoSchedule(players, 3, 1, "random");
  assertRoundIntegrity(players, schedule, 1);
  assert.equal(auditSchedule(players, schedule).repeatedPartners, 0);
});

test("americano avec byes : 10 joueurs / 2 terrains → repos équilibrés (écart ≤ 1)", () => {
  const players = makePlayers(10);
  const schedule = generateAmericanoSchedule(players, 8, 2, "random");
  assertRoundIntegrity(players, schedule, 2);
  const audit = auditSchedule(players, schedule);
  assert.ok(audit.byeSpread <= 1, `écart de byes ${audit.byeSpread} > 1`);
  // 10 joueurs, 8 joueurs actifs/round → 2 repos/round → 16 repos sur 8 rounds
  const h = historyFromRounds(schedule);
  let totalByes = 0;
  for (const p of players) totalByes += h.byes.get(p.id) ?? 0;
  assert.equal(totalByes, 16);
});

test("americano 7 joueurs (non multiple de 4) : 1 terrain, 3 repos par round", () => {
  const players = makePlayers(7);
  const schedule = generateAmericanoSchedule(players, 7, 2, "random");
  assertRoundIntegrity(players, schedule, 2);
  for (const round of schedule) {
    assert.equal(round.matches.length, 1);
    assert.equal(round.resting.length, 3);
  }
  assert.ok(auditSchedule(players, schedule).byeSpread <= 1);
});

test("americano 12 joueurs / 3 terrains / 11 rounds : partenaires sans répétition", () => {
  const players = makePlayers(12);
  const schedule = generateAmericanoSchedule(players, 11, 3, "random");
  assertRoundIntegrity(players, schedule, 3);
  const audit = auditSchedule(players, schedule);
  // 11 rounds à 12 joueurs = rotation partenaire-parfaite théorique.
  // On tolère au plus 1 répétition (recherche heuristique) mais on vise 0.
  assert.ok(audit.repeatedPartners <= 1, `${audit.repeatedPartners} partenaires répétés`);
});

test("americano 16 joueurs / 4 terrains / 8 rounds : aucun partenaire répété", () => {
  const players = makePlayers(16);
  const schedule = generateAmericanoSchedule(players, 8, 4, "random");
  assertRoundIntegrity(players, schedule, 4);
  assert.equal(auditSchedule(players, schedule).repeatedPartners, 0);
});

test("mode équilibré : écart de niveau entre équipes minimisé", () => {
  const players: EnginePlayer[] = [
    { id: "fort1", level: 9 },
    { id: "fort2", level: 9 },
    { id: "moyen1", level: 5 },
    { id: "moyen2", level: 5 },
    { id: "faible1", level: 2 },
    { id: "faible2", level: 2 },
    { id: "moyen3", level: 6 },
    { id: "moyen4", level: 4 },
  ];
  const schedule = generateAmericanoSchedule(players, 3, 2, "balanced");
  const levelOf = new Map(players.map((p) => [p.id, p.level]));
  let totalGap = 0;
  let matches = 0;
  for (const round of schedule) {
    for (const m of round.matches) {
      const l1 = levelOf.get(m.team1[0])! + levelOf.get(m.team1[1])!;
      const l2 = levelOf.get(m.team2[0])! + levelOf.get(m.team2[1])!;
      totalGap += Math.abs(l1 - l2);
      matches++;
    }
  }
  assert.ok(totalGap / matches <= 3, `écart moyen ${totalGap / matches} trop élevé`);
});

test("mexicano : 1&4 vs 2&3 dans chaque groupe de classement", () => {
  const ranked = makePlayers(8); // p1 = 1er au classement
  const round = generateMexicanoRound(ranked, 2, 2, []);
  assert.equal(round.matches.length, 2);
  const m1 = round.matches[0];
  assert.deepEqual([...m1.team1].sort(), ["p1", "p4"]);
  assert.deepEqual([...m1.team2].sort(), ["p2", "p3"]);
  const m2 = round.matches[1];
  assert.deepEqual([...m2.team1].sort(), ["p5", "p8"]);
  assert.deepEqual([...m2.team2].sort(), ["p6", "p7"]);
});

test("seedOrder : placement standard des têtes de série", () => {
  for (const size of [4, 8, 16]) {
    const order = seedOrder(size);
    assert.equal(order.length, size);
    assert.deepEqual([...order].sort((a, b) => a - b), Array.from({ length: size }, (_, i) => i + 1));
    // Chaque match du round 1 oppose des seeds qui somment à size+1 (1 vs dernier…).
    for (let i = 0; i < size; i += 2) {
      assert.equal(order[i] + order[i + 1], size + 1);
    }
    // Les seeds 1 et 2 sont dans des moitiés opposées (ne se croisent qu'en finale).
    assert.ok(order.indexOf(1) < size / 2 !== order.indexOf(2) < size / 2);
  }
});

test("bracket 8 équipes : 4+2+1 matchs, la finale n'a pas de suivant", () => {
  const teams = Array.from({ length: 8 }, (_, i) => ({
    p1: `a${i}`,
    p2: `b${i}`,
    seed: i + 1,
  }));
  const matches = buildBracket(teams, 4);
  assert.equal(matches.length, 7);
  const final = matches.find((m) => m.nextMatchPos === null)!;
  assert.equal(final.roundNumber, 3);
  // Chaque match non-final envoie son vainqueur vers un slot unique.
  const targets = new Set(
    matches.filter((m) => m.nextMatchPos !== null).map((m) => `${m.nextMatchPos}:${m.nextMatchSlot}`),
  );
  assert.equal(targets.size, 6);
});

test("bracket 6 équipes : les seeds 1 et 2 reçoivent un bye et avancent", () => {
  const teams = Array.from({ length: 6 }, (_, i) => ({
    p1: `a${i}`,
    p2: `b${i}`,
    seed: i + 1,
  }));
  const matches = buildBracket(teams, 2);
  assert.equal(nextPowerOfTwo(6), 8);
  const round1 = matches.filter((m) => m.roundNumber === 1);
  assert.equal(round1.length, 2, "2 vrais matchs au round 1 (2 byes retirés)");
  const round2 = matches.filter((m) => m.roundNumber === 2);
  const preFilled = round2.flatMap((m) => [m.team1, m.team2]).filter(Boolean);
  assert.deepEqual(preFilled.map((t) => t!.seed).sort(), [1, 2]);
});

test("composeTeams équilibré : le plus fort joue avec le plus faible", () => {
  const players = [
    { id: "a", level: 10 },
    { id: "b", level: 8 },
    { id: "c", level: 4 },
    { id: "d", level: 1 },
  ];
  const teams = composeTeams(players, "balanced");
  assert.equal(teams.length, 2);
  const teamOfA = teams.find((t) => t.p1 === "a" || t.p2 === "a")!;
  assert.ok(teamOfA.p1 === "d" || teamOfA.p2 === "d", "le niveau 10 est avec le niveau 1");
});

test("sideConflict : seules deux préférences strictes identiques posent problème", () => {
  assert.equal(sideConflict("left", "left"), true);
  assert.equal(sideConflict("right", "right"), true);
  assert.equal(sideConflict("left", "right"), false);
  assert.equal(sideConflict("both", "both"), false);
  assert.equal(sideConflict("left", "both"), false);
  assert.equal(sideConflict(null, "left"), false);
  assert.equal(sideConflict(undefined, undefined), false);
});

test("mode équilibré : jamais deux gauchers stricts en équipe quand une alternative existe", () => {
  // 4 gauchers stricts + 4 droitiers stricts, niveaux homogènes :
  // chaque équipe doit mélanger un gauche et un droit.
  const players: EnginePlayer[] = [
    { id: "g1", level: 5, side: "left" },
    { id: "g2", level: 5, side: "left" },
    { id: "g3", level: 5, side: "left" },
    { id: "g4", level: 5, side: "left" },
    { id: "d1", level: 5, side: "right" },
    { id: "d2", level: 5, side: "right" },
    { id: "d3", level: 5, side: "right" },
    { id: "d4", level: 5, side: "right" },
  ];
  const sideOf = new Map(players.map((p) => [p.id, p.side]));
  const schedule = generateAmericanoSchedule(players, 3, 2, "balanced");
  assertRoundIntegrity(players, schedule, 2);
  let conflicts = 0;
  for (const round of schedule) {
    for (const m of round.matches) {
      if (sideConflict(sideOf.get(m.team1[0]), sideOf.get(m.team1[1]))) conflicts++;
      if (sideConflict(sideOf.get(m.team2[0]), sideOf.get(m.team2[1]))) conflicts++;
    }
  }
  // 3 rounds × 2 matchs : la rotation parfaite gauche/droite existe (4×4).
  assert.equal(conflicts, 0, `${conflicts} équipes en conflit de côté`);
});

test("mode équilibré : le côté ne casse pas la rotation des partenaires", () => {
  const players: EnginePlayer[] = makePlayers(8).map((p, i) => ({
    ...p,
    side: i % 2 === 0 ? "left" : "right",
  }));
  const schedule = generateAmericanoSchedule(players, 7, 2, "balanced");
  assertRoundIntegrity(players, schedule, 2);
  const audit = auditSchedule(players, schedule);
  // La rotation reste prioritaire sur l'évitement de conflit de côté.
  assert.ok(audit.maxPartnerCount <= 2, "le côté ne doit pas dominer la rotation");
});

test("composeTeams équilibré : évite gauche/gauche quand un partenaire compatible existe", () => {
  const players = [
    { id: "a", level: 10, side: "left" as const },
    { id: "b", level: 8, side: "right" as const },
    { id: "c", level: 4, side: "both" as const },
    { id: "d", level: 1, side: "left" as const },
  ];
  const teams = composeTeams(players, "balanced");
  for (const t of teams) {
    const sa = players.find((p) => p.id === t.p1)!.side;
    const sb = players.find((p) => p.id === t.p2)!.side;
    assert.ok(!(sa !== "both" && sa === sb), `équipe ${t.p1}/${t.p2} en conflit de côté`);
  }
});

test("stress : 20 joueurs / 4 terrains / 10 rounds reste intègre et équitable", () => {
  const players = makePlayers(20);
  const schedule = generateAmericanoSchedule(players, 10, 4, "balanced");
  assertRoundIntegrity(players, schedule, 4);
  const audit = auditSchedule(players, schedule);
  assert.ok(audit.byeSpread <= 1);
  assert.ok(audit.maxPartnerCount <= 2, "jamais 3 fois le même partenaire sur 10 rounds");
});
