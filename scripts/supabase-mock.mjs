/**
 * Mock Supabase local (GoTrue + PostgREST + RPC) pour l'E2E hors-ligne.
 *
 * Couvre le sous-ensemble utilisé par PadelPro :
 * - Auth : signup, token (password/refresh), user, logout — sessions en mémoire.
 * - REST : select (eq, in, or, order, limit, colonnes), insert, update, delete
 *   sur profiles / events / event_players / matches.
 * - RPC : report_score (avec avancement de bracket), claim_player,
 *   global_leaderboard (Elo K=32, invités à 1000) — répliques des fonctions SQL.
 *
 * Usage : node scripts/supabase-mock.mjs [port]
 * puis builder l'app avec NEXT_PUBLIC_SUPABASE_URL=http://localhost:<port>.
 */
import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.argv[2] || 4545);

/* ------------------------------------------------------------------ store */
const db = { profiles: [], events: [], event_players: [], matches: [] };
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
    base.current_round ??= 0;
    base.scheduled_at ??= null;
    base.organizer_id ??= user?.id ?? null;
  }
  if (table === "event_players") {
    base.level ??= 5;
    base.seed ??= 0;
    base.profile_id ??= null;
  }
  if (table === "matches") {
    base.score1 ??= null;
    base.score2 ??= null;
    base.status ??= "pending";
    base.bracket_pos ??= row.bracket_pos ?? null;
    base.next_match_pos ??= row.next_match_pos ?? null;
    base.next_match_slot ??= row.next_match_slot ?? null;
    base.reported_by ??= null;
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
  const player = db.event_players.find((ep) => ep.id === p.p_player_id);
  const event = player && db.events.find((e) => e.id === player.event_id);
  if (!player || !event || event.share_code !== String(p.p_share_code || "").toUpperCase())
    throw pgError("player_or_code_invalid");
  player.profile_id = user.id;
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
      if (fn === "global_leaderboard") return send(res, 200, rpcGlobalLeaderboard());
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
      const list = (Array.isArray(body) ? body : [body]).map((r) => withDefaults(table, r, user));
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
      targets.forEach((r) => Object.assign(r, body));
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
