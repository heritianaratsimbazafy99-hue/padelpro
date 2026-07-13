# Americano Teams and Automatic Cycles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrichir l'Americano avec des binômes remixés ou fixes, des cycles automatiques et supplémentaires, ainsi qu'un classement collectif fiable pour les équipes fixes.

**Architecture:** Le format persiste sous `americano`. Des helpers résolvent les réglages historiques, des moteurs purs planifient les cycles remixés et fixes, puis un RPC Supabase transactionnel valide et insère chaque cycle. Les pages client existantes restent les points d'entrée interactifs et partagent des composants de composition, classement et libellé de cycle.

**Tech Stack:** Next.js 16.2.10 App Router, React 19.2.4, TypeScript strict, Tailwind CSS 4, Supabase JS 2.110/Postgres/RLS/RPC, Node 25 test runner, Playwright 1.61.1.

## Global Constraints

- Conserver exactement les trois formats `americano`, `mexicano` et `tournament`; ne pas ajouter de nouvelle valeur à `EventFormat`.
- Interpréter tout Americano historique sans nouveaux réglages comme `remixed`, avec `composition = pairing` et `roundsPerCycle = rounds`.
- Pour un nouvel Americano, écrire `rounds` et `rounds_per_cycle` avec la même valeur calculée.
- Autoriser les matchs nuls et conserver le total fixe de points pour tous les Americanos.
- Exiger au lancement au moins quatre joueurs et un roster pair en variante fixe; chaque `team_number` doit alors désigner exactement deux joueurs. Un brouillon intermédiaire incomplet reste enregistrable mais non lançable.
- Classer les équipes fixes par victoires, différence, points marqués, confrontation directe à deux équipes, puis libellé.
- Verrouiller le roster et les équipes après le lancement, sans bloquer `claim_player`.
- Faire passer toute création, suppression ou modification structurelle du roster par un RPC de remplacement atomique qui verrouille la même ligne `events` que le lancement.
- Ne pas ajouter de dépendance npm ni modifier la direction visuelle existante.
- Conserver les pages interactives en Client Components; `params` reste une `Promise` lue avec React `use`, conformément à la documentation locale Next.js 16.
- Les mutations de cycle Americano passent par un RPC authentifié qui revérifie propriété, état, cycle attendu et payload.
- La migration est préparée et testée localement; son application à une base distante reste une étape de déploiement explicite, hors de ce plan local.

## File Structure

**Create**

- `src/lib/americano-settings.ts` — résolution des réglages historiques et libellés cycle/round.
- `src/lib/americano-settings.test.ts` — contrats de compatibilité des réglages.
- `src/lib/engine/cycle-planning.ts` — durée et résumé mathématique des cycles.
- `src/lib/engine/cycle-planning.test.ts` — matrice de rosters/terrains.
- `src/lib/engine/fixed-teams.ts` — composition et validation des binômes persistés.
- `src/lib/engine/fixed-teams.test.ts` — composition manuelle, aléatoire et équilibrée.
- `src/lib/engine/round-robin.ts` — championnat fixe et audit d'intégrité.
- `src/lib/engine/round-robin.test.ts` — round-robin à 3, 5 et 6 équipes.
- `src/lib/engine/team-standings.ts` — classement collectif et départage direct.
- `src/lib/engine/team-standings.test.ts` — statistiques, tris et multi-cycle.
- `src/lib/event-planning.ts` — adaptation entre événements stockés et moteurs purs.
- `src/lib/event-planning.test.ts` — premier cycle, cycle suivant et erreurs métier.
- `src/components/fixed-team-composer.tsx` — aperçu, sélection et échange accessible des joueurs.
- `src/components/team-standings.tsx` — tableau collectif mobile et accessible.
- `supabase/migrations/0006_americano_team_cycles.sql` — colonnes, contraintes, RLS et RPC atomique.
- `scripts/supabase-mock.test.mjs` — intégration du RPC, verrouillage et idempotence du mock.
- `scripts/e2e-team-cycles.mjs` — parcours mobile fixe puis remixé à six joueurs.

**Modify**

- `package.json` — commande `npm test`.
- `src/lib/types.ts` — nouveaux réglages, `team_number`, `cycle_number`, classement d'équipe.
- `src/lib/event-identity.test.ts` — valeurs par défaut des nouveaux champs du fixture.
- `src/lib/engine/americano.ts` — source aléatoire injectable et génération avec historique.
- `src/lib/engine/engine.test.ts` — non-régression du wrapper historique et cycle remixé.
- `src/lib/actions.ts` — planification pure, RPC du cycle et action `addAmericanoCycle`.
- `src/lib/utils.ts` — erreurs métier lisibles.
- `src/app/events/new/page.tsx` — variante, composition, résumé et persistance des binômes.
- `src/app/events/[id]/page.tsx` — brouillon fixe, cycles, repos et actions de fin.
- `src/app/join/[code]/page.tsx` — libellés de cycle et classement collectif.
- `src/components/ui.tsx` — nom accessible optionnel du contrôle segmenté.
- `src/components/match-card.tsx` — nom accessible et attributs E2E stables.
- `src/components/standings.tsx` — wrapper individuel/collectif.
- `src/components/podium.tsx` — podium par équipe.
- `scripts/supabase-mock.mjs` — nouvelles colonnes, gardes RLS simulées et RPC.
- `README.md` — variantes Americano, cycles et commandes de vérification.

---

### Task 1: Contracts, legacy settings, and round labels

**Files:**
- Create: `src/lib/americano-settings.ts`
- Create: `src/lib/americano-settings.test.ts`
- Modify: `src/lib/types.ts:1-91`
- Modify: `src/lib/event-identity.test.ts:6-17`
- Modify: `package.json:5-10`

**Interfaces:**
- Produces: `TeamMode`, `CompositionMode`, `ResolvedAmericanoSettings`, `resolveAmericanoSettings`, `roundMeta`, `formatRoundLabel`, `currentCycleNumber`.
- Consumed by: all engine adapters and UI tasks below.

- [ ] **Step 1: Write the failing settings tests**

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EventSettings, Match } from "./types.ts";
import {
  currentCycleNumber,
  formatRoundLabel,
  resolveAmericanoSettings,
  roundMeta,
} from "./americano-settings.ts";

const legacy: EventSettings = {
  points_per_match: 24,
  courts: 1,
  rounds: 7,
  pairing: "balanced",
};

