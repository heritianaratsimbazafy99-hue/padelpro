"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * Curseur custom de la landing : point + anneau traînant.
 * Desktop pointeur fin uniquement, respecte prefers-reduced-motion.
 * Rendu invisible tant que la souris n'a pas bougé ; l'anneau s'ouvre
 * et se teinte lime au survol de tout élément interactif / [data-cursor].
 */
export function Cursor({ scopeRef }: { scopeRef: React.RefObject<HTMLElement | null> }) {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    const scope = scopeRef.current;
    if (!dot || !ring || !scope) return;

    // Le natif est masqué via la classe .cursor-live (CSS scopé média)
    scope.classList.add("cursor-live");

    const dx = gsap.quickTo(dot, "x", { duration: 0.15, ease: "power3.out" });
    const dy = gsap.quickTo(dot, "y", { duration: 0.15, ease: "power3.out" });
    const rx = gsap.quickTo(ring, "x", { duration: 0.45, ease: "power3.out" });
    const ry = gsap.quickTo(ring, "y", { duration: 0.45, ease: "power3.out" });

    let visible = false;
    const move = (e: MouseEvent) => {
      if (!visible) {
        visible = true;
        gsap.set([dot, ring], { x: e.clientX, y: e.clientY, autoAlpha: 1 });
      }
      dx(e.clientX);
      dy(e.clientY);
      rx(e.clientX);
      ry(e.clientY);
    };

    // Ouverture de l'anneau sur les cibles interactives
    const over = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a, button, [data-cursor]");
      const hovering = Boolean(target);
      ring.dataset.hovering = String(hovering);
      gsap.to(ring, { scale: hovering ? 1.6 : 1, duration: 0.3, ease: "power3.out" });
      gsap.to(dot, { scale: hovering ? 0.5 : 1, duration: 0.3, ease: "power3.out" });
    };

    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mouseover", over, { passive: true });
    return () => {
      scope.classList.remove("cursor-live");
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", over);
    };
  }, [scopeRef]);

  return (
    <>
      <div ref={dotRef} className="cursor-dot opacity-0" aria-hidden />
      <div ref={ringRef} className="cursor-ring opacity-0" aria-hidden />
    </>
  );
}
