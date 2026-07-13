/**
 * Mock Supabase local (GoTrue + PostgREST + RPC) pour l'E2E hors-ligne.
 *
 * Couvre le sous-ensemble utilisé par PadelPro :
 * - Auth : signup, token (password/refresh), user, logout — sessions en mémoire.
 * - REST : select (eq, in, or, order, limit, colonnes), insert, update, delete
 *   sur profiles / events / event_players / matches.
 * - RPC : report_score (avec avancement de bracket), claim_player,
 *   replace_event_roster, commit_americano_cycle et global_leaderboard
 *   (Elo K=32, invités à 1000) — répliques des fonctions SQL.
 *
 * Usage : node scripts/supabase-mock.mjs [port]
 * puis builder l'app avec NEXT_PUBLIC_SUPABASE_URL=http://localhost:<port>.
 */
import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.argv[2] || 4545);

/* ------------------------------------------------------------------ store */
const db = { profiles: [], events: [], event_players: [], matches: [], profile_trophies: [] };
const users = []; // {id, email, password, user_metadata}
const sessions = new Map(); // access_token -> user id

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

function makeSession(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access_token =
    b64url({ alg: "HS256", typ: "JWT" }) +
    "." +
    b64url({ sub: user.id, email: user.email, exp, aud: "authenticated", role: "authenticated" }) +
    ".mock";
  sessions.set(access_token, user.id);
  return {
    access_token,
    refresh_token: "rt_" + uuid(),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    user: publicUser(user),
  };
}
const publicUser = (u) => ({
  id: u.id,
  aud: "authenticated",
  role: "authenticated",
  email: u.email,
  email_confirmed_at: now(),
  user_metadata: u.user_metadata,
  app_metadata: { provider: "email" },
  created_at: now(),
  updated_at: now(),
});

function authedUser(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (!m) return null;
  const uid = sessions.get(m[1]);
  return users.find((u) => u.id === uid) ?? null;
}

