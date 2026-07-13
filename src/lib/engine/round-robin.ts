import type { PlannedRound } from "./americano.ts";
import { planFixedCycle } from "./cycle-planning.ts";
import type { FixedTeam } from "./fixed-teams.ts";

export interface GenerateFixedCycleOptions {
  teams: readonly FixedTeam[];
  courts: number;
  cycleNumber: number;
  startRoundNumber: number;
}

function requireSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} doit être un entier sûr.`);
}

export function generateFixedCycle({
  teams,
  courts,
  cycleNumber,
  startRoundNumber,
}: GenerateFixedCycleOptions): PlannedRound[] {
  requireSafeInteger(courts, "Le nombre de terrains");
  requireSafeInteger(cycleNumber, "Le numéro de cycle");
  requireSafeInteger(startRoundNumber, "Le numéro de round initial");
  if (teams.length < 2) throw new Error("Il faut au moins 2 équipes.");
  if (courts < 1) throw new Error("Il faut au moins un terrain.");
  if (cycleNumber < 1 || startRoundNumber < 1) {
    throw new Error("Numéro de cycle ou round invalide.");
  }

  const plan = planFixedCycle(teams.length, courts);
  const rotation: Array<FixedTeam | null> = [...teams].sort(
    (first, second) => first.teamNumber - second.teamNumber,
  );
  if (rotation.length % 2 !== 0) rotation.push(null);

  const logicalRounds: Array<Array<[FixedTeam, FixedTeam]>> = [];
  for (let round = 0; round < rotation.length - 1; round++) {
    const pairings: Array<[FixedTeam, FixedTeam]> = [];
    for (let index = 0; index < rotation.length / 2; index++) {
      const first = rotation[index];
      const second = rotation[rotation.length - 1 - index];
      if (first && second) pairings.push([first, second]);
    }
    logicalRounds.push(pairings);
    rotation.splice(1, 0, rotation.pop()!);
  }
  if (cycleNumber % 2 === 0) logicalRounds.reverse();

  const allPlayerIds = teams.flatMap((team) => team.playerIds);
  const rounds: PlannedRound[] = [];
  const courtOffset = (cycleNumber - 1) % courts;
  for (const pairings of logicalRounds) {
    for (let offset = 0; offset < pairings.length; offset += courts) {
      const wave = pairings.slice(offset, offset + courts);
      const matches = wave.map(([first, second], index) => {
        const reverse = cycleNumber % 2 === 0;
        return {
          court: ((index + courtOffset) % courts) + 1,
          team1: [...(reverse ? second.playerIds : first.playerIds)] as [string, string],
          team2: [...(reverse ? first.playerIds : second.playerIds)] as [string, string],
        };
      });
      const activePlayerIds = new Set(
        matches.flatMap((match) => [...match.team1, ...match.team2]),
      );
      rounds.push({
        roundNumber: startRoundNumber + rounds.length,
        matches,
        resting: allPlayerIds.filter((id) => !activePlayerIds.has(id)),
      });
    }
  }

  if (rounds.length !== plan.roundsPerCycle) throw new Error("Cycle fixe incomplet.");
  return rounds;
}

export interface FixedCycleAudit {
  matchCount: number;
  missingPairings: number;
  repeatedPairings: number;
  membershipConflicts: number;
  restConflicts: number;
  teamRoundConflicts: number;
  courtConflicts: number;
  playSpread: number;
  restSpread: number;
}

const teamPairKey = (first: number, second: number) =>
  first < second ? `${first}|${second}` : `${second}|${first}`;

export function auditFixedCycle(
  teams: readonly FixedTeam[],
  rounds: readonly PlannedRound[],
  courts: number,
): FixedCycleAudit {
  requireSafeInteger(courts, "Le nombre de terrains");

  const teamOf = new Map(
    teams.flatMap((team) => team.playerIds.map((id) => [id, team.teamNumber] as const)),
  );
  const membersOf = new Map(
    teams.map((team) => [team.teamNumber, new Set(team.playerIds)] as const),
  );
  const allPlayerIds = teams.flatMap((team) => team.playerIds);
  const pairings = new Map<string, number>();
  const plays = new Map(teams.map((team) => [team.teamNumber, 0]));
  const rests = new Map(teams.map((team) => [team.teamNumber, 0]));
  let membershipConflicts = 0;
  let restConflicts = 0;
  let teamRoundConflicts = 0;
  let courtConflicts = 0;

  for (const round of rounds) {
    const seenTeams = new Set<number>();
    const seenCourts = new Set<number>();
    const activePlayerIds = new Set<string>();
    for (const match of round.matches) {
      if (match.court < 1 || match.court > courts || seenCourts.has(match.court)) {
        courtConflicts++;
      }
      seenCourts.add(match.court);
      for (const id of [...match.team1, ...match.team2]) activePlayerIds.add(id);

      const resolveSide = (side: [string, string]): number | null => {
        const first = teamOf.get(side[0]);
        const second = teamOf.get(side[1]);
        if (first == null || second == null || first !== second || new Set(side).size !== 2) {
          return null;
        }
        const expectedMembers = membersOf.get(first)!;
        return side.every((id) => expectedMembers.has(id)) ? first : null;
      };

      const first = resolveSide(match.team1);
      const second = resolveSide(match.team2);
      if (first == null || second == null || first === second) {
        membershipConflicts++;
        continue;
      }
      for (const teamNumber of [first, second]) {
        if (seenTeams.has(teamNumber)) teamRoundConflicts++;
        seenTeams.add(teamNumber);
      }
      const key = teamPairKey(first, second);
      pairings.set(key, (pairings.get(key) ?? 0) + 1);
    }

    const actualRest = new Set(round.resting);
    const expectedRest = new Set(
      allPlayerIds.filter((id) => !activePlayerIds.has(id)),
    );
    if (
      actualRest.size !== round.resting.length ||
      actualRest.size !== expectedRest.size ||
      [...actualRest].some((id) => !expectedRest.has(id))
    ) {
      restConflicts++;
    }

    for (const team of teams) {
      const target = seenTeams.has(team.teamNumber) ? plays : rests;
      target.set(team.teamNumber, target.get(team.teamNumber)! + 1);
    }
  }

  const expectedPairings = new Set<string>();
  for (let first = 0; first < teams.length; first++) {
    for (let second = first + 1; second < teams.length; second++) {
      expectedPairings.add(teamPairKey(teams[first].teamNumber, teams[second].teamNumber));
    }
  }
  const spread = (values: Iterable<number>) => {
    const list = [...values];
    return Math.max(...list) - Math.min(...list);
  };

  return {
    matchCount: rounds.reduce((sum, round) => sum + round.matches.length, 0),
    missingPairings: [...expectedPairings].filter((key) => !pairings.has(key)).length,
    repeatedPairings: [...pairings.values()].reduce(
      (sum, count) => sum + Math.max(0, count - 1),
      0,
    ),
    membershipConflicts,
    restConflicts,
    teamRoundConflicts,
    courtConflicts,
    playSpread: spread(plays.values()),
    restSpread: spread(rests.values()),
  };
}
