"use client";

import { useLayoutEffect, useRef } from "react";
import { ArrowRight, BarChart3, QrCode, Repeat, Scale, Trophy, Zap } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useSpotlight } from "@/components/motion";

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    icon: Repeat,
    title: "Americano & Mexicano",
    desc: "Rotations générées automatiquement : jamais deux fois le même partenaire tant qu'une alternative existe, repos répartis équitablement.",
    accent: "bg-lime text-on-lime",
  },
  {
    icon: Trophy,
    title: "Tournois à élimination",
    desc: "Tableau avec têtes de série et byes automatiques. Le vainqueur avance tout seul dans le bracket.",
    accent: "bg-court text-cream",
  },
  {
    icon: Scale,
    title: "Équilibrage intelligent",
    desc: "Mode équilibré : les équipes de chaque match sont formées pour des scores serrés, selon le niveau des joueurs.",
    accent: "bg-clay text-cream",
  },
  {
    icon: QrCode,
    title: "QR code magique",
    desc: "Les joueurs scannent, choisissent leur nom et annoncent les scores eux-mêmes. Zéro friction, zéro papier.",
    accent: "bg-court text-cream",
  },
  {
    icon: Zap,
    title: "Scores en direct",
    desc: "Classement et prochains matchs mis à jour en temps réel sur tous les téléphones.",
    accent: "bg-lime text-on-lime",
  },
  {
    icon: BarChart3,
    title: "Elo & statistiques",
    desc: "Compte gratuit : classement Elo global, victoires, taux de réussite et historique complet sur tous tes événements.",
    accent: "bg-clay text-cream",
  },
];

function FeaturePanel({
  icon: Icon,
  title,
  desc,
  accent,
  index,
}: (typeof features)[number] & { index: number }) {
  const onMove = useSpotlight<HTMLDivElement>();
  return (
    <div
      data-cursor
      onMouseMove={onMove}
      className="spotlight lift relative shrink-0 w-full lg:w-[24rem] bg-surface border border-border rounded-[1.75rem] p-7 sm:p-8 shadow-club overflow-hidden"
    >
      <span
        aria-hidden
        className="absolute -top-6 right-4 font-display font-bold text-[6rem] leading-none text-outline select-none"
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <div
        className={`relative size-14 rounded-2xl flex items-center justify-center mb-24 lg:mb-32 shadow-club ${accent}`}
      >
        <Icon className="size-7" aria-hidden />
      </div>
      <h3 className="relative font-display font-bold text-xl sm:text-2xl tracking-tight mb-3">
        {title}
      </h3>
      <p className="relative text-sm sm:text-base text-ink-muted leading-relaxed">{desc}</p>
    </div>
  );
}

/**
 * Rail horizontal épinglé (desktop) : la section se fige et les cartes
 * défilent latéralement au rythme du scroll. Pile verticale sur mobile.
 */
export function FeaturesRail() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        const track = trackRef.current;
        const section = sectionRef.current;
        if (!track || !section) return;

        const distance = () => track.scrollWidth - window.innerWidth;
        const st = {
          trigger: section,
          start: "top top",
          end: () => "+=" + distance(),
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          /* Smoother créé après (effet du parent) → pin en transform */
          pinType: window.matchMedia("(hover: hover) and (pointer: fine)").matches
            ? ("transform" as const)
            : ("fixed" as const),
        };
        gsap.to(track, { x: () => -distance(), ease: "none", scrollTrigger: st });
        gsap.to(progressRef.current, {
          scaleX: 1,
          ease: "none",
          scrollTrigger: { ...st, pin: false },
        });
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative overflow-hidden lg:h-screen lg:flex lg:flex-col lg:justify-center py-20 lg:py-0">
      <div className="mx-auto w-full max-w-6xl px-4 mb-10 lg:mb-12 flex items-end justify-between gap-6">
        <div data-st-fade>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-clay mb-4">
            Pensé pour le bord du terrain
          </p>
          <h2 className="font-display text-4xl sm:text-6xl font-bold tracking-tight">
            Tout ce qu&apos;il faut{" "}
            <span className="font-serif-display italic font-normal">pour jouer.</span>
          </h2>
        </div>
        <div
          data-st-fade
          className="hidden lg:flex items-center gap-2 text-ink-faint text-xs font-bold uppercase tracking-[0.2em] shrink-0 pb-2"
          aria-hidden
        >
          Scroll <ArrowRight className="size-4" />
        </div>
      </div>

      <div
        ref={trackRef}
        className="h-rail flex-col lg:flex-row gap-5 lg:gap-6 px-4 lg:px-[max(1rem,calc((100vw-72rem)/2))] mx-auto w-full max-w-6xl lg:max-w-none lg:w-max"
      >
        {features.map((f, i) => (
          <FeaturePanel key={f.title} {...f} index={i} />
        ))}
      </div>

      {/* Progression du rail */}
      <div className="hidden lg:block mx-auto w-full max-w-6xl px-4 mt-12">
        <div className="h-0.5 bg-border rounded-full overflow-hidden">
          <div
            ref={progressRef}
            className="h-full bg-court origin-left"
            style={{ transform: "scaleX(0)" }}
          />
        </div>
      </div>
    </section>
  );
}
