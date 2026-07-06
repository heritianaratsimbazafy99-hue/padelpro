/**
 * Bracket à élimination directe pour tournois de padel (équipes de 2).
 *
 * - Taille du bracket = puissance de 2 supérieure ou égale au nombre d'équipes ;
 * - placement standard des têtes de série (seed 1 et 2 ne se rencontrent qu'en finale) ;
 * - les byes profitent aux meilleures têtes de série et se propagent automatiquement.
 *
 * Numérotation `bracket_pos` : position globale, round 1 = 0..size/2-1,
 * puis chaque round suivant continue la numérotation.
 */

export interface BracketTeam {
  p1: string;
  p2: string;
  seed: number; // 1 = meilleure tête de série
}

export interface BracketMatch {
  roundNumber: number;
  bracketPos: number;
  court: number;
  team1: BracketTeam | null;
  team2: BracketTeam | null;
  nextMatchPos: number | null;
  nextMatchSlot: 1 | 2 | null;
}

/** Ordre standard des seeds pour un bracket de taille `size` (puissance de 2). */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const next: number[] = [];
    const sum = order.length * 2 + 1;
    for (const s of order) next.push(s, sum - s);
    order = next;
  }
  return order;
}

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Construit tous les matchs du bracket. Les équipes absentes (bye ou slots des
 * rounds suivants) sont null ; les byes du round 1 sont propagés immédiatement.
 */
export function buildBracket(teams: BracketTeam[], courts: number): BracketMatch[] {
  if (teams.length < 2) throw new Error("Il faut au moins 2 équipes.");
  const size = nextPowerOfTwo(teams.length);
  const bySeed = new Map(teams.map((t) => [t.seed, t]));
  const order = seedOrder(size);

  const matches: BracketMatch[] = [];
  const totalRounds = Math.log2(size);

  // Position de départ de chaque round dans la numérotation globale.
  const roundStart: number[] = [0];
  for (let r = 1; r < totalRounds; r++) {
    roundStart.push(roundStart[r - 1] + size / Math.pow(2, r));
  }

  for (let r = 0; r < totalRounds; r++) {
    const matchCount = size / Math.pow(2, r + 1);
    for (let i = 0; i < matchCount; i++) {
      const pos = roundStart[r] + i;
      const isFinal = r === totalRounds - 1;
      matches.push({
        roundNumber: r + 1,
        bracketPos: pos,
        court: (i % Math.max(1, courts)) + 1,
        team1: r === 0 ? (bySeed.get(order[i * 2]) ?? null) : null,
        team2: r === 0 ? (bySeed.get(order[i * 2 + 1]) ?? null) : null,
        nextMatchPos: isFinal ? null : roundStart[r + 1] + Math.floor(i / 2),
        nextMatchSlot: isFinal ? null : ((i % 2 === 0 ? 1 : 2) as 1 | 2),
      });
    }
  }

  // Propage les byes du round 1 : une équipe seule avance directement.
  for (const m of matches.filter((m) => m.roundNumber === 1)) {
    const solo = m.team1 && !m.team2 ? m.team1 : !m.team1 && m.team2 ? m.team2 : null;
    if (solo && m.nextMatchPos !== null) {
      const next = matches.find((x) => x.bracketPos === m.nextMatchPos)!;
      if (m.nextMatchSlot === 1) next.team1 = solo;
      else next.team2 = solo;
    }
  }

  // Les matchs de bye (une seule équipe) sont retirés : ils sont déjà résolus.
  return matches.filter((m) => !(m.roundNumber === 1 && (!m.team1 || !m.team2)));
}

/** Libellé du round selon la profondeur restante ("Finale", "Demi-finales"…). */
export function roundLabel(roundNumber: number, totalRounds: number): string {
  const remaining = totalRounds - roundNumber;
  if (remaining === 0) return "Finale";
  if (remaining === 1) return "Demi-finales";
  if (remaining === 2) return "Quarts de finale";
  if (remaining === 3) return "Huitièmes de finale";
  return `Round ${roundNumber}`;
}

/**
 * Compose les équipes d'un tournoi à partir de joueurs individuels.
 * - "balanced" : le meilleur joue avec le moins fort (1+2n, 2+2n-1, …), en
 *   évitant d'associer deux joueurs qui préfèrent strictement le même côté ;
 * - "random"   : tirage aléatoire.
 * Les seeds sont attribués selon la force cumulée de l'équipe.
 */
export function composeTeams(
  players: Array<{ id: string; level: number; side?: "left" | "right" | "both" | null }>,
  mode: "random" | "balanced",
): Array<{ p1: string; p2: string; strength: number }> {
  if (players.length < 4 || players.length % 2 !== 0) {
    throw new Error("Il faut un nombre pair de joueurs (minimum 4).");
  }
  const pool = [...players];
  const teams: Array<{ p1: string; p2: string; strength: number }> = [];
  if (mode === "balanced") {
    pool.sort((a, b) => b.level - a.level);
    const conflict = (a: (typeof pool)[number], b: (typeof pool)[number]) =>
      a.side != null && a.side !== "both" && a.side === b.side;
    while (pool.length) {
      const strong = pool.shift()!;
      // Partenaire le plus faible dont le côté est compatible ; à défaut, le plus faible.
      let pick = pool.length - 1;
      for (let i = pool.length - 1; i >= 0; i--) {
        if (!conflict(strong, pool[i])) {
          pick = i;
          break;
        }
      }
      const weak = pool.splice(pick, 1)[0];
      teams.push({ p1: strong.id, p2: weak.id, strength: strong.level + weak.level });
    }
  } else {
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    while (pool.length) {
      const a = pool.shift()!;
      const b = pool.shift()!;
      teams.push({ p1: a.id, p2: b.id, strength: a.level + b.level });
    }
  }
  return teams;
}
