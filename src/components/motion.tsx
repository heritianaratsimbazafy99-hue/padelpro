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
 * Focus-trap pour modales/sheets : à l'activation, mémorise l'élément
 * déclencheur, place le focus sur le premier élément focusable du conteneur
 * (souvent le bouton de fermeture), fait boucler Tab / Shift+Tab à
 * l'intérieur, puis restaure le focus au déclencheur à la fermeture.
 * Attacher la ref renvoyée au panneau de la modale.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;
    const previous = document.activeElement as HTMLElement | null;

    const selector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    // Éléments focusables réellement rendus (exclut les éléments cachés).
    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => el.getClientRects().length > 0,
      );

    const first = focusables()[0];
    (first ?? container).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = els[0];
      const lastEl = els[els.length - 1];
      const current = document.activeElement;
      if (e.shiftKey) {
        if (current === firstEl || !container.contains(current)) {
          e.preventDefault();
          lastEl.focus();
        }
      } else if (current === lastEl || !container.contains(current)) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previous?.focus();
    };
  }, [active]);

  return ref;
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