/* -------------------------------------------------- PostgREST-like filters */
function parseFilters(params) {
  const filters = [];
  for (const [key, raw] of params.entries()) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(key)) continue;
    if (key === "or") {
      const inner = raw.replace(/^\(|\)$/g, "");
      const parts = splitTop(inner);
      filters.push((row) => parts.some((p) => matchCond(row, p)));
    } else {
      filters.push((row) => matchCond(row, `${key}.${raw}`));
    }
  }
  return (row) => filters.every((f) => f(row));
}
function splitTop(s) {
  const out = [];
  let depth = 0,
    cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
function matchCond(row, cond) {
  // col.op.value  (value may contain dots for in.(...))
  const m = /^([a-zA-Z0-9_]+)\.(eq|neq|in|is)\.(.*)$/.exec(cond);
  if (!m) return true;
  const [, col, op, val] = m;
  const v = row[col];
  if (op === "eq") return String(v) === val;
  if (op === "neq") return String(v) !== val;
  if (op === "is") return val === "null" ? v == null : String(v) === val;
  if (op === "in") {
    const list = val.replace(/^\(|\)$/g, "").split(",").map((x) => x.trim().replace(/^"|"$/g, ""));
    return list.includes(String(v));
  }
  return true;
}
function applyOrder(rows, orderParam) {
  if (!orderParam) return rows;
  const specs = orderParam.split(",").map((part) => {
    const bits = part.split(".");
    return {
      col: bits[0],
      desc: bits.includes("desc"),
      nullsFirst: bits.includes("nullsfirst"),
    };
  });
  return [...rows].sort((a, b) => {
    for (const s of specs) {
      const av = a[s.col],
        bv = b[s.col];
      if (av == null && bv == null) continue;
      if (av == null) return s.nullsFirst ? -1 : 1;
      if (bv == null) return s.nullsFirst ? 1 : -1;
      if (av < bv) return s.desc ? 1 : -1;
      if (av > bv) return s.desc ? -1 : 1;
    }
    return 0;
  });
}
function pickColumns(rows, select) {
  if (!select || select === "*") return rows;
  const cols = select.split(",").map((c) => c.trim());
  if (cols.includes("*")) return rows;
  return rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
}

/* ------------------------------------------------------------ table defaults */
function withDefaults(table, row, user) {
  const base = { id: uuid(), created_at: now(), ...row };
  if (table === "events") {
    base.share_code ??= crypto.randomBytes(3).toString("hex").toUpperCase();
    base.status ??= "draft";
    base.settings ??= {};
    base.current_round ??= 0;
    base.scheduled_at ??= null;
    base.organizer_id ??= user?.id ?? null;
  }
  if (table === "event_players") {
    base.level ??= 5;
    base.seed ??= 0;
    base.profile_id ??= null;
    base.preferred_side ??= null;
    base.team_number ??= null;
  }
  if (table === "profile_trophies") {
    base.unlocked_at ??= now();
  }
  if (table === "matches") {
    base.event_id = canonicalUuid(base.event_id);
    for (const field of MATCH_PLAYER_FIELDS) base[field] = canonicalUuid(base[field]);
    base.score1 ??= null;
    base.score2 ??= null;
    base.status ??= "pending";
    base.bracket_pos ??= row.bracket_pos ?? null;
    base.next_match_pos ??= row.next_match_pos ?? null;
    base.next_match_slot ??= row.next_match_slot ?? null;
    base.reported_by ??= null;
    base.cycle_number ??= 1;
  }
  return base;
}

/* ------------------------------------------------------------------- RPCs */
function rpcReportScore(p) {
  const match = db.matches.find((m) => m.id === p.p_match_id);
  if (!match) throw pgError("match_not_found");
  const event = db.events.find((e) => e.id === match.event_id);
  if (!event || event.share_code !== String(p.p_share_code || "").toUpperCase())
    throw pgError("invalid_share_code");
  if (event.status !== "active") throw pgError("event_not_active");
  if (p.p_score1 < 0 || p.p_score2 < 0) throw pgError("invalid_score");
  if (["americano", "mexicano"].includes(event.format)) {
    const pts = Number(event.settings?.points_per_match ?? 0);
    if (pts > 0 && p.p_score1 + p.p_score2 !== pts) throw pgError("score_sum_mismatch");
  } else if (p.p_score1 === p.p_score2) {
    throw pgError("draw_not_allowed");
  }
  match.score1 = p.p_score1;
  match.score2 = p.p_score2;
  match.status = "done";
  match.reported_by = p.p_reporter ?? match.reported_by;

  if (event.format === "tournament" && match.next_match_pos != null) {
    const winnerT1 = p.p_score1 > p.p_score2;
    const w1 = winnerT1 ? match.team1_p1 : match.team2_p1;
    const w2 = winnerT1 ? match.team1_p2 : match.team2_p2;
    const next = db.matches.find(
      (m) => m.event_id === match.event_id && m.bracket_pos === match.next_match_pos,
    );
    if (next) {
      if (match.next_match_slot === 1) {
        next.team1_p1 = w1;
        next.team1_p2 = w2;
      } else {
        next.team2_p1 = w1;
        next.team2_p2 = w2;
      }
    }
  }
}

function rpcClaimPlayer(p, user) {
  if (!user) throw pgError("not_authenticated");
  const playerId = canonicalUuid(p.p_player_id);
  const player = db.event_players.find((ep) => canonicalUuid(ep.id) === playerId);
  const event = player && db.events.find((e) => e.id === player.event_id);
  if (!player || !event || event.share_code !== String(p.p_share_code || "").toUpperCase())
    throw pgError("player_or_code_invalid");
  player.profile_id = user.id;
  // Réplique SQL : copie du côté préféré depuis le profil au claim.
  const profile = db.profiles.find((pr) => pr.id === user.id);
  player.preferred_side = profile?.preferred_side ?? player.preferred_side ?? null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PG_INTEGER_MIN = -2_147_483_648;
const PG_INTEGER_MAX = 2_147_483_647;
const MATCH_PLAYER_FIELDS = ["team1_p1", "team1_p2", "team2_p1", "team2_p2"];
const canonicalUuid = (value) =>
  typeof value === "string" && UUID_PATTERN.test(value) ? value.toLowerCase() : value;
const isPgInteger = (value) =>
  Number.isInteger(value) && value >= PG_INTEGER_MIN && value <= PG_INTEGER_MAX;

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

const jsonEqual = (left, right) =>
  JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));

