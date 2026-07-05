"use client";

import { useEffect, useRef } from "react";
import { Trophy } from "lucide-react";
import type { EventPlayer, Match, PadelEvent } from "@/lib/types";
import { computeStandings } from "@/lib/engine/standings";
import { Avatar } from "./ui";

/**
 * Burst de confettis maison (canvas, zéro dépendance) tiré une seule fois à
 * l'apparition du podium. Couleurs du design system (lime, blanc, info).
 * Respecte `prefers-reduced-motion` (aucun confetti), ne bloque jamais les
 * interactions (pointer-events: none) ni ne crée de scroll (fixed inset-0).
 */
function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const colors = ["#c8f542", "#ffffff", "#60a5fa"];
    const particles = Array.from({ length: 140 }, (_, i) => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.5,
      y: h * 0.3 + Math.random() * 40,
      vx: (Math.random() - 0.5) * 9,
      vy: -(4 + Math.random() * 9),
      size: 4 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: colors[i % colors.length],
    }));

    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const fade = Math.max(0, 1 - (t - t0) / 2800); // extinction en ~2,8 s
      ctx.clearRect(0, 0, w, h);
      let alive = false;
      for (const p of particles) {
        p.vy += 0.18; // gravité
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (fade > 0 && p.y < h + 20) alive = true;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (alive) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, w, h);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="fixed inset-0 z-50 pointer-events-none"
    />
  );
}

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
      <Confetti />
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="size-5 text-lime" aria-hidden />
        <h2 className="text-lg font-extrabold">Podium</h2>
      </div>
      <div className="flex flex-col gap-2">
        {podium.map((row, i) => (
          <div
            key={row.label}
            className={`stagger-i flex items-center gap-3 border rounded-(--radius-card) px-4 py-3 ${tones[i]} ${
              i === 0 ? "glow-lime" : ""
            }`}
            style={{ "--i": i * 3 } as React.CSSProperties}
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
