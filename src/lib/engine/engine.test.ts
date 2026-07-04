import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateAmericanoSchedule,
  generateMexicanoRound,
  auditSchedule,
  historyFromRounds,
  type EnginePlayer,
  type PlannedRound,
} from "./americano.ts";
import { buildBracket, seedOrder, composeTeams, nextPowerOfTwo } from "./bracket.ts";

function makePlayers(n: number): EnginePlayer[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, level: (i % 10) + 1 }));
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

test("stress : 20 joueurs / 4 terrains / 10 rounds reste intègre et équitable", () => {
  const players = makePlayers(20);
  const schedule = generateAmericanoSchedule(players, 10, 4, "balanced");
  assertRoundIntegrity(players, schedule, 4);
  const audit = auditSchedule(players, schedule);
  assert.ok(audit.byeSpread <= 1);
  assert.ok(audit.maxPartnerCount <= 2, "jamais 3 fois le même partenaire sur 10 rounds");
});
