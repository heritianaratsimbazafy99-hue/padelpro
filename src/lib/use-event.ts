"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "./supabase/client";
import type { EventPlayer, Match, PadelEvent } from "./types";

export interface EventData {
  event: PadelEvent | null;
  players: EventPlayer[];
  matches: Match[];
  loading: boolean;
  notFound: boolean;
  refresh: () => Promise<void>;
  /**
   * Marque localement un match comme terminé avec le score donné, sans
   * attendre le serveur (optimistic UI). Renvoie une fonction de rollback
   * à appeler si l'appel RPC échoue.
   */
  applyOptimisticScore: (matchId: string, score1: number, score2: number) => () => void;
}

/**
 * Charge un événement (par id ou share_code) avec joueurs + matchs,
 * et s'abonne aux changements en temps réel (scores, rounds, roster).
 */
export function useEvent(key: { id?: string; shareCode?: string }): EventData {
  const supabase = useMemo(() => createClient(), []);
  const [event, setEvent] = useState<PadelEvent | null>(null);
  const [players, setPlayers] = useState<EventPlayer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const eventIdRef = useRef<string | null>(null);
  // Scores optimistes en attente de confirmation serveur (matchId → score).
  const optimisticRef = useRef(new Map<string, { score1: number; score2: number }>());

  const load = useCallback(async () => {
    let query = supabase.from("events").select("*");
    query = key.id ? query.eq("id", key.id) : query.eq("share_code", (key.shareCode ?? "").toUpperCase());
    const { data: ev } = await query.maybeSingle();

    if (!ev) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    eventIdRef.current = ev.id;

    const [{ data: pls }, { data: mts }] = await Promise.all([
      supabase.from("event_players").select("*").eq("event_id", ev.id).order("created_at"),
      supabase
        .from("matches")
        .select("*")
        .eq("event_id", ev.id)
        .order("round_number")
        .order("bracket_pos", { nullsFirst: true })
        .order("court"),
    ]);

    // Réconciliation : on ré-applique les scores optimistes non confirmés par
    // le serveur (un rechargement en vol ne doit pas faire « re-ouvrir » un
    // match validé) ; dès que le serveur renvoie le match terminé, la vraie
    // donnée reprend la main et l'overlay est levé.
    const merged = ((mts ?? []) as Match[]).map((m) => {
      const opt = optimisticRef.current.get(m.id);
      if (!opt) return m;
      if (m.status === "done") {
        optimisticRef.current.delete(m.id);
        return m;
      }
      return { ...m, score1: opt.score1, score2: opt.score2, status: "done" as const };
    });

    setEvent(ev as PadelEvent);
    setPlayers((pls ?? []) as EventPlayer[]);
    setMatches(merged);
    setNotFound(false);
    setLoading(false);
  }, [supabase, key.id, key.shareCode]);

  const applyOptimisticScore = useCallback(
    (matchId: string, score1: number, score2: number) => {
      optimisticRef.current.set(matchId, { score1, score2 });
      let snapshot: Match | undefined;
      setMatches((prev) =>
        prev.map((m) => {
          if (m.id !== matchId) return m;
          snapshot = m;
          return { ...m, score1, score2, status: "done" as const };
        }),
      );
      // Rollback : lève l'overlay et restaure l'état du match d'avant l'optimisme.
      return () => {
        optimisticRef.current.delete(matchId);
        setMatches((prev) => prev.map((m) => (m.id === matchId && snapshot ? snapshot : m)));
      };
    },
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Realtime : toute modification sur l'événement recharge les données.
  useEffect(() => {
    if (!event?.id) return;
    const channel = supabase
      .channel(`event-${event.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `event_id=eq.${event.id}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events", filter: `id=eq.${event.id}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_players", filter: `event_id=eq.${event.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, event?.id, load]);

  return { event, players, matches, loading, notFound, refresh: load, applyOptimisticScore };
}
