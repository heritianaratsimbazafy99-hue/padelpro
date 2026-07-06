"use client";

import { useRef } from "react";
import { ArrowLeftRight, Camera, Loader2, Share2, Trophy, Zap } from "lucide-react";
import type { PreferredSide } from "@/lib/types";
import { SIDE_LABELS } from "@/lib/utils";
import { TROPHIES } from "@/lib/trophies";
import { Avatar } from "@/components/ui";
import { CountUp } from "@/components/motion";

export interface EloPoint {
  elo: number;
}

/* ------------------------------------------------------------------------ */
/* Sparkline Elo — série unique, ligne 2px lime sur carte vert court.        */
/* Pas de légende (le contexte nomme la série), valeurs en encre de texte,   */
/* repère discret à 1000 (l'Elo de départ) quand il est dans la plage.       */
/* ------------------------------------------------------------------------ */

function EloSparkline({ points }: { points: EloPoint[] }) {
  if (points.length < 2) return null;
  const W = 168;
  const H = 40;
  const PAD = 3;
  const values = points.map((p) => p.elo);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const x = (i: number) => PAD + (i / (values.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);
  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const first = values[0];
  const last = values[values.length - 1];
  const showBaseline = min < 1000 && max > 1000;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-[10.5rem] h-10"
      role="img"
      aria-label={`Évolution Elo : de ${first} à ${last} sur ${values.length} matchs`}
    >
      {showBaseline && (
        <line
          x1={PAD}
          x2={W - PAD}
          y1={y(1000)}
          y2={y(1000)}
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      )}
      <path
        d={path}
        fill="none"
        stroke="var(--lime)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={x(values.length - 1)} cy={y(last)} r="3" fill="var(--lime)" />
    </svg>
  );
}

/* ------------------------------------------------------------------------ */
/* Grille des trophées du club (état + date de déblocage).                   */
/* ------------------------------------------------------------------------ */

const UNLOCK_DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

export function TrophyGrid({
  earned,
  unlockedAt,
}: {
  earned: Set<string>;
  /** Dates de déblocage persistées (profile_trophies). */
  unlockedAt?: Map<string, string>;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {TROPHIES.map(({ id, icon: Icon, label, hint }, i) => {
        const done = earned.has(id);
        const at = unlockedAt?.get(id);
        return (
          <div
            key={id}
            className={`stagger-i rounded-(--radius-card) border p-3 flex flex-col items-center text-center gap-1.5 transition-colors ${
              done ? "bg-lime/25 border-lime-deep/50" : "bg-surface border-border opacity-60 grayscale"
            }`}
            style={{ "--i": i } as React.CSSProperties}
          >
            <span
              className={`size-10 rounded-full flex items-center justify-center ${
                done ? "bg-lime text-on-lime" : "bg-surface-2 text-ink-faint"
              }`}
            >
              <Icon className="size-5" aria-hidden />
            </span>
            <p className="text-xs font-bold leading-tight">{label}</p>
            <p className="text-[0.65rem] text-ink-faint leading-tight">
              {done && at ? `Débloqué le ${UNLOCK_DATE.format(new Date(at))}` : hint}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Carte licence — partagée entre /profile (édition) et /players/[id].       */
/* ------------------------------------------------------------------------ */

export interface PlayerCardProps {
  name: string;
  /** Sous-titre (email sur son propre profil, rien sur un profil public). */
  subtitle?: string | null;
  title: string;
  avatarUrl: string | null;
  elo: number | null;
  memberSince: string | null;
  bio: string | null;
  side: PreferredSide | null;
  racket: string | null;
  trophies: { unlocked: number; total: number };
  eloHistory: EloPoint[] | null;
  /** Mode édition : active le bouton caméra d'upload de photo. */
  onPickAvatar?: (file: File) => void;
  uploading?: boolean;
  /** Bouton « Partager ma licence » (PNG). */
  onShare?: () => void;
  sharing?: boolean;
}

export function PlayerCard({
  name,
  subtitle,
  title,
  avatarUrl,
  elo,
  memberSince,
  bio,
  side,
  racket,
  trophies,
  eloHistory,
  onPickAvatar,
  uploading,
  onShare,
  sharing,
}: PlayerCardProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <section className="sec-court grain relative overflow-hidden rounded-[1.75rem] border border-border shadow-club-lg animate-fade-up">
      <div className="relative p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <Avatar name={name || "Joueur"} src={avatarUrl} size="xl" className="ring-2 ring-lime/60" />
            {onPickAvatar && (
              <>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  aria-label="Changer la photo de profil"
                  className="absolute -bottom-1 -right-1 size-9 rounded-full bg-lime text-on-lime border-2 border-court flex items-center justify-center cursor-pointer transition-transform hover:scale-110 active:scale-95 disabled:opacity-60"
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Camera className="size-4" aria-hidden />
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) onPickAvatar(f);
                  }}
                />
              </>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-lime mb-1 truncate">
              Licence PadelPro · {title}
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold truncate">
              {name || "Joueur"}
            </h1>
            {subtitle && <p className="text-sm text-ink-muted truncate">{subtitle}</p>}
            {memberSince && (
              <p className="text-xs text-ink-faint mt-1">
                Membre depuis {new Date(memberSince).getFullYear()}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end shrink-0">
            <p className="tnum font-display text-3xl font-bold text-lime">
              {elo === null ? "–" : <CountUp value={elo} />}
            </p>
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-ink-faint">Elo</p>
          </div>
        </div>

        {eloHistory && eloHistory.length >= 2 && (
          <div className="flex items-center justify-between gap-3 mt-3 text-ink-faint">
            <span className="text-[0.65rem] font-bold uppercase tracking-wider">
              Progression Elo
            </span>
            <EloSparkline points={eloHistory} />
          </div>
        )}

        {bio?.trim() && (
          <p className="font-serif-display italic text-lg leading-snug mt-4 text-ink">
            « {bio.trim()} »
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-4">
          {side && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-2 border border-border text-xs font-semibold">
              <ArrowLeftRight className="size-3.5 text-lime" aria-hidden />
              {SIDE_LABELS[side]}
            </span>
          )}
          {racket?.trim() && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-2 border border-border text-xs font-semibold">
              <Zap className="size-3.5 text-lime" aria-hidden />
              {racket.trim()}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-2 border border-border text-xs font-semibold">
            <Trophy className="size-3.5 text-lime" aria-hidden />
            {trophies.unlocked}/{trophies.total} trophées
          </span>
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              disabled={sharing}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-lime text-on-lime border border-lime text-xs font-bold cursor-pointer transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
            >
              {sharing ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Share2 className="size-3.5" aria-hidden />
              )}
              Partager
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
