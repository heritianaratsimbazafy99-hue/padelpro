"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { Logo, LogoMark } from "@/components/logo";
import { Cursor } from "./cursor";
import { Hero } from "./hero";
import { Magnetic } from "./magnetic";
import { FeaturesRail } from "./features";
import { Manifesto, Showcase, Stats, StepsDeck } from "./sections";

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

/* ------------------------------------------------------------------------ */
/* Rideau d'intro — deux panneaux qui libèrent la page (CSS pur)             */
/* ------------------------------------------------------------------------ */

function IntroCurtain() {
  return (
    <div aria-hidden className="fixed inset-0 z-[100] pointer-events-none">
      <div className="curtain curtain-2 absolute inset-0 bg-lime" />
      <div className="curtain curtain-1 absolute inset-0 bg-court flex items-center justify-center">
        <LogoMark className="size-16" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Nav flottante claire : pilule opaque dès qu'on scrolle                    */
/* ------------------------------------------------------------------------ */

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
        className={`mx-auto max-w-5xl h-14 px-4 flex items-center justify-between rounded-full transition-all duration-300 border ${
          scrolled
            ? "bg-surface/85 backdrop-blur-xl border-border shadow-club"
            : "bg-transparent border-transparent"
        }`}
      >
        <Logo href="/" />
        <nav className="flex items-center gap-1.5">
          <Link
            href="/login"
            className="h-10 px-4 inline-flex items-center rounded-full text-sm font-semibold text-ink-muted hover:text-ink transition-colors"
          >
            Connexion
          </Link>
          <Link
            href="/signup"
            className="btn-shine h-10 px-5 inline-flex items-center rounded-full bg-court text-cream text-sm font-bold hover:bg-court-2 transition-colors"
          >
            Commencer
          </Link>
        </nav>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------------ */
/* Marquee incliné, réactif à la vitesse de scroll (skew)                    */
/* ------------------------------------------------------------------------ */

const marqueeWords = [
  "Americano",
  "Mexicano",
  "Tournois",
  "Scores live",
  "Elo global",
  "QR code",
];

function VelocityMarquee({
  band,
  dot,
  reverse = false,
}: {
  band: string;
  dot: string;
  reverse?: boolean;
}) {
  const scope = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const inner = innerRef.current;
        if (!inner) return;
        /* La bande se cisaille avec la vitesse de scroll puis revient */
        const proxy = { skew: 0 };
        const setter = gsap.quickSetter(inner, "skewX", "deg");
        const clamp = gsap.utils.clamp(-14, 14);
        const st = ScrollTrigger.create({
          onUpdate(self) {
            const skew = clamp(self.getVelocity() / -250);
            if (Math.abs(skew) > Math.abs(proxy.skew)) {
              proxy.skew = skew;
              gsap.to(proxy, {
                skew: 0,
                duration: 0.9,
                ease: "power3",
                overwrite: true,
                onUpdate: () => setter(proxy.skew),
              });
            }
          },
        });
        return () => st.kill();
      });
    }, scope);
    return () => ctx.revert();
  }, []);

  const items = [...marqueeWords, ...marqueeWords];
  return (
    <div
      ref={scope}
      className={`relative my-2 overflow-hidden select-none ${band} ${
        reverse ? "rotate-[1.5deg]" : "-rotate-[1.5deg]"
      } scale-[1.02]`}
      aria-hidden
    >
      <div
        ref={innerRef}
        className="animate-marquee flex w-max items-center gap-10 py-4 pr-10"
        style={reverse ? { animationDirection: "reverse" } : undefined}
      >
        {[0, 1].map((half) => (
          <div key={half} className="flex items-center gap-10">
            {items.map((w, i) => (
              <span
                key={`${half}-${i}`}
                className="flex items-center gap-10 font-display font-bold uppercase tracking-wide text-lg sm:text-2xl whitespace-nowrap"
              >
                {w}
                <span className={`size-2.5 rounded-full ${dot}`} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* CTA final — poster lime                                                   */
/* ------------------------------------------------------------------------ */

function FinalCta() {
  return (
    <section className="sec-lime relative overflow-hidden court-lines-light grain">
      {/* Mot fantôme en fond, en parallaxe */}
      <span
        aria-hidden
        data-speed="0.8"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display font-bold uppercase text-[26vw] leading-none text-outline whitespace-nowrap select-none pointer-events-none"
      >
        Padel
      </span>

      <div data-final-cta className="relative mx-auto max-w-4xl px-4 py-28 sm:py-44 text-center">
        <LogoMark className="size-16 mx-auto mb-8 animate-float" />
        <h2 className="font-display text-[clamp(2.4rem,6.5vw,5rem)] font-bold tracking-tight leading-[1.02] mb-6">
          Le prochain americano,
          <br />
          <span className="font-serif-display italic font-normal">
            c&apos;est toi qui l&apos;organises.
          </span>
        </h2>
        <p className="text-ink-muted text-lg mb-10 max-w-md mx-auto">
          Gratuit, sans installation : tout se passe dans le navigateur, même pour tes
          invités.
        </p>
        <Magnetic className="inline-block">
          <Link
            href="/signup"
            className="btn-shine group h-16 px-12 inline-flex items-center justify-center gap-2.5 rounded-full bg-court text-cream text-lg font-bold hover:bg-court-2 transition-colors shadow-club-lg"
          >
            Créer mon compte gratuit
            <ArrowRight
              className="size-5 transition-transform group-hover:translate-x-1"
              aria-hidden
            />
          </Link>
        </Magnetic>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Footer vert profond, logotype géant                                       */
/* ------------------------------------------------------------------------ */

function Footer() {
  return (
    <footer className="sec-court relative overflow-hidden grain">
      <div className="relative mx-auto max-w-6xl px-4 pt-16">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-10 border-b border-border">
          <Logo href="/" />
          <nav className="flex items-center gap-6 text-sm font-semibold text-ink-muted">
            <Link href="/login" className="hover:text-ink transition-colors">
              Connexion
            </Link>
            <Link href="/signup" className="hover:text-ink transition-colors">
              Créer un compte
            </Link>
          </nav>
        </div>
        <p className="text-xs text-ink-faint text-center py-6">
          © {new Date().getFullYear()}
          {" — "}PadelPro, americanos, mexicanos &amp; tournois.
        </p>
      </div>
      <div aria-hidden className="relative overflow-hidden">
        <p className="font-display font-bold uppercase text-[16vw] leading-[0.78] text-center text-outline select-none translate-y-[16%]">
          PadelPro
        </p>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------------ */
/* Moteur global : smooth scroll, reveals, barre de progression.             */
/* Monté en PREMIER enfant : son effet s'exécute avant ceux des sections,    */
/* donc ScrollSmoother existe avant leurs pins (sinon pins désynchronisés).  */
/* Le DOM complet existe déjà au moment des effets ; le contexte GSAP est    */
/* volontairement global — la ref du parent n'est attachée qu'après les      */
/* effets de ses enfants, elle serait null ici.                              */
/* ------------------------------------------------------------------------ */

function GlobalMotion() {
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        /* Inertie de scroll + effets data-speed (desktop pointeur fin) */
        let smoother: ScrollSmoother | undefined;
        if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
          smoother = ScrollSmoother.create({
            wrapper: "#smooth-wrapper",
            content: "#smooth-content",
            smooth: 1.15,
            effects: true,
          });
        }

        /* Révélation au scroll de toutes les cibles marquées */
        gsap.utils.toArray<HTMLElement>("[data-st-fade]").forEach((el) => {
          gsap.from(el, {
            y: 44,
            autoAlpha: 0,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%" },
          });
        });

        /* CTA final : zoom doux à l'arrivée */
        gsap.from("[data-final-cta]", {
          scale: 0.94,
          y: 40,
          autoAlpha: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: "[data-final-cta]", start: "top 85%" },
        });

        /* Barre de progression de lecture (sélecteur : les refs des
           éléments frères suivants ne sont pas encore attachées ici) */
        gsap.to(".scroll-progress", {
          scaleX: 1,
          ease: "none",
          scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
        });

        /* Re-mesure après la transition d'entrée du template (0,3 s) :
           elle modifie brièvement le containing block des éléments fixed. */
        const refreshId = window.setTimeout(() => ScrollTrigger.refresh(), 450);

        return () => {
          window.clearTimeout(refreshId);
          smoother?.kill();
        };
      });
    });
    return () => ctx.revert();
  }, []);

  return null;
}

/* ------------------------------------------------------------------------ */
/* Page                                                                      */
/* ------------------------------------------------------------------------ */

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);

  /* Fond crème derrière l'overscroll pendant la landing */
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = "#f3f0e6";
    return () => {
      document.body.style.background = prev;
    };
  }, []);

  return (
    <div ref={rootRef} className="landing-light flex-1">
      <GlobalMotion />
      <IntroCurtain />
      <div className="scroll-progress" aria-hidden />
      <FloatingHeader />
      <Cursor scopeRef={rootRef} />

      {/* ScrollSmoother : tout le contenu défilant vit dans #smooth-content */}
      <div id="smooth-wrapper">
        <main id="smooth-content" className="overflow-x-clip">
          <Hero />
          <VelocityMarquee band="bg-court text-cream" dot="bg-lime" />
          <Stats />
          <StepsDeck />
          <Manifesto />
          <Showcase />
          <FeaturesRail />
          <VelocityMarquee band="bg-clay text-cream" dot="bg-cream" reverse />
          <FinalCta />
          <Footer />
        </main>
      </div>
    </div>
  );
}
