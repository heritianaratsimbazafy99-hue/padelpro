"use client";

import { Crown } from "lucide-react";
import type { EventPlayer, Match } from "@/lib/types";
import { computeStandings } from "@/lib/engine/standings";
import { Avatar } from "./ui";

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
      <ol>
        {rows.map((row, i) => {
          const me = row.playerId === meId;
          return (
            <li
              key={row.playerId}
              className={`grid items-center gap-2 px-4 py-2.5 border-b border-border last:border-b-0 ${
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
              <span className="tnum text-right text-base font-extrabold">{row.pointsFor}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
