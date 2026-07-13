"use client";

import { Crown, Trophy } from "lucide-react";
import type { EventPlayer, Match, PadelEvent } from "@/lib/types";
import { resolveAmericanoSettings } from "@/lib/americano-settings";
import { computeStandings } from "@/lib/engine/standings";
import { computeTeamStandings } from "@/lib/engine/team-standings";
import { Avatar } from "./ui";
import { Confetti } from "./motion";

/**
 * Podium de fin d'événement, façon estrade du club :
 * - americano/mexicano : trois colonnes (2ᵉ · 1ᵉʳ · 3ᵉ) qui montent en cascade,
 *   points affichés, couronne pour le vainqueur, confettis ;
 * - tournoi : champions & finalistes en cartes.
 */
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

  /* ---- Tournoi : champions / finalistes ---- */
  if (event.format === "tournament") {
    const totalRounds = Math.max(0, ...matches.map((m) => m.round_number));
    const final = matches.find((m) => m.round_number === totalRounds && m.status === "done");
    if (!final) return null;
    const t1Won = (final.score1 ?? 0) > (final.score2 ?? 0);
    const winners = (t1Won ? [final.team1_p1, final.team1_p2] : [final.team2_p1, final.team2_p2])
      .map(nameOf)
      .filter(Boolean) as string[];
    const losers = (t1Won ? [final.team2_p1, final.team2_p2] : [final.team1_p1, final.team1_p2])
      .map(nameOf)
      .filter(Boolean) as string[];

    return (
      <section className="mb-6 animate-fade-up">
        <Confetti />
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="size-5 text-court" aria-hidden />
          <h2 className="text-lg font-extrabold">Podium</h2>
        </div>
        <div className="flex flex-col gap-2">
          {[
            { names: winners, label: "Champions", cls: "border-lime/60 bg-lime/15 glow-lime" },
            { names: losers, label: "Finalistes", cls: "border-border-strong bg-surface-2/60" },
          ].map((row, i) => (
            <div
              key={row.label}
              className={`stagger-i flex items-center gap-3 border rounded-(--radius-card) px-4 py-3 ${row.cls}`}
              style={{ "--i": i * 3 } as React.CSSProperties}
            >
              <span
                className={`inline-flex items-center justify-center size-8 rounded-full text-sm font-extrabold ${
                  i === 0 ? "bg-lime text-on-lime" : "bg-surface-3 text-ink-muted"
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

  /* ---- Points : estrade à trois colonnes ---- */
  const fixed =
    event.format === "americano" &&
    resolveAmericanoSettings(event.settings).teamMode === "fixed";
  const entries = fixed
    ? computeTeamStandings(players, matches)
        .slice(0, 3)
        .map((row) => ({
          id: `team-${row.teamNumber}`,
          names: row.names,
          label: row.label,
          metric: `${row.wins} victoire${row.wins === 1 ? "" : "s"}`,
        }))
    : computeStandings(players, matches)
        .slice(0, 3)
        .map((row) => ({
          id: row.playerId,
          names: [row.name],
          label: row.name,
          metric: `${row.pointsFor} pts`,
        }));
  if (entries.length === 0) return null;

  // Ordre visuel : 2ᵉ · 1ᵉʳ · 3ᵉ (l'estrade classique)
  const slots = [entries[1], entries[0], entries[2]].filter(Boolean);
  const conf: Record<string, { h: string; bar: string; rank: number; delay: number }> = {
    [entries[0]?.id ?? "_1"]: {
      h: "9.5rem",
      bar: "bg-lime text-on-lime",
      rank: 1,
      delay: 2,
    },
    ...(entries[1] && {
      [entries[1].id]: {
        h: "6.5rem",
        bar: "bg-surface-3 text-ink",
        rank: 2,
        delay: 1,
      },
    }),
    ...(entries[2] && {
      [entries[2].id]: {
        h: "4.75rem",
        bar: "bg-amber-600/25 text-amber-900",
        rank: 3,
        delay: 0,
      },
    }),
  };

  return (
    <section className="mb-6 animate-fade-up">
      <Confetti />
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="size-5 text-court" aria-hidden />
        <h2 className="text-lg font-extrabold">Podium</h2>
      </div>
      <div className="bg-surface border border-border rounded-(--radius-card) px-4 pt-6 pb-4 shadow-club overflow-hidden">
        <div className="flex items-end justify-center gap-3">
          {slots.map((r) => {
            const c = conf[r.id];
            return (
              <div key={r.id} className="flex flex-col items-center gap-2 w-full max-w-28 min-w-0">
                {c.rank === 1 && (
                  <Crown className="size-5 text-clay animate-float" aria-hidden />
                )}
                <div className="flex -space-x-2">
                  {r.names.map((name) => (
                    <Avatar
                      key={name}
                      name={name}
                      size={c.rank === 1 ? "lg" : "md"}
                    />
                  ))}
                </div>
                <p className="max-w-full truncate text-xs font-bold">{r.label}</p>
                <div
                  className={`animate-podium-rise w-full rounded-t-2xl flex flex-col items-center justify-start pt-2.5 font-display font-bold ${c.bar}`}
                  style={{ height: c.h, "--i": c.delay } as React.CSSProperties}
                >
                  <span className="text-xl leading-none">{c.rank}</span>
                  <span className="tnum text-[0.7rem] font-sans font-semibold opacity-80 mt-1">
                    {r.metric}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