function settingInteger(settings, key) {
  const value = settings?.[key];
  if (value == null || value === "") return null;
  if (typeof value === "number") return isPgInteger(value) ? value : Number.NaN;
  if (typeof value !== "string" || !/^[+-]?\d+$/.test(value.trim())) return Number.NaN;
  const parsed = Number(value.trim());
  return isPgInteger(parsed) ? parsed : Number.NaN;
}

function fixedRosterDetails(roster) {
  if (roster.length % 2 !== 0) return null;
  const teams = new Map();
  for (const player of roster) {
    if (!isPgInteger(player.team_number) || player.team_number < 1) return null;
    const members = teams.get(player.team_number) ?? [];
    members.push(player);
    teams.set(player.team_number, members);
  }
  if ([...teams.values()].some((members) => members.length !== 2)) return null;
  if (teams.size * 2 !== roster.length) return null;
  return { teams, teamCount: teams.size };
}

function automaticRoundCount(playerCount, courts, teamMode, teamCount = null) {
  if (teamMode === "fixed") {
    const logicalRounds = teamCount % 2 === 0 ? teamCount - 1 : teamCount;
    const matchesPerLogical = Math.floor(teamCount / 2);
    return logicalRounds * Math.ceil(matchesPerLogical / courts);
  }

  const active = Math.min(courts * 4, Math.floor(playerCount / 4) * 4);
  let rounds = playerCount % 4 === 2 ? playerCount / 2 : playerCount - 1;
  while ((rounds * active) % playerCount !== 0) rounds++;
  return rounds;
}

function validRosterPlayer(player) {
  return Boolean(
    player &&
      typeof player.id === "string" &&
      UUID_PATTERN.test(player.id) &&
      typeof player.display_name === "string" &&
      player.display_name.trim() !== "" &&
      isPgInteger(player.level) &&
      player.level >= 1 &&
      player.level <= 10 &&
      isPgInteger(player.seed) &&
      player.seed >= 0 &&
      (player.preferred_side == null || ["left", "right", "both"].includes(player.preferred_side)) &&
      (player.team_number == null ||
        (isPgInteger(player.team_number) && player.team_number > 0)),
  );
}

function directMatchInsertAllowed(row, user) {
  if (!row || !user) return false;
  const eventId = canonicalUuid(row.event_id);
  const event = db.events.find((candidate) => canonicalUuid(candidate.id) === eventId);
  if (!event || event.organizer_id !== user.id) return false;
  return (
    (event.status === "draft" && ["mexicano", "tournament"].includes(event.format)) ||
    (event.status === "active" && event.format === "mexicano")
  );
}

function matchCycleRoundCourtKey(row) {
  if (!row || row.bracket_pos != null) return null;
  return [
    canonicalUuid(row.event_id),
    row.cycle_number ?? 1,
    row.round_number,
    row.court,
  ].join(":");
}

