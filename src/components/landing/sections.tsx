"use client";

import { useLayoutEffect, useRef } from "react";
import { QrCode, Scale, Sparkles, Trophy, Zap } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CountUp } from "@/components/motion";

gsap.registerPlugin(ScrollTrigger, SplitText);

/* ------------------------------------------------------------------------ */
/* Chiffres clés — compteurs géants sur papier                               */
/* ------------------------------------------------------------------------ */

export function Stats() {
  const stats = [
    { value: 60, suffix: "s", label: "pour lancer un tournoi" },
    { value: 3, suffix: "", label: "formats de jeu" },
    { value: 100, suffix: "%", label: "gratuit, sans installation" },
    { value: 0, suffix: "", label: "papier, zéro crayon" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
      <div data-st-fade className="grid grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`px-6 py-8 text-center ${i > 0 ? "border-l border-border" : ""} ${
              i >= 2 ? "max-lg:border-t max-lg:border-border" : ""
            } ${i === 2 ? "max-lg:border-l-0" : ""}`}
          >
            <p className="font-display text-[clamp(2.8rem,6vw,4.5rem)] leading-none font-bold text-court tnum">
              <CountUp value={s.value} suffix={s.suffix} />
            </p>
            <p className="font-serif-display italic text-base text-ink-muted mt-3">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Manifeste — texte géant révélé mot à mot au scroll (section verte)        */
/* ------------------------------------------------------------------------ */

export function Manifesto() {
  const scope = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const split = new SplitText("[data-manifesto]", { type: "words" });
        gsap.fromTo(
          split.words,
          { opacity: 0.12 },
          {
            opacity: 1,
            stagger: 0.06,
            ease: "none",
            scrollTrigger: {
              trigger: "[data-manifesto]",
              start: "top 78%",
              end: "bottom 45%",
              scrub: 0.4,
            },
          },
        );
      });
    }, scope);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={scope} className="sec-court relative overflow-hidden grain">
      {/* Stickers flottants */}
      <div
        aria-hidden
        data-speed="0.85"
        className="absolute top-16 right-[8%] rotate-6 hidden md:block"
      >
        <span className="inline-flex items-center gap-2 bg-lime text-on-lime rounded-full px-4 py-2 text-sm font-bold shadow-club">
          <QrCode className="size-4" /> 0 papier
        </span>
      </div>
      <div
        aria-hidden
        data-speed="1.12"
        className="absolute bottom-24 left-[6%] -rotate-6 hidden md:block"
      >
        <span className="inline-flex items-center gap-2 bg-clay text-cream rounded-full px-4 py-2 text-sm font-bold shadow-club">
          <Zap className="size-4" /> Scores live
        </span>
      </div>
      <div aria-hidden data-speed="0.9" className="absolute top-1/3 left-[10%] hidden lg:block">
        <div className="size-10 rounded-full ball-lime opacity-80" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 py-28 sm:py-40">
        <p data-st-fade className="text-xs font-bold uppercase tracking-[0.3em] text-lime mb-8">
          Le manifeste
        </p>
        <p
          data-manifesto
          className="font-display text-[clamp(1.7rem,4.2vw,3.2rem)] font-bold leading-[1.25] tracking-tight"
        >
          Fini le papier, le crayon et les disputes de comptage. Tu crées l&apos;événement,
          tes joueurs scannent un QR code, et tout s&apos;enchaîne — rotations équitables,
          scores en direct, classement qui se met à jour tout seul. Toi, tu n&apos;as plus
          qu&apos;à <span className="font-serif-display italic font-normal text-lime">jouer.</span>
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Étapes — deck de cartes empilées (sticky + scale au scroll)               */
/* ------------------------------------------------------------------------ */

const deckSteps = [
  {
    n: "01",
    title: "Crée ton événement",
    desc: "Format, points, terrains, joueurs : tout se règle sur un seul écran. Americano, mexicano ou tournoi à élimination — prêt en 60 secondes.",
    card: "bg-surface border border-border text-ink",
    accent: "bg-lime text-on-lime",
    visual: "form" as const,
  },
  {
    n: "02",
    title: "Partage le QR code",
    desc: "Chaque joueur scanne, choisit son nom et annonce ses scores lui-même. Aucun compte requis pour tes invités, zéro friction.",
    card: "sec-court text-cream border border-transparent",
    accent: "bg-lime text-on-lime",
    visual: "qr" as const,
  },
  {
    n: "03",
    title: "Jouez, tout s'enchaîne",
    desc: "Rounds générés, scores en direct, classement qui vit sur tous les téléphones. Et à la fin : le podium.",
    card: "sec-lime text-court border border-transparent",
    accent: "bg-court text-cream",
    visual: "podium" as const,
  },
];

function StepVisual({ kind }: { kind: "form" | "qr" | "podium" }) {
  if (kind === "form") {
    return (
      <div className="bg-background/70 border border-border rounded-2xl p-5 space-y-3 shadow-club">
        {[
          ["Format", "Americano"],
          ["Points par match", "24"],
          ["Terrains", "2"],
          ["Joueurs", "8"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-6 text-sm">
            <span className="text-ink-muted font-medium">{k}</span>
            <span className="font-bold bg-surface border border-border rounded-lg px-3 py-1">
              {v}
            </span>
          </div>
        ))}
        <div className="pt-1">
          <div className="h-10 rounded-xl bg-lime text-on-lime flex items-center justify-center text-sm font-bold">
            Lancer l&apos;événement
          </div>
        </div>
      </div>
    );
  }
  if (kind === "qr") {
    /* Faux QR : damier déterministe */
    const cells = Array.from({ length: 64 }, (_, i) => (i * 7 + (i % 9) * 3) % 5 < 2);
    return (
      <div className="bg-cream rounded-2xl p-5 shadow-club w-fit mx-auto">
        <div className="grid grid-cols-8 gap-1">
          {cells.map((on, i) => (
            <span
              key={i}
              className={`size-3.5 sm:size-4 rounded-[2px] ${on ? "bg-court" : "bg-transparent"}`}
            />
          ))}
        </div>
        <p className="text-court text-center text-xs font-bold mt-3 tracking-widest uppercase">
          padelpro.app/join
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-end justify-center gap-3 h-44 sm:h-52">
      {[
        { h: "62%", label: "Sofia", medal: "2" },
        { h: "92%", label: "Léa", medal: "1" },
        { h: "46%", label: "Karim", medal: "3" },
      ].map((p) => (
        <div key={p.label} className="flex flex-col items-center gap-2 h-full justify-end w-20">
          <span className="text-xs font-bold">{p.label}</span>
          <div
            className={`w-full rounded-t-xl flex items-start justify-center pt-2 font-display font-bold ${
              p.medal === "1" ? "bg-court text-cream" : "bg-court/25 text-court"
            }`}
            style={{ height: p.h }}
          >
            {p.medal}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StepsDeck() {
  const scope = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        /* Cartes empilées : chaque carte s'épingle (pin) jusqu'à ce que la
           suivante vienne la recouvrir — sticky natif casserait sous
           ScrollSmoother (contenu transformé), donc pin ScrollTrigger. */
        const cards = gsap.utils.toArray<HTMLElement>("[data-deck-card]");
        /* Le smoother (créé après, dans l'effet du parent) transforme le
           contenu : le pin doit être en "transform" quand il sera actif. */
        const pinType = window.matchMedia("(hover: hover) and (pointer: fine)").matches
          ? ("transform" as const)
          : ("fixed" as const);
        cards.forEach((card, i) => {
          const next = cards[i + 1];
          if (!next) return;
          ScrollTrigger.create({
            trigger: card,
            start: "top top+=110",
            endTrigger: next,
            end: "top top+=110",
            pin: true,
            pinSpacing: false,
            pinType,
          });
          gsap.to(card, {
            scale: 0.93,
            autoAlpha: 0.45,
            transformOrigin: "center top",
            ease: "none",
            scrollTrigger: {
              trigger: next,
              start: "top bottom",
              end: "top top+=140",
              scrub: true,
            },
          });
        });
      });
    }, scope);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={scope} className="relative mx-auto max-w-5xl px-4 py-20 sm:py-28">
      <div data-st-fade className="text-center mb-14">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-clay mb-4">
          Simple comme un service
        </p>
        <h2 className="font-display text-4xl sm:text-6xl font-bold tracking-tight">
          Trois gestes,{" "}
          <span className="font-serif-display italic font-normal">zéro friction.</span>
        </h2>
      </div>

      <div className="space-y-[10vh] pb-[8vh]">
        {deckSteps.map((s) => (
          <div
            key={s.n}
            data-deck-card
            className={`relative rounded-[2rem] p-7 sm:p-12 shadow-club-lg overflow-hidden grain will-change-transform ${s.card}`}
          >
            <div className="relative grid md:grid-cols-2 gap-8 items-center">
              <div>
                <span
                  className={`inline-flex items-center justify-center size-14 rounded-2xl font-display font-bold text-xl mb-6 ${s.accent}`}
                >
                  {s.n}
                </span>
                <h3 className="font-display text-2xl sm:text-4xl font-bold tracking-tight mb-4">
                  {s.title}
                </h3>
                <p className="text-base sm:text-lg leading-relaxed opacity-80 max-w-md">
                  {s.desc}
                </p>
              </div>
              <div className="relative">
                <span
                  aria-hidden
                  className="absolute -top-10 -right-2 font-display font-bold text-[7rem] leading-none opacity-10 select-none hidden sm:block"
                >
                  {s.n}
                </span>
                <StepVisual kind={s.visual} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Showcase — le classement vit tout seul (section verte)                    */
/* ------------------------------------------------------------------------ */

const leaderboard = [
  { rank: 1, name: "Léa", pts: 148, delta: "+12" },
  { rank: 2, name: "Sofia", pts: 141, delta: "+8" },
  { rank: 3, name: "Karim", pts: 133, delta: "+5" },
  { rank: 4, name: "Marco", pts: 127, delta: "-3" },
];

export function Showcase() {
  const scope = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-podium-bar]", {
          scaleY: 0,
          transformOrigin: "bottom center",
          duration: 1.1,
          ease: "elastic.out(1, 0.6)",
          stagger: 0.12,
          scrollTrigger: { trigger: "[data-podium]", start: "top 80%" },
        });
        gsap.from("[data-lb-row]", {
          x: -32,
          autoAlpha: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.09,
          scrollTrigger: { trigger: "[data-lb]", start: "top 85%" },
        });
      });
    }, scope);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={scope} className="sec-court relative overflow-hidden grain">
      <div className="relative mx-auto max-w-6xl px-4 py-24 sm:py-36 grid lg:grid-cols-2 gap-14 items-center">
        <div data-st-fade>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-lime mb-4">
            Pendant que tu joues
          </p>
          <h2 className="font-display text-4xl sm:text-6xl font-bold tracking-tight mb-6">
            Le classement{" "}
            <span className="font-serif-display italic font-normal text-lime">
              vit tout seul.
            </span>
          </h2>
          <p className="text-ink-muted text-lg leading-relaxed max-w-md mb-8">
            Chaque score annoncé met à jour le classement sur tous les téléphones. Elo
            global, victoires, taux de réussite : tout se calcule sans toi.
          </p>
          <ul className="space-y-4">
            {[
              { icon: Zap, txt: "Temps réel sur tous les écrans, sans recharger" },
              { icon: Scale, txt: "Équipes équilibrées selon le niveau de chacun" },
              { icon: Trophy, txt: "Podium final et Elo global sur tous tes événements" },
            ].map(({ icon: Icon, txt }) => (
              <li key={txt} className="flex items-center gap-3 text-base font-medium">
                <span className="size-9 shrink-0 rounded-xl bg-lime/15 border border-lime/30 flex items-center justify-center">
                  <Icon className="size-4.5 text-lime" aria-hidden />
                </span>
                {txt}
              </li>
            ))}
          </ul>
        </div>

        {/* Visuel : podium + mini classement */}
        <div className="relative" data-speed="0.94">
          <div
            data-podium
            className="flex items-end justify-center gap-3 h-56 sm:h-64 mb-6 px-6"
            aria-hidden
          >
            {[
              { h: "58%", n: "2", name: "Sofia" },
              { h: "88%", n: "1", name: "Léa" },
              { h: "42%", n: "3", name: "Karim" },
            ].map((p) => (
              <div key={p.n} className="flex flex-col items-center justify-end gap-2 h-full w-24">
                <span className="text-xs font-bold text-ink-muted">{p.name}</span>
                <div
                  data-podium-bar
                  className={`w-full rounded-t-2xl flex items-start justify-center pt-3 font-display text-xl font-bold ${
                    p.n === "1" ? "bg-lime text-on-lime" : "bg-surface-2 text-cream"
                  }`}
                  style={{ height: p.h }}
                >
                  {p.n}
                </div>
              </div>
            ))}
          </div>

          <div
            data-lb
            data-cursor
            className="bg-surface border border-border rounded-3xl p-4 sm:p-5 shadow-club-lg"
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="font-display font-bold text-sm">Classement live</p>
              <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold text-lime uppercase tracking-wider">
                <span className="size-1.5 rounded-full bg-lime animate-pulse-soft" aria-hidden />
                En direct
              </span>
            </div>
            <div className="space-y-1.5">
              {leaderboard.map((r) => (
                <div
                  key={r.rank}
                  data-lb-row
                  className="flex items-center gap-3 bg-background/50 border border-border rounded-xl px-3 py-2.5"
                >
                  <span
                    className={`size-7 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold ${
                      r.rank === 1 ? "bg-lime text-on-lime" : "bg-surface-2 text-ink-muted"
                    }`}
                  >
                    {r.rank}
                  </span>
                  <span className="flex-1 text-sm font-semibold">{r.name}</span>
                  <span className="tnum text-sm font-bold">{r.pts} pts</span>
                  <span
                    className={`tnum text-xs font-bold w-9 text-right ${
                      r.delta.startsWith("+") ? "text-lime" : "text-clay"
                    }`}
                  >
                    {r.delta}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Sticker Elo */}
          <div
            aria-hidden
            data-speed="1.08"
            className="absolute -top-4 -right-2 sm:-right-6 rotate-6"
          >
            <span className="inline-flex items-center gap-2 bg-cream text-court rounded-full px-4 py-2 text-sm font-bold shadow-club-lg">
              <Sparkles className="size-4" /> Elo +12
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
