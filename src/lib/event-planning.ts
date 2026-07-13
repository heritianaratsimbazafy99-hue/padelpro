import { resolveAmericanoSettings } from "./americano-settings.ts";
import { generateRemixedCycle, type PlannedRound } from "./engine/americano.ts";
import { fixedTeamsFromAssignments } from "./engine/fixed-teams.ts";
import { generateFixedCycle } from "./engine/round-robin.ts";
import type { EventPlayer, Match, PadelEvent } from "./types.ts";

export interface CycleMatchInput {
  round_number: number;
  court: number;
  team1_p1: string;
  team1_p2: string;
  team2_p1: string;
  team2_p2: string;
}

export interface PlannedCycle {
  expectedCycle: number;
  matches: CycleMatchInput[];
}

export function plannedRoundsFromMatches(
  playerIds: readonly string[],
  matches: readonly Match[],
): PlannedRound[] {
  const byRound = new Map<number, Match[]>();
  for (const match of matches) {
    byRound.set(match.round_number, [...(byRound.get(match.round_number) ?? []), match]);
  }

  return [...byRound.entries()]
    .sort(([firstRound], [secondRound]) => firstRound - secondRound)
    .map(([roundNumber, rows]) => {
      const orderedRows = [...rows].sort((first, second) => first.court - second.court);
      if (
        orderedRows.some(
          (row) => !row.team1_p1 || !row.team1_p2 || !row.team2_p1 || !row.team2_p2,
        )
      ) {
        throw new Error("invalid_cycle_payload");
      }
      const active = new Set(
        orderedRows.flatMap((row) => [
          row.team1_p1!,
          row.team1_p2!,
          row.team2_p1!,
          row.team2_p2!,
        ]),
      );
      return {
        roundNumber,
        matches: orderedRows.map((row) => ({
          court: row.court,
          team1: [row.team1_p1!, row.team1_p2!],
          team2: [row.team2_p1!, row.team2_p2!],
        })),
        resting: playerIds.filter((id) => !active.has(id)),
      };
    });
}

export function planAmericanoCycle(
  event: PadelEvent,
  players: readonly EventPlayer[],
  matches: readonly Match[],
): PlannedCycle {
  if (event.format !== "americano") throw new Error("invalid_event_format");

  const settings = resolveAmericanoSettings(event.settings);
  const currentCycle =
    matches.length === 0 ? 0 : Math.max(...matches.map((match) => match.cycle_number ?? 1));
  if (
    currentCycle > 0 &&
    matches.some(
      (match) =>
        (match.cycle_number ?? 1) === currentCycle &&
        (match.status !== "done" || match.score1 == null || match.score2 == null),
    )
  ) {
    throw new Error("cycle_incomplete");
  }

  const expectedCycle = currentCycle + 1;
  if (expectedCycle === 1 && event.status !== "draft") throw new Error("unexpected_cycle");
  if (expectedCycle > 1 && event.status !== "active") throw new Error("event_not_active");

  const startRoundNumber = Math.max(0, ...matches.map((match) => match.round_number)) + 1;
  const enginePlayers = players.map((player) => ({
    id: player.id,
    level: player.level,
    side: player.preferred_side,
  }));
  const rounds =
    settings.teamMode === "fixed"
      ? generateFixedCycle({
          teams: fixedTeamsFromAssignments(
            players.map((player) => ({
              id: player.id,
              level: player.level,
              side: player.preferred_side,
              teamNumber: player.team_number,
            })),
          ),
          courts: event.settings.courts,
          cycleNumber: expectedCycle,
          startRoundNumber,
        })
      : generateRemixedCycle({
          players: enginePlayers,
          roundsPerCycle: settings.roundsPerCycle,
          courts: event.settings.courts,
          mode: settings.composition === "balanced" ? "balanced" : "random",
          previousRounds: plannedRoundsFromMatches(
            players.map((player) => player.id),
            matches,
          ),
        });

  if (rounds.length !== settings.roundsPerCycle) throw new Error("invalid_cycle_payload");

  return {
    expectedCycle,
    matches: rounds.flatMap((round) =>
      round.matches.map((match) => ({
        round_number: round.roundNumber,
        court: match.court,
        team1_p1: match.team1[0],
        team1_p2: match.team1[1],
        team2_p1: match.team2[0],
        team2_p2: match.team2[1],
      })),
    ),
  };
}