function rpcReplaceEventRoster(p, user) {
  const eventId = canonicalUuid(p.p_event_id);
  const event = db.events.find((candidate) => canonicalUuid(candidate.id) === eventId);
  if (!event || !user || event.organizer_id !== user.id) throw pgError("not_event_organizer");
  if (event.status !== "draft" || db.matches.some((match) => match.event_id === event.id)) {
    throw pgError("roster_locked");
  }

  const rawRoster = p.p_players;
  if (!Array.isArray(rawRoster)) throw pgError("invalid_roster_payload");
  const roster = rawRoster.map((player) =>
    player && typeof player === "object"
      ? { ...player, id: canonicalUuid(player.id) }
      : player,
  );
  if (roster.some((player) => !validRosterPlayer(player))) {
    throw pgError("invalid_roster_payload");
  }

  const ids = new Set();
  const names = new Set();
  for (const player of roster) {
    const normalizedName = player.display_name.trim().toLowerCase();
    if (ids.has(player.id) || names.has(normalizedName)) {
      throw pgError("invalid_roster_payload");
    }
    ids.add(player.id);
    names.add(normalizedName);
  }
  if (
    db.event_players.some(
      (player) =>
        ids.has(canonicalUuid(player.id)) && canonicalUuid(player.event_id) !== eventId,
    )
  ) {
    throw pgError("invalid_roster_payload");
  }

  let nextSettings = event.settings;
  if (p.p_rounds_per_cycle != null) {
    const roundsPerCycle = p.p_rounds_per_cycle;
    const courts = settingInteger(event.settings, "courts");
    const teamMode = event.settings?.team_mode ?? "remixed";
    if (
      event.format !== "americano" ||
      !isPgInteger(roundsPerCycle) ||
      roundsPerCycle < 1 ||
      roster.length < 4 ||
      !isPgInteger(courts) ||
      courts < 1 ||
      !["remixed", "fixed"].includes(teamMode)
    ) {
      throw pgError("invalid_roster_payload");
    }

    let teamCount = null;
    if (teamMode === "fixed") {
      const fixed = fixedRosterDetails(roster);
      if (!fixed) throw pgError("fixed_teams_invalid");
      teamCount = fixed.teamCount;
    }
    const expectedRounds = automaticRoundCount(roster.length, courts, teamMode, teamCount);
    if (roundsPerCycle !== expectedRounds) throw pgError("invalid_roster_payload");
    nextSettings = {
      ...event.settings,
      rounds: expectedRounds,
      rounds_per_cycle: expectedRounds,
    };
  }

  const existingById = new Map(
    db.event_players
      .filter((player) => player.event_id === event.id)
      .map((player) => [canonicalUuid(player.id), player]),
  );
  const replacement = roster.map((player) => {
    const existing = existingById.get(player.id);
    return {
      ...(existing ?? {}),
      id: player.id,
      event_id: event.id,
      display_name: player.display_name.trim(),
      profile_id: existing?.profile_id ?? null,
      level: player.level,
      seed: player.seed,
      preferred_side: player.preferred_side ?? null,
      team_number: player.team_number ?? null,
      created_at: existing?.created_at ?? now(),
    };
  });

  event.settings = nextSettings;
  db.event_players = db.event_players
    .filter((player) => player.event_id !== event.id)
    .concat(replacement);

  return [...replacement].sort(
    (left, right) => left.seed - right.seed || left.id.localeCompare(right.id),
  );
}

function invalidCyclePayload() {
  throw pgError("invalid_cycle_payload");
}

