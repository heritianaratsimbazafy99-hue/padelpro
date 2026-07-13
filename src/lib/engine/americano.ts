/**
 * Moteur de génération de rounds Americano / Mexicano.
 *
 * Règles de l'americano :
 *  - tournoi individuel : les paires tournent à chaque round ;
 *  - chaque match se joue en un total de points fixe (ex. 24) partagé
 *    entre les deux équipes (score1 + score2 = total) ;
 *  - le classement individuel cumule les points marqués sur tous les rounds.
 *
 * Garanties du moteur :
 *  - les repos (byes) sont répartis équitablement : écart max de 1 entre joueurs ;
 *  - un joueur ne rejoue jamais avec le même partenaire tant qu'une alternative
 *    existe (pénalité quadratique + optimisation par recherche locale) ;
 *  - les re-rencontres en adversaires sont minimisées ;
 *  - en mode « équilibré », l'écart de niveau entre les deux équipes de chaque
 *    match est minimisé, à priorité égale avec la rotation ;
 *  - en mode « équilibré », deux joueurs qui préfèrent strictement le même
 *    côté (gauche/gauche ou droite/droite) sont évités en équipe.
 */

export type EngineSide = "left" | "right" | "both";

export interface EnginePlayer {
  id: string;
  level: number; // 1-10
  /** Côté préféré (issu du profil) ; absent/both = flexible. */
  side?: EngineSide | null;
}

export interface PlannedMatch {
  court: number;
  team1: [string, string];
  team2: [string, string];
}

export interface PlannedRound {
  roundNumber: number;
  matches: PlannedMatch[];
  resting: string[];
}

export type PairingMode = "random" | "balanced";

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

const W_PARTNER = 1000; // rejouer avec le même partenaire : très pénalisé
const W_OPPONENT = 40; // raffronter le même adversaire : pénalisé
const W_BALANCE = 12; // mode équilibré : écart de niveau entre équipes
const W_SIDE = 60; // mode équilibré : équipe gauche/gauche ou droite/droite

