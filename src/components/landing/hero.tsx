"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, Sparkles } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { Magnetic } from "./magnetic";

gsap.registerPlugin(ScrollTrigger, SplitText);

/** Carte match live du hero : score qui s'incrémente + tilt 3D au survol. */
function LiveMatchCard() {
  const ref = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState({ a: 12, b: 9 });

  // Le score "vit" : il monte doucement puis recommence, comme un vrai match.
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
      ry(((e.clientX - r.left) / r.width - 0.5) * 14);
      rx(-((e.clientY - r.top) / r.height - 0.5) * 14);
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
    <div style={{ perspective: "1000px" }}>
      <div
        ref={ref}
        data-hero-card
        className="gradient-border rounded-3xl p-5 sm:p-6 text-left shadow-2xl shadow-black/60 backdrop-blur will-change-transform"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div className="flex items-center justify-between mb-4" style={{ transform: "translateZ(30px)" }}>
          <p className="font-extrabold">Americano du vendredi</p>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-warning">
            <span className="size-1.5 rounded-full bg-warning animate-pulse-soft" aria-hidden />
            Round 3/7
          </span>
        </div>
        <div
          className="bg-surface-2/80 border border-border rounded-2xl p-4 mb-3"
          style={{ transform: "translateZ(45px)" }}
        >
          <div className="flex items-center justify-between text-sm font-semibold mb-2.5">
            <span className={leadA ? "" : "text-ink-muted"}>Léa &amp; Marco</span>
            <span className={`tnum text-xl font-extrabold ${leadA ? "text-lime" : "text-ink-muted"}`}>
              {score.a}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm font-semibold">
            <span className={leadA ? "text-ink-muted" : ""}>Sofia &amp; Karim</span>
            <span className={`tnum text-xl font-extrabold ${leadA ? "text-ink-muted" : "text-lime"}`}>
              {score.b}
            </span>
          </div>
        </div>
        <div
          className="flex items-center justify-between text-xs text-ink-faint px-1"
          style={{ transform: "translateZ(30px)" }}
        >
          <span>Terrain 1 · 24 pts</span>
          <span className="inline-flex items-center gap-1.5 text-lime font-semibold">
            <span className="size-1.5 rounded-full bg-lime animate-pulse-soft" aria-hidden />
            Live
          </span>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  const scope = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // --- Timeline d'intro ---
        // Split par lignes avec masque : préserve le <span> dégradé intact
        // (un split par mots casserait le background-clip: text).
        const split = new SplitText("[data-hero-title]", { type: "lines", mask: "lines" });
        const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

        tl.from("[data-hero-badge]", { y: 24, autoAlpha: 0, duration: 0.7 })
          .from(
            split.lines,
            { yPercent: 115, rotation: 2, duration: 1.1, stagger: 0.12 },
            "-=0.35",
          )
          .from("[data-hero-sub]", { y: 26, autoAlpha: 0, duration: 0.8 }, "-=0.55")
          .from("[data-hero-cta] > *", { y: 24, autoAlpha: 0, duration: 0.7, stagger: 0.1 }, "-=0.5")
          .from("[data-hero-card]", { y: 60, autoAlpha: 0, scale: 0.92, duration: 1, ease: "expo.out" }, "-=0.45")
          .from("[data-hero-scroll]", { autoAlpha: 0, duration: 0.6 }, "-=0.3")
          .from("[data-hero-orb]", { scale: 0, autoAlpha: 0, duration: 1.2, ease: "expo.out", stagger: 0.15 }, 0.4);

        // --- Balle flottante en boucle ---
        gsap.to("[data-hero-ball]", {
          y: -22,
          rotation: 18,
          duration: 2.6,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });

        // --- Léger départ du contenu au scroll ---
        gsap.to("[data-hero-inner]", {
          yPercent: -8,
          autoAlpha: 0.25,
          ease: "none",
          scrollTrigger: {
            trigger: scope.current,
            start: "bottom 85%",
            end: "bottom 30%",
            scrub: true,
          },
        });

        // --- Parallaxe souris sur les couches décoratives ---
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
      className="relative min-h-[100svh] flex flex-col overflow-hidden glow-scene noise"
    >
      {/* Sol de terrain en perspective */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[46%] [transform:perspective(700px)_rotateX(58deg)] origin-bottom court-grid opacity-80"
        style={{
          maskImage: "linear-gradient(to top, rgba(0,0,0,0.9), transparent)",
          WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0.9), transparent)",
        }}
      />
      {/* Ligne de fond de court */}
      <div
        aria-hidden
        className="absolute inset-x-[12%] bottom-[13%] h-px bg-gradient-to-r from-transparent via-lime/40 to-transparent"
      />

      {/* Orbes lumineux */}
      <div
        aria-hidden
        data-hero-orb
        data-parallax="26"
        className="absolute -top-24 left-1/2 -translate-x-1/2 size-[34rem] rounded-full bg-lime/10 blur-[110px] pointer-events-none"
      />
      <div
        aria-hidden
        data-hero-orb
        data-parallax="40"
        className="absolute top-1/3 -right-24 size-72 rounded-full bg-info/10 blur-[90px] pointer-events-none"
      />

      {/* Balle de padel flottante */}
      <div
        aria-hidden
        data-parallax="55"
        className="absolute right-[8%] top-[16%] sm:right-[14%] sm:top-[20%] pointer-events-none"
      >
        <div
          data-hero-ball
          className="size-10 sm:size-14 rounded-full shadow-[0_0_50px_rgba(200,245,66,0.45)]"
          style={{
            background:
              "radial-gradient(circle at 32% 30%, #eaff8a 0%, #c8f542 45%, #7fa317 100%)",
          }}
        >
          <div className="size-full rounded-full border-2 border-black/10 [border-radius:50%]" />
        </div>
      </div>
      {/* Petite balle secondaire */}
      <div
        aria-hidden
        data-parallax="32"
        className="absolute left-[6%] bottom-[30%] hidden sm:block pointer-events-none"
      >
        <div
          data-hero-ball
          className="size-6 rounded-full opacity-60 shadow-[0_0_30px_rgba(200,245,66,0.3)]"
          style={{
            background:
              "radial-gradient(circle at 32% 30%, #eaff8a 0%, #c8f542 45%, #7fa317 100%)",
          }}
        />
      </div>

      {/* Contenu */}
      <div
        data-hero-inner
        className="relative mx-auto w-full max-w-6xl px-4 flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16 pt-28 pb-20"
      >
        <div className="flex-1 text-center lg:text-left max-w-2xl">
          <div
            data-hero-badge
            className="inline-flex items-center gap-2 bg-surface/70 backdrop-blur border border-border rounded-full px-4 py-1.5 mb-7 text-xs font-semibold text-ink-muted"
          >
            <Sparkles className="size-3.5 text-lime" aria-hidden />
            Scores en temps réel, sur tous les téléphones
          </div>

          <h1
            data-hero-title
            className="font-display text-[clamp(2.6rem,7vw,5.2rem)] font-bold tracking-tight leading-[1.02] mb-6"
          >
            Tes americanos de padel,{" "}
            <span className="text-gradient">sans prise de tête.</span>
          </h1>

          <p
            data-hero-sub
            className="text-ink-muted text-lg sm:text-xl max-w-xl mx-auto lg:mx-0 mb-9 leading-relaxed"
          >
            Rotations équitables, équipes équilibrées, QR code pour les joueurs, classement live.
            Organiser un tournoi prend <strong className="text-ink font-semibold">60 secondes</strong>.
          </p>

          <div
            data-hero-cta
            className="flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-3"
          >
            <Magnetic className="w-full sm:w-auto">
              <Link
                href="/signup"
                className="btn-shine group h-14 px-8 inline-flex items-center justify-center gap-2 rounded-2xl bg-lime text-on-lime text-base font-bold hover:bg-lime-deep transition-colors glow-lime w-full sm:w-auto"
              >
                Organiser ma première partie
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            </Magnetic>
            <Magnetic className="w-full sm:w-auto">
              <Link
                href="/login"
                className="h-14 px-8 inline-flex items-center justify-center rounded-2xl border border-border-strong bg-surface/50 backdrop-blur text-base font-semibold hover:border-lime hover:text-lime transition-colors w-full sm:w-auto"
              >
                J&apos;ai déjà un compte
              </Link>
            </Magnetic>
          </div>
        </div>

        {/* Carte match live */}
        <div className="w-full max-w-sm shrink-0" data-parallax="-14">
          <LiveMatchCard />
        </div>
      </div>

      {/* Indice de scroll */}
      <div
        data-hero-scroll
        className="relative pb-8 flex justify-center"
        aria-hidden
      >
        <div className="flex flex-col items-center gap-2 text-ink-faint">
          <span className="text-[0.625rem] font-bold uppercase tracking-[0.2em]">Découvrir</span>
          <ArrowDown className="size-4 animate-float" />
        </div>
      </div>
    </section>
  );
}
