"use client";

import { useLayoutEffect, useRef } from "react";
import { Crown } from "lucide-react";
import type { EventPlayer, Match } from "@/lib/types";
import { computeStandings } from "@/lib/engine/standings";
import { Avatar, PopValue } from "./ui";

const medalTones = [
  "bg-lime/15 text-court border-lime/30",
  "bg-surface-3 text-ink-muted border-border-strong",
  "bg-amber-600/15 text-amber-700 border-amber-600/30",
];

/** Classement live americano/mexicano : points cumulés, victoires, diff. */
export function Standings({
  players,
  matches,
  meId,
  compact,
}: {
  players: EventPlayer[];
  matches: Match[];
  meId?: string | null;
  compact?: boolean;
}) {
  const rows = computeStandings(players, matches);
  const anyPlayed = rows.some((r) => r.played > 0);

  /* FLIP : quand l'ordre change (score optimiste, Realtime), chaque ligne
     glisse de son ancienne position vers la nouvelle au lieu de sauter. */
  const listRef = useRef<HTMLOListElement>(null);
  const prevTops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const items = Array.from(list.querySelectorAll<HTMLElement>("[data-player-row]"));
    const nextTops = new Map<string, number>();
    for (const el of items) {
      const id = el.dataset.playerRow!;
      const top = el.getBoundingClientRect().top;
      const prev = prevTops.current.get(id);
      if (!reduced && prev !== undefined && Math.abs(prev - top) > 1) {
        el.animate(
          [{ transform: `translateY(${prev - top}px)` }, { transform: "translateY(0)" }],
          { duration: 450, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );
      }
      nextTops.set(id, top);
    }
    prevTops.current = nextTops;
  });

  return (
    <div className="bg-surface border border-border rounded-(--radius-card) overflow-hidden">
      <div
        className="grid items-center gap-2 px-4 py-2.5 text-[0.6875rem] font-bold text-ink-faint uppercase tracking-wider border-b border-border"
        style={{ gridTemplateColumns: compact ? "2rem 1fr 3rem" : "2rem 1fr 2.5rem 2.5rem 3rem" }}
      >
        <span>#</span>
        <span>Joueur</span>
        {!compact && (
          <>
            <span className="text-center">J</span>
            <span className="text-center">V</span>
          </>
        )}
        <span className="text-right">Pts</span>
      </div>
      <ol ref={listRef}>
        {rows.map((row, i) => {
          const me = row.playerId === meId;
          return (
            <li
              key={row.playerId}
              data-player-row={row.playerId}
              className={`grid items-center gap-2 px-4 py-2.5 border-b border-border last:border-b-0 bg-surface ${
                me ? "bg-lime/5" : ""
              }`}
              style={{
                gridTemplateColumns: compact ? "2rem 1fr 3rem" : "2rem 1fr 2.5rem 2.5rem 3rem",
              }}
            >
              <span
                className={`inline-flex items-center justify-center size-6 rounded-full border text-xs font-extrabold ${
                  anyPlayed && i < 3 ? medalTones[i] : "border-transparent text-ink-faint"
                }`}
              >
                {anyPlayed && i === 0 ? <Crown className="size-3.5" aria-label="1er" /> : i + 1}
              </span>
              <span className="flex items-center gap-2 min-w-0">
                <Avatar name={row.name} size="sm" />
                <span className={`truncate text-sm ${me ? "font-bold text-court" : "font-semibold"}`}>
                  {row.name}
                  {me && <span className="text-ink-faint font-medium"> (toi)</span>}
                </span>
              </span>
              {!compact && (
                <>
                  <span className="tnum text-center text-sm text-ink-muted">{row.played}</span>
                  <span className="tnum text-center text-sm text-ink-muted">{row.wins}</span>
                </>
              )}
              <span className="tnum text-right text-base font-extrabold">
                <PopValue value={row.pointsFor} />
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
