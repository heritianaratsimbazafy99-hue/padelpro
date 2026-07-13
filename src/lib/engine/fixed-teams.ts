import {
  sideConflict,
  type EnginePlayer,
  type PairingMode,
  type RandomSource,
} from "./americano.ts";

export interface FixedTeam {
  teamNumber: number;
  playerIds: [string, string];
}

export type AssignedEnginePlayer = EnginePlayer & { teamNumber: number | null };
export type TeamAssignments = Record<string, number>;

function assertUniquePlayerIds(ids: readonly string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Identifiant de joueur dupliqué : ${id}.`);
    seen.add(id);
  }
}

function shuffled<T>(values: readonly T[], random: RandomSource): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

/** Affectation minimale carrée en O(n³), déterministe à coût égal. */
function minimumCostAssignment(costs: readonly (readonly number[])[]): number[] {
  const size = costs.length;
  const rowPotential = Array<number>(size + 1).fill(0);
  const columnPotential = Array<number>(size + 1).fill(0);
  const matchedRow = Array<number>(size + 1).fill(0);
  const previousColumn = Array<number>(size + 1).fill(0);

  for (let row = 1; row <= size; row++) {
    matchedRow[0] = row;
    let currentColumn = 0;
    const minimum = Array<number>(size + 1).fill(Infinity);
    const used = Array<boolean>(size + 1).fill(false);

    do {
      used[currentColumn] = true;
      const currentRow = matchedRow[currentColumn];
      let delta = Infinity;
      let nextColumn = 0;
      for (let column = 1; column <= size; column++) {
        if (used[column]) continue;
        const candidate =
          costs[currentRow - 1][column - 1] -
          rowPotential[currentRow] -
          columnPotential[column];
        if (candidate < minimum[column]) {
          minimum[column] = candidate;
          previousColumn[column] = currentColumn;
        }
        if (minimum[column] < delta) {
          delta = minimum[column];
          nextColumn = column;
        }
      }
      for (let column = 0; column <= size; column++) {
        if (used[column]) {
          rowPotential[matchedRow[column]] += delta;
          columnPotential[column] -= delta;
        } else {
          minimum[column] -= delta;
        }
      }
      currentColumn = nextColumn;
    } while (matchedRow[currentColumn] !== 0);

    do {
      const nextColumn = previousColumn[currentColumn];
      matchedRow[currentColumn] = matchedRow[nextColumn];
      currentColumn = nextColumn;
    } while (currentColumn !== 0);
  }

  const assignment = Array<number>(size);
  for (let column = 1; column <= size; column++) {
    assignment[matchedRow[column] - 1] = column - 1;
  }
  return assignment;
}

function balancedPairs(players: readonly EnginePlayer[]): Array<[EnginePlayer, EnginePlayer]> {
  const ranked = [...players].sort((a, b) => b.level - a.level);
  const teamCount = ranked.length / 2;
  const strongHalf = ranked.slice(0, teamCount);
  const weakHalf = ranked.slice(teamCount).reverse();
  const maximumRankCost = teamCount * Math.max(0, teamCount - 1);
  const conflictPenalty = maximumRankCost + 1;
  const costs = strongHalf.map((strong, strongIndex) =>
    weakHalf.map((weak, weakIndex) =>
      (sideConflict(strong.side, weak.side) ? conflictPenalty : 0) +
      Math.abs(strongIndex - weakIndex),
    ),
  );
  const assignment = minimumCostAssignment(costs);
  return strongHalf.map((strong, index) => [strong, weakHalf[assignment[index]]]);
}

function pairPool(
  players: readonly EnginePlayer[],
  mode: PairingMode,
  random: RandomSource,
): Array<[EnginePlayer, EnginePlayer]> {
  if (mode === "balanced") return balancedPairs(players);
  const pool = shuffled(players, random);
  const pairs: Array<[EnginePlayer, EnginePlayer]> = [];
  while (pool.length > 0) pairs.push([pool.shift()!, pool.shift()!]);
  return pairs;
}

export function composeFixedTeams(
  players: readonly EnginePlayer[],
  mode: PairingMode,
  random: RandomSource = Math.random,
): FixedTeam[] {
  assertUniquePlayerIds(players.map((player) => player.id));
  if (players.length < 4 || players.length % 2 !== 0) {
    throw new Error("Il faut un nombre pair de joueurs (minimum 4).");
  }
  return pairPool(players, mode, random).map(([first, second], index) => ({
    teamNumber: index + 1,
    playerIds: [first.id, second.id],
  }));
}

export function assignmentsFromTeams(teams: readonly FixedTeam[]): TeamAssignments {
  assertUniquePlayerIds(teams.flatMap((team) => team.playerIds));
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
  assertUniquePlayerIds(players.map((player) => player.id));
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
