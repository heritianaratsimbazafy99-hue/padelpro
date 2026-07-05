"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Match, PadelEvent } from "@/lib/types";
import { friendlyError } from "@/lib/utils";
import { Button } from "./ui";
import { useEscapeClose, useFocusTrap } from "./motion";

/** Ligne de saisie du score d'une équipe (boutons ± 48 px + pop du chiffre). */
function ScoreRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <p className="flex-1 text-sm font-semibold truncate">{label}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Moins de points pour ${label}`}
          onClick={() => onChange(value - 1)}
          className="size-12 rounded-xl bg-surface-2 border border-border text-xl font-bold cursor-pointer transition-colors hover:border-border-strong active:scale-95"
        >
          −
        </button>
        <span key={value} className="tnum w-14 text-center text-3xl font-extrabold animate-score-pop">
          {value}
        </span>
        <button
          type="button"
          aria-label={`Plus de points pour ${label}`}
          onClick={() => onChange(value + 1)}
          className="size-12 rounded-xl bg-lime/10 border border-lime/30 text-lime text-xl font-bold cursor-pointer transition-colors hover:bg-lime/20 active:scale-95"
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Bottom sheet de saisie de score.
 * Americano/Mexicano : le total est fixe → régler le score d'une équipe ajuste
 * l'autre automatiquement (impossible de se tromper).
 * Tournoi : saisie libre des deux scores (jeux/sets), pas d'égalité.
 * Validation optimiste : la sheet se ferme immédiatement, le match passe
 * « Terminé » localement ; en cas d'erreur RPC, rollback + erreur côté page.
 */
export function ScoreSheet({
  event,
  match,
  playerName,
  reporter,
  onClose,
  onSaved,
  applyOptimisticScore,
  onError,
}: {
  event: PadelEvent;
  match: Match;
  playerName: (id: string | null) => string | null;
  reporter: string;
  onClose: () => void;
  onSaved: () => void;
  /** Applique le score localement avant le serveur ; renvoie le rollback. */
  applyOptimisticScore: (matchId: string, score1: number, score2: number) => () => void;
  /** Remonte l'erreur RPC à la page (la sheet est déjà fermée). */
  onError: (message: string) => void;
}) {
  const isPointsBased = event.format === "americano" || event.format === "mexicano";
  const total = event.settings.points_per_match ?? 24;
  const [s1, setS1] = useState(match.score1 ?? (isPointsBased ? Math.floor(total / 2) : 0));
  const [s2, setS2] = useState(
    match.score2 ?? (isPointsBased ? total - Math.floor(total / 2) : 0),
  );
  const [error, setError] = useState<string | null>(null);

  useEscapeClose(true, onClose);
  const trapRef = useFocusTrap<HTMLDivElement>(true);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const t1 = [match.team1_p1, match.team1_p2].map(playerName).filter(Boolean).join(" & ");
  const t2 = [match.team2_p1, match.team2_p2].map(playerName).filter(Boolean).join(" & ");

  function setTeam1(v: number) {
    const clamped = Math.max(0, isPointsBased ? Math.min(total, v) : v);
    setS1(clamped);
    if (isPointsBased) setS2(total - clamped);
  }
  function setTeam2(v: number) {
    const clamped = Math.max(0, isPointsBased ? Math.min(total, v) : v);
    setS2(clamped);
    if (isPointsBased) setS1(total - clamped);
  }

  function save() {
    setError(null);
    if (!isPointsBased && s1 === s2) {
      setError("Un match de tournoi ne peut pas être nul.");
      return;
    }
    // Optimistic UI : le match apparaît « Terminé » tout de suite et la sheet
    // se ferme sans attendre le serveur.
    const rollback = applyOptimisticScore(match.id, s1, s2);
    onClose();
    const supabase = createClient();
    supabase
      .rpc("report_score", {
        p_match_id: match.id,
        p_share_code: event.share_code,
        p_score1: s1,
        p_score2: s2,
        p_reporter: reporter,
      })
      .then(({ error: rpcError }) => {
        if (rpcError) {
          rollback();
          onError(friendlyError(rpcError.message));
        } else {
          onSaved();
        }
      });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Saisie du score">
      <button
        aria-label="Fermer"
        className="absolute inset-0 bg-black/60 cursor-pointer animate-backdrop"
        onClick={onClose}
      />
      <div
        ref={trapRef}
        tabIndex={-1}
        className="relative bg-surface border-t border-border rounded-t-3xl p-5 pb-safe animate-sheet-up max-w-2xl w-full mx-auto outline-none"
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-extrabold">Annoncer le score</h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="size-10 rounded-xl flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-2 cursor-pointer transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>
        <p className="text-sm text-ink-muted mb-5">
          Terrain {match.court}
          {isPointsBased && (
            <>
              {" "}
              · {total} points à répartir — ajuster une équipe ajuste l&apos;autre.
            </>
          )}
        </p>
        <div className="flex flex-col gap-4 mb-5">
          <ScoreRow label={t1 || "Équipe 1"} value={s1} onChange={setTeam1} />
          <ScoreRow label={t2 || "Équipe 2"} value={s2} onChange={setTeam2} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger font-medium mb-4">
            {error}
          </p>
        )}
        <Button size="lg" full onClick={save}>
          Valider le score
        </Button>
      </div>
    </div>
  );
}
