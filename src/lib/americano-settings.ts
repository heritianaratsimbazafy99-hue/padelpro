import type { CompositionMode, EventSettings, Match, TeamMode } from "./types";

export interface ResolvedAmericanoSettings {
  teamMode: TeamMode;
  composition: CompositionMode;
  roundsPerCycle: number;
  legacy: boolean;
}

export function resolveAmericanoSettings(settings: EventSettings): ResolvedAmericanoSettings {
  return {
    teamMode: settings.team_mode ?? "remixed",
    composition: settings.composition ?? settings.pairing,
    roundsPerCycle: settings.rounds_per_cycle ?? settings.rounds,
    legacy:
      settings.team_mode === undefined &&
      settings.composition === undefined &&
      settings.rounds_per_cycle === undefined,
  };
}

export function roundMeta(
  match: Pick<Match, "round_number" | "cycle_number">,
  settings: EventSettings,
) {
  const cycleNumber = match.cycle_number ?? 1;
  const roundsPerCycle = resolveAmericanoSettings(settings).roundsPerCycle;
  return {
    cycleNumber,
    localRound: match.round_number - (cycleNumber - 1) * roundsPerCycle,
  };
}

export function formatRoundLabel(
  match: Pick<Match, "round_number" | "cycle_number">,
  settings: EventSettings,
): string {
  const meta = roundMeta(match, settings);
  return meta.cycleNumber > 1
    ? `Cycle ${meta.cycleNumber} · R${meta.localRound}`
    : `R${meta.localRound}`;
}

export function currentCycleNumber(matches: ReadonlyArray<Pick<Match, "cycle_number">>): number {
  return Math.max(1, ...matches.map((match) => match.cycle_number ?? 1));
}
