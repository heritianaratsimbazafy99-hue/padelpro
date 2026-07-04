"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "./supabase/client";
import type { EventFormat, Match } from "./types";

export interface HistoryEntry {
  matchId: string;
  eventId: string;
  eventName: string;
  eventFormat: EventFormat;
  playedAt: string;
  round: number;
  partner: string | null;
  opponents: string[];
  myScore: number;
  theirScore: number;
  result: "win" | "loss" | "draw";
}

/**
 * Historique détaillé d'un compte : tous ses matchs terminés, avec partenaire,
 * adversaires, score et événement, du plus récent au plus ancien.
 */
export function usePlayerHistory(userId: string | null): HistoryEntry[] | null {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data: myPlayers } = await supabase
        .from("event_players")
        .select("id, event_id")
        .eq("profile_id", userId);

      const myIds = (myPlayers ?? []).map((p) => p.id);
      const eventIds = [...new Set((myPlayers ?? []).map((p) => p.event_id))];
      if (myIds.length === 0) {
        setEntries([]);
        return;
      }

      const [{ data: events }, { data: roster }, { data: rawMatches }] = await Promise.all([
        supabase.from("events").select("id, name, format").in("id", eventIds),
        supabase.from("event_players").select("id, display_name").in("event_id", eventIds),
        supabase
          .from("matches")
          .select("*")
          .in("event_id", eventIds)
          .eq("status", "done")
          .order("created_at", { ascending: false }),
      ]);

      const eventById = new Map((events ?? []).map((e) => [e.id, e]));
      const nameOf = new Map((roster ?? []).map((p) => [p.id, p.display_name]));
      const mySet = new Set(myIds);

      const out: HistoryEntry[] = [];
      for (const m of (rawMatches ?? []) as Match[]) {
        const t1 = [m.team1_p1, m.team1_p2].filter(Boolean) as string[];
        const t2 = [m.team2_p1, m.team2_p2].filter(Boolean) as string[];
        const inT1 = t1.some((id) => mySet.has(id));
        const inT2 = t2.some((id) => mySet.has(id));
        if (!inT1 && !inT2) continue;
        const myTeam = inT1 ? t1 : t2;
        const otherTeam = inT1 ? t2 : t1;
        const myScore = (inT1 ? m.score1 : m.score2) ?? 0;
        const theirScore = (inT1 ? m.score2 : m.score1) ?? 0;
        const ev = eventById.get(m.event_id);
        out.push({
          matchId: m.id,
          eventId: m.event_id,
          eventName: ev?.name ?? "Événement",
          eventFormat: (ev?.format ?? "americano") as EventFormat,
          playedAt: m.created_at,
          round: m.round_number,
          partner: myTeam.filter((id) => !mySet.has(id)).map((id) => nameOf.get(id) ?? "?")[0] ?? null,
          opponents: otherTeam.map((id) => nameOf.get(id) ?? "?"),
          myScore,
          theirScore,
          result: myScore > theirScore ? "win" : myScore < theirScore ? "loss" : "draw",
        });
      }
      setEntries(out);
    })();
  }, [supabase, userId]);

  return entries;
}