function rpcCommitAmericanoCycle(p, user) {
  const eventId = canonicalUuid(p.p_event_id);
  const event = db.events.find((candidate) => canonicalUuid(candidate.id) === eventId);
  if (!event || !user || event.organizer_id !== user.id) throw pgError("not_event_organizer");
  if (event.format !== "americano") throw pgError("invalid_event_format");

  const eventMatches = db.matches.filter((match) => match.event_id === event.id);
  const currentCycle = eventMatches.reduce(
    (maximum, match) => Math.max(maximum, Number(match.cycle_number ?? 1)),
    0,
  );
  const lastRound = eventMatches.reduce(
    (maximum, match) => Math.max(maximum, Number(match.round_number ?? 0)),
    0,
  );
  if (!isPgInteger(p.p_expected_cycle)) throw pgError("unexpected_cycle");
  if (p.p_expected_cycle <= currentCycle) throw pgError("cycle_already_added");
  if (p.p_expected_cycle !== currentCycle + 1) throw pgError("unexpected_cycle");
  if (p.p_expected_cycle === 1 && event.status !== "draft") throw pgError("unexpected_cycle");
  if (p.p_expected_cycle > 1 && event.status !== "active") throw pgError("event_not_active");
  if (
    p.p_expected_cycle > 1 &&
    eventMatches.some(
      (match) => Number(match.cycle_number ?? 1) === currentCycle && match.status !== "done",
    )
  ) {
    throw pgError("cycle_incomplete");
  }

  const courts = settingInteger(event.settings, "courts");
  const configuredCycleRounds = settingInteger(event.settings, "rounds_per_cycle");
  const legacyRounds = settingInteger(event.settings, "rounds");
  const roundsPerCycle = configuredCycleRounds ?? legacyRounds;
  const teamMode = event.settings?.team_mode ?? "remixed";
  const roster = db.event_players.filter((player) => player.event_id === event.id);
  if (
    !isPgInteger(courts) ||
    courts < 1 ||
    !isPgInteger(roundsPerCycle) ||
    roundsPerCycle < 1 ||
    roster.length < 4 ||
    !["remixed", "fixed"].includes(teamMode)
  ) {
    invalidCyclePayload();
  }

  let fixed = null;
  if (teamMode === "fixed") {
    fixed = fixedRosterDetails(roster);
    if (!fixed) throw pgError("fixed_teams_invalid");
  }
  if (Object.prototype.hasOwnProperty.call(event.settings ?? {}, "rounds_per_cycle")) {
    const expectedRounds = automaticRoundCount(
      roster.length,
      courts,
      teamMode,
      fixed?.teamCount ?? null,
    );
    if (expectedRounds !== roundsPerCycle) invalidCyclePayload();
  }

  const rawMatches = p.p_matches;
  if (!Array.isArray(rawMatches) || rawMatches.length === 0) invalidCyclePayload();
  const matches = rawMatches.map((match) => {
    if (!match || typeof match !== "object") return match;
    const normalized = { ...match };
    for (const field of MATCH_PLAYER_FIELDS) normalized[field] = canonicalUuid(normalized[field]);
    return normalized;
  });
  const playerIds = new Set(roster.map((player) => player.id));
  const roundCourts = new Set();
  const roundPlayers = new Set();
  const roundMatchCounts = new Map();
  const appearances = new Map(roster.map((player) => [player.id, 0]));

  for (const match of matches) {
    if (
      !match ||
      !isPgInteger(match.round_number) ||
      !isPgInteger(match.court) ||
      match.court < 1 ||
      match.court > courts
    ) {
      invalidCyclePayload();
    }
    const idsInMatch = MATCH_PLAYER_FIELDS.map((field) => match[field]);
    if (
      idsInMatch.some((id) => typeof id !== "string" || !playerIds.has(id)) ||
      new Set(idsInMatch).size !== 4
    ) {
      invalidCyclePayload();
    }

    const roundCourt = `${match.round_number}:${match.court}`;
    if (roundCourts.has(roundCourt)) invalidCyclePayload();
    roundCourts.add(roundCourt);
    roundMatchCounts.set(
      match.round_number,
      (roundMatchCounts.get(match.round_number) ?? 0) + 1,
    );

    for (const id of idsInMatch) {
      const roundPlayer = `${match.round_number}:${id}`;
      if (roundPlayers.has(roundPlayer)) invalidCyclePayload();
      roundPlayers.add(roundPlayer);
      appearances.set(id, appearances.get(id) + 1);
    }
  }

  const roundNumbers = [...roundMatchCounts.keys()].sort((left, right) => left - right);
  if (
    roundNumbers.length !== roundsPerCycle ||
    roundNumbers[0] !== lastRound + 1 ||
    roundNumbers.some((round, index) => round !== lastRound + index + 1)
  ) {
    invalidCyclePayload();
  }

  if (teamMode === "remixed") {
    const matchesPerRound = Math.min(courts, Math.floor(roster.length / 4));
    if ([...roundMatchCounts.values()].some((count) => count !== matchesPerRound)) {
      invalidCyclePayload();
    }
    const counts = [...appearances.values()];
    if (Math.max(...counts) - Math.min(...counts) > 1) invalidCyclePayload();
  } else {
    const teamByPlayer = new Map();
    for (const [teamNumber, members] of fixed.teams) {
      for (const member of members) teamByPlayer.set(member.id, teamNumber);
    }
    const pairings = new Set();
    for (const match of matches) {
      const team1 = teamByPlayer.get(match.team1_p1);
      const team2 = teamByPlayer.get(match.team2_p1);
      if (
        team1 !== teamByPlayer.get(match.team1_p2) ||
        team2 !== teamByPlayer.get(match.team2_p2) ||
        team1 === team2
      ) {
        invalidCyclePayload();
      }
      const pairing = [team1, team2].sort((left, right) => left - right).join(":");
      if (pairings.has(pairing)) invalidCyclePayload();
      pairings.add(pairing);
    }
    const expectedPairings = (fixed.teamCount * (fixed.teamCount - 1)) / 2;
    if (matches.length !== expectedPairings || pairings.size !== expectedPairings) {
      invalidCyclePayload();
    }
  }

  const rows = matches.map((match) =>
    withDefaults(
      "matches",
      {
        event_id: event.id,
        cycle_number: p.p_expected_cycle,
        round_number: match.round_number,
        court: match.court,
        team1_p1: match.team1_p1,
        team1_p2: match.team1_p2,
        team2_p1: match.team2_p1,
        team2_p2: match.team2_p2,
      },
      user,
    ),
  );

  db.matches.push(...rows);
  if (p.p_expected_cycle === 1) event.status = "active";
  event.current_round = lastRound + 1;
}

