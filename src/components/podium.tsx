"use client";

import { Trophy } from "lucide-react";
import type { EventPlayer, Match, PadelEvent } from "@/lib/types";
import { computeStandings } from "@/lib/engine/standings";
import { Avatar } from "./ui";

/** Podium de fin d'événement (americano/mexicano : top 3 aux points ; tournoi : finalistes). */
export function Podium({
  event,
  players,
  matches,
}: {
  event: PadelEvent;
  players: EventPlayer[];
  matches: Match[];
}) {
  const nameOf = (id: string | null) => players.find((p) => p.id === id)?.display_name ?? null;

  let podium: Array<{ names: string[]; label: string }> = [];

  if (event.format === "tournament") {
    const totalRounds = Math.max(0, ...matches.map((m) => m.round_number));
    const final = matches.find((m) => m.round_number === totalRounds && m.status === "done");
    if (final) {
      const t1Won = (final.score1 ?? 0) > (final.score2 ?? 0);
      const winners = t1Won ? [final.team1_p1, final.team1_p2] : [final.team2_p1, final.team2_p2];
      const losers = t1Won ? [final.team2_p1, final.team2_p2] : [final.team1_p1, final.team1_p2];
      podium = [
        { names: winners.map(nameOf).filter(Boolean) as string[], label: "Champions" },
        { names: losers.map(nameOf).filter(Boolean) as string[], label: "Finalistes" },
      ];
    }
  } else {
    const rows = computeStandings(players, matches).slice(0, 3);
    const labels = ["1ᵉʳ", "2ᵉ", "3ᵉ"];
    podium = rows.map((r, i) => ({ names: [r.name], label: labels[i] }));
  }

  if (podium.length === 0) return null;

  const tones = [
    "border-lime/50 bg-lime/10",
    "border-slate-300/40 bg-slate-300/5",
    "border-amber-600/40 bg-amber-600/5",
  ];

  return (
    <section className="mb-6 animate-fade-up">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="size-5 text-lime" aria-hidden />
        <h2 className="text-lg font-extrabold">Podium</h2>
      </div>
      <div className="flex flex-col gap-2">
        {podium.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-center gap-3 border rounded-(--radius-card) px-4 py-3 ${tones[i]}`}
          >
            <span
              className={`inline-flex items-center justify-center size-8 rounded-full text-sm font-extrabold ${
                i === 0 ? "bg-lime text-on-lime" : i === 1 ? "bg-slate-300/20 text-slate-200" : "bg-amber-600/20 text-amber-500"
              }`}
            >
              {i + 1}
            </span>
            <div className="flex -space-x-2">
              {row.names.map((n) => (
                <Avatar key={n} name={n} />
              ))}
            </div>
            <div className="min-w-0">
              <p className="font-bold truncate">{row.names.join(" & ")}</p>
              <p className="text-xs text-ink-muted">{row.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
