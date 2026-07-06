"use client";

import { useEffect } from "react";
import { Confetti } from "./motion";

/**
 * Célébration plein écran à l'annonce d'un score : 3 variantes de victoire
 * et 3 variantes de défaite, tirées au hasard par le parent. Purement
 * décoratif (pointer-events-none, aria-hidden sauf l'annonce sr-only),
 * auto-détruit après ~2,5 s. Les keyframes vivent dans globals.css et
 * sont neutralisées par prefers-reduced-motion (règle globale).
 */
export interface CelebrationData {
  kind: "win" | "loss";
  variant: 0 | 1 | 2;
}

function Stamp({
  children,
  className,
  rot = "-5deg",
  delay,
}: {
  children: React.ReactNode;
  className: string;
  rot?: string;
  delay?: string;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <span
        className={`animate-stamp-in rounded-2xl px-7 py-3.5 shadow-club-lg whitespace-nowrap ${className}`}
        style={{ "--stamp-rot": rot, animationDelay: delay } as React.CSSProperties}
      >
        {children}
      </span>
    </div>
  );
}

export function Celebration({ data, onDone }: { data: CelebrationData; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [data, onDone]);

  const { kind, variant } = data;

  return (
    <div
      data-celebration={`${kind}-${variant}`}
      className="fixed inset-0 z-[65] pointer-events-none overflow-hidden"
    >
      <p className="sr-only" role="status">
        {kind === "win" ? "Victoire !" : "Défaite."}
      </p>

      <div aria-hidden className="absolute inset-0">
        {/* ---------- Victoires ---------- */}
        {kind === "win" && variant === 0 && (
          <>
            <Confetti />
            <Stamp className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-tight bg-lime text-on-lime">
              Victoire&nbsp;!
            </Stamp>
          </>
        )}

        {kind === "win" && variant === 1 && (
          <>
            {Array.from({ length: 7 }, (_, i) => (
              <span
                key={i}
                className="animate-celeb-fall absolute -top-10 size-8 rounded-full ball-lime"
                style={{ left: `${7 + i * 13}%`, "--i": i } as React.CSSProperties}
              />
            ))}
            <Stamp
              className="font-serif-display italic text-4xl sm:text-5xl bg-court text-lime"
              rot="3deg"
            >
              Quel match&nbsp;!
            </Stamp>
          </>
        )}

        {kind === "win" && variant === 2 && (
          <>
            <div className="absolute inset-x-0 top-1/2 flex items-center justify-center">
              <span
                className="animate-shockwave absolute size-44 rounded-full border-[5px] border-lime"
                style={{ animationDelay: "0.58s" }}
              />
              <span className="animate-smash-drop size-14 rounded-full ball-lime -translate-y-1/2" />
            </div>
            <Stamp
              className="font-display text-3xl sm:text-4xl font-bold uppercase bg-cream text-court border-2 border-court"
              rot="-4deg"
              delay="0.7s"
            >
              Smash gagnant&nbsp;!
            </Stamp>
          </>
        )}

        {/* ---------- Défaites ---------- */}
        {kind === "loss" && variant === 0 && (
          <>
            <div
              className="animate-vignette absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse at center, transparent 52%, rgba(232,88,47,0.32))",
              }}
            />
            <Stamp
              className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-tight bg-clay text-cream"
              rot="3deg"
            >
              Défaite…
            </Stamp>
          </>
        )}

        {kind === "loss" && variant === 1 && (
          <>
            <span className="animate-deflate-bounce absolute bottom-12 left-[4%] size-9 rounded-full ball-clay" />
            <Stamp
              className="font-serif-display italic text-4xl sm:text-5xl bg-surface text-ink border border-border-strong"
              rot="-3deg"
            >
              Ça se rejouera.
            </Stamp>
          </>
        )}

        {kind === "loss" && variant === 2 && (
          <>
            <div className="absolute inset-x-0 top-0 flex justify-center">
              <span className="animate-drop-away size-10 rounded-full ball-clay" />
            </div>
            <Stamp
              className="font-display text-3xl sm:text-4xl font-bold uppercase bg-surface-2 text-ink-muted border border-border-strong"
              rot="2deg"
              delay="0.35s"
            >
              Dans le filet.
            </Stamp>
          </>
        )}
      </div>
    </div>
  );
}