function rpcGlobalLeaderboard() {
  const ratings = new Map(); // profile_id -> elo
  const stats = new Map(); // profile_id -> {played,wins,losses,draws}
  const claimed = db.event_players.filter((p) => p.profile_id);
  for (const p of claimed) {
    if (!ratings.has(p.profile_id)) {
      ratings.set(p.profile_id, 1000);
      stats.set(p.profile_id, { played: 0, wins: 0, losses: 0, draws: 0 });
    }
  }
  const playerProfile = new Map(db.event_players.map((p) => [p.id, p.profile_id]));
  const ratingOf = (pid) => (pid && playerProfile.get(pid) ? ratings.get(playerProfile.get(pid)) : 1000);

  const done = db.matches
    .filter((m) => m.status === "done")
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  for (const m of done) {
    const t1 = [m.team1_p1, m.team1_p2].filter(Boolean);
    const t2 = [m.team2_p1, m.team2_p2].filter(Boolean);
    if (!t1.length || !t2.length) continue;
    const r1 = t1.reduce((s, p) => s + ratingOf(p), 0) / t1.length;
    const r2 = t2.reduce((s, p) => s + ratingOf(p), 0) / t2.length;
    const e1 = 1 / (1 + 10 ** ((r2 - r1) / 400));
    const s1 = m.score1 > m.score2 ? 1 : m.score1 < m.score2 ? 0 : 0.5;
    for (const [team, exp, score] of [
      [t1, e1, s1],
      [t2, 1 - e1, 1 - s1],
    ]) {
      for (const pid of team) {
        const prof = playerProfile.get(pid);
        if (!prof || !ratings.has(prof)) continue;
        ratings.set(prof, ratings.get(prof) + 32 * (score - exp));
        const st = stats.get(prof);
        st.played++;
        if (score === 1) st.wins++;
        else if (score === 0) st.losses++;
        else st.draws++;
      }
    }
  }
  return [...ratings.entries()]
    .filter(([id]) => stats.get(id).played > 0)
    .map(([id, elo]) => {
      const prof = db.profiles.find((p) => p.id === id);
      const st = stats.get(id);
      return {
        p_id: id,
        p_name: prof?.display_name ?? "Joueur",
        p_elo: Math.round(elo),
        p_played: st.played,
        p_wins: st.wins,
        p_losses: st.losses,
        p_draws: st.draws,
      };
    })
    .sort((a, b) => b.p_elo - a.p_elo);
}

/* Réplique de player_elo_history : même Elo que le leaderboard, mais émet
   un point après chaque match du joueur demandé. */
function rpcPlayerEloHistory(p) {
  const target = p.p_profile_id;
  const ratings = new Map();
  for (const pl of db.event_players.filter((x) => x.profile_id)) {
    if (!ratings.has(pl.profile_id)) ratings.set(pl.profile_id, 1000);
  }
  const playerProfile = new Map(db.event_players.map((x) => [x.id, x.profile_id]));
  const ratingOf = (pid) =>
    pid && playerProfile.get(pid) ? ratings.get(playerProfile.get(pid)) : 1000;

  const out = [];
  const done = db.matches
    .filter((m) => m.status === "done")
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  for (const m of done) {
    const t1 = [m.team1_p1, m.team1_p2].filter(Boolean);
    const t2 = [m.team2_p1, m.team2_p2].filter(Boolean);
    if (!t1.length || !t2.length) continue;
    const r1 = t1.reduce((s, x) => s + ratingOf(x), 0) / t1.length;
    const r2 = t2.reduce((s, x) => s + ratingOf(x), 0) / t2.length;
    const e1 = 1 / (1 + 10 ** ((r2 - r1) / 400));
    const s1 = m.score1 > m.score2 ? 1 : m.score1 < m.score2 ? 0 : 0.5;
    let involved = false;
    for (const [team, exp, score] of [
      [t1, e1, s1],
      [t2, 1 - e1, 1 - s1],
    ]) {
      for (const pid of team) {
        const prof = playerProfile.get(pid);
        if (!prof || !ratings.has(prof)) continue;
        ratings.set(prof, ratings.get(prof) + 32 * (score - exp));
        if (prof === target) involved = true;
      }
    }
    if (involved) {
      out.push({ h_idx: out.length + 1, h_elo: Math.round(ratings.get(target)), h_played_at: m.created_at });
    }
  }
  return out;
}

