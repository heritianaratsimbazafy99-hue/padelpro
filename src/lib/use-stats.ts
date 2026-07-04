"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "./supabase/client";
import type { Match } from "./types";

export interface PlayerStats {
  events: number;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  pointsFor: number;
  winRate: number; // 0-100
}

/**
 * Statistiques globales d'un compte : agrège tous les matchs joués via les
 * fiches event_players liées au profil (claim par QR ou invitation).
 */
export function usePlayerStats(userId: string | null): PlayerStats | null {
  const supabase = useMemo(() => createClient(), []);
  const [stats, setStats] = useState<PlayerStats | null>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data: myPlayers } = await supabase
        .from("event_players")
        .select("id, event_id")
        .eq("profile_id", userId);

      const ids = (myPlayers ?? []).map((p) => p.id);
      const eventIds = new Set((myPlayers ?? []).map((p) => p.event_id));
      if (ids.length === 0) {
        setStats({ events: 0, matches: 0, wins: 0, losses: 0, draws: 0, pointsFor: 0, winRate: 0 });
        return;
      }

      const orFilter = ["team1_p1", "team1_p2", "team2_p1", "team2_p2"]
        .map((col) => `${col}.in.(${ids.join(",")})`)
        .join(",");
      const { data: rawMatches } = await supabase
        .from("matches")
        .select("*")
        .eq("status", "done")
        .or(orFilter);

      const idSet = new Set(ids);
      let wins = 0;
      let losses = 0;
      let draws = 0;
      let pointsFor = 0;
      let played = 0;
      for (const m of (rawMatches ?? []) as Match[]) {
        const inT1 = [m.team1_p1, m.team1_p2].some((x) => x && idSet.has(x));
        const inT2 = [m.team2_p1, m.team2_p2].some((x) => x && idSet.has(x));
        if (!inT1 && !inT2) continue;
        const my = inT1 ? (m.score1 ?? 0) : (m.score2 ?? 0);
        const their = inT1 ? (m.score2 ?? 0) : (m.score1 ?? 0);
        played++;
        pointsFor += my;
        if (my > their) wins++;
        else if (my < their) losses++;
        else draws++;
      }
      setStats({
        events: eventIds.size,
        matches: played,
        wins,
        losses,
        draws,
        pointsFor,
        winRate: played > 0 ? Math.round((wins / played) * 100) : 0,
      });
    })();
  }, [supabase, userId]);

  return stats;
}
