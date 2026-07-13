"use client";

import { createClient } from "./supabase/client";
import type { EventPlayer, Match, PadelEvent, PreferredSide } from "./types";
import { generateMexicanoRound, type PlannedRound } from "./engine/americano";
import { buildBracket, composeTeams } from "./engine/bracket";
import { computeStandings } from "./engine/standings";
import {
  plannedRoundsFromMatches,
  planAmericanoCycle,
  type PlannedCycle,
} from "./event-planning";

function roundsToRows(eventId: string, rounds: PlannedRound[]) {
  return rounds.flatMap((r) =>
    r.matches.map((m) => ({
      event_id: eventId,
      round_number: r.roundNumber,
      court: m.court,
      team1_p1: m.team1[0],
      team1_p2: m.team1[1],
      team2_p1: m.team2[0],
      team2_p2: m.team2[1],
    })),
  );
}

export interface RosterPlayerInput {
  id: string;
  display_name: string;
  level: number;
  seed: number;
  preferred_side: PreferredSide | null;
  team_number: number | null;
}

export async function replaceEventRoster(
  eventId: string,
  players: readonly RosterPlayerInput[],
  roundsPerCycle: number | null,
): Promise<string | null> {
  const supabase = createClient();
  const { error } = await supabase.rpc("replace_event_roster", {
    p_event_id: eventId,
    p_players: players,
    p_rounds_per_cycle: roundsPerCycle,
  });
  return error?.message ?? null;
}

async function commitAmericanoCycle(
  eventId: string,
  plan: PlannedCycle,
): Promise<string | null> {
  const supabase = createClient();
  const { error } = await supabase.rpc("commit_americano_cycle", {
    p_event_id: eventId,
    p_expected_cycle: plan.expectedCycle,
    p_matches: plan.matches,
  });
  return error?.message ?? null;
}

export async function addAmericanoCycle(
  event: PadelEvent,
  players: EventPlayer[],
  matches: Match[],
): Promise<string | null> {
  try {
    return await commitAmericanoCycle(event.id, planAmericanoCycle(event, players, matches));
  } catch (error) {
    return error instanceof Error ? error.message : "Génération impossible.";
  }
}

/** Lance l'événement : génère les matchs selon le format et passe en "active". */
export async function startEvent(event: PadelEvent, players: EventPlayer[]): Promise<string | null> {
  const enginePlayers = players.map((p) => ({
    id: p.id,
    level: p.level,
    side: p.preferred_side,
  }));
  const { courts, pairing } = event.settings;

  let rows: Array<Record<string, unknown>> = [];

  try {
    if (event.format === "americano") {
      return await commitAmericanoCycle(event.id, planAmericanoCycle(event, players, []));
    } else if (event.format === "mexicano") {
      // Round 1 : ordre initial selon le mode (niveau ou aléatoire), ensuite le classement décide.
      const ranked =
        pairing === "balanced"
          ? [...enginePlayers].sort((a, b) => b.level - a.level)
          : [...enginePlayers].sort(() => Math.random() - 0.5);
      rows = roundsToRows(event.id, [generateMexicanoRound(ranked, 1, courts, [])]);
    } else {
      const teams = composeTeams(enginePlayers, pairing);
      teams.sort((a, b) => b.strength - a.strength);
      const bracket = buildBracket(
        teams.map((t, i) => ({ p1: t.p1, p2: t.p2, seed: i + 1 })),
        courts,
      );
      rows = bracket.map((m) => ({
        event_id: event.id,
        round_number: m.roundNumber,
        court: m.court,
        team1_p1: m.team1?.p1 ?? null,
        team1_p2: m.team1?.p2 ?? null,
        team2_p1: m.team2?.p1 ?? null,
        team2_p2: m.team2?.p2 ?? null,
        bracket_pos: m.bracketPos,
        next_match_pos: m.nextMatchPos,
        next_match_slot: m.nextMatchSlot,
      }));
    }
  } catch (e) {
    return e instanceof Error ? e.message : "Génération impossible.";
  }

  const supabase = createClient();
  const { error: mErr } = await supabase.from("matches").insert(rows);
  if (mErr) return mErr.message;

  const { error: eErr } = await supabase
    .from("events")
    .update({ status: "active", current_round: 1 })
    .eq("id", event.id);
  return eErr?.message ?? null;
}

/** Mexicano : génère le round suivant à partir du classement courant. */
export async function nextMexicanoRound(
  event: PadelEvent,
  players: EventPlayer[],
  matches: Match[],
): Promise<string | null> {
  const supabase = createClient();
  const standings = computeStandings(players, matches);
  const infoOf = new Map(players.map((p) => [p.id, p]));
  const ranked = standings.map((s) => ({
    id: s.playerId,
    level: infoOf.get(s.playerId)?.level ?? 5,
    side: infoOf.get(s.playerId)?.preferred_side,
  }));

  // Reconstruit l'historique (byes) à partir des matchs déjà joués.
  const playedRounds = plannedRoundsFromMatches(
    players.map((player) => player.id),
    matches,
  );

  const nextNumber = Math.max(0, ...matches.map((m) => m.round_number)) + 1;
  const round = generateMexicanoRound(ranked, nextNumber, event.settings.courts, playedRounds);

  const { error: mErr } = await supabase.from("matches").insert(roundsToRows(event.id, [round]));
  if (mErr) return mErr.message;
  const { error: eErr } = await supabase
    .from("events")
    .update({ current_round: nextNumber })
    .eq("id", event.id);
  return eErr?.message ?? null;
}

/** Termine l'événement (classement figé, podium affiché). */
export async function completeEvent(eventId: string): Promise<string | null> {
  const supabase = createClient();
  const { error } = await supabase.from("events").update({ status: "completed" }).eq("id", eventId);
  return error?.message ?? null;
}

/** Supprime l'événement et toutes ses données. */
export async function deleteEvent(eventId: string): Promise<string | null> {
  const supabase = createClient();
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  return error?.message ?? null;
}
