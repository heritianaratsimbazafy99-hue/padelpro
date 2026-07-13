import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EventPlayer } from "./types.ts";
import { getPlayerReporterName, resolveEventPlayerId } from "./event-identity.ts";

function player(overrides: Partial<EventPlayer> & Pick<EventPlayer, "id" | "display_name">): EventPlayer {
  return {
    event_id: "event-1",
    profile_id: null,
    level: 5,
    seed: 1,
    preferred_side: null,
    team_number: null,
    created_at: "2026-07-08T00:00:00.000Z",
    ...overrides,
  };
}

describe("event player identity", () => {
  it("resolves the organizer as a player when their profile is linked", () => {
    const players = [
      player({ id: "p1", display_name: "Mira" }),
      player({ id: "p2", display_name: "Nina", profile_id: "user-organizer" }),
    ];

    assert.equal(resolveEventPlayerId(players, "user-organizer", null), "p2");
  });

  it("uses the stored player choice when no profile-linked player exists", () => {
    const players = [
      player({ id: "p1", display_name: "Mira" }),
      player({ id: "p2", display_name: "Nina" }),
    ];

    assert.equal(resolveEventPlayerId(players, "user-organizer", "p1"), "p1");
  });

  it("reports scores with the selected player name", () => {
    const players = [player({ id: "p1", display_name: "Mira" })];

    assert.equal(getPlayerReporterName(players, "p1", "organisateur"), "Mira");
    assert.equal(getPlayerReporterName(players, null, "organisateur"), "organisateur");
  });
});
