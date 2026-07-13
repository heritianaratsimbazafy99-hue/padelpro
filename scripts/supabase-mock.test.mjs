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

function directMatchPayload(eventId, roster, overrides = {}) {
  const [a, b, c, d] = [...roster]
    .sort((left, right) => left.seed - right.seed)
    .map((player) => player.id);
  return {
    event_id: eventId,
    round_number: 1,
    court: 1,
    team1_p1: a,
    team1_p2: b,
    team2_p1: c,
    team2_p2: d,
    ...overrides,
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

test("direct non-Americano match inserts mirror the organizer policy", async () => {
  const outsider = await json("/auth/v1/signup", "POST", {
    email: "policy@test.fr",
    password: "MotDePasse!123",
    data: { display_name: "Policy Outsider" },
  }, null);
  const mexicano = await insert("events", {
    organizer_id: event.organizer_id,
    format: "mexicano",
    name: "Mexicano Policy",
    settings: { points_per_match: 24, courts: 1, rounds: 3 },
  });
  const mexicanoRoster = await replaceRoster(mexicano.id, sixRemixedPlayerRows());

  await assert.rejects(
    () => insert("matches", directMatchPayload(mexicano.id, mexicanoRoster), outsider.access_token),
    /match_write_forbidden/,
  );
  assert.equal((await select("matches", `event_id=eq.${mexicano.id}`)).length, 0);
  await insert("matches", directMatchPayload(mexicano.id, mexicanoRoster));
  await patchEvent(mexicano.id, { status: "active" });
  await insert("matches", directMatchPayload(mexicano.id, mexicanoRoster, { round_number: 2 }));

  const tournament = await insert("events", {
    organizer_id: event.organizer_id,
    format: "tournament",
    name: "Tournament Policy",
    settings: { courts: 1 },
  });
  const tournamentRoster = await replaceRoster(tournament.id, sixRemixedPlayerRows());
  await insert("matches", directMatchPayload(tournament.id, tournamentRoster, { bracket_pos: 1 }));
  await patchEvent(tournament.id, { status: "active" });
  await assert.rejects(
    () => insert("matches", directMatchPayload(tournament.id, tournamentRoster, {
      round_number: 2,
      bracket_pos: 2,
    })),
    /match_write_forbidden/,
  );
});

test("the mock enforces the cycle round court unique index atomically", async () => {
  const mexicano = await insert("events", {
    organizer_id: event.organizer_id,
    format: "mexicano",
    name: "Unique Match Index",
    settings: { points_per_match: 24, courts: 1, rounds: 3 },
  });
  const roster = await replaceRoster(mexicano.id, sixRemixedPlayerRows());
  const match = directMatchPayload(mexicano.id, roster);
  await assert.rejects(
    () => insert("matches", [match, { ...match }]),
    /matches_event_cycle_round_court_unique/,
  );
  assert.equal((await select("matches", `event_id=eq.${mexicano.id}`)).length, 0);

  await insert("matches", match);
  await assert.rejects(
    () => insert("matches", { ...match }),
    /matches_event_cycle_round_court_unique/,
  );
  assert.equal((await select("matches", `event_id=eq.${mexicano.id}`)).length, 1);
});

test("roster UUIDs are canonical and case-insensitive", async () => {
  const canonical = await insert("events", {
    organizer_id: event.organizer_id,
    format: "americano",
    name: "Canonical UUID",
    settings: { points_per_match: 24, courts: 1, rounds: 3 },
  });
  const rows = sixRemixedPlayerRows();
  const firstId = rows[0].id;
  rows[0].id = firstId.toUpperCase();
  const stored = await replaceRoster(canonical.id, rows);
  assert.equal(stored.find((player) => player.seed === 1).id, firstId);

  const duplicate = rosterPayload(stored);
  duplicate[1].id = firstId.toUpperCase();
  await assert.rejects(
    () => replaceRoster(canonical.id, duplicate),
    /invalid_roster_payload/,
  );

  const secondEvent = await insert("events", {
    organizer_id: event.organizer_id,
    format: "americano",
    name: "Cross Event UUID",
    settings: { points_per_match: 24, courts: 1, rounds: 3 },
  });
  const crossEvent = sixRemixedPlayerRows();
  crossEvent[0].id = firstId.toUpperCase();
  await assert.rejects(
    () => replaceRoster(secondEvent.id, crossEvent),
    /invalid_roster_payload/,
  );
});

test("null scores stay pending and keep completion and the next cycle blocked", async () => {
  const scoredEvent = await insert("events", {
    organizer_id: event.organizer_id,
    format: "americano",
    name: "Null Score Guard",
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
  const roster = await replaceRoster(scoredEvent.id, sixFixedPlayerRows(), 3);
  await rpc("commit_americano_cycle", cyclePayload(scoredEvent.id, roster, 1));
  const [target, ...otherMatches] = await select("matches", `event_id=eq.${scoredEvent.id}`);

  await assert.rejects(
    () => rpc("report_score", {
      p_match_id: target.id,
      p_share_code: scoredEvent.share_code,
      p_score1: null,
      p_score2: 24,
      p_reporter: "Null Score",
    }),
    /invalid_score/,
  );

  const [unchanged] = await select("matches", `id=eq.${target.id}`);
  assert.equal(unchanged.status, "pending");
  assert.equal(unchanged.score1, null);
  assert.equal(unchanged.score2, null);

  for (const match of otherMatches) {
    await rpc("report_score", {
      p_match_id: match.id,
      p_share_code: scoredEvent.share_code,
      p_score1: 12,
      p_score2: 12,
      p_reporter: "Null Score",
    });
  }
  await assert.rejects(
    () => patchEvent(scoredEvent.id, { status: "completed" }),
    /cycle_incomplete/,
  );
  await assert.rejects(
    () => rpc("commit_americano_cycle", cyclePayload(scoredEvent.id, roster, 2)),
    /cycle_incomplete/,
  );
});

test("a claimed player cannot be reassigned to a second profile", async () => {
  const first = await json("/auth/v1/signup", "POST", {
    email: "claim-first@test.fr",
    password: "MotDePasse!123",
    data: { display_name: "Premier Claim" },
  }, null);
  const second = await json("/auth/v1/signup", "POST", {
    email: "claim-second@test.fr",
    password: "MotDePasse!123",
    data: { display_name: "Second Claim" },
  }, null);
  const claimEvent = await insert("events", {
    organizer_id: event.organizer_id,
    format: "mexicano",
    name: "Claim Ownership",
    settings: { points_per_match: 24, courts: 1, rounds: 3 },
  });
  const roster = await replaceRoster(claimEvent.id, sixRemixedPlayerRows());
  const player = roster[0];

  await rpc("claim_player", {
    p_player_id: player.id,
    p_share_code: claimEvent.share_code,
  }, first.access_token);
  await assert.rejects(
    () => rpc("claim_player", {
      p_player_id: player.id,
      p_share_code: claimEvent.share_code,
    }, second.access_token),
    /player_or_code_invalid/,
  );

  const [claimed] = await select("event_players", `id=eq.${player.id}`);
  assert.equal(claimed.profile_id, first.user.id);
});

test("Mexicano and tournament matches reject players from another event", async () => {
  const foreignEvent = await insert("events", {
    organizer_id: event.organizer_id,
    format: "mexicano",
    name: "Foreign Roster",
    settings: { points_per_match: 24, courts: 1, rounds: 3 },
  });
  const foreignRoster = await replaceRoster(foreignEvent.id, sixRemixedPlayerRows());

  for (const format of ["mexicano", "tournament"]) {
    const ownEvent = await insert("events", {
      organizer_id: event.organizer_id,
      format,
      name: `Cross Event ${format}`,
      settings: { points_per_match: 24, courts: 1, rounds: 3 },
    });
    const ownRoster = await replaceRoster(ownEvent.id, sixRemixedPlayerRows());
    const match = directMatchPayload(ownEvent.id, ownRoster, {
      team2_p2: foreignRoster[0].id,
      ...(format === "tournament" ? { bracket_pos: 1 } : {}),
    });

    await assert.rejects(
      () => insert("matches", match),
      /match_write_forbidden/,
    );
    assert.equal((await select("matches", `event_id=eq.${ownEvent.id}`)).length, 0);
  }
});

test("Mexicano matches cannot be inserted after event completion", async () => {
  const completed = await insert("events", {
    organizer_id: event.organizer_id,
    format: "mexicano",
    name: "Completed Mexicano",
    settings: { points_per_match: 24, courts: 1, rounds: 3 },
  });
  const roster = await replaceRoster(completed.id, sixRemixedPlayerRows());
  const first = await insert("matches", directMatchPayload(completed.id, roster));
  await patchEvent(completed.id, { status: "active" });
  await rpc("report_score", {
    p_match_id: first.id,
    p_share_code: completed.share_code,
    p_score1: 12,
    p_score2: 12,
    p_reporter: "Completed Guard",
  });
  await patchEvent(completed.id, { status: "completed" });

  await assert.rejects(
    () => insert("matches", directMatchPayload(completed.id, roster, { round_number: 2 })),
    /match_write_forbidden/,
  );
  assert.equal((await select("matches", `event_id=eq.${completed.id}`)).length, 1);
});

test("Americano cycle payloads require native JSON numbers and UUID strings", async () => {
  const nativeTypes = await insert("events", {
    organizer_id: event.organizer_id,
    format: "americano",
    name: "Native Cycle Types",
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
  const roster = await replaceRoster(nativeTypes.id, sixFixedPlayerRows(), 3);

  const stringlyNumbers = cyclePayload(nativeTypes.id, roster, 1);
  stringlyNumbers.p_matches[0].round_number = String(
    stringlyNumbers.p_matches[0].round_number,
  );
  stringlyNumbers.p_matches[0].court = String(stringlyNumbers.p_matches[0].court);
  await assert.rejects(
    () => rpc("commit_americano_cycle", stringlyNumbers),
    /invalid_cycle_payload/,
  );

  const scalarUuid = cyclePayload(nativeTypes.id, roster, 1);
  scalarUuid.p_matches[0].team1_p1 = 123;
  await assert.rejects(
    () => rpc("commit_americano_cycle", scalarUuid),
    /invalid_cycle_payload/,
  );
  assert.equal((await select("matches", `event_id=eq.${nativeTypes.id}`)).length, 0);
});
