"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react";

/**
 * Révélation au scroll : ajoute .is-inview quand l'élément entre dans le
 * viewport. Combiné aux classes CSS .reveal / .stagger de globals.css.
 */
export function Reveal({
  as: Tag = "div",
  className = "",
  children,
  once = true,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  once?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-inview");
            if (once) io.unobserve(entry.target);
          } else if (!once) {
            entry.target.classList.remove("is-inview");
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    // La cible et ses enfants directs marqués .reveal
    const targets = [el, ...Array.from(el.querySelectorAll(":scope > .reveal"))];
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [once]);

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}

/** Compteur animé : monte de 0 à `value` quand il devient visible. */
export function CountUp({
  value,
  suffix = "",
  duration = 900,
  className,
}: {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const [prevValue, setPrevValue] = useState(value);
  const [hasStarted, setHasStarted] = useState(false);
  const started = useRef(false);

  // Si la valeur change après l'animation (données live), suit directement.
  if (prevValue !== value) {
    setPrevValue(value);
    if (hasStarted) setDisplay(value);
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;
        started.current = true;
        setHasStarted(true);
        if (reduced) {
          setDisplay(value);
          io.disconnect();
          return;
        }
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setDisplay(Math.round(value * eased));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        io.disconnect();
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {display}
      {suffix}
    </span>
  );
}

/**
 * Confettis de célébration (canvas léger, sans dépendance).
 * Monté une fois : burst aux couleurs du club puis auto-nettoyage.
 * Ne fait rien si prefers-reduced-motion.
 */
export function Confetti({ duration = 2800 }: { duration?: number }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:80";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      return;
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);

    const colors = ["#c8f542", "#14351f", "#e8582f", "#b3e42e", "#f3f0e6"];
    const parts = Array.from({ length: 130 }, () => ({
      x: Math.random() * window.innerWidth,
      y: -20 - Math.random() * window.innerHeight * 0.4,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      vy: 2.2 + Math.random() * 3.4,
      vx: -1.2 + Math.random() * 2.4,
      rot: Math.random() * Math.PI,
      vr: -0.12 + Math.random() * 0.24,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const elapsed = t - t0;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const fade = Math.max(0, 1 - elapsed / duration);
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (elapsed < duration) raf = requestAnimationFrame(tick);
      else canvas.remove();
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      canvas.remove();
    };
  }, [duration]);

  return null;
}

/**
 * Piège le focus clavier dans une modale/sheet tant qu'elle est ouverte.
 * - Attacher la ref retournée au conteneur du dialogue (avec tabIndex={-1}).
 * - Au montage : focus sur [data-autofocus] s'il existe, sinon le conteneur.
 * - Tab / Shift+Tab bouclent à l'intérieur ; à la fermeture, le focus
 *   revient à l'élément qui avait ouvert le dialogue.
 */
export function useFocusTrap<T extends HTMLElement>(active = true) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;
    const previous = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.getClientRects().length > 0);

    const preferred = container.querySelector<HTMLElement>("[data-autofocus]");
    (preferred ?? container).focus({ preventScroll: true });

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) {
        e.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const current = document.activeElement;
      if (e.shiftKey) {
        if (current === first || !container.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last || !container.contains(current)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeydown, true);
    return () => {
      document.removeEventListener("keydown", onKeydown, true);
      previous?.focus?.({ preventScroll: true });
    };
  }, [active]);

  return ref;
}

/** Ferme une modale/sheet avec la touche Échap quand elle est ouverte. */
export function useEscapeClose(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, onClose]);
}

/**
 * Spotlight curseur : renvoie un onMouseMove qui positionne le halo
 * radial des cartes .spotlight (variables CSS --spot-x / --spot-y).
 */
export function useSpotlight<T extends HTMLElement>() {
  return useCallback((e: React.MouseEvent<T>) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    target.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    target.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  }, []);
}
