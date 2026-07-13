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
