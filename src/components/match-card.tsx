"use client";

import { MapPin } from "lucide-react";
import type { Match } from "@/lib/types";
import { Avatar, PopValue } from "./ui";

function TeamLine({
  names,
  score,
  won,
  highlight,
}: {
  names: string[];
  score: number | null;
  won: boolean;
  highlight: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="flex -space-x-2 shrink-0">
        {names.map((n) => (
          <Avatar key={n} name={n} size="sm" />
        ))}
      </div>
      <p
        className={`flex-1 truncate text-sm ${
          won ? "font-bold text-ink" : "font-medium text-ink-muted"
        } ${highlight ? "text-court" : ""}`}
      >
        {names.join(" & ") || "À déterminer"}
      </p>
      <span
        className={`tnum text-lg shrink-0 ${
          won ? "font-extrabold text-court" : "font-bold text-ink-muted"
        }`}
      >
        <PopValue value={score ?? "–"} />
      </span>
    </div>
  );
}

export function MatchCard({
  match,
  playerName,
  meId,
  onClick,
  roundTag,
}: {
  match: Match;
  playerName: (id: string | null) => string | null;
  /** Joueur courant (participant) : ses matchs sont mis en évidence. */
  meId?: string | null;
  onClick?: () => void;
  roundTag?: string;
}) {
  const t1 = [match.team1_p1, match.team1_p2].map(playerName).filter(Boolean) as string[];
  const t2 = [match.team2_p1, match.team2_p2].map(playerName).filter(Boolean) as string[];
  const done = match.status === "done";
  const t1won = done && (match.score1 ?? 0) > (match.score2 ?? 0);
  const t2won = done && (match.score2 ?? 0) > (match.score1 ?? 0);
  const mine =
    !!meId &&
    [match.team1_p1, match.team1_p2, match.team2_p1, match.team2_p2].includes(meId);
  const inTeam1 = !!meId && [match.team1_p1, match.team1_p2].includes(meId);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`w-full text-left bg-surface border rounded-(--radius-card) p-4 transition-all duration-150 ${
        mine ? "border-lime/40" : "border-border"
      } ${onClick ? "cursor-pointer hover:border-border-strong active:scale-[0.99]" : ""}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-faint">
          <MapPin className="size-3.5" aria-hidden />
          Terrain {match.court}
          {roundTag && <span className="text-ink-faint">· {roundTag}</span>}
        </span>
        {done ? (
          <span className="text-xs font-bold text-success">Terminé</span>
        ) : (
          <span className="text-xs font-bold text-warning animate-pulse-soft">À jouer</span>
        )}
      </div>
      <div className="flex flex-col gap-2.5">
        <TeamLine names={t1} score={match.score1} won={t1won} highlight={mine && inTeam1} />
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[0.625rem] font-extrabold text-ink-faint tracking-widest">VS</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <TeamLine names={t2} score={match.score2} won={t2won} highlight={mine && !inTeam1} />
      </div>
    </button>
  );
}
