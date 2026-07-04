"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  QrCode,
  Repeat,
  Scale,
  Trophy,
  Zap,
} from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Logo, LogoMark } from "@/components/logo";
import { CountUp, useSpotlight } from "@/components/motion";
import { Hero } from "./hero";
import { Magnetic } from "./magnetic";

gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------------------ */
/* Données                                                                   */
/* ------------------------------------------------------------------------ */

const features = [
  {
    icon: Repeat,
    title: "Americano & Mexicano",
    desc: "Rotations générées automatiquement : jamais deux fois le même partenaire tant qu'une alternative existe, repos répartis équitablement.",
    big: true,
  },
  {
    icon: Trophy,
    title: "Tournois à élimination",
    desc: "Tableau avec têtes de série et byes automatiques. Le vainqueur avance tout seul dans le bracket.",
    big: false,
  },
  {
    icon: Scale,
    title: "Équilibrage intelligent",
    desc: "Mode équilibré : les équipes de chaque match sont formées pour des scores serrés, selon le niveau des joueurs.",
    big: false,
  },
  {
    icon: QrCode,
    title: "QR code magique",
    desc: "Les joueurs scannent, choisissent leur nom et annoncent les scores eux-mêmes. Zéro friction, zéro papier.",
    big: false,
  },
  {
    icon: Zap,
    title: "Scores en direct",
    desc: "Classement et prochains matchs mis à jour en temps réel sur tous les téléphones.",
    big: false,
  },
  {
    icon: BarChart3,
    title: "Elo & statistiques",
    desc: "Compte gratuit : classement Elo global, victoires, taux de réussite et historique complet sur tous tes événements.",
    big: true,
  },
];

const steps = [
  {
    n: "01",
    title: "Crée ton événement",
    desc: "Format, points, terrains, joueurs : prêt en 60 secondes.",
  },
  {
    n: "02",
    title: "Partage le QR code",
    desc: "Chaque joueur le scanne et sélectionne son nom.",
  },
  {
    n: "03",
    title: "Jouez, tout s'enchaîne",
    desc: "Rounds, scores et classement live. Podium à la fin.",
  },
];

const marqueeWords = ["Americano", "Mexicano", "Tournois", "Classement live", "QR code", "Elo global"];

/* ------------------------------------------------------------------------ */
/* Sous-composants                                                           */
/* ------------------------------------------------------------------------ */

/** Nav flottante : devient une pilule opaque dès qu'on scrolle. */
function FloatingHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed top-0 inset-x-0 z-50 px-3 pt-3">
      <div
        className={`mx-auto max-w-5xl h-14 px-4 flex items-center justify-between rounded-2xl transition-all duration-300 ${
          scrolled
            ? "bg-surface/80 backdrop-blur-xl border border-border shadow-lg shadow-black/30"
            : "bg-transparent border border-transparent"
        }`}
      >
        <Logo href="/" />
        <nav className="flex items-center gap-1.5">
          <Link
            href="/login"
            className="h-10 px-4 inline-flex items-center rounded-xl text-sm font-semibold text-ink-muted hover:text-ink transition-colors"
          >
            Connexion
          </Link>
          <Link
            href="/signup"
            className="btn-shine h-10 px-4 inline-flex items-center rounded-xl bg-lime text-on-lime text-sm font-bold hover:bg-lime-deep transition-colors"
          >
            Commencer
          </Link>
        </nav>
      </div>
    </header>
  );
}

