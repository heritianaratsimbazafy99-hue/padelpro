"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { Magnetic } from "./magnetic";

gsap.registerPlugin(ScrollTrigger, SplitText);

/* ------------------------------------------------------------------------ */
/* Carte match live — papier clair, tilt 3D, score qui vit                   */
/* ------------------------------------------------------------------------ */

function ScoreRow({ team, pts, lead }: { team: string; pts: number; lead: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-sm font-semibold ${lead ? "text-ink" : "text-ink-muted"}`}>
        {team}
      </span>
      <span
        className={`tnum inline-flex items-center justify-center min-w-11 h-9 rounded-xl text-lg font-extrabold transition-colors ${
          lead ? "bg-lime text-on-lime" : "bg-surface-2 text-ink-muted"
        }`}
      >
        {pts}
      </span>
    </div>
  );
}

function LiveMatchCard() {
  const ref = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState({ a: 12, b: 9 });

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      setScore((s) => {
        if (s.a + s.b >= 24) return { a: 8, b: 7 };
        return Math.random() > 0.45 ? { ...s, a: s.a + 1 } : { ...s, b: s.b + 1 };
      });
    }, 2600);
    return () => clearInterval(id);
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const rx = gsap.quickTo(el, "rotationX", { duration: 0.5, ease: "power3.out" });
    const ry = gsap.quickTo(el, "rotationY", { duration: 0.5, ease: "power3.out" });
    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * 12);
      rx(-((e.clientY - r.top) / r.height - 0.5) * 12);
    };
    const leave = () => {
      rx(0);
      ry(0);
    };
    el.addEventListener("mousemove", move);
    el.addEventListener("mouseleave", leave);
    return () => {
      el.removeEventListener("mousemove", move);
      el.removeEventListener("mouseleave", leave);
    };
  }, []);

  const leadA = score.a >= score.b;

  return (
    <div style={{ perspective: "1100px" }}>
      <div
        ref={ref}
        data-hero-card
        data-cursor
        className="relative bg-surface border border-border rounded-[1.75rem] p-5 sm:p-6 shadow-club-lg will-change-transform"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div
          className="flex items-center justify-between mb-4"
          style={{ transform: "translateZ(30px)" }}
        >
          <p className="font-display font-bold">Americano du vendredi</p>
          <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-clay">
            <span className="size-1.5 rounded-full bg-clay animate-pulse-soft" aria-hidden />
            Round 3/7
          </span>
        </div>
        <div
          className="space-y-3 bg-background/70 border border-border rounded-2xl p-4 mb-4"
          style={{ transform: "translateZ(45px)" }}
        >
          <ScoreRow team="Léa & Marco" pts={score.a} lead={leadA} />
          <ScoreRow team="Sofia & Karim" pts={score.b} lead={!leadA} />
        </div>
        <div
          className="flex items-center justify-between text-xs text-ink-faint px-1"
          style={{ transform: "translateZ(30px)" }}
        >
          <span>Terrain 1 · 24 pts</span>
          <span className="inline-flex items-center gap-1.5 font-bold text-court">
            <span className="size-1.5 rounded-full bg-court animate-pulse-soft" aria-hidden />
            Live
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Badge circulaire tournant « scanne · joue · gagne »                       */
/* ------------------------------------------------------------------------ */

function SpinBadge({ className = "" }: { className?: string }) {
  return (
    <div className={`relative size-28 sm:size-32 ${className}`} aria-hidden>
      <svg viewBox="0 0 100 100" className="absolute inset-0 animate-spin-slow">
        <defs>
          <path id="circ" d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
        </defs>
        <text
          className="fill-court"
          style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.22em" }}
        >
          <textPath href="#circ">SCANNE · JOUE · GAGNE · REJOUE ·</textPath>
        </text>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="size-11 rounded-full ball-lime" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Hero                                                                      */
/* ------------------------------------------------------------------------ */

export function Hero() {
  const scope = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        /* --- Timeline d'intro (après le rideau) --- */
        const lines = gsap.utils.toArray<HTMLElement>("[data-hero-line]");
        const splits = lines.map((l) => new SplitText(l, { type: "chars", mask: "chars" }));
        const tl = gsap.timeline({ delay: 0.55, defaults: { ease: "power4.out" } });

        tl.from("[data-hero-badge]", { y: 24, autoAlpha: 0, duration: 0.7 });
        splits.forEach((split, i) => {
          tl.from(
            split.chars,
            { yPercent: 120, rotation: 4, duration: 0.9, stagger: 0.022 },
            i === 0 ? "-=0.35" : "-=0.75",
          );
        });
        tl.to("[data-marker]", { scaleX: 1, duration: 0.6, ease: "power3.inOut" }, "-=0.5")
          .from("[data-hero-sub]", { y: 26, autoAlpha: 0, duration: 0.8 }, "-=0.45")
          .from(
            "[data-hero-cta] > *",
            { y: 24, autoAlpha: 0, duration: 0.7, stagger: 0.1 },
            "-=0.55",
          )
          .from(
            "[data-hero-card-wrap]",
            { y: 70, autoAlpha: 0, rotation: 6, duration: 1.1, ease: "expo.out" },
            "-=0.8",
          )
          .from(
            "[data-hero-spin]",
            { scale: 0, autoAlpha: 0, duration: 0.8, ease: "back.out(1.6)" },
            "-=0.7",
          )
          .from("[data-hero-scroll]", { autoAlpha: 0, duration: 0.6 }, "-=0.3");

        /* --- Balles flottantes en boucle --- */
        gsap.to("[data-hero-ball]", {
          y: -24,
          rotation: 20,
          duration: 2.8,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          stagger: 0.5,
        });

        /* --- Départ du hero au scroll (scrub) --- */
        gsap.to("[data-hero-inner]", {
          yPercent: -10,
          autoAlpha: 0.15,
          ease: "none",
          scrollTrigger: {
            trigger: scope.current,
            start: "bottom 90%",
            end: "bottom 35%",
            scrub: true,
          },
        });

        /* --- Parallaxe souris des couches décoratives --- */
        if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
          const layers = gsap.utils.toArray<HTMLElement>("[data-parallax]");
          const setters = layers.map((el) => ({
            depth: Number(el.dataset.parallax || 10),
            x: gsap.quickTo(el, "x", { duration: 0.8, ease: "power3.out" }),
            y: gsap.quickTo(el, "y", { duration: 0.8, ease: "power3.out" }),
          }));
          const onMove = (e: MouseEvent) => {
            const nx = e.clientX / window.innerWidth - 0.5;
            const ny = e.clientY / window.innerHeight - 0.5;
            setters.forEach((s) => {
              s.x(nx * s.depth);
              s.y(ny * s.depth);
            });
          };
          window.addEventListener("mousemove", onMove);
          return () => window.removeEventListener("mousemove", onMove);
        }
      });
    }, scope);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={scope}
      className="relative min-h-[100svh] flex flex-col overflow-hidden court-lines-light"
    >
      {/* Voile radial chaud en haut */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 50% -12%, rgba(200,245,66,0.35), transparent 65%), radial-gradient(ellipse 45% 35% at 90% 20%, rgba(232,88,47,0.12), transparent 70%)",
        }}
      />
      {/* Fondu du quadrillage vers le bas */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background to-transparent pointer-events-none"
      />

      {/* Balles décoratives — parallaxe souris + parallaxe scroll (data-speed) */}
      <div
        aria-hidden
        data-parallax="46"
        data-speed="0.85"
        className="absolute right-[6%] top-[15%] sm:right-[10%] pointer-events-none"
      >
        <div data-hero-ball className="size-12 sm:size-16 rounded-full ball-lime" />
      </div>
      <div
        aria-hidden
        data-parallax="28"
        data-speed="1.1"
        className="absolute left-[5%] top-[30%] hidden sm:block pointer-events-none"
      >
        <div data-hero-ball className="size-8 rounded-full ball-clay opacity-90" />
      </div>
      <div
        aria-hidden
        data-parallax="60"
        data-speed="0.75"
        className="absolute left-[16%] bottom-[14%] hidden lg:block pointer-events-none"
      >
        <div data-hero-ball className="size-6 rounded-full ball-lime opacity-70" />
      </div>

      {/* Contenu */}
      <div
        data-hero-inner
        className="relative mx-auto w-full max-w-6xl px-4 flex-1 flex flex-col lg:flex-row lg:items-center gap-10 lg:gap-6 pt-32 pb-16"
      >
        <div className="flex-1 min-w-0">
          <div
            data-hero-badge
            className="inline-flex items-center gap-2 bg-surface border border-border rounded-full pl-2 pr-4 py-1.5 mb-8 text-xs font-semibold text-ink-muted shadow-club"
          >
            <span className="inline-flex items-center gap-1.5 bg-court text-cream rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider">
              <span className="size-1 rounded-full bg-lime animate-pulse-soft" aria-hidden />
              Live
            </span>
            Scores en temps réel sur tous les téléphones
          </div>

          <h1 className="font-display font-bold uppercase tracking-tight leading-[0.92] text-[clamp(3.2rem,11vw,8rem)] mb-7">
            <span data-hero-line className="block">
              Organise.
            </span>
            <span data-hero-line className="block text-outline">
              Scanne.
            </span>
            <span data-hero-line className="block normal-case">
              <span className="marker font-serif-display italic font-normal pr-2">
                <span data-marker aria-hidden />
                Joue.
              </span>
            </span>
          </h1>

          <p
            data-hero-sub
            className="text-ink-muted text-lg sm:text-xl max-w-xl mb-9 leading-relaxed"
          >
            Americanos, mexicanos et tournois de padel — rotations équitables, scores en
            direct, classement Elo. Prêt en{" "}
            <strong className="text-ink font-semibold">60 secondes</strong>, sans
            installation.
          </p>

          <div data-hero-cta className="flex flex-col sm:flex-row items-center gap-3">
            <Magnetic className="w-full sm:w-auto">
              <Link
                href="/signup"
                className="btn-shine group h-14 px-8 inline-flex items-center justify-center gap-2 rounded-full bg-court text-cream text-base font-bold hover:bg-court-2 transition-colors shadow-club-lg w-full sm:w-auto"
              >
                Lancer mon premier americano
                <ArrowRight
                  className="size-5 transition-transform group-hover:translate-x-1"
                  aria-hidden
                />
              </Link>
            </Magnetic>
            <Magnetic className="w-full sm:w-auto">
              <Link
                href="/login"
                className="h-14 px-8 inline-flex items-center justify-center rounded-full border border-border-strong bg-surface/70 text-base font-semibold hover:border-court hover:text-court transition-colors w-full sm:w-auto"
              >
                J&apos;ai déjà un compte
              </Link>
            </Magnetic>
          </div>
        </div>

        {/* Carte match + badge tournant */}
        <div
          className="relative w-full max-w-sm mx-auto lg:mx-0 shrink-0 lg:-rotate-2"
          data-speed="0.92"
        >
          <div data-hero-card-wrap>
            <LiveMatchCard />
          </div>
          <div data-hero-spin className="absolute -top-14 -right-4 sm:-right-10">
            <SpinBadge />
          </div>
        </div>
      </div>

      {/* Indice de scroll */}
      <div data-hero-scroll className="relative pb-8 flex justify-center" aria-hidden>
        <div className="flex flex-col items-center gap-2 text-ink-faint">
          <span className="text-[0.625rem] font-bold uppercase tracking-[0.2em]">
            Découvrir
          </span>
          <ArrowDown className="size-4 animate-float" />
        </div>
      </div>
    </section>
  );
}