describe("americano settings", () => {
  it("preserves legacy Americano defaults", () => {
    assert.deepEqual(resolveAmericanoSettings(legacy), {
      teamMode: "remixed",
      composition: "balanced",
      roundsPerCycle: 7,
      legacy: true,
    });
  });

  it("prefers the new fixed/manual cycle settings", () => {
    assert.deepEqual(
      resolveAmericanoSettings({
        ...legacy,
        team_mode: "fixed",
        composition: "manual",
        rounds_per_cycle: 3,
      }),
      { teamMode: "fixed", composition: "manual", roundsPerCycle: 3, legacy: false },
    );
  });

  it("derives local round labels from global round numbers", () => {
    const settings = { ...legacy, rounds_per_cycle: 3 };
    assert.deepEqual(roundMeta({ round_number: 5, cycle_number: 2 }, settings), {
      cycleNumber: 2,
      localRound: 2,
    });
    assert.equal(formatRoundLabel({ round_number: 5, cycle_number: 2 }, settings), "Cycle 2 · R2");
  });

  it("finds the current cycle while accepting old rows", () => {
    const matches = [{ cycle_number: 1 }, { cycle_number: 3 }] as Match[];
    assert.equal(currentCycleNumber(matches), 3);
    assert.equal(currentCycleNumber([]), 1);
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `node --test src/lib/americano-settings.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `americano-settings.ts` or missing exported types.

- [ ] **Step 3: Add the shared types and compatibility resolver**

Add to `src/lib/types.ts`:

```ts
export type TeamMode = "remixed" | "fixed";
export type CompositionMode = PairingMode | "manual";

export interface EventSettings {
  points_per_match: number;
  courts: number;
  rounds: number;
  pairing: PairingMode;
  team_mode?: TeamMode;
  composition?: CompositionMode;
  rounds_per_cycle?: number;
  best_of?: number;
}

// Add inside EventPlayer
team_number: number | null;

// Add inside Match
cycle_number: number;

export interface TeamStandingRow {
  teamNumber: number;
  playerIds: [string, string];
  names: [string, string];
  label: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
}
```

Create `src/lib/americano-settings.ts`:

```ts
import type { CompositionMode, EventSettings, Match, TeamMode } from "./types";

export interface ResolvedAmericanoSettings {
  teamMode: TeamMode;
  composition: CompositionMode;
  roundsPerCycle: number;
  legacy: boolean;
}

export function resolveAmericanoSettings(settings: EventSettings): ResolvedAmericanoSettings {
  return {
    teamMode: settings.team_mode ?? "remixed",
    composition: settings.composition ?? settings.pairing,
    roundsPerCycle: settings.rounds_per_cycle ?? settings.rounds,
    legacy:
      settings.team_mode === undefined &&
      settings.composition === undefined &&
      settings.rounds_per_cycle === undefined,
  };
}

export function roundMeta(
  match: Pick<Match, "round_number" | "cycle_number">,
  settings: EventSettings,
) {
  const cycleNumber = match.cycle_number ?? 1;
  const roundsPerCycle = resolveAmericanoSettings(settings).roundsPerCycle;
  return {
    cycleNumber,
    localRound: match.round_number - (cycleNumber - 1) * roundsPerCycle,
  };
}

export function formatRoundLabel(
  match: Pick<Match, "round_number" | "cycle_number">,
  settings: EventSettings,
): string {
  const meta = roundMeta(match, settings);
  return meta.cycleNumber > 1
    ? `Cycle ${meta.cycleNumber} · R${meta.localRound}`
    : `R${meta.localRound}`;
}

export function currentCycleNumber(matches: ReadonlyArray<Pick<Match, "cycle_number">>): number {
  return Math.max(1, ...matches.map((match) => match.cycle_number ?? 1));
}
```

Update the `EventPlayer` fixture with `preferred_side: null` and `team_number: null`. Add `"test": "node --test"` to `package.json`.

- [ ] **Step 4: Run focused and full tests**

Run: `node --test src/lib/americano-settings.test.ts && npm test`

Expected: all settings tests pass; the existing 22 tests remain green.

- [ ] **Step 5: Commit the contracts**

```bash
git add package.json src/lib/types.ts src/lib/event-identity.test.ts src/lib/americano-settings.ts src/lib/americano-settings.test.ts
git commit -m "feat: add Americano cycle contracts"
```

---

### Task 2: Automatic cycle planning

**Files:**
- Create: `src/lib/engine/cycle-planning.ts`
- Create: `src/lib/engine/cycle-planning.test.ts`

**Interfaces:**
- Produces: `RemixedCyclePlan`, `FixedCyclePlan`, `planRemixedCycle`, `planFixedCycle`.
- Consumed by: wizard summaries and both schedule generators.

- [ ] **Step 1: Write the failing planning matrix**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { planFixedCycle, planRemixedCycle } from "./cycle-planning.ts";

test("remixed cycle duration balances appearances", () => {
  assert.deepEqual(planRemixedCycle(6, 1), {
    activePlayersPerRound: 4,
    matchesPerRound: 1,
    roundsPerCycle: 3,
    matchesPerPlayer: 2,
    restsPerPlayer: 1,
  });
  assert.equal(planRemixedCycle(10, 1).roundsPerCycle, 5);
  assert.equal(planRemixedCycle(10, 2).matchesPerPlayer, 4);
  assert.equal(planRemixedCycle(8, 1).roundsPerCycle, 8);
  assert.equal(planRemixedCycle(8, 2).roundsPerCycle, 7);
  assert.equal(planRemixedCycle(12, 2).roundsPerCycle, 12);
  assert.equal(planRemixedCycle(12, 3).roundsPerCycle, 11);
});

test("fixed cycle duration accounts for court waves", () => {
  assert.equal(planFixedCycle(3, 1).roundsPerCycle, 3);
  assert.equal(planFixedCycle(5, 1).roundsPerCycle, 10);
  assert.equal(planFixedCycle(5, 2).roundsPerCycle, 5);
  assert.equal(planFixedCycle(6, 1).roundsPerCycle, 15);
  assert.equal(planFixedCycle(6, 2).roundsPerCycle, 10);
});

test("cycle planning rejects invalid capacity", () => {
  assert.throws(() => planRemixedCycle(3, 1), /au moins 4/i);
  assert.throws(() => planFixedCycle(1, 1), /au moins 2 équipes/i);
  assert.throws(() => planRemixedCycle(6, 0), /terrain/i);
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `node --test src/lib/engine/cycle-planning.test.ts`

Expected: FAIL because the planning module does not exist.

- [ ] **Step 3: Implement the exact planning formulas**

```ts
export interface RemixedCyclePlan {
  activePlayersPerRound: number;
  matchesPerRound: number;
  roundsPerCycle: number;
  matchesPerPlayer: number;
  restsPerPlayer: number;
}

export interface FixedCyclePlan {
  teamCount: number;
  logicalRounds: number;
  matchesPerCycle: number;
  roundsPerCycle: number;
  matchesPerTeam: number;
  restsPerTeam: number;
}

export function planRemixedCycle(playerCount: number, courts: number): RemixedCyclePlan {
  if (playerCount < 4) throw new Error("Il faut au moins 4 joueurs.");
  if (courts < 1) throw new Error("Il faut au moins un terrain.");
  const activePlayersPerRound = Math.min(courts * 4, Math.floor(playerCount / 4) * 4);
  const minimumRounds = playerCount % 4 === 2 ? playerCount / 2 : playerCount - 1;
  let roundsPerCycle = Math.ceil(minimumRounds);
  while ((roundsPerCycle * activePlayersPerRound) % playerCount !== 0) roundsPerCycle++;
  const matchesPerPlayer = (roundsPerCycle * activePlayersPerRound) / playerCount;
  return {
    activePlayersPerRound,
    matchesPerRound: activePlayersPerRound / 4,
    roundsPerCycle,
    matchesPerPlayer,
    restsPerPlayer: roundsPerCycle - matchesPerPlayer,
  };
}

export function planFixedCycle(teamCount: number, courts: number): FixedCyclePlan {
  if (teamCount < 2) throw new Error("Il faut au moins 2 équipes.");
  if (courts < 1) throw new Error("Il faut au moins un terrain.");
  const logicalRounds = teamCount % 2 === 0 ? teamCount - 1 : teamCount;
  const matchesPerLogicalRound = Math.floor(teamCount / 2);
  const roundsPerCycle = logicalRounds * Math.ceil(matchesPerLogicalRound / courts);
  return {
    teamCount,
    logicalRounds,
    matchesPerCycle: (teamCount * (teamCount - 1)) / 2,
    roundsPerCycle,
    matchesPerTeam: teamCount - 1,
    restsPerTeam: roundsPerCycle - (teamCount - 1),
  };
}
```

- [ ] **Step 4: Verify GREEN**

Run: `node --test src/lib/engine/cycle-planning.test.ts`

Expected: 3 tests pass.

- [ ] **Step 5: Commit the planner**

```bash
git add src/lib/engine/cycle-planning.ts src/lib/engine/cycle-planning.test.ts
git commit -m "feat: plan automatic Americano cycles"
```

---

### Task 3: History-aware remixed cycle generation

**Files:**
- Modify: `src/lib/engine/americano.ts:21-324`
- Modify: `src/lib/engine/engine.test.ts:3-91`

**Interfaces:**
- Produces: `RandomSource`, `GenerateRemixedCycleOptions`, `generateRemixedCycle`.
- Preserves: the existing `generateAmericanoSchedule(players, rounds, courts, mode, attempts)` signature.

- [ ] **Step 1: Add failing deterministic cycle tests**

Add `generateRemixedCycle` to the existing imports, then add this helper and tests to `engine.test.ts`:

```ts
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test --test-name-pattern="remixed cycle" src/lib/engine/engine.test.ts`

Expected: FAIL because `generateRemixedCycle` is not exported.

- [ ] **Step 3: Inject randomness and generate from an immutable prior history**

Introduce this public API:

```ts
export type RandomSource = () => number;

export interface GenerateRemixedCycleOptions {
  players: readonly EnginePlayer[];
  roundsPerCycle: number;
  courts: number;
  mode: PairingMode;
  previousRounds?: readonly PlannedRound[];
  attempts?: number;
  random?: RandomSource;
}

export function generateRemixedCycle({
  players,
  roundsPerCycle,
  courts,
  mode,
  previousRounds = [],
  attempts = 25,
  random = Math.random,
}: GenerateRemixedCycleOptions): PlannedRound[] {
  if (players.length < 4) throw new Error("Il faut au moins 4 joueurs.");
  if (roundsPerCycle < 1) throw new Error("Il faut au moins un round.");
  if (courts < 1) throw new Error("Il faut au moins un terrain.");
  if (attempts < 1) throw new Error("Il faut au moins une tentative.");
  const startRound = Math.max(0, ...previousRounds.map((round) => round.roundNumber)) + 1;
  let best: PlannedRound[] | null = null;
  let bestScore = Infinity;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const history = historyFromRounds([...previousRounds]);
    const candidate: PlannedRound[] = [];
    for (let offset = 0; offset < roundsPerCycle; offset++) {
      const round = generateRound(
        [...players],
        startRound + offset,
        courts,
        mode,
        history,
        60,
        random,
      );
      commitRound(round, history);
      candidate.push(round);
    }
    const score = scheduleScore([...players], [...previousRounds, ...candidate]);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best!;
}
```

Thread `random` through `shuffled`, `pickResting`, `generateRound` and every shuffle call. Give the internal helpers `random: RandomSource = Math.random` defaults so the existing Mexicano call remains source-compatible. Replace the implementation of `generateAmericanoSchedule` with a wrapper around `generateRemixedCycle` using an empty history.

- [ ] **Step 4: Run the complete engine suite repeatedly**

Run: `node --test src/lib/engine/engine.test.ts && node --test src/lib/engine/engine.test.ts`

Expected: both runs pass; deterministic new tests do not flicker and all historical tests remain green.

- [ ] **Step 5: Commit the history-aware generator**

```bash
git add src/lib/engine/americano.ts src/lib/engine/engine.test.ts
git commit -m "feat: generate remixed cycles from match history"
```

---

### Task 4: Fixed-team composition and persisted assignment validation

**Files:**
- Create: `src/lib/engine/fixed-teams.ts`
- Create: `src/lib/engine/fixed-teams.test.ts`
- Modify: `src/lib/engine/bracket.ts:90-139`
- Modify: `src/lib/engine/engine.test.ts:12,177-252`

**Interfaces:**
- Produces: `FixedTeam`, `AssignedEnginePlayer`, `TeamAssignments`, `composeFixedTeams`, `assignmentsFromTeams`, `fixedTeamsFromAssignments`, `swapAssignments`.
- Consumes: `EnginePlayer`, `PairingMode`, `RandomSource`, `sideConflict`.
- Tournament code imports the shared composer rather than keeping a second implementation.

- [ ] **Step 1: Write failing composition tests**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
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
```

- [ ] **Step 2: Run the tests and confirm RED**

Run: `node --test src/lib/engine/fixed-teams.test.ts`

Expected: FAIL because `fixed-teams.ts` does not exist.

- [ ] **Step 3: Extract and implement one shared team composer**

```ts
import {
  sideConflict,
  type EnginePlayer,
  type PairingMode,
  type RandomSource,
} from "./americano";

export interface FixedTeam {
  teamNumber: number;
  playerIds: [string, string];
}

export type AssignedEnginePlayer = EnginePlayer & { teamNumber: number | null };
export type TeamAssignments = Record<string, number>;

function shuffled<T>(values: readonly T[], random: RandomSource): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function pairPool(
  players: readonly EnginePlayer[],
  mode: PairingMode,
  random: RandomSource,
): Array<[EnginePlayer, EnginePlayer]> {
  const pool = mode === "random"
    ? shuffled(players, random)
    : [...players].sort((a, b) => b.level - a.level);
  const pairs: Array<[EnginePlayer, EnginePlayer]> = [];
  while (pool.length > 0) {
    const first = pool.shift()!;
    let partnerIndex = 0;
    if (mode === "balanced") {
      partnerIndex = pool.length - 1;
      for (let index = pool.length - 1; index >= 0; index--) {
        if (!sideConflict(first.side, pool[index].side)) {
          partnerIndex = index;
          break;
        }
      }
    }
    pairs.push([first, pool.splice(partnerIndex, 1)[0]]);
  }
  return pairs;
}

export function composeFixedTeams(
  players: readonly EnginePlayer[],
  mode: PairingMode,
  random: RandomSource = Math.random,
): FixedTeam[] {
  if (players.length < 4 || players.length % 2 !== 0) {
    throw new Error("Il faut un nombre pair de joueurs (minimum 4).");
  }
  return pairPool(players, mode, random).map(([first, second], index) => ({
    teamNumber: index + 1,
    playerIds: [first.id, second.id],
  }));
}

export function assignmentsFromTeams(teams: readonly FixedTeam[]): TeamAssignments {
  return Object.fromEntries(
    teams.flatMap((team) => team.playerIds.map((id) => [id, team.teamNumber] as const)),
  );
}

export function composeTeams(
  players: readonly EnginePlayer[],
  mode: PairingMode,
): Array<{ p1: string; p2: string; strength: number }> {
  const levelOf = new Map(players.map((player) => [player.id, player.level]));
  return composeFixedTeams(players, mode).map((team) => ({
    p1: team.playerIds[0],
    p2: team.playerIds[1],
    strength: (levelOf.get(team.playerIds[0]) ?? 5) + (levelOf.get(team.playerIds[1]) ?? 5),
  }));
}

export function fixedTeamsFromAssignments(players: readonly AssignedEnginePlayer[]): FixedTeam[] {
  if (players.length < 4 || players.length % 2 !== 0) {
    throw new Error("Il faut un nombre pair de joueurs (minimum 4).");
  }
  const groups = new Map<number, string[]>();
  for (const player of players) {
    if (player.teamNumber == null) throw new Error("Un joueur est sans équipe.");
    if (!Number.isInteger(player.teamNumber) || player.teamNumber < 1) {
      throw new Error("Le numéro d'équipe doit être un entier positif.");
    }
    groups.set(player.teamNumber, [...(groups.get(player.teamNumber) ?? []), player.id]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([teamNumber, ids]) => {
      if (ids.length !== 2) throw new Error("Chaque équipe doit contenir exactement deux joueurs.");
      return { teamNumber, playerIds: [ids[0], ids[1]] };
    });
}

export function swapAssignments(
  assignments: TeamAssignments,
  firstId: string,
  secondId: string,
): TeamAssignments {
  if (!(firstId in assignments) || !(secondId in assignments)) return assignments;
  return {
    ...assignments,
    [firstId]: assignments[secondId],
    [secondId]: assignments[firstId],
  };
}
```

Remove the old `composeTeams` body from `bracket.ts`, import/re-export the compatibility adapter above, and keep the tournament action output unchanged.

- [ ] **Step 4: Verify composition and historical bracket tests**

Run: `node --test src/lib/engine/fixed-teams.test.ts src/lib/engine/engine.test.ts`

Expected: all new composition tests and all existing bracket tests pass.

- [ ] **Step 5: Commit fixed-team composition**

```bash
git add src/lib/engine/fixed-teams.ts src/lib/engine/fixed-teams.test.ts src/lib/engine/bracket.ts src/lib/engine/engine.test.ts
git commit -m "feat: compose and validate fixed padel teams"
```

---

### Task 5: Fixed-team round-robin cycles

**Files:**
- Create: `src/lib/engine/round-robin.ts`
- Create: `src/lib/engine/round-robin.test.ts`

**Interfaces:**
- Consumes: `FixedTeam`, `PlannedRound`, `planFixedCycle`.
- Produces: `GenerateFixedCycleOptions`, `generateFixedCycle`, `FixedCycleAudit`, `auditFixedCycle`.

- [ ] **Step 1: Write failing round-robin tests**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateFixedCycle, auditFixedCycle } from "./round-robin.ts";

const teams = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    teamNumber: i + 1,
    playerIds: [`p${i * 2 + 1}`, `p${i * 2 + 2}`] as [string, string],
  }));