/** Bandeau défilant incliné, façon affiche de club. */
function Marquee() {
  const items = [...marqueeWords, ...marqueeWords];
  return (
    <div className="relative -rotate-[1.5deg] scale-[1.02] my-2 bg-lime text-on-lime overflow-hidden select-none" aria-hidden>
      <div className="animate-marquee flex w-max items-center gap-8 py-3.5 pr-8">
        {[0, 1].map((half) => (
          <div key={half} className="flex items-center gap-8">
            {items.map((w, i) => (
              <span key={`${half}-${i}`} className="flex items-center gap-8 font-display font-bold uppercase tracking-wide text-sm sm:text-base whitespace-nowrap">
                {w}
                <span className="size-2 rounded-full bg-on-lime/60" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Chiffres clés avec compteurs animés. */
function StatsBar() {
  const stats = [
    { value: 60, suffix: "s", label: "pour lancer un tournoi" },
    { value: 3, suffix: "", label: "formats de jeu" },
    { value: 100, suffix: "%", label: "gratuit, sans installation" },
    { value: 0, suffix: "", label: "papier, zéro crayon" },
  ];
  return (
    <section className="mx-auto max-w-5xl px-4 py-14">
      <div data-st-fade className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-3xl overflow-hidden border border-border">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface p-6 sm:p-8 text-center">
            <p className="font-display text-4xl sm:text-5xl font-bold text-lime tnum">
              <CountUp value={s.value} suffix={s.suffix} />
            </p>
            <p className="text-xs sm:text-sm text-ink-muted font-medium mt-2">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Carte feature avec spotlight qui suit le curseur. */
function FeatureCard({
  icon: Icon,
  title,
  desc,
  big,
}: (typeof features)[number]) {
  const onMove = useSpotlight<HTMLDivElement>();
  return (
    <div
      data-st-fade
      onMouseMove={onMove}
      className={`spotlight card-lift bg-surface border border-border rounded-3xl p-6 sm:p-7 ${
        big ? "sm:col-span-2 lg:col-span-3" : "lg:col-span-2"
      }`}
    >
      <div className="size-12 rounded-2xl bg-lime/10 border border-lime/25 flex items-center justify-center mb-5">
        <Icon className="size-6 text-lime" aria-hidden />
      </div>
      <h3 className="font-display font-bold text-lg mb-2">{title}</h3>
      <p className="text-sm text-ink-muted leading-relaxed">{desc}</p>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Page                                                                      */
/* ------------------------------------------------------------------------ */

export function LandingPage() {
  const scope = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Révélation au scroll de toutes les cibles marquées
        gsap.utils.toArray<HTMLElement>("[data-st-fade]").forEach((el) => {
          gsap.from(el, {
            y: 44,
            autoAlpha: 0,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%" },
          });
        });

        // Étapes : cascade + trait qui se dessine entre elles
        gsap.from("[data-step]", {
          y: 56,
          autoAlpha: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.16,
          scrollTrigger: { trigger: "[data-steps]", start: "top 82%" },
        });
        gsap.from("[data-step-line]", {
          scaleX: 0,
          transformOrigin: "left center",
          duration: 1.2,
          ease: "power2.inOut",
          scrollTrigger: { trigger: "[data-steps]", start: "top 78%" },
        });

        // CTA final : zoom doux à l'arrivée
        gsap.from("[data-final-cta]", {
          scale: 0.94,
          y: 40,
          autoAlpha: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: "[data-final-cta]", start: "top 85%" },
        });
      });
    }, scope);
    return () => ctx.revert();
  }, []);

  return (
    <main ref={scope} className="flex-1 overflow-x-clip">
      <FloatingHeader />
      <Hero />
      <Marquee />
      <StatsBar />

      {/* Comment ça marche */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div data-st-fade className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-lime mb-3">
            Simple comme un service
          </p>
          <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight">
            Comment ça marche
          </h2>
        </div>
        <div data-steps className="relative grid sm:grid-cols-3 gap-4 sm:gap-6">
          <div
            data-step-line
            aria-hidden
            className="hidden sm:block absolute top-10 inset-x-16 h-px bg-gradient-to-r from-lime/60 via-lime/25 to-lime/60"
          />
          {steps.map((s) => (
            <div
              key={s.n}
              data-step
              className="relative bg-surface border border-border rounded-3xl p-6 sm:p-7 card-lift"
            >
              <span className="relative inline-flex items-center justify-center size-14 rounded-2xl bg-lime text-on-lime font-display font-bold text-lg mb-5 glow-lime">
                {s.n}
              </span>
              <h3 className="font-display font-bold text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-ink-muted leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Fonctionnalités — bento grid */}
      <section className="relative border-t border-border bg-surface/30">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
          <div data-st-fade className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-lime mb-3">
              Pensé pour le bord du terrain
            </p>
            <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight mb-4">
              Tout ce qu&apos;il faut pour jouer
            </h2>
            <p className="text-ink-muted max-w-lg mx-auto">
              Rapide, lisible, utilisable d&apos;une main entre deux matchs — même pour tes invités
              sans compte.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {features.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative overflow-hidden glow-scene noise">
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[55%] [transform:perspective(700px)_rotateX(58deg)] origin-bottom court-grid opacity-60"
          style={{
            maskImage: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)",
            WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)",
          }}
        />
        <div data-final-cta className="relative mx-auto max-w-4xl px-4 py-24 sm:py-36 text-center">
          <LogoMark className="size-16 mx-auto mb-8 animate-float" />
          <h2 className="font-display text-[clamp(2.2rem,6vw,4.5rem)] font-bold tracking-tight leading-[1.05] mb-6">
            Le prochain americano,
            <br />
            <span className="text-gradient">c&apos;est toi qui l&apos;organises.</span>
          </h2>
          <p className="text-ink-muted text-lg mb-10 max-w-md mx-auto">
            Gratuit, sans installation : tout se passe dans le navigateur, même pour tes invités.
          </p>
          <Magnetic className="inline-block">
            <Link
              href="/signup"
              className="btn-shine h-14 px-10 inline-flex items-center justify-center rounded-2xl bg-lime text-on-lime text-lg font-bold hover:bg-lime-deep transition-colors glow-lime"
            >
              Créer mon compte gratuit
            </Link>
          </Magnetic>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Logo href="/" />
          <p className="text-xs text-ink-faint">
            © {new Date().getFullYear()} PadelPro — Americanos, mexicanos &amp; tournois.
          </p>
        </div>
      </footer>
    </main>
  );
}
