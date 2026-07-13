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
