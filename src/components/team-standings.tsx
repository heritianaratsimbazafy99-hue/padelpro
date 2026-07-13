"use client";

import type { EventPlayer, Match } from "@/lib/types";
import { computeTeamStandings } from "@/lib/engine/team-standings";
import { Avatar, PopValue } from "./ui";

export function TeamStandings({
  players,
  matches,
  meId,
}: {
  players: EventPlayer[];
  matches: Match[];
  meId?: string | null;
}) {
  const rows = computeTeamStandings(players, matches);

  return (
    <div className="overflow-x-auto rounded-(--radius-card) border border-border bg-surface">
      <table className="w-full min-w-[44rem] border-collapse text-sm">
        <caption className="sr-only">Classement par équipe</caption>
        <thead>
          <tr className="border-b border-border text-[0.6875rem] font-bold uppercase tracking-wider text-ink-faint">
            <th scope="col" className="px-4 py-2.5 text-left">
              Équipe
            </th>
            {[
              ["J", "text-center"],
              ["V", "text-center"],
              ["N", "text-center"],
              ["D", "text-center"],
              ["Pour", "text-right"],
              ["Contre", "text-right"],
              ["Diff.", "text-right"],
            ].map(([label, align]) => (
              <th key={label} scope="col" className={`px-3 py-2.5 ${align}`}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const mine = meId != null && row.playerIds.includes(meId);
            return (
              <tr
                key={row.teamNumber}
                className={`border-b border-border last:border-b-0 ${mine ? "bg-lime/5" : ""}`}
              >
                <th scope="row" className="px-4 py-3 text-left font-semibold">
                  <span className="flex min-w-52 items-center gap-3">
                    <span className="flex -space-x-2" aria-hidden>
                      {row.names.map((name) => (
                        <Avatar key={name} name={name} size="sm" />
                      ))}
                    </span>
                    <span className={mine ? "font-bold text-court" : "text-ink"}>
                      {row.label}
                      {mine && <span className="text-ink-faint"> (ton équipe)</span>}
                    </span>
                  </span>
                </th>
                <td className="tnum px-3 py-3 text-center text-ink-muted">{row.played}</td>
                <td className="tnum px-3 py-3 text-center text-ink-muted">{row.wins}</td>
                <td className="tnum px-3 py-3 text-center text-ink-muted">{row.draws}</td>
                <td className="tnum px-3 py-3 text-center text-ink-muted">{row.losses}</td>
                <td className="tnum px-3 py-3 text-right font-bold">
                  <PopValue value={row.pointsFor} />
                </td>
                <td className="tnum px-3 py-3 text-right text-ink-muted">
                  <PopValue value={row.pointsAgainst} />
                </td>
                <td className="tnum px-3 py-3 text-right font-extrabold">
                  <PopValue value={row.diff > 0 ? `+${row.diff}` : row.diff} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
