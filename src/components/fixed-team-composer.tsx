"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { TeamAssignments } from "@/lib/engine/fixed-teams";

export interface ComposerPlayer {
  id: string;
  name: string;
}

function groupComposerPlayers(players: ComposerPlayer[], assignments: TeamAssignments) {
  const groups = new Map<number, ComposerPlayer[]>();
  for (const player of players) {
    const teamNumber = assignments[player.id];
    if (teamNumber == null) continue;
    groups.set(teamNumber, [...(groups.get(teamNumber) ?? []), player]);
  }
  return [...groups.entries()]
    .sort(([first], [second]) => first - second)
    .map(([teamNumber, members]) => ({ teamNumber, members }));
}

export function FixedTeamComposer({
  players,
  assignments,
  editable,
  onSwap,
  onRegenerate,
}: {
  players: ComposerPlayer[];
  assignments: TeamAssignments;
  editable: boolean;
  onSwap: (firstId: string, secondId: string) => void;
  onRegenerate?: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const groups = groupComposerPlayers(players, assignments);

  function choose(id: string) {
    if (!editable) return;
    if (!selected) {
      setSelected(id);
      return;
    }
    if (selected !== id) onSwap(selected, id);
    setSelected(null);
  }

  return (
    <section
      role="group"
      aria-label="Composition des équipes"
      className="flex flex-col gap-3"
    >
      <p className="sr-only" aria-live="polite">
        {selected
          ? `${players.find((player) => player.id === selected)?.name} sélectionné, choisis un joueur à échanger.`
          : ""}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {groups.map(({ teamNumber, members }) => (
          <div
            key={teamNumber}
            className="rounded-(--radius-field) border border-border bg-surface-2 p-3"
          >
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
              Équipe {teamNumber}
            </p>
            <div className="flex flex-col gap-1.5">
              {members.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  disabled={!editable}
                  aria-pressed={selected === player.id}
                  aria-label={`Sélectionner ${player.name}, équipe ${teamNumber}`}
                  onClick={() => choose(player.id)}
                  className="min-h-10 rounded-lg border border-border bg-surface px-3 text-left text-sm font-semibold text-ink transition-colors enabled:cursor-pointer enabled:hover:border-lime/50 enabled:aria-pressed:border-lime enabled:aria-pressed:bg-lime/10 disabled:opacity-80"
                >
                  {player.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {onRegenerate && (
        <Button type="button" variant="secondary" onClick={onRegenerate}>
          Refaire le tirage
        </Button>
      )}
    </section>
  );
}
