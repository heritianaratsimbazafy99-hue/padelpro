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
  assert.deepEqual(planRemixedCycle(14, 1), {
    activePlayersPerRound: 4,
    matchesPerRound: 1,
    roundsPerCycle: 7,
    matchesPerPlayer: 2,
    restsPerPlayer: 5,
  });
  assert.deepEqual(planRemixedCycle(14, 2), {
    activePlayersPerRound: 8,
    matchesPerRound: 2,
    roundsPerCycle: 7,
    matchesPerPlayer: 4,
    restsPerPlayer: 3,
  });
});

test("fixed cycle duration accounts for court waves", () => {
  assert.equal(planFixedCycle(3, 1).roundsPerCycle, 3);
  assert.equal(planFixedCycle(5, 1).roundsPerCycle, 10);
  assert.equal(planFixedCycle(5, 2).roundsPerCycle, 5);
  assert.equal(planFixedCycle(6, 1).roundsPerCycle, 15);
  assert.equal(planFixedCycle(6, 2).roundsPerCycle, 10);
  assert.equal(planFixedCycle(7, 1).roundsPerCycle, 21);
  assert.equal(planFixedCycle(7, 2).roundsPerCycle, 14);
  assert.equal(planFixedCycle(7, 3).roundsPerCycle, 7);
});

test("cycle planning rejects invalid capacity", () => {
  assert.throws(() => planRemixedCycle(3, 1), /au moins 4/i);
  assert.throws(() => planFixedCycle(1, 1), /au moins 2 équipes/i);
  assert.throws(() => planRemixedCycle(6, 0), /terrain/i);
});