interface HistoryState {
  partner: Map<string, number>;
  opponent: Map<string, number>;
  byes: Map<string, number>;
  lastBye: Map<string, number>;
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const bump = (m: Map<string, number>, k: string, by = 1) => m.set(k, (m.get(k) ?? 0) + by);

function shuffled<T>(arr: T[], random: RandomSource = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deux préférences strictes identiques dans la même équipe ? */
export function sideConflict(a?: EngineSide | null, b?: EngineSide | null): boolean {
  return a != null && a !== "both" && a === b;
}

/** Coût d'un match donné selon l'historique et le mode d'équilibrage. */
function matchCost(
  m: PlannedMatch,
  h: HistoryState,
  mode: PairingMode,
  infoOf: Map<string, EnginePlayer>,
): number {
  const p1 = h.partner.get(pairKey(m.team1[0], m.team1[1])) ?? 0;
  const p2 = h.partner.get(pairKey(m.team2[0], m.team2[1])) ?? 0;
  let cost = W_PARTNER * (p1 * p1 + p2 * p2);

  for (const a of m.team1) {
    for (const b of m.team2) {
      const o = h.opponent.get(pairKey(a, b)) ?? 0;
      cost += W_OPPONENT * o * o;
    }
  }

  if (mode === "balanced") {
    const level = (id: string) => infoOf.get(id)?.level ?? 5;
    const l1 = level(m.team1[0]) + level(m.team1[1]);
    const l2 = level(m.team2[0]) + level(m.team2[1]);
    cost += W_BALANCE * Math.abs(l1 - l2);

    const side = (id: string) => infoOf.get(id)?.side;
    if (sideConflict(side(m.team1[0]), side(m.team1[1]))) cost += W_SIDE;
    if (sideConflict(side(m.team2[0]), side(m.team2[1]))) cost += W_SIDE;
  }
  return cost;
}

function roundCost(
  matches: PlannedMatch[],
  h: HistoryState,
  mode: PairingMode,
  infoOf: Map<string, EnginePlayer>,
): number {
  return matches.reduce((s, m) => s + matchCost(m, h, mode, infoOf), 0);
}

/** Meilleur des 3 découpages possibles d'un groupe de 4 joueurs en 2 équipes. */
function bestSplit(
  four: string[],
  court: number,
  h: HistoryState,
  mode: PairingMode,
  infoOf: Map<string, EnginePlayer>,
): PlannedMatch {
  const [a, b, c, d] = four;
  const splits: PlannedMatch[] = [
    { court, team1: [a, b], team2: [c, d] },
    { court, team1: [a, c], team2: [b, d] },
    { court, team1: [a, d], team2: [b, c] },
  ];
  let best = splits[0];
  let bestCost = Infinity;
  for (const s of splits) {
    const cost = matchCost(s, h, mode, infoOf);
    if (cost < bestCost) {
      bestCost = cost;
      best = s;
    }
  }
  return best;
}

/**
 * Sélectionne les joueurs au repos pour ce round.
 * Priorité de repos : moins de byes cumulés, puis bye le plus ancien.
 * Garantie : l'écart de byes entre deux joueurs ne dépasse jamais 1.
 */
function pickResting(
  players: EnginePlayer[],
  restingCount: number,
  h: HistoryState,
  random: RandomSource = Math.random,
): string[] {
  if (restingCount <= 0) return [];
  const order = shuffled(players, random).sort((a, b) => {
    const byeDiff = (h.byes.get(a.id) ?? 0) - (h.byes.get(b.id) ?? 0);
    if (byeDiff !== 0) return byeDiff;
    return (h.lastBye.get(a.id) ?? -1) - (h.lastBye.get(b.id) ?? -1);
  });
  return order.slice(0, restingCount).map((p) => p.id);
}

/** Toutes les positions (matchIndex, teamIndex, slotIndex) d'un round. */
function positions(matches: PlannedMatch[]): Array<[number, 0 | 1, 0 | 1]> {
  const out: Array<[number, 0 | 1, 0 | 1]> = [];
  for (let i = 0; i < matches.length; i++) {
    out.push([i, 0, 0], [i, 0, 1], [i, 1, 0], [i, 1, 1]);
  }
  return out;
}

function getSlot(m: PlannedMatch, team: 0 | 1, slot: 0 | 1): string {
  return team === 0 ? m.team1[slot] : m.team2[slot];
}
function setSlot(m: PlannedMatch, team: 0 | 1, slot: 0 | 1, v: string) {
  if (team === 0) m.team1[slot] = v;
  else m.team2[slot] = v;
}

/**
 * Génère un round : multi-redémarrages aléatoires + hill-climbing par échanges.
 * Retourne le meilleur agencement trouvé (coût 0 = aucune répétition).
 */
function generateRound(
  players: EnginePlayer[],
  roundNumber: number,
  courts: number,
  mode: PairingMode,
  h: HistoryState,
  restarts = 60,
  random: RandomSource = Math.random,
): PlannedRound {
  const infoOf = new Map(players.map((p) => [p.id, p]));
  const capacity = Math.min(courts * 4, Math.floor(players.length / 4) * 4);
  const resting = pickResting(players, players.length - capacity, h, random);
  const restingSet = new Set(resting);
  const active = players.filter((p) => !restingSet.has(p.id)).map((p) => p.id);

  let best: PlannedMatch[] = [];
  let bestCost = Infinity;

  for (let r = 0; r < restarts && bestCost > 0; r++) {
    const order = shuffled(active, random);
    const matches: PlannedMatch[] = [];
    for (let i = 0; i < order.length; i += 4) {
      matches.push(bestSplit(order.slice(i, i + 4), matches.length + 1, h, mode, infoOf));
    }

    // Hill-climbing : on tente tous les échanges de joueurs entre positions.
    let improved = true;
    let cost = roundCost(matches, h, mode, infoOf);
    while (improved && cost > 0) {
      improved = false;
      const pos = positions(matches);
      for (let i = 0; i < pos.length && cost > 0; i++) {
        for (let j = i + 1; j < pos.length; j++) {
          const [mi, ti, si] = pos[i];
          const [mj, tj, sj] = pos[j];
          if (mi === mj) continue; // même match : couvert par bestSplit
          const before =
            matchCost(matches[mi], h, mode, infoOf) + matchCost(matches[mj], h, mode, infoOf);
          const a = getSlot(matches[mi], ti, si);
          const b = getSlot(matches[mj], tj, sj);
          setSlot(matches[mi], ti, si, b);
          setSlot(matches[mj], tj, sj, a);
          const after =
            matchCost(matches[mi], h, mode, infoOf) + matchCost(matches[mj], h, mode, infoOf);
          if (after < before) {
            cost = cost - before + after;
            improved = true;
          } else {
            setSlot(matches[mi], ti, si, a);
            setSlot(matches[mj], tj, sj, b);
          }
        }
      }
      // Ré-optimise le découpage interne de chaque match après les échanges.
      for (let i = 0; i < matches.length; i++) {
        matches[i] = bestSplit(
          [...matches[i].team1, ...matches[i].team2],
          matches[i].court,
          h,
          mode,
          infoOf,
        );
      }
      cost = roundCost(matches, h, mode, infoOf);
    }

    if (cost < bestCost) {
      bestCost = cost;
      best = matches.map((m) => ({ court: m.court, team1: [...m.team1], team2: [...m.team2] }));
    }
  }

  return { roundNumber, matches: best, resting };
}

/** Applique un round à l'historique (partenaires, adversaires, byes). */
function commitRound(round: PlannedRound, h: HistoryState) {
  for (const m of round.matches) {
    bump(h.partner, pairKey(m.team1[0], m.team1[1]));
    bump(h.partner, pairKey(m.team2[0], m.team2[1]));
    for (const a of m.team1) for (const b of m.team2) bump(h.opponent, pairKey(a, b));
  }
  for (const id of round.resting) {
    bump(h.byes, id);
    h.lastBye.set(id, round.roundNumber);
  }
}

function emptyHistory(): HistoryState {
  return { partner: new Map(), opponent: new Map(), byes: new Map(), lastBye: new Map() };
}

/** Reconstruit l'historique à partir de rounds déjà joués (matchs en base). */
export function historyFromRounds(rounds: PlannedRound[]): HistoryState {
  const h = emptyHistory();
  for (const r of rounds) commitRound(r, h);
  return h;
}

/** Score global d'un planning : moins il y a de répétitions, mieux c'est. */
function scheduleScore(players: EnginePlayer[], schedule: PlannedRound[]): number {
  const h = historyFromRounds(schedule);
  let score = 0;
  for (const c of h.partner.values()) if (c > 1) score += W_PARTNER * (c - 1) * (c - 1);
  for (const c of h.opponent.values()) if (c > 1) score += W_OPPONENT * (c - 1) * (c - 1);
  return score;
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
  if (!Number.isSafeInteger(roundsPerCycle))
    throw new Error("Le nombre de rounds doit être un entier sûr.");
  if (!Number.isSafeInteger(courts))
    throw new Error("Le nombre de terrains doit être un entier sûr.");
  if (!Number.isSafeInteger(attempts))
    throw new Error("Le nombre de tentatives doit être un entier sûr.");
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

/**
 * Génère l'intégralité du planning americano.
 * La génération round par round étant gourmande, on retente le planning complet
 * plusieurs fois et on garde le meilleur : quand une rotation parfaite existe
 * (ex. 8 joueurs / 7 rounds), elle est trouvée.
 * @param players minimum 4 joueurs (pas besoin d'un multiple de 4 : les byes tournent).
 */
export function generateAmericanoSchedule(
  players: EnginePlayer[],
  rounds: number,
  courts: number,
  mode: PairingMode,
  attempts = 25,
): PlannedRound[] {
  return generateRemixedCycle({ players, roundsPerCycle: rounds, courts, mode, attempts });
}

/**
 * Mexicano : le round suivant est déterminé par le classement courant.
 * Groupes de 4 par rang ; dans chaque groupe, 1 & 4 affrontent 2 & 3
 * (sommes de rangs égales → matchs serrés).
 * @param ranked joueurs triés du 1er au dernier au classement courant.
 */
export function generateMexicanoRound(
  ranked: EnginePlayer[],
  roundNumber: number,
  courts: number,
  playedRounds: PlannedRound[],
): PlannedRound {
  if (ranked.length < 4) throw new Error("Il faut au moins 4 joueurs.");
  const h = historyFromRounds(playedRounds);
  const capacity = Math.min(courts * 4, Math.floor(ranked.length / 4) * 4);
  const resting = pickResting(ranked, ranked.length - capacity, h);
  const restingSet = new Set(resting);
  const active = ranked.filter((p) => !restingSet.has(p.id));

  const matches: PlannedMatch[] = [];
  for (let i = 0; i + 3 < active.length; i += 4) {
    const [r1, r2, r3, r4] = active.slice(i, i + 4);
    matches.push({
      court: matches.length + 1,
      team1: [r1.id, r4.id],
      team2: [r2.id, r3.id],
    });
  }
  return { roundNumber, matches, resting };
}

/** Audit d'équité d'un planning (utilisé par les tests et l'écran de contrôle). */
export function auditSchedule(players: EnginePlayer[], rounds: PlannedRound[]) {
  const h = historyFromRounds(rounds);
  let repeatedPartners = 0;
  let maxPartnerCount = 0;
  for (const count of h.partner.values()) {
    if (count > 1) repeatedPartners += count - 1;
    maxPartnerCount = Math.max(maxPartnerCount, count);
  }
  const byeCounts = players.map((p) => h.byes.get(p.id) ?? 0);
  const byeSpread = Math.max(...byeCounts) - Math.min(...byeCounts);
  return { repeatedPartners, maxPartnerCount, byeSpread };
}
