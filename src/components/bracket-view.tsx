"use client";

import type { Match } from "@/lib/types";
import { roundLabel } from "@/lib/engine/bracket";
import { MatchCard } from "./match-card";

/** Tableau du tournoi groupé par round (Quarts → Demi → Finale). */
export function BracketView({
  matches,
  playerName,
  meId,
  onSelect,
}: {
  matches: Match[];
  playerName: (id: string | null) => string | null;
  meId?: string | null;
  onSelect?: (m: Match) => void;
}) {
  const totalRounds = Math.max(0, ...matches.map((m) => m.round_number));
  const byRound = new Map<number, Match[]>();
  for (const m of matches) {
    byRound.set(m.round_number, [...(byRound.get(m.round_number) ?? []), m]);
  }
  const rounds = [...byRound.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div className="flex flex-col gap-6">
      {rounds.map(([num, ms]) => (
        <section key={num}>
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-ink-faint mb-3">
            {roundLabel(num, totalRounds)}
          </h3>
          <div className="flex flex-col gap-3">
            {ms
              .sort((a, b) => (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0))
              .map((m) => {
                const ready = m.team1_p1 && m.team2_p1 && m.status === "pending";
                return (
                  <MatchCard
                    key={m.id}
                    match={m}
                    playerName={playerName}
                    meId={meId}
                    onClick={ready && onSelect ? () => onSelect(m) : undefined}
                  />
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
