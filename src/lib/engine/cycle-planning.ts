export interface RemixedCyclePlan {
  activePlayersPerRound: number;
  matchesPerRound: number;
  roundsPerCycle: number;
  matchesPerPlayer: number;
  restsPerPlayer: number;
}

export interface FixedCyclePlan {
  teamCount: number;
  logicalRounds: number;
  matchesPerCycle: number;
  roundsPerCycle: number;
  matchesPerTeam: number;
  restsPerTeam: number;
}

export function planRemixedCycle(playerCount: number, courts: number): RemixedCyclePlan {
  if (playerCount < 4) throw new Error("Il faut au moins 4 joueurs.");
  if (courts < 1) throw new Error("Il faut au moins un terrain.");
  const activePlayersPerRound = Math.min(courts * 4, Math.floor(playerCount / 4) * 4);
  const minimumRounds = playerCount % 4 === 2 ? playerCount / 2 : playerCount - 1;
  let roundsPerCycle = Math.ceil(minimumRounds);
  while ((roundsPerCycle * activePlayersPerRound) % playerCount !== 0) roundsPerCycle++;
  const matchesPerPlayer = (roundsPerCycle * activePlayersPerRound) / playerCount;
  return {
    activePlayersPerRound,
    matchesPerRound: activePlayersPerRound / 4,
    roundsPerCycle,
    matchesPerPlayer,
    restsPerPlayer: roundsPerCycle - matchesPerPlayer,
  };
}

export function planFixedCycle(teamCount: number, courts: number): FixedCyclePlan {
  if (teamCount < 2) throw new Error("Il faut au moins 2 équipes.");
  if (courts < 1) throw new Error("Il faut au moins un terrain.");
  const logicalRounds = teamCount % 2 === 0 ? teamCount - 1 : teamCount;
  const matchesPerLogicalRound = Math.floor(teamCount / 2);
  const roundsPerCycle = logicalRounds * Math.ceil(matchesPerLogicalRound / courts);
  return {
    teamCount,
    logicalRounds,
    matchesPerCycle: (teamCount * (teamCount - 1)) / 2,
    roundsPerCycle,
    matchesPerTeam: teamCount - 1,
    restsPerTeam: roundsPerCycle - (teamCount - 1),
  };
}