test("3 fixed teams play a complete 3-round cycle", () => {
  const input = teams(3);
  const rounds = generateFixedCycle({ teams: input, courts: 1, cycleNumber: 1, startRoundNumber: 1 });
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
  const oneCourt = generateFixedCycle({ teams: input, courts: 1, cycleNumber: 1, startRoundNumber: 1 });
  const twoCourts = generateFixedCycle({ teams: input, courts: 2, cycleNumber: 1, startRoundNumber: 1 });
  assert.equal(oneCourt.length, 10);
  assert.equal(twoCourts.length, 5);
  for (const [rounds, courts] of [[oneCourt, 1], [twoCourts, 2]] as const) {
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
  const rounds = generateFixedCycle({ teams: input, courts: 2, cycleNumber: 1, startRoundNumber: 1 });
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

test("audit rejects a mixed team and an incorrect resting list", () => {
  const input = teams(3);
  const rounds = generateFixedCycle({ teams: input, courts: 1, cycleNumber: 1, startRoundNumber: 1 });
  rounds[0].matches[0].team1[1] = rounds[0].matches[0].team2[0];
  rounds[0].resting = [];
  const audit = auditFixedCycle(input, rounds, 1);
  assert.ok(audit.membershipConflicts > 0);
  assert.ok(audit.restConflicts > 0);
});

test("cycle 2 keeps teams, continues rounds and reverses orientation", () => {
  const input = teams(3);
  const first = generateFixedCycle({ teams: input, courts: 1, cycleNumber: 1, startRoundNumber: 1 });
  const second = generateFixedCycle({ teams: input, courts: 1, cycleNumber: 2, startRoundNumber: 4 });
  assert.deepEqual(second.map((round) => round.roundNumber), [4, 5, 6]);
  const pair = first[0].matches[0];
  const pairPlayers = [...pair.team1, ...pair.team2].sort().join("|");
  const reverse = second.flatMap((round) => round.matches).find((match) =>
    [...match.team1, ...match.team2].sort().join("|") === pairPlayers,
  );
  assert.ok(reverse);
  assert.deepEqual([...reverse.team1].sort(), [...pair.team2].sort());
  assert.deepEqual([...reverse.team2].sort(), [...pair.team1].sort());
  const audit = auditFixedCycle(input, second, 1);
  assert.equal(audit.missingPairings, 0);
  assert.equal(audit.repeatedPairings, 0);
  assert.equal(audit.membershipConflicts, 0);
  assert.equal(audit.restConflicts, 0);
});
```

- [ ] **Step 2: Run the tests and confirm RED**

Run: `node --test src/lib/engine/round-robin.test.ts`

Expected: FAIL because the round-robin module does not exist.

- [ ] **Step 3: Implement circle scheduling, waves, orientation, and audit**

```ts
import type { PlannedRound } from "./americano";
import { planFixedCycle } from "./cycle-planning";
import type { FixedTeam } from "./fixed-teams";

export interface GenerateFixedCycleOptions {
  teams: readonly FixedTeam[];
  courts: number;
  cycleNumber: number;
  startRoundNumber: number;
}

export function generateFixedCycle({
  teams,
  courts,
  cycleNumber,
  startRoundNumber,
}: GenerateFixedCycleOptions): PlannedRound[] {
  if (teams.length < 2) throw new Error("Il faut au moins 2 équipes.");
  if (courts < 1) throw new Error("Il faut au moins un terrain.");
  if (cycleNumber < 1 || startRoundNumber < 1) throw new Error("Numéro de cycle ou round invalide.");
  const plan = planFixedCycle(teams.length, courts);
  const rotation: Array<FixedTeam | null> = [...teams].sort((a, b) => a.teamNumber - b.teamNumber);
  if (rotation.length % 2 !== 0) rotation.push(null);
  const logical: Array<Array<[FixedTeam, FixedTeam]>> = [];
  for (let round = 0; round < rotation.length - 1; round++) {
    const pairings: Array<[FixedTeam, FixedTeam]> = [];
    for (let i = 0; i < rotation.length / 2; i++) {
      const left = rotation[i];
      const right = rotation[rotation.length - 1 - i];
      if (left && right) pairings.push([left, right]);
    }
    logical.push(pairings);
    rotation.splice(1, 0, rotation.pop()!);
  }
  if (cycleNumber % 2 === 0) logical.reverse();

  const allPlayerIds = teams.flatMap((team) => team.playerIds);
  const rounds: PlannedRound[] = [];
  for (const pairings of logical) {
    for (let offset = 0; offset < pairings.length; offset += courts) {
      const wave = pairings.slice(offset, offset + courts);
      const matches = wave.map(([a, b], index) => {
        const reverse = cycleNumber % 2 === 0;
        return {
          court: ((index + cycleNumber - 1) % courts) + 1,
          team1: [...(reverse ? b.playerIds : a.playerIds)] as [string, string],
          team2: [...(reverse ? a.playerIds : b.playerIds)] as [string, string],
        };
      });
      const active = new Set(matches.flatMap((match) => [...match.team1, ...match.team2]));
      rounds.push({
        roundNumber: startRoundNumber + rounds.length,
        matches,
        resting: allPlayerIds.filter((id) => !active.has(id)),
      });
    }
  }
  if (rounds.length !== plan.roundsPerCycle) throw new Error("Cycle fixe incomplet.");
  return rounds;
}

export interface FixedCycleAudit {
  matchCount: number;
  missingPairings: number;
  repeatedPairings: number;
  membershipConflicts: number;
  restConflicts: number;
  teamRoundConflicts: number;
  courtConflicts: number;
  playSpread: number;
  restSpread: number;
}

const teamPairKey = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function auditFixedCycle(
  teams: readonly FixedTeam[],
  rounds: readonly PlannedRound[],
  courts: number,
): FixedCycleAudit {
  const teamOf = new Map(
    teams.flatMap((team) => team.playerIds.map((id) => [id, team.teamNumber] as const)),
  );
  const membersOf = new Map(
    teams.map((team) => [team.teamNumber, new Set(team.playerIds)] as const),
  );
  const allPlayerIds = teams.flatMap((team) => team.playerIds);
  const pairings = new Map<string, number>();
  const plays = new Map(teams.map((team) => [team.teamNumber, 0]));
  const rests = new Map(teams.map((team) => [team.teamNumber, 0]));
  let membershipConflicts = 0;
  let restConflicts = 0;
  let teamRoundConflicts = 0;
  let courtConflicts = 0;

  for (const round of rounds) {
    const seenTeams = new Set<number>();
    const seenCourts = new Set<number>();
    const activeIds = new Set<string>();
    for (const match of round.matches) {
      if (match.court < 1 || match.court > courts || seenCourts.has(match.court)) courtConflicts++;
      seenCourts.add(match.court);
      for (const id of [...match.team1, ...match.team2]) activeIds.add(id);
      const resolveSide = (side: [string, string]): number | null => {
        const first = teamOf.get(side[0]);
        const second = teamOf.get(side[1]);
        if (first == null || second == null || first !== second || new Set(side).size !== 2) return null;
        const expectedMembers = membersOf.get(first)!;
        return side.every((id) => expectedMembers.has(id)) ? first : null;
      };
      const first = resolveSide(match.team1);
      const second = resolveSide(match.team2);
      if (first == null || second == null || first === second) {
        membershipConflicts++;
        continue;
      }
      for (const teamNumber of [first, second]) {
        if (seenTeams.has(teamNumber)) teamRoundConflicts++;
        seenTeams.add(teamNumber);
      }
      const key = teamPairKey(first, second);
      pairings.set(key, (pairings.get(key) ?? 0) + 1);
    }
    const actualRest = new Set(round.resting);
    const expectedRest = new Set(allPlayerIds.filter((id) => !activeIds.has(id)));
    if (
      actualRest.size !== round.resting.length ||
      actualRest.size !== expectedRest.size ||
      [...actualRest].some((id) => !expectedRest.has(id))
    ) {
      restConflicts++;
    }
    for (const team of teams) {
      const target = seenTeams.has(team.teamNumber) ? plays : rests;
      target.set(team.teamNumber, target.get(team.teamNumber)! + 1);
    }
  }

  const expected = new Set<string>();
  for (let left = 0; left < teams.length; left++) {
    for (let right = left + 1; right < teams.length; right++) {
      expected.add(teamPairKey(teams[left].teamNumber, teams[right].teamNumber));
    }
  }
  const spread = (values: Iterable<number>) => {
    const list = [...values];
    return Math.max(...list) - Math.min(...list);
  };
  return {
    matchCount: rounds.reduce((sum, round) => sum + round.matches.length, 0),
    missingPairings: [...expected].filter((key) => !pairings.has(key)).length,
    repeatedPairings: [...pairings.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0),
    membershipConflicts,
    restConflicts,
    teamRoundConflicts,
    courtConflicts,
    playSpread: spread(plays.values()),
    restSpread: spread(rests.values()),
  };
}
```

Keep the audit independent of names and levels; it only verifies identities, pairings, courts, plays, and rests.

- [ ] **Step 4: Verify the complete fixed scheduler matrix**

Run: `node --test src/lib/engine/round-robin.test.ts src/lib/engine/cycle-planning.test.ts`

Expected: all tests pass, including 3, 5 and 6-team court-wave cases.

- [ ] **Step 5: Commit the fixed scheduler**

```bash
git add src/lib/engine/round-robin.ts src/lib/engine/round-robin.test.ts
git commit -m "feat: generate fixed-team round robin cycles"
```

---

### Task 6: Team standings and direct tie-breaks

**Files:**
- Create: `src/lib/engine/team-standings.ts`
- Create: `src/lib/engine/team-standings.test.ts`

**Interfaces:**
- Consumes: `EventPlayer`, `Match`, `TeamStandingRow`.
- Produces: `computeTeamStandings(players, matches): TeamStandingRow[]`.

- [ ] **Step 1: Write failing team standings tests**

```ts
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
```

- [ ] **Step 2: Run the tests and confirm RED**

Run: `node --test src/lib/engine/team-standings.test.ts`

Expected: FAIL because `computeTeamStandings` is missing.

- [ ] **Step 3: Implement grouping, stats, and transitive sorting**

```ts
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
```

- [ ] **Step 4: Verify standings and all engine tests**

Run: `node --test src/lib/engine/team-standings.test.ts && npm test`

Expected: all tests pass.

- [ ] **Step 5: Commit team standings**

```bash
git add src/lib/engine/team-standings.ts src/lib/engine/team-standings.test.ts
git commit -m "feat: rank fixed Americano teams"
```

---

### Task 7: Transactional Supabase schema, RLS, and cycle RPC

**Files:**
- Create: `supabase/migrations/0006_americano_team_cycles.sql`
- Modify: `scripts/supabase-mock.mjs:1-220,408-490`
- Create: `scripts/supabase-mock.test.mjs`

**Interfaces:**
- Produces RPC: `replace_event_roster(p_event_id uuid, p_players jsonb, p_rounds_per_cycle integer default null) returns setof event_players`.
- Produces RPC: `commit_americano_cycle(p_event_id uuid, p_expected_cycle integer, p_matches jsonb) returns void`.
- Payload rows contain `round_number`, `court`, and four non-null player UUIDs; the server supplies event, cycle, scores and status.
- Error codes: `not_event_organizer`, `invalid_event_format`, `invalid_roster_payload`, `fixed_teams_invalid`, `invalid_cycle_payload`, `cycle_incomplete`, `cycle_already_added`, `unexpected_cycle`, `event_not_active`, `event_locked`, `roster_locked`, `roster_write_forbidden` and `match_write_forbidden` (mock guards/direct REST only).

- [ ] **Step 1: Write a failing mock integration test**

The test must spawn the mock on port 4599, sign up an organizer, create a draft Americano and six players, then exercise the RPC:

```js
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";

const base = "http://127.0.0.1:4599";
let child;
let token;
let event;
let players;

async function waitFor(url) {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`mock indisponible: ${url}`);
}

async function request(path, { method = "GET", body, bearer = token, prefer } = {}) {
  const headers = { apikey: "mock", "Content-Type": "application/json" };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  const payload = raw ? JSON.parse(raw) : null;
  if (!response.ok) {
    throw new Error(payload?.message ?? payload?.msg ?? `HTTP ${response.status}`);
  }
  return payload;
}

const json = (path, method, body, bearer = token) => request(path, { method, body, bearer });

async function insert(table, rows, bearer = token) {
  const payload = await request(`/rest/v1/${table}?select=*`, {
    method: "POST",
    body: rows,
    bearer,
    prefer: "return=representation",
  });
  return Array.isArray(rows) ? payload : payload[0];
}

const select = (table, query = "") =>
  request(`/rest/v1/${table}?select=*${query ? `&${query}` : ""}`);

const rpc = (name, params, bearer = token) =>
  request(`/rest/v1/rpc/${name}`, { method: "POST", body: params, bearer });

const replaceRoster = (eventId, roster, roundsPerCycle = null, bearer = token) =>
  rpc("replace_event_roster", {
    p_event_id: eventId,
    p_players: roster,
    p_rounds_per_cycle: roundsPerCycle,
  }, bearer);

const patchTeamNumber = (playerId, teamNumber) =>
  request(`/rest/v1/event_players?id=eq.${playerId}`, {
    method: "PATCH",
    body: { team_number: teamNumber },
  });

const patchEvent = (eventId, body) =>
  request(`/rest/v1/events?id=eq.${eventId}`, { method: "PATCH", body });

const deletePlayer = (playerId) =>
  request(`/rest/v1/event_players?id=eq.${playerId}`, { method: "DELETE" });

const sixFixedPlayerRows = () =>
  ["Alice", "Bob", "Chloé", "Dany", "Emma", "Félix"].map((display_name, index) => ({
    id: randomUUID(),
    display_name,
    level: 5,
    seed: index + 1,
    preferred_side: null,
    team_number: Math.floor(index / 2) + 1,
  }));

const sixRemixedPlayerRows = () => sixFixedPlayerRows().map((player, index) => ({
  ...player,
  display_name: `Legacy ${index + 1}`,
  team_number: null,
}));

const tenFixedPlayerRows = () =>
  Array.from({ length: 10 }, (_, index) => ({
    id: randomUUID(),
    display_name: `Dix ${index + 1}`,
    level: 5,
    seed: index + 1,
    preferred_side: null,
    team_number: Math.floor(index / 2) + 1,
  }));

const rosterPayload = (roster) => roster.map((player) => ({
  id: player.id,
  display_name: player.display_name,
  level: player.level,
  seed: player.seed,
  preferred_side: player.preferred_side,
  team_number: player.team_number,
}));

function cyclePayload(eventId, roster, cycle) {
  const [a, b, c, d, e, f] = [...roster]
    .sort((left, right) => left.seed - right.seed)
    .map((player) => player.id);
  const firstRound = (cycle - 1) * 3 + 1;
  const pairings = [
    [[a, b], [c, d]],
    [[a, b], [e, f]],
    [[c, d], [e, f]],
  ];
  return {
    p_event_id: eventId,
    p_expected_cycle: cycle,
    p_matches: pairings.map(([team1, team2], index) => ({
      round_number: firstRound + index,
      court: 1,
      team1_p1: cycle % 2 === 0 ? team2[0] : team1[0],
      team1_p2: cycle % 2 === 0 ? team2[1] : team1[1],
      team2_p1: cycle % 2 === 0 ? team1[0] : team2[0],
      team2_p2: cycle % 2 === 0 ? team1[1] : team2[1],
    })),
  };
}

async function scoreAllMatches(eventId, shareCode) {
  const pending = await select("matches", `event_id=eq.${eventId}&status=eq.pending`);
  for (const match of pending) {
    await rpc("report_score", {
      p_match_id: match.id,
      p_share_code: shareCode,
      p_score1: 12,
      p_score2: 12,
      p_reporter: "Cycle Test",
    });
  }
}

before(async () => {
  child = spawn(process.execPath, ["scripts/supabase-mock.mjs", "4599"], { stdio: "ignore" });
  await waitFor(`${base}/rest/v1/events`);
  const signup = await json("/auth/v1/signup", "POST", {
    email: "cycle@test.fr",
    password: "MotDePasse!123",
    data: { display_name: "Cycle Test" },
  }, null);
  token = signup.access_token;
  event = await insert("events", {
    organizer_id: signup.user.id,
    format: "americano",
    name: "Cycle RPC",
    settings: {
      points_per_match: 24,
      courts: 1,
      rounds: 3,
      pairing: "random",
      team_mode: "fixed",
      composition: "manual",
      rounds_per_cycle: 3,
    },
  });
  players = await replaceRoster(event.id, sixFixedPlayerRows(), 3);
});

after(async () => {
  if (!child || child.exitCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  await exited;
});

test("cycle commit is atomic, gated and idempotent", async () => {
  const other = await json("/auth/v1/signup", "POST", {
    email: "autre@test.fr",
    password: "MotDePasse!123",
    data: { display_name: "Autre" },
  }, null);
  await assert.rejects(
    () => rpc("commit_americano_cycle", cyclePayload(event.id, players, 1), other.access_token),
    /not_event_organizer/,
  );

  const incompleteRoster = rosterPayload(players);
  incompleteRoster.find((player) => player.seed === 6).team_number = null;
  players = await replaceRoster(event.id, incompleteRoster);
  await assert.rejects(
    () => rpc("commit_americano_cycle", cyclePayload(event.id, players, 1)),
    /fixed_teams_invalid/,
  );
  const restoredRoster = rosterPayload(players);
  restoredRoster.find((player) => player.seed === 6).team_number = 3;
  players = await replaceRoster(event.id, restoredRoster, 3);

  const invalid = cyclePayload(event.id, players, 1);
  invalid.p_matches[0].team2_p2 = players[0].id;
  await assert.rejects(() => rpc("commit_americano_cycle", invalid), /invalid_cycle_payload/);
  assert.equal((await select("matches", `event_id=eq.${event.id}`)).length, 0);
  await assert.rejects(() => patchEvent(event.id, { status: "active" }), /event_locked/);

  await rpc("commit_americano_cycle", cyclePayload(event.id, players, 1));
  assert.equal((await select("matches", `event_id=eq.${event.id}`)).length, 3);
  await rpc("claim_player", {
    p_player_id: players[0].id,
    p_share_code: event.share_code,
  }, other.access_token);
  const [claimed] = await select("event_players", `id=eq.${players[0].id}`);
  assert.equal(claimed.profile_id, other.user.id);
  const changedRoster = rosterPayload(players);
  changedRoster[0].team_number = 9;
  await assert.rejects(() => replaceRoster(event.id, changedRoster, 3), /roster_locked/);
  await assert.rejects(() => patchTeamNumber(players[0].id, 9), /roster_write_forbidden/);
  await assert.rejects(
    () => insert("event_players", {
      event_id: event.id,
      display_name: "Intrus",
      level: 5,
      seed: 7,
      team_number: null,
    }),
    /roster_write_forbidden/,
  );
  await assert.rejects(() => deletePlayer(players[5].id), /roster_write_forbidden/);
  await assert.rejects(() => patchEvent(event.id, { status: "draft" }), /event_locked/);
  await assert.rejects(() => patchEvent(event.id, { status: "completed" }), /cycle_incomplete/);
  await assert.rejects(
    () => insert("matches", {
      event_id: event.id,
      ...cyclePayload(event.id, players, 2).p_matches[0],
    }),
    /match_write_forbidden/,
  );
  await assert.rejects(() => rpc("commit_americano_cycle", cyclePayload(event.id, players, 2)), /cycle_incomplete/);
  await scoreAllMatches(event.id, event.share_code);
  await rpc("commit_americano_cycle", cyclePayload(event.id, players, 2));
  await assert.rejects(() => rpc("commit_americano_cycle", cyclePayload(event.id, players, 2)), /cycle_already_added/);
  assert.equal((await select("matches", `event_id=eq.${event.id}`)).length, 6);
});

test("legacy Americano uses remixed and rounds fallbacks across two cycles", async () => {
  const legacy = await insert("events", {
    organizer_id: event.organizer_id,
    format: "americano",
    name: "Legacy RPC",
    settings: { points_per_match: 24, courts: 1, rounds: 3, pairing: "random" },
  });
  const roster = await replaceRoster(legacy.id, sixRemixedPlayerRows());
  await rpc("commit_americano_cycle", cyclePayload(legacy.id, roster, 1));
  await scoreAllMatches(legacy.id, legacy.share_code);
  await rpc("commit_americano_cycle", cyclePayload(legacy.id, roster, 2));
  assert.equal((await select("matches", `event_id=eq.${legacy.id}`)).length, 6);
});

test("draft roster replacement persists automatic rounds when 6 becomes 10", async () => {
  const resized = await insert("events", {
    organizer_id: event.organizer_id,
    format: "americano",
    name: "Resize RPC",
    settings: {
      points_per_match: 24,
      courts: 1,
      rounds: 3,
      pairing: "random",
      team_mode: "fixed",
      composition: "manual",
      rounds_per_cycle: 3,
    },
  });
  await replaceRoster(resized.id, sixFixedPlayerRows(), 3);
  await replaceRoster(resized.id, tenFixedPlayerRows(), 10);
  const [stored] = await select("events", `id=eq.${resized.id}`);
  assert.equal(stored.settings.rounds, 10);
  assert.equal(stored.settings.rounds_per_cycle, 10);
});
```

- [ ] **Step 2: Run the integration test and confirm RED**

Run: `node --test scripts/supabase-mock.test.mjs`

Expected: FAIL because the new defaults/RPC and active-roster guard do not exist.

- [ ] **Step 3: Add columns, lock guards, RLS, and the atomic RPC**

The migration must contain these schema changes:

```sql
alter table public.event_players
  add column team_number integer check (team_number is null or team_number > 0);

alter table public.matches
  add column cycle_number integer not null default 1 check (cycle_number > 0);

create unique index matches_event_cycle_round_court_unique
  on public.matches (event_id, cycle_number, round_number, court)
  where bracket_pos is null;
```

Remove direct roster writes entirely. Every structural mutation goes through a single RPC which locks the parent event before touching player rows; this closes the concurrent-INSERT gap while `claim_player` remains available through its existing `SECURITY DEFINER` path:

```sql
drop policy if exists "event_players_write_organizer" on public.event_players;
```

Keep public select and create no direct insert/update/delete policy. Implement `replace_event_roster` with this contract:

```sql
create or replace function public.replace_event_roster(
  p_event_id uuid,
  p_players jsonb,
  p_rounds_per_cycle integer default null
)
returns setof public.event_players
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_player_count integer;
  v_team_count integer;
  v_courts integer;
  v_team_mode text;
  v_active integer;
  v_expected_rounds integer;
  v_logical_rounds integer;
  v_matches_per_logical integer;
begin
  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found or auth.uid() is null or v_event.organizer_id is distinct from auth.uid() then
    raise exception 'not_event_organizer';
  end if;
  if v_event.status <> 'draft' or exists (
    select 1 from public.matches m where m.event_id = p_event_id
  ) then
    raise exception 'roster_locked';
  end if;
  if jsonb_typeof(p_players) is distinct from 'array' then
    raise exception 'invalid_roster_payload';
  end if;

  v_player_count := jsonb_array_length(p_players);
  if exists (
    with payload as (
      select * from jsonb_to_recordset(p_players) as x(
        id uuid,
        display_name text,
        level integer,
        seed integer,
        preferred_side text,
        team_number integer
      )
    )
    select 1 from payload
    where id is null
      or display_name is null or btrim(display_name) = ''
      or level is null or level not between 1 and 10
      or seed is null or seed < 0
      or preferred_side not in ('left', 'right', 'both')
      or team_number < 1
  ) or exists (
    select 1
    from jsonb_to_recordset(p_players) as x(id uuid, display_name text)
    group by id having count(*) > 1
  ) or exists (
    select 1
    from jsonb_to_recordset(p_players) as x(id uuid, display_name text)
    group by lower(btrim(display_name)) having count(*) > 1
  ) or exists (
    select 1
    from public.event_players ep
    join jsonb_to_recordset(p_players) as x(id uuid) on x.id = ep.id
    where ep.event_id <> p_event_id
  ) then
    raise exception 'invalid_roster_payload';
  end if;

  if p_rounds_per_cycle is not null then
    if v_event.format <> 'americano' or p_rounds_per_cycle < 1 or v_player_count < 4 then
      raise exception 'invalid_roster_payload';
    end if;
    v_courts := (v_event.settings ->> 'courts')::integer;
    v_team_mode := coalesce(v_event.settings ->> 'team_mode', 'remixed');
    if v_courts < 1 or v_team_mode not in ('remixed', 'fixed') then
      raise exception 'invalid_roster_payload';
    end if;

    if v_team_mode = 'fixed' then
      select count(distinct team_number) into v_team_count
      from jsonb_to_recordset(p_players) as x(team_number integer);
      if v_player_count % 2 <> 0
        or exists (
          select 1
          from jsonb_to_recordset(p_players) as x(team_number integer)
          group by team_number
          having team_number is null or count(*) <> 2
        )
        or v_team_count * 2 <> v_player_count then
        raise exception 'fixed_teams_invalid';
      end if;
      v_logical_rounds := case when v_team_count % 2 = 0 then v_team_count - 1 else v_team_count end;
      v_matches_per_logical := floor(v_team_count / 2.0)::integer;
      v_expected_rounds := v_logical_rounds * ((v_matches_per_logical + v_courts - 1) / v_courts);
    else
      v_active := least(v_courts * 4, floor(v_player_count / 4.0)::integer * 4);
      v_expected_rounds := case
        when v_player_count % 4 = 2 then v_player_count / 2
        else v_player_count - 1
      end;
      while (v_expected_rounds * v_active) % v_player_count <> 0 loop
        v_expected_rounds := v_expected_rounds + 1;
      end loop;
    end if;

    if p_rounds_per_cycle <> v_expected_rounds then
      raise exception 'invalid_roster_payload';
    end if;
    v_event.settings := jsonb_set(
      jsonb_set(v_event.settings, '{rounds}', to_jsonb(v_expected_rounds), true),
      '{rounds_per_cycle}', to_jsonb(v_expected_rounds), true
    );
    update public.events set settings = v_event.settings where id = p_event_id;
  end if;

  delete from public.event_players ep
  where ep.event_id = p_event_id
    and not exists (
      select 1 from jsonb_to_recordset(p_players) as x(id uuid) where x.id = ep.id
    );

  insert into public.event_players as ep (
    id, event_id, display_name, level, seed, preferred_side, team_number
  )
  select
    x.id, p_event_id, btrim(x.display_name), x.level, x.seed, x.preferred_side, x.team_number
  from jsonb_to_recordset(p_players) as x(
    id uuid,
    display_name text,
    level integer,
    seed integer,
    preferred_side text,
    team_number integer
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    level = excluded.level,
    seed = excluded.seed,
    preferred_side = excluded.preferred_side,
    team_number = excluded.team_number
  where ep.event_id = p_event_id;

  return query
  select * from public.event_players ep
  where ep.event_id = p_event_id
  order by ep.seed, ep.id;
end;
$$;

revoke execute on function public.replace_event_roster(uuid, jsonb, integer)
  from public, anon;
grant execute on function public.replace_event_roster(uuid, jsonb, integer)
  to authenticated;
```

The `preferred_side` and `team_number` predicates intentionally allow `NULL`; SQL three-valued logic makes only non-null invalid values enter the `where`. `profile_id` is never accepted from the client and is preserved on conflict. `claim_player` therefore remains possible after launch.

Also remove the broad direct-write policy on `matches`; otherwise the RPC can be bypassed. Preserve only the direct insert paths still used by Mexicano and tournament:

```sql
drop policy if exists "matches_write_organizer" on public.matches;

create policy "matches_insert_organizer_non_americano" on public.matches
  for insert to authenticated
  with check (exists (
    select 1 from public.events e
    where e.id = event_id
      and e.organizer_id = auth.uid()
      and (
        (e.status = 'draft' and e.format in ('mexicano', 'tournament'))
        or (e.status = 'active' and e.format = 'mexicano')
      )
  ));
```

`report_score` and bracket advancement keep working through their existing `SECURITY DEFINER` function; no direct update/delete policy is recreated.

Add a trigger that freezes structural event fields once matches exist, prevents status rollback, and rejects completion while a match is pending. This also serializes safely with the cycle RPC because both the `UPDATE` and `SELECT ... FOR UPDATE` lock the same event row:

```sql
create or replace function public.guard_event_after_launch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'completed' and new.status <> 'completed' then
    raise exception 'event_locked';
  end if;

  if old.status = 'draft' and new.status = 'active' and not exists (
    select 1 from public.matches m where m.event_id = old.id
  ) then
    raise exception 'event_locked';
  end if;

  if exists (select 1 from public.matches m where m.event_id = old.id) then
    if new.organizer_id is distinct from old.organizer_id
      or new.format is distinct from old.format
      or new.settings is distinct from old.settings
      or new.status = 'draft' then
      raise exception 'event_locked';
    end if;
  end if;

  if new.status = 'completed' and old.status <> 'completed' then
    if old.status <> 'active' then
      raise exception 'event_not_active';
    end if;
    if exists (
      select 1 from public.matches m
      where m.event_id = old.id and m.status <> 'done'
    ) then
      raise exception 'cycle_incomplete';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_event_after_launch
  before update on public.events
  for each row execute function public.guard_event_after_launch();

revoke execute on function public.guard_event_after_launch() from public, anon, authenticated;
```

Implement a `SECURITY DEFINER SET search_path = ''` RPC with this transaction order:

```sql
select * into v_event
from public.events
where id = p_event_id
for update;

if not found or auth.uid() is null or v_event.organizer_id is distinct from auth.uid() then
  raise exception 'not_event_organizer';
end if;
if v_event.format <> 'americano' then
  raise exception 'invalid_event_format';
end if;

-- Stabilise les affectations pendant toute la validation/insertion du cycle.
perform 1
from public.event_players
where event_id = p_event_id
order by id
for update;

select coalesce(max(cycle_number), 0), coalesce(max(round_number), 0)
into v_current_cycle, v_last_round
from public.matches
where event_id = p_event_id;

if p_expected_cycle <= v_current_cycle then
  raise exception 'cycle_already_added';
end if;
if p_expected_cycle <> v_current_cycle + 1 then
  raise exception 'unexpected_cycle';
end if;
if p_expected_cycle = 1 and v_event.status <> 'draft' then
  raise exception 'unexpected_cycle';
end if;
if p_expected_cycle > 1 and v_event.status <> 'active' then
  raise exception 'event_not_active';
end if;
if p_expected_cycle > 1 and exists (
  select 1 from public.matches
  where event_id = p_event_id and cycle_number = v_current_cycle and status <> 'done'
) then
  raise exception 'cycle_incomplete';
end if;
```

Resolve SQL settings with exactly the same legacy fallbacks as `resolveAmericanoSettings`:

```sql
v_courts := nullif(v_event.settings ->> 'courts', '')::integer;
v_rounds_per_cycle := coalesce(
  nullif(v_event.settings ->> 'rounds_per_cycle', '')::integer,
  nullif(v_event.settings ->> 'rounds', '')::integer
);
v_team_mode := coalesce(v_event.settings ->> 'team_mode', 'remixed');
select count(*) into v_player_count
from public.event_players where event_id = p_event_id;

if v_courts is null or v_courts < 1
  or v_rounds_per_cycle is null or v_rounds_per_cycle < 1
  or v_player_count < 4
  or v_team_mode not in ('remixed', 'fixed') then
  raise exception 'invalid_cycle_payload';
end if;
```

When `settings` contains the new key `rounds_per_cycle`, recompute the expected duration in SQL and require equality with `v_rounds_per_cycle`. Use the same integer formulas as the roster RPC:

```sql
if v_team_mode = 'fixed' then
  if v_player_count % 2 <> 0 then raise exception 'fixed_teams_invalid'; end if;
  v_team_count := v_player_count / 2;
  v_logical_rounds := case
    when v_team_count % 2 = 0 then v_team_count - 1
    else v_team_count
  end;
  v_matches_per_logical := floor(v_team_count / 2.0)::integer;
  v_expected_rounds := v_logical_rounds
    * ((v_matches_per_logical + v_courts - 1) / v_courts);
else
  v_active := least(v_courts * 4, floor(v_player_count / 4.0)::integer * 4);
  v_expected_rounds := case
    when v_player_count % 4 = 2 then v_player_count / 2
    else v_player_count - 1
  end;
  while (v_expected_rounds * v_active) % v_player_count <> 0 loop
    v_expected_rounds := v_expected_rounds + 1;
  end loop;
end if;

if v_expected_rounds <> v_rounds_per_cycle then
  raise exception 'invalid_cycle_payload';
end if;
```

Skip this automatic-duration check only for a legacy event where `rounds_per_cycle` is absent; its historical `settings.rounds` remains authoritative. Parse `p_matches` consistently with this CTE wherever validation is needed:

```sql
with payload as (
  select * from jsonb_to_recordset(p_matches) as x(
    round_number integer,
    court integer,
    team1_p1 uuid,
    team1_p2 uuid,
    team2_p1 uuid,
    team2_p2 uuid
  )
)
```

Validate the complete candidate before the single insert, in this order:

1. `p_matches` is a non-empty JSON array.
2. Each row has a round and court, four non-null/distinct player ids, `court between 1 and v_courts`, and all four ids belong to `p_event_id`.
3. Grouping the unnested player ids by `(round_number, player_id)` never gives `count(*) > 1`; grouping by `(round_number, court)` never gives `count(*) > 1`.
4. Distinct round numbers are contiguous, their minimum is `v_last_round + 1`, and their count is exactly `v_rounds_per_cycle`.
5. In `remixed` mode, every round has `least(v_courts, floor(v_player_count / 4))` matches and the max/min appearance count across the complete roster differs by at most one. This preserves legacy arbitrary round counts while new automatic cycles remain perfectly equal where the formula allows it.
6. In `fixed` mode, the roster is even, `count(*) filter (where team_number is null) = 0`, every team number groups exactly two players, and `team_count * 2 = v_player_count`. Each match side contains one persisted team, the opponents have distinct team numbers, the payload contains `team_count * (team_count - 1) / 2` matches, and every unordered team pairing occurs exactly once.

Any failure raises `invalid_cycle_payload`, except an invalid fixed roster which raises `fixed_teams_invalid`. Only after every check passes, insert the full array in one statement:

```sql
insert into public.matches (
  event_id, cycle_number, round_number, court,
  team1_p1, team1_p2, team2_p1, team2_p2
)
select
  p_event_id, p_expected_cycle, x.round_number, x.court,
  x.team1_p1, x.team1_p2, x.team2_p1, x.team2_p2
from jsonb_to_recordset(p_matches) as x(
  round_number integer,
  court integer,
  team1_p1 uuid,
  team1_p2 uuid,
  team2_p1 uuid,
  team2_p2 uuid
);

update public.events
set status = case when p_expected_cycle = 1 then 'active' else status end,
    current_round = v_last_round + 1
where id = p_event_id;
```

Finally revoke execution from `public` and `anon`, then grant it to `authenticated`.

- [ ] **Step 4: Mirror the server contract in the local mock**

Add defaults:

```js
if (table === "event_players") base.team_number ??= null;
if (table === "matches") base.cycle_number ??= 1;
```

Implement `rpcReplaceEventRoster(params, user)` first: lock logically by executing synchronously, validate/replace the complete draft roster, preserve `profile_id`, recalculate both round fields when `p_rounds_per_cycle` is supplied, and return the stored rows ordered by `(seed, id)` like SQL. Reject every direct REST POST/PATCH/DELETE on `event_players` with `roster_write_forbidden`; `claim_player` remains the only active-roster mutation.

Then implement `rpcCommitAmericanoCycle(params, user)` with the same legacy fallback, automatic-duration, status, expected-cycle, ownership, payload, fixed-team, pairing-completeness, appearance-spread, and duplicate guards as SQL. Build every row in a temporary local array and call `db.matches.push(...rows)` only after all checks pass. Guard direct Americano match inserts with `match_write_forbidden`. Mirror `guard_event_after_launch` in event PATCH handling: a matchless draft cannot be activated directly, structural settings/status cannot be reverted after launch, and an event with pending matches cannot be completed. Route both new RPCs beside the existing RPCs.

- [ ] **Step 5: Verify persistence behavior**

Run: `node --test scripts/supabase-mock.test.mjs`

Expected: the RPC test passes; only six rows exist after a successful second cycle and a rejected duplicate call.

Then apply every migration, including `0006`, to an isolated local Supabase project and lint the real Postgres schema (Docker/local Supabase is required; this never touches the linked remote project):

```bash
CHECK_DIR="$(mktemp -d /tmp/padelpro-supabase.XXXXXX)"
mkdir -p "$CHECK_DIR/home"
HOME="$CHECK_DIR/home" supabase init --workdir "$CHECK_DIR"
cp -R supabase/migrations/. "$CHECK_DIR/supabase/migrations/"
HOME="$CHECK_DIR/home" supabase start --workdir "$CHECK_DIR"
HOME="$CHECK_DIR/home" supabase db reset --local --no-seed --workdir "$CHECK_DIR"
HOME="$CHECK_DIR/home" supabase db lint --local --level warning --fail-on error --workdir "$CHECK_DIR"
HOME="$CHECK_DIR/home" supabase stop --no-backup --workdir "$CHECK_DIR"
```

Expected: reset applies migrations `0001` through `0006`; lint exits 0. If any command fails, keep the temporary directory for inspection and do not claim the database contract verified.

- [ ] **Step 6: Commit the database contract**

```bash
git add supabase/migrations/0006_americano_team_cycles.sql scripts/supabase-mock.mjs scripts/supabase-mock.test.mjs
git commit -m "feat: commit Americano cycles atomically"
```

---

### Task 8: Pure event planning and client actions

**Files:**
- Create: `src/lib/event-planning.ts`
- Create: `src/lib/event-planning.test.ts`
- Modify: `src/lib/actions.ts:3-129`
- Modify: `src/lib/utils.ts:38-47`

**Interfaces:**
- Produces: `CycleMatchInput`, `PlannedCycle`, `plannedRoundsFromMatches`, `planAmericanoCycle`.
- Produces actions: `replaceEventRoster(eventId, players, roundsPerCycle)` and `addAmericanoCycle(event, players, matches)`.
- `startEvent` uses `commit_americano_cycle` only for Americano; Mexicano and tournament retain their current paths.

- [ ] **Step 1: Write failing event planner tests**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { EventPlayer, Match, PadelEvent } from "./types.ts";
import { planAmericanoCycle } from "./event-planning.ts";

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

function americanoEvent(teamMode: "fixed" | "remixed", status: "draft" | "active"): PadelEvent {
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
): Match {
  return {
    id,
    event_id: "event-1",
    round_number: round,
    cycle_number: 1,
    court: 1,
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

test("fixed initial plan uses persisted teams and cycle 1", () => {
  const result = planAmericanoCycle(fixedEvent(), fixedPlayers(), []);
  assert.equal(result.expectedCycle, 1);
  assert.deepEqual([...new Set(result.matches.map((row) => row.round_number))], [1, 2, 3]);
  assert.equal(result.matches.length, 3);
});

test("remixed next plan reconstructs history and starts cycle 2 at round 4", () => {
  const result = planAmericanoCycle(remixedEvent(), remixedPlayers(), completedCycleOne());
  assert.equal(result.expectedCycle, 2);
  assert.equal(Math.min(...result.matches.map((row) => row.round_number)), 4);
});

test("next plan rejects an unfinished current cycle", () => {
  assert.throws(
    () => planAmericanoCycle(remixedEvent(), remixedPlayers(), pendingCycleOne()),
    /cycle_incomplete/,
  );
});

test("next plan rejects a completed event", () => {
  assert.throws(
    () => planAmericanoCycle(
      { ...remixedEvent(), status: "completed" },
      remixedPlayers(),
      completedCycleOne(),
    ),
    /event_not_active/,
  );
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `node --test src/lib/event-planning.test.ts`

Expected: FAIL because the planner module is missing.

- [ ] **Step 3: Implement the pure adapter**

```ts
import { resolveAmericanoSettings } from "./americano-settings";
import { generateRemixedCycle, type PlannedRound } from "./engine/americano";
import { fixedTeamsFromAssignments } from "./engine/fixed-teams";
import { generateFixedCycle } from "./engine/round-robin";
import type { EventPlayer, Match, PadelEvent } from "./types";

export interface CycleMatchInput {
  round_number: number;
  court: number;
  team1_p1: string;
  team1_p2: string;
  team2_p1: string;
  team2_p2: string;
}

export interface PlannedCycle {
  expectedCycle: number;
  matches: CycleMatchInput[];
}

export function plannedRoundsFromMatches(
  playerIds: readonly string[],
  matches: readonly Match[],
): PlannedRound[] {
  const byRound = new Map<number, Match[]>();
  for (const match of matches) {
    byRound.set(match.round_number, [...(byRound.get(match.round_number) ?? []), match]);
  }
  return [...byRound.entries()].sort(([a], [b]) => a - b).map(([roundNumber, rows]) => {
    const orderedRows = [...rows].sort((a, b) => a.court - b.court);
    if (orderedRows.some((row) => !row.team1_p1 || !row.team1_p2 || !row.team2_p1 || !row.team2_p2)) {
      throw new Error("invalid_cycle_payload");
    }
    const active = new Set(orderedRows.flatMap((row) => [row.team1_p1!, row.team1_p2!, row.team2_p1!, row.team2_p2!]));
    return {
      roundNumber,
      matches: orderedRows.map((row) => ({
        court: row.court,
        team1: [row.team1_p1!, row.team1_p2!],
        team2: [row.team2_p1!, row.team2_p2!],
      })),
      resting: playerIds.filter((id) => !active.has(id)),
    };
  });
}

export function planAmericanoCycle(
  event: PadelEvent,
  players: readonly EventPlayer[],
  matches: readonly Match[],
): PlannedCycle {
  if (event.format !== "americano") throw new Error("invalid_event_format");
  const settings = resolveAmericanoSettings(event.settings);
  const currentCycle = matches.length === 0
    ? 0
    : Math.max(...matches.map((match) => match.cycle_number ?? 1));
  if (
    currentCycle > 0 &&
    matches.some((match) => (match.cycle_number ?? 1) === currentCycle && match.status !== "done")
  ) {
    throw new Error("cycle_incomplete");
  }

  const expectedCycle = currentCycle + 1;
  if (expectedCycle === 1 && event.status !== "draft") throw new Error("unexpected_cycle");
  if (expectedCycle > 1 && event.status !== "active") throw new Error("event_not_active");
  const startRoundNumber = Math.max(0, ...matches.map((match) => match.round_number)) + 1;
  const enginePlayers = players.map((player) => ({
    id: player.id,
    level: player.level,
    side: player.preferred_side,
  }));
  const rounds = settings.teamMode === "fixed"
    ? generateFixedCycle({
        teams: fixedTeamsFromAssignments(
          players.map((player) => ({
            id: player.id,
            level: player.level,
            side: player.preferred_side,
            teamNumber: player.team_number,
          })),
        ),
        courts: event.settings.courts,
        cycleNumber: expectedCycle,
        startRoundNumber,
      })
    : generateRemixedCycle({
        players: enginePlayers,
        roundsPerCycle: settings.roundsPerCycle,
        courts: event.settings.courts,
        mode: settings.composition === "balanced" ? "balanced" : "random",
        previousRounds: plannedRoundsFromMatches(players.map((player) => player.id), matches),
      });

  if (rounds.length !== settings.roundsPerCycle) throw new Error("invalid_cycle_payload");
  return {
    expectedCycle,
    matches: rounds.flatMap((round) =>
      round.matches.map((match) => ({
        round_number: round.roundNumber,
        court: match.court,
        team1_p1: match.team1[0],
        team1_p2: match.team1[1],
        team2_p1: match.team2[0],
        team2_p2: match.team2[1],
      })),
    ),
  };
}
```

- [ ] **Step 4: Make actions thin and RPC-backed**

```ts
export interface RosterPlayerInput {
  id: string;
  display_name: string;
  level: number;
  seed: number;
  preferred_side: PreferredSide | null;
  team_number: number | null;
}

export async function replaceEventRoster(
  eventId: string,
  players: readonly RosterPlayerInput[],
  roundsPerCycle: number | null,
): Promise<string | null> {
  const supabase = createClient();
  const { error } = await supabase.rpc("replace_event_roster", {
    p_event_id: eventId,
    p_players: players,
    p_rounds_per_cycle: roundsPerCycle,
  });
  return error?.message ?? null;
}

async function commitAmericanoCycle(eventId: string, plan: PlannedCycle): Promise<string | null> {
  const supabase = createClient();
  const { error } = await supabase.rpc("commit_americano_cycle", {
    p_event_id: eventId,
    p_expected_cycle: plan.expectedCycle,
    p_matches: plan.matches,
  });
  return error?.message ?? null;
}

export async function addAmericanoCycle(
  event: PadelEvent,
  players: EventPlayer[],
  matches: Match[],
): Promise<string | null> {
  try {
    return await commitAmericanoCycle(event.id, planAmericanoCycle(event, players, matches));
  } catch (error) {
    return error instanceof Error ? error.message : "Génération impossible.";
  }
}
```

Refactor `startEvent`: the Americano branch calls `planAmericanoCycle(event, players, [])` and the RPC; only the existing Mexicano/tournament branches use direct inserts and the explicit status update. Replace the hand-written Mexicano history conversion with `plannedRoundsFromMatches`.

Map all RPC errors listed in Task 7 inside `friendlyError`.

- [ ] **Step 5: Verify planner, engine, lint, and build**

Run: `node --test src/lib/event-planning.test.ts && npm test && npm run lint && npm run build`

Expected: tests pass, ESLint reports zero errors, and Next.js production build succeeds.

- [ ] **Step 6: Commit event actions**

```bash
git add src/lib/event-planning.ts src/lib/event-planning.test.ts src/lib/actions.ts src/lib/utils.ts
git commit -m "feat: plan and append Americano cycles"
```

---

### Task 9: Fixed-team composer and creation wizard

**Files:**
- Create: `src/components/fixed-team-composer.tsx`
- Modify: `src/components/ui.tsx:168-207`
- Modify: `src/app/events/new/page.tsx:1-371`

**Interfaces:**
- `FixedTeamComposer` consumes `players`, `assignments`, `editable`, `onSwap`, `onRegenerate`.
- Wizard persists `team_mode`, `composition`, `rounds_per_cycle`, compatibility `rounds`, and each player's `team_number`.

- [ ] **Step 1: Add a failing wizard slice to `scripts/e2e-team-cycles.mjs`**

The initial script should navigate to `/events/new`, choose `Americano`, select `Par équipes · fixe` and `Manuelle`, add six names, then assert:

```js
await expectVisible(page.getByText("6 joueurs · 3 équipes · 3 rounds · 1 repos par équipe"));
await expectVisible(page.getByRole("group", { name: "Composition des équipes" }));
if ((await page.getByText(/^Équipe [1-3]$/).count()) !== 3) {
  throw new Error("les trois binômes ne sont pas affichés");
}
```

Use the same service contract as the historical E2E. Before running any browser slice, keep these processes available in separate terminals (the build is repeated after every UI change):

```bash
node scripts/supabase-mock.mjs 4545
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4545 npm run build
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4545 npm run start -- -p 3200
```

- [ ] **Step 2: Run the browser slice and confirm RED**

Run the existing mock/build/server setup, then: `node scripts/e2e-team-cycles.mjs`

Expected: FAIL because the variant controls and team composer are not rendered.

- [ ] **Step 3: Implement the accessible controlled composer**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { TeamAssignments } from "@/lib/engine/fixed-teams";

export interface ComposerPlayer {
  id: string;
  name: string;
}

function groupComposerPlayers(players: ComposerPlayer[], assignments: TeamAssignments) {
  const groups = new Map<number, ComposerPlayer[]>();
  for (const player of players) {
    const teamNumber = assignments[player.id];
    if (teamNumber == null) continue;
    groups.set(teamNumber, [...(groups.get(teamNumber) ?? []), player]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([teamNumber, members]) => ({ teamNumber, members }));
}

export function FixedTeamComposer({
  players,
  assignments,
  editable,
  onSwap,
  onRegenerate,
}: {
  players: ComposerPlayer[];
  assignments: TeamAssignments;
  editable: boolean;
  onSwap: (firstId: string, secondId: string) => void;
  onRegenerate?: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const groups = groupComposerPlayers(players, assignments);
  function choose(id: string) {
    if (!editable) return;
    if (!selected) return setSelected(id);
    if (selected !== id) onSwap(selected, id);
    setSelected(null);
  }
  return (
    <section role="group" aria-label="Composition des équipes">
      <p className="sr-only" aria-live="polite">
        {selected ? `${players.find((p) => p.id === selected)?.name} sélectionné, choisis un joueur à échanger.` : ""}
      </p>
      {groups.map(({ teamNumber, members }) => (
        <div key={teamNumber}>
          <p>Équipe {teamNumber}</p>
          {members.map((player) => (
            <button
              key={player.id}
              type="button"
              disabled={!editable}
              aria-pressed={selected === player.id}
              aria-label={`Sélectionner ${player.name}, équipe ${teamNumber}`}
              onClick={() => choose(player.id)}
            >
              {player.name}
            </button>
          ))}
        </div>
      ))}
      {onRegenerate && <Button type="button" onClick={onRegenerate}>Refaire le tirage</Button>}
    </section>
  );
}
```

Style only with existing tokens/components. Add an optional `ariaLabel` prop to `Segmented` and pass it to its `radiogroup`.

- [ ] **Step 4: Update wizard state, validation, preview, and inserts**

Keep the existing `pairing` state for Mexicano/tournament and add `composition` only for Americano. Update the Americano format description so it no longer promises only an individual tournament. The `Manuelle` choice is rendered only when `teamMode === "fixed"`; switching back to remixé normalizes a prior `manual` value to `random`. Switching format must not leak `manual` into tournament `pairing`.

Use stable local ids created only when a player is added:

```ts
interface DraftPlayer {
  id: string;
  name: string;
  level: number;
  side: PreferredSide | null;
}

const [teamMode, setTeamMode] = useState<TeamMode>("remixed");
const [composition, setComposition] = useState<CompositionMode>("random");
const [assignments, setAssignments] = useState<TeamAssignments | null>(null);
```

Build a preview only inside explicit event handlers so a random composition never changes during render:

```ts
function buildAssignments(
  roster: readonly DraftPlayer[],
  mode: CompositionMode,
): TeamAssignments | null {
  if (roster.length < 4 || roster.length % 2 !== 0) return null;
  if (mode === "manual") {
    return Object.fromEntries(roster.map((player, index) => [player.id, Math.floor(index / 2) + 1]));
  }
  return assignmentsFromTeams(
    composeFixedTeams(
      roster.map((player) => ({ id: player.id, level: player.level, side: player.side })),
      mode,
    ),
  );
}

function replaceRoster(next: DraftPlayer[]) {
  setPlayers(next);
  setAssignments(teamMode === "fixed" ? buildAssignments(next, composition) : null);
}
```

`addPlayer` creates `id: crypto.randomUUID()` and calls `replaceRoster`; removal does the same. Switching to fixed mode or changing composition calls `buildAssignments` once with the current roster. Level/side changes rebuild only in balanced fixed mode. `Refaire le tirage` explicitly calls it for random/balanced mode; manual mode exposes selection/exchange but no reroll button. This makes the six-player manual preview appear immediately when the sixth player is added, while an odd roster has `assignments = null`.

`cyclePlan` comes only from `planRemixedCycle` or `planFixedCycle`, never a duplicate formula in the page. Keep the rounds stepper for Mexicano; hide it for new Americanos. Derive `playersValid` from minimum count plus: fixed Americano requires an even roster and a complete assignment map; tournament still requires a pair count; remixé keeps historical odd-roster support.

For Americano only, persist settings as:

```ts
settings: {
  points_per_match: points,
  courts,
  rounds: cyclePlan.roundsPerCycle,
  pairing: composition === "balanced" ? "balanced" : "random",
  team_mode: teamMode,
  composition,
  rounds_per_cycle: cyclePlan.roundsPerCycle,
}
```

For Mexicano and tournament, preserve their current settings shape and use the untouched `pairing` state. The balancing controls read `composition === "balanced"` for Americano and `pairing === "balanced"` otherwise.

After inserting the event, call `replaceEventRoster` for every format instead of writing `event_players` directly:

```ts
const rosterError = await replaceEventRoster(
  event.id,
  players.map((player, index) => ({
    id: player.id,
    display_name: player.name,
    level: player.level,
    seed: index + 1,
    preferred_side: player.side,
    team_number: format === "americano" && teamMode === "fixed"
      ? assignments?.[player.id] ?? null
      : null,
  })),
  format === "americano" ? cyclePlan.roundsPerCycle : null,
);
```

On failure, delete the just-created empty event, surface `friendlyError(rosterError)`, and stay in the wizard. Disable creation when the fixed roster is odd or assignments are absent/incomplete. Show level and side selectors only when balancing is active.

- [ ] **Step 5: Verify the wizard slice and static checks**

Run: `node scripts/e2e-team-cycles.mjs && npm run lint && npm run build`

Expected: the wizard slice passes, the `replace_event_roster` RPC contains three team numbers twice each and the automatic round count, and static checks are clean.

- [ ] **Step 6: Commit the creation flow**

```bash
git add src/components/fixed-team-composer.tsx src/components/ui.tsx src/app/events/new/page.tsx scripts/e2e-team-cycles.mjs
git commit -m "feat: configure fixed teams in Americano wizard"
```

---

### Task 10: Organizer, participant, standings, and podium UI

**Files:**
- Create: `src/components/team-standings.tsx`
- Modify: `src/components/standings.tsx:1-114`
- Modify: `src/components/podium.tsx:1-129`
- Modify: `src/components/match-card.tsx:43-103`
- Modify: `src/app/events/[id]/page.tsx:1-620`
- Modify: `src/app/join/[code]/page.tsx:1-370`

**Interfaces:**
- `Standings` now receives `event` and branches with `resolveAmericanoSettings`.
- `TeamStandings` receives `players`, `matches`, `meId`, and uses `computeTeamStandings`.
- `MatchCard` exposes `data-match-id`, `data-match-status`, `data-cycle-number`, `data-round-number`, `data-court`, and a stable accessible name.

- [ ] **Step 1: Extend the browser scenario and confirm RED**

After wizard creation, the E2E must assert draft preview, launch, badges, three unique cycle-1 pairings, one resting team per round, team table, both cycle actions, cycle 2, and team podium. Run it before implementation.

Run: `node scripts/e2e-team-cycles.mjs`

Expected: FAIL at the first missing draft/cycle UI assertion.

- [ ] **Step 2: Render team standings and podium entries**

Create `TeamStandings` with a semantic `<table>` inside `overflow-x-auto`. Columns are `Équipe`, `J`, `V`, `N`, `D`, `Pour`, `Contre`, `Diff.`. Render two avatars and the `label`; highlight a row when `row.playerIds.includes(meId)`.

Change `Standings` to:

```tsx
export function Standings({ event, players, matches, meId, compact }: StandingsProps) {
  if (event.format === "americano" && resolveAmericanoSettings(event.settings).teamMode === "fixed") {
    return <TeamStandings players={players} matches={matches} meId={meId} />;
  }
  return <IndividualStandings players={players} matches={matches} meId={meId} compact={compact} />;
}
```

In `Podium`, derive normalized entries:

```ts
const fixed = event.format === "americano" && resolveAmericanoSettings(event.settings).teamMode === "fixed";
const entries = fixed
  ? computeTeamStandings(players, matches).slice(0, 3).map((row) => ({
      id: `team-${row.teamNumber}`,
      names: row.names,
      label: row.label,
      metric: `${row.wins} victoire${row.wins === 1 ? "" : "s"}`,
    }))
  : computeStandings(players, matches).slice(0, 3).map((row) => ({
      id: row.playerId,
      names: [row.name],
      label: row.name,
      metric: `${row.pointsFor} pts`,
    }));
```

Reuse the existing podium animation with an avatar stack for `names`.

- [ ] **Step 3: Add organizer cycle state and actions**

Derive `currentCycle = max(match.cycle_number ?? 1)`, its matches, completion state, and fixed/rest labels from the loaded rows. Use `formatRoundLabel` for round pills and cards. When the current Americano cycle is complete, render both:

```tsx
<Button onClick={() => run(() => addAmericanoCycle(event, players, matches))} loading={busy}>
  Ajouter un cycle
</Button>
<Button variant="secondary" onClick={() => setConfirmAction("complete")}>
  Terminer l&apos;événement
</Button>
```

Make `run` return success/failure. Only after a successful addition call `refresh()` and `setViewRound(null)` so the first pending round of the new cycle is selected. Remove the existing ghost action `Terminer l'événement maintenant`: no format may be completed with pending matches, matching the database trigger from Task 7. Keep the existing final-round behavior for Mexicano and tournament.

In fixed draft mode, keep a controlled `draftAssignments` map synchronized from non-null `players[].team_number` and reuse `FixedTeamComposer`. Every structural roster change and every team edit goes through the same atomic full-roster RPC; never issue a direct `event_players` insert, update, or delete from the page.

Derive the automatic duration only when the draft is currently launchable. A legacy Americano passes `null` so its historical settings remain untouched. A fixed draft with an odd or incomplete roster also passes `null`: it may be saved while being edited, but launch stays disabled until the teams are recomposed.

```ts
function automaticRoundsForDraftRoster(
  nextPlayers: readonly RosterPlayerInput[],
  nextAssignments: TeamAssignments,
): number | null {
  if (event.format !== "americano") return null;
  const settings = resolveAmericanoSettings(event.settings);
  if (settings.legacy || nextPlayers.length < 4) return null;

  if (settings.teamMode === "remixed") {
    return planRemixedCycle(nextPlayers.length, event.settings.courts).roundsPerCycle;
  }

  try {
    fixedTeamsFromAssignments(nextPlayers.map((player) => ({
      id: player.id,
      level: player.level,
      side: player.preferred_side ?? undefined,
      teamNumber: nextAssignments[player.id] ?? null,
    })));
    return planFixedCycle(nextPlayers.length / 2, event.settings.courts).roundsPerCycle;
  } catch {
    return null;
  }
}

async function persistDraftRoster(
  nextPlayers: readonly RosterPlayerInput[],
  nextAssignments: TeamAssignments,
): Promise<boolean> {
  setBusy(true);
  const fixed = resolveAmericanoSettings(event.settings).teamMode === "fixed";
  const payload = nextPlayers.map((player, index) => ({
    ...player,
    seed: index + 1,
    team_number: fixed ? nextAssignments[player.id] ?? null : null,
  }));
  const error = await replaceEventRoster(
    event.id,
    payload,
    automaticRoundsForDraftRoster(payload, nextAssignments),
  );
  if (error) setToast({ message: friendlyError(error), tone: "danger" });
  else setDraftAssignments(nextAssignments);
  await refresh();
  setBusy(false);
  return error === null;
}
```

Convert the current rows to `RosterPlayerInput[]` once (`display_name`, level, seed, preferred side, and team number). `addPlayer` appends `{ id: crypto.randomUUID(), ... }`; removal filters the full array. Both call `persistDraftRoster` instead of Supabase table mutations. In fixed mode, an add/remove deliberately clears every team number and shows `Recomposer les équipes`; this permits safe odd intermediate drafts while preventing launch. In remixed mode, the same call immediately recalculates and persists `rounds` and `rounds_per_cycle` whenever at least four players remain.

`Recomposer les équipes` builds sequential pairs for manual mode or calls `composeFixedTeams` for random/balanced mode, then persists the full roster with the resulting map. Exchanges and rerolls use that exact same function. A valid fixed resize therefore updates duration atomically—for example 6 players/3 teams/1 court stores 3 rounds, while 10 players/5 teams/1 court stores 10. Validate launch by calling `fixedTeamsFromAssignments`; display its French error and never call `startEvent` while invalid. The cycle RPC remains the final server-side guard.

For the organizer rest card, derive the active player ids from `roundMatches`. In fixed mode, group the players by `team_number` and list only teams whose two members are absent, using `Équipe N · Alice & Bob`; in remixé retain the existing comma-separated player names. This avoids describing the two members of one fixed pair as two unrelated rests.

- [ ] **Step 4: Add participant labels and stable match controls**

Pass `event` to every `Standings` call. Use `formatRoundLabel(match, event.settings)` for participant cards. Add badges `Équipes fixes/remixées` and `Cycle N`.

Define “ce round” identically on both pages as the smallest global `round_number` containing a pending match:

```ts
const activeRound = Math.min(
  Infinity,
  ...matches.filter((match) => match.status === "pending").map((match) => match.round_number),
);
const activeRoundMatches = matches.filter((match) => match.round_number === activeRound);
const myCurrentMatch = activeRoundMatches.find((match) =>
  [match.team1_p1, match.team1_p2, match.team2_p1, match.team2_p2].includes(meId),
);
const myNextMatch = matches
  .filter((match) => match.status === "pending" && match.round_number >= activeRound)
  .sort((a, b) => a.round_number - b.round_number || a.court - b.court)
  .find((match) =>
    [match.team1_p1, match.team1_p2, match.team2_p1, match.team2_p2].includes(meId),
  );
```

If `activeRound !== Infinity` and `myCurrentMatch` is absent, show `Ton équipe est au repos ce round` in fixed mode or `Tu es au repos ce round` in remixé, then still show the later `myNextMatch` when one exists. If no pending round exists but the event is active, show `Cycle terminé — en attente de l'organisateur` instead of calling that state a rest.

Give `MatchCard` this stable contract:

```tsx
const accessibleName = done
  ? `${t1.join(" et ")} contre ${t2.join(" et ")}, ${match.score1} à ${match.score2}, terrain ${match.court}`
  : `Annoncer le score : ${t1.join(" et ")} contre ${t2.join(" et ")}, terrain ${match.court}`;

<button
  aria-label={accessibleName}
  data-match-id={match.id}
  data-match-status={match.status}
  data-cycle-number={match.cycle_number ?? 1}
  data-round-number={match.round_number}
  data-court={match.court}
  // existing props and classes
>
```

- [ ] **Step 5: Verify UI flow and accessibility**

Run: `node scripts/e2e-team-cycles.mjs && npm run lint && npm run build`

Expected: fixed-team cycle 1 and 2 pass; no page/console errors; all controls are located by role/name or stable `data-*` attributes.

- [ ] **Step 6: Commit event surfaces**

```bash
git add src/components/team-standings.tsx src/components/standings.tsx src/components/podium.tsx src/components/match-card.tsx src/app/events/[id]/page.tsx src/app/join/[code]/page.tsx
git commit -m "feat: manage and display Americano team cycles"
```

---

### Task 11: Complete E2E coverage, documentation, and release verification

**Files:**
- Modify: `scripts/e2e-team-cycles.mjs`
- Modify: `scripts/e2e.mjs:47-82,116-239`
- Modify: `README.md:8-51`

**Interfaces:**
- Existing E2E uses `MatchCard` accessible names/data attributes instead of scanning arbitrary buttons for `&`.
- New E2E independently covers fixed and remixed six-player cycles.

- [ ] **Step 1: Finish the fixed-team E2E**

The scenario must complete these assertions in order:

1. Create fixed/manual six-player Americano and exchange two players.
2. Assert `team_mode=fixed`, `composition=manual`, `rounds=rounds_per_cycle=3`, and three team numbers used exactly twice.
3. Launch and assert `Équipes fixes`, `Cycle 1`, three rounds, three unique team pairings and one resting team per round.
4. Read round 1 through the mock REST API, join as a member of its resting team, assert `Ton équipe est au repos ce round`, then assert that the later `Ton prochain match` contains the same fixed partner.
5. Before scoring, assert the premature completion action is absent.
6. Score all three matches through `[data-match-status="pending"]`.
7. Assert team table headers and two names in each row.
8. Assert `Ajouter un cycle` and `Terminer l'événement` simultaneously.
9. Add cycle 2; assert rounds 4–6, three new match rows, no duplicate `(cycle, round, court)` and unchanged teams.
10. Score cycle 2, finish the event, and assert the podium has two names per team.

- [ ] **Step 2: Add the remixed six-player E2E**

Create a second event with `Individuel · remixé`, `Aléatoire`, six players and one court. Assert the summary `3 rounds · 2 matchs et 1 repos par joueur`. After launch, collect match cards and rest messages for R1–R3 and verify in JavaScript:

```js
for (const name of names) {
  if (appearances.get(name) !== 2) throw new Error(`${name} ne joue pas exactement deux fois`);
  if (rests.get(name) !== 1) throw new Error(`${name} ne se repose pas exactement une fois`);
}
if (new Set(partnerPairs).size !== 6) throw new Error("un partenaire a été répété");
```

- [ ] **Step 3: Harden the historical E2E selectors**

Replace both loops that inspect every button text for `&` with:

```js
const nextPendingMatch = page.locator('[data-match-status="pending"]').first();
await nextPendingMatch.click();
```

Remove the Americano round-stepper manipulation from the creation flow and assert the automatic summary instead. Keep the existing Mexicano behavior untouched. Capture `console.error` in addition to `pageerror`, and fail the run when either collection is non-empty.

- [ ] **Step 4: Update README**

Document:

- Americano `Individuel · remixé` with automatic equitable cycles.
- Americano `Par équipes · fixe` with manual/random/balanced composition and round-robin.
- The `Ajouter un cycle` action and collective ranking.
- Commands `npm test`, `npm run lint`, `npm run build`, `node --test scripts/supabase-mock.test.mjs`, and `node scripts/e2e-team-cycles.mjs`.

- [ ] **Step 5: Run the complete verification sequence**

Run the mock in terminal A and leave it active:

```bash
node scripts/supabase-mock.mjs 4545
```

In terminal B, build against that mock and leave the production server active:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4545 npm run build
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4545 npm run start -- -p 3200
```

Then run in order from terminal C:

```bash
npm test
node --test scripts/supabase-mock.test.mjs
npm run lint
node scripts/e2e.mjs
node scripts/e2e-team-cycles.mjs
git diff --check
git status --short
```

Expected:

- every Node test passes;
- mock integration proves cycle atomicity and roster lock;
- ESLint reports zero errors and warnings;
- production build succeeds;
- both browser scripts exit 0 with no page or console errors;
- `git diff --check` is silent;
- only the intended implementation files are modified before the final commit.

- [ ] **Step 6: Commit documentation and final verification changes**

```bash
git add README.md scripts/e2e.mjs scripts/e2e-team-cycles.mjs
git commit -m "test: cover Americano team cycles end to end"
```