const pgError = (msg) => Object.assign(new Error(msg), { pg: true });

/* ------------------------------------------------------------------ server */
function send(res, status, body, headers = {}) {
  const data = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Expose-Headers": "*",
    ...headers,
  });
  res.end(data);
}
const readBody = (req) =>
  new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : null);
      } catch {
        resolve(null);
      }
    });
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  if (req.method === "OPTIONS") return send(res, 204);

  /* ---------------- auth (GoTrue) ---------------- */
  if (path === "/auth/v1/signup" && req.method === "POST") {
    const body = await readBody(req);
    if (users.some((u) => u.email === body.email))
      return send(res, 400, { code: 400, msg: "User already registered" });
    const user = {
      id: uuid(),
      email: body.email,
      password: body.password,
      user_metadata: body.data ?? {},
    };
    users.push(user);
    // Réplique du trigger handle_new_user : crée le profil
    db.profiles.push({
      id: user.id,
      display_name: body.data?.display_name ?? body.email.split("@")[0],
      bio: null,
      preferred_side: null,
      racket: null,
      avatar_url: null,
      created_at: now(),
    });
    const session = makeSession(user);
    return send(res, 200, { ...session, user: publicUser(user) });
  }
  if (path === "/auth/v1/token" && req.method === "POST") {
    const grant = url.searchParams.get("grant_type");
    const body = await readBody(req);
    if (grant === "password") {
      const user = users.find((u) => u.email === body.email && u.password === body.password);
      if (!user)
        return send(res, 400, {
          code: 400,
          error_code: "invalid_credentials",
          msg: "Invalid login credentials",
        });
      return send(res, 200, makeSession(user));
    }
    if (grant === "refresh_token") {
      const uid = [...sessions.values()][0];
      const user = users.find((u) => u.id === uid);
      if (!user) return send(res, 400, { code: 400, msg: "Invalid Refresh Token" });
      return send(res, 200, makeSession(user));
    }
    return send(res, 400, { msg: "unsupported grant" });
  }
  if (path === "/auth/v1/user" && req.method === "GET") {
    const user = authedUser(req);
    if (!user) return send(res, 401, { code: 401, msg: "invalid JWT" });
    return send(res, 200, publicUser(user));
  }
  if (path === "/auth/v1/logout") return send(res, 204);

  /* ---------------- rpc ---------------- */
  if (path.startsWith("/rest/v1/rpc/") && req.method === "POST") {
    const fn = path.slice("/rest/v1/rpc/".length);
    const params = (await readBody(req)) ?? {};
    const user = authedUser(req);
    try {
      if (fn === "report_score") {
        rpcReportScore(params);
        return send(res, 204);
      }
      if (fn === "claim_player") {
        rpcClaimPlayer(params, user);
        return send(res, 204);
      }
      if (fn === "replace_event_roster") {
        return send(res, 200, rpcReplaceEventRoster(params, user));
      }
      if (fn === "commit_americano_cycle") {
        rpcCommitAmericanoCycle(params, user);
        return send(res, 204);
      }
      if (fn === "global_leaderboard") return send(res, 200, rpcGlobalLeaderboard());
      if (fn === "player_elo_history") return send(res, 200, rpcPlayerEloHistory(params));
      return send(res, 404, { message: `function ${fn} not found` });
    } catch (e) {
      return send(res, 400, { code: "P0001", message: e.message, details: null, hint: null });
    }
  }

  /* ---------------- rest (PostgREST) ---------------- */
  if (path.startsWith("/rest/v1/")) {
    const table = path.slice("/rest/v1/".length);
    if (!(table in db)) return send(res, 404, { message: `relation ${table} not found` });
    const rows = db[table];
    const match = parseFilters(url.searchParams);
    const wantsObject = (req.headers.accept || "").includes("vnd.pgrst.object+json");
    const select = url.searchParams.get("select") ?? "*";

    if (
      table === "event_players" &&
      ["POST", "PATCH", "DELETE"].includes(req.method)
    ) {
      return send(res, 400, {
        code: "42501",
        message: "roster_write_forbidden",
        details: null,
        hint: null,
      });
    }
    if (table === "matches" && ["PATCH", "DELETE"].includes(req.method)) {
      return send(res, 400, {
        code: "42501",
        message: "match_write_forbidden",
        details: null,
        hint: null,
      });
    }

    if (req.method === "GET") {
      let out = applyOrder(rows.filter(match), url.searchParams.get("order"));
      const limit = url.searchParams.get("limit");
      if (limit) out = out.slice(0, Number(limit));
      out = pickColumns(out, select);
      if (wantsObject) {
        if (out.length === 1) return send(res, 200, out[0]);
        return send(res, 406, {
          code: "PGRST116",
          message: `JSON object requested, multiple (or no) rows returned`,
          details: `The result contains ${out.length} rows`,
        });
      }
      return send(res, 200, out);
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const user = authedUser(req);
      const input = Array.isArray(body) ? body : [body];
      if (table === "matches") {
        if (input.some((row) => !directMatchInsertAllowed(row, user))) {
          return send(res, 400, {
            code: "42501",
            message: "match_write_forbidden",
            details: null,
            hint: null,
          });
        }

        const occupied = new Set(
          db.matches.map(matchCycleRoundCourtKey).filter((key) => key !== null),
        );
        for (const row of input) {
          const key = matchCycleRoundCourtKey(row);
          if (key !== null && occupied.has(key)) {
            return send(res, 409, {
              code: "23505",
              message:
                'duplicate key value violates unique constraint "matches_event_cycle_round_court_unique"',
              details: null,
              hint: null,
            });
          }
          if (key !== null) occupied.add(key);
        }
      }
      const list = input.map((r) => withDefaults(table, r, user));
      rows.push(...list);
      const prefer = req.headers.prefer || "";
      if (prefer.includes("return=representation")) {
        const out = pickColumns(list, select);
        return send(res, 201, wantsObject ? out[0] : out);
      }
      return send(res, 201);
    }

    if (req.method === "PATCH") {
      const body = await readBody(req);
      const targets = rows.filter(match);
      const replacements = targets.map((row) => ({ ...row, ...body }));
      if (table === "events") {
        for (let index = 0; index < targets.length; index++) {
          const oldEvent = targets[index];
          const newEvent = replacements[index];
          const matches = db.matches.filter((candidate) => candidate.event_id === oldEvent.id);

          if (oldEvent.status === "completed" && newEvent.status !== "completed") {
            return send(res, 400, { code: "P0001", message: "event_locked" });
          }
          if (
            oldEvent.status === "draft" &&
            newEvent.status === "active" &&
            matches.length === 0
          ) {
            return send(res, 400, { code: "P0001", message: "event_locked" });
          }
          if (
            matches.length > 0 &&
            (newEvent.organizer_id !== oldEvent.organizer_id ||
              newEvent.format !== oldEvent.format ||
              !jsonEqual(newEvent.settings, oldEvent.settings) ||
              newEvent.status === "draft")
          ) {
            return send(res, 400, { code: "P0001", message: "event_locked" });
          }
          if (newEvent.status === "completed" && oldEvent.status !== "completed") {
            if (oldEvent.status !== "active") {
              return send(res, 400, { code: "P0001", message: "event_not_active" });
            }
            if (matches.some((candidate) => candidate.status !== "done")) {
              return send(res, 400, { code: "P0001", message: "cycle_incomplete" });
            }
          }
        }
      }
      targets.forEach((row, index) => Object.assign(row, replacements[index]));
      const prefer = req.headers.prefer || "";
      if (prefer.includes("return=representation")) {
        const out = pickColumns(targets, select);
        return send(res, 200, wantsObject ? out[0] : out);
      }
      return send(res, 204);
    }

    if (req.method === "DELETE") {
      const targets = rows.filter(match);
      db[table] = rows.filter((r) => !targets.includes(r));
      // Cascade FK comme en SQL
      if (table === "events") {
        const ids = new Set(targets.map((t) => t.id));
        db.event_players = db.event_players.filter((p) => !ids.has(p.event_id));
        db.matches = db.matches.filter((m) => !ids.has(m.event_id));
      }
      return send(res, 204);
    }
  }

  send(res, 404, { message: "not found" });
});

// Realtime : on refuse la connexion WebSocket (l'app a des refresh manuels).
server.on("upgrade", (_req, socket) => socket.destroy());

server.listen(PORT, () => console.log(`[supabase-mock] http://localhost:${PORT}`));
