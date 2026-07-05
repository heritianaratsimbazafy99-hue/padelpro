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

    setEvent(ev as PadelEvent);
    setPlayers((pls ?? []) as EventPlayer[]);
    setMatches((mts ?? []) as Match[]);
    setNotFound(false);
    setLoading(false);
  }, [supabase, key.id, key.shareCode]);

  useEffect(() => {
    // Chargement initial : les setState de `load` surviennent après des
    // await, jamais de façon synchrone dans le corps de l'effet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
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

  return { event, players, matches, loading, notFound, refresh: load };
}
