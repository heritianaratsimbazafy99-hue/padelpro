"use client";

import { useLayoutEffect, useRef } from "react";
import { QrCode, Repeat } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/* ==========================================================================
   CourtScene — la pièce maîtresse du hero.
   Un terrain de padel en pseudo-3D (CSS transforms) qui rejoue en boucle un
   americano à 8 joueurs : 4 sur le court, 4 au repos sur le banc. Entre les
   rounds, « Rotation des joueurs » (le banc entre en jeu) ou « Rotation des
   paires » (les meilleurs se retrouvent), balle avec vraie physique, score
   live, classement top-4 qui se réordonne, sacre du vainqueur.

   Tout est piloté par UNE timeline GSAP déterministe : uniquement des
   transforms/opacity (60 fps), zéro dépendance. Un léger scrub au scroll
   accentue la perspective du terrain. En prefers-reduced-motion, la scène
   reste une illustration statique complète et lisible.
========================================================================== */

type PlayerId =
  | "heritiana"
  | "salman"
  | "dera"
  | "tsiresy"
  | "johary"
  | "sanda"
  | "frederique"
  | "teddy";

const PLAYER_NAMES: Record<PlayerId, string> = {
  heritiana: "Heritiana",
  salman: "Salman",
  dera: "Dera",
  tsiresy: "Tsiresy",
  johary: "Johary",
  sanda: "Sanda",
  frederique: "Frédérique",
  teddy: "Teddy",
};

const ALL_PLAYERS = Object.keys(PLAYER_NAMES) as PlayerId[];

const LIME = "#c8f542";
const CLAY = "#e8582f";
const BENCH = "#cbc3a6";

/* Slots en % de la surface du terrain : 4 sur le court, 4 sur le banc
   (à gauche, hors des vitres). */
type SlotName = "t1a" | "t1b" | "t2a" | "t2b" | "b1" | "b2" | "b3" | "b4";

const SLOTS: Record<SlotName, { x: number; y: number }> = {
  t1a: { x: 27, y: 19 },
  t1b: { x: 73, y: 31 },
  t2a: { x: 27, y: 69 },
  t2b: { x: 73, y: 83 },
  b1: { x: -18, y: 32 },
  b2: { x: -18, y: 50 },
  b3: { x: -18, y: 68 },
  b4: { x: -18, y: 86 },
};

const ringColor = (slot: SlotName) =>
  slot.startsWith("t1") ? LIME : slot.startsWith("t2") ? CLAY : BENCH;

interface RoundScript {
  label: string;
  /** Chip de transition affiché avant CE round (le round 1 sert au bouclage). */
  chip: string;
  /** Position de chacun des 8 joueurs pendant le round. */
  positions: Record<PlayerId, SlotName>;
  /** Score au moment où l'on « prend » le match en cours. */
  start: [number, number];
  /** Vainqueur de chaque point joué à l'écran. */
  winners: Array<1 | 2>;
  /** Classement cumulé des 8 joueurs (trié) affiché à la fin du round. */
  standings: Array<{ id: PlayerId; pts: number }>;
}

/* Un americano à 8 joueurs (7 rounds) dont on suit 3 rounds : le banc entre
   en jeu au round 2, les 4 meneurs se retrouvent au round 3 — et Salman
   arrache la couronne à Heritiana au dernier moment. */
const ROUNDS: RoundScript[] = [
  {
    label: "Round 1/7",
    chip: "Rotation des joueurs",
    positions: {
      heritiana: "t1a",
      salman: "t1b",
      dera: "t2a",
      tsiresy: "t2b",
      johary: "b1",
      sanda: "b2",
      frederique: "b3",
      teddy: "b4",
    },
    start: [12, 9],
    winners: [1, 2, 1],
    standings: [
      { id: "heritiana", pts: 14 },
      { id: "salman", pts: 14 },
      { id: "dera", pts: 10 },
      { id: "tsiresy", pts: 10 },
      { id: "johary", pts: 0 },
      { id: "sanda", pts: 0 },
      { id: "frederique", pts: 0 },
      { id: "teddy", pts: 0 },
    ],
  },
  {
    label: "Round 2/7",
    chip: "Rotation des joueurs",
    positions: {
      johary: "t1a",
      sanda: "t1b",
      frederique: "t2a",
      teddy: "t2b",
      heritiana: "b1",
      salman: "b2",
      dera: "b3",
      tsiresy: "b4",
    },
    start: [11, 10],
    winners: [2, 1, 1],
    standings: [
      { id: "heritiana", pts: 14 },
      { id: "salman", pts: 14 },
      { id: "johary", pts: 13 },
      { id: "sanda", pts: 13 },
      { id: "frederique", pts: 11 },
      { id: "teddy", pts: 11 },
      { id: "dera", pts: 10 },
      { id: "tsiresy", pts: 10 },
    ],
  },
  {
    label: "Round 3/7",
    chip: "Rotation des paires",
    positions: {
      heritiana: "t1a",
      johary: "t1b",
      salman: "t2a",
      sanda: "t2b",
      frederique: "b1",
      teddy: "b2",
      dera: "b3",
      tsiresy: "b4",
    },
    start: [8, 12],
    winners: [1, 2, 2, 2],
    standings: [
      { id: "salman", pts: 29 },
      { id: "sanda", pts: 28 },
      { id: "heritiana", pts: 23 },
      { id: "johary", pts: 22 },
      { id: "frederique", pts: 11 },
      { id: "teddy", pts: 11 },
      { id: "dera", pts: 10 },
      { id: "tsiresy", pts: 10 },
    ],
  },
];

/** Positions du round 1 = référentiel des deltas et placement CSS statique. */
const BASE_SLOT: Record<PlayerId, { x: number; y: number }> = Object.fromEntries(
  ALL_PLAYERS.map((id) => [id, SLOTS[ROUNDS[0].positions[id]]]),
) as Record<PlayerId, { x: number; y: number }>;

const ROW_H = 30; // hauteur d'une ligne du classement (px)
const WINDOW = 4; // lignes visibles dans la fenêtre du classement
const HIT_DUR = 0.42; // durée d'une traversée de balle (s)

const teamOf = (r: RoundScript, team: 1 | 2): [PlayerId, PlayerId] => {
  const a = team === 1 ? "t1a" : "t2a";
  const b = team === 1 ? "t1b" : "t2b";
  return [
    ALL_PLAYERS.find((id) => r.positions[id] === a)!,
    ALL_PLAYERS.find((id) => r.positions[id] === b)!,
  ];
};

const teamLabel = (ids: [PlayerId, PlayerId]) =>
  `${PLAYER_NAMES[ids[0]]} & ${PLAYER_NAMES[ids[1]]}`;

/* -------------------------------------------------------------------------- */

export function CourtScene() {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(root);
      const one = (sel: string) => q(sel)[0] as HTMLElement | undefined;
      const court = one("[data-court]");
      if (!court) return;

      const setText = (el: HTMLElement | undefined, s: string) => {
        if (el) el.textContent = s;
      };

      const mm = gsap.matchMedia();

      /* ---- Tilt 3D piloté par la souris (desktop uniquement) ---- */
      mm.add(
        "(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)",
        () => {
          const tilt = one("[data-tilt]");
          if (!tilt) return;
          const rx = gsap.quickTo(tilt, "rotationX", { duration: 0.7, ease: "power3.out" });
          const ry = gsap.quickTo(tilt, "rotationY", { duration: 0.7, ease: "power3.out" });
          const move = (e: MouseEvent) => {
            const r = root.getBoundingClientRect();
            ry(((e.clientX - r.left) / r.width - 0.5) * 7);
            rx(-((e.clientY - r.top) / r.height - 0.5) * 7);
          };
          const leave = () => {
            rx(0);
            ry(0);
          };
          root.addEventListener("mousemove", move);
          root.addEventListener("mouseleave", leave);
          return () => {
            root.removeEventListener("mousemove", move);
            root.removeEventListener("mouseleave", leave);
          };
        },
      );

      /* ---- Le match qui se joue tout seul + boost au scroll ---- */
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const ballOuter = one("[data-ball-outer]");
        const ballHop = one("[data-ball-hop]");
        const ballVis = one("[data-ball]");
        const ballShadow = one("[data-ball-shadow]");
        const roundEl = one("[data-round]");
        const rotChip = one("[data-rot-chip]");
        const rotChipText = one("[data-rot-chip-text]");
        const crown = one("[data-lb-crown]");
        const boost = one("[data-boost]");
        const teamEl = (t: 1 | 2) => one(`[data-team="${t}"]`);
        const scoreEl = (t: 1 | 2) => one(`[data-score="${t}"]`);
        const flashEl = (t: 1 | 2) => one(`[data-flash="${t}"]`);
        const puckEl = (id: PlayerId) => one(`[data-puck="${id}"]`);
        const ringEl = (id: PlayerId) => one(`[data-ring="${id}"]`);
        const rowEl = (id: PlayerId) => one(`[data-lb-row="${id}"]`);
        const rowPts = (id: PlayerId) => one(`[data-lb-pts="${id}"]`);
        if (!ballOuter || !ballHop || !ballVis || !ballShadow) return;

        /* Boost de perspective au scroll : le terrain se redresse légèrement
           quand le hero défile (scrub). */
        if (boost) {
          gsap.to(boost, {
            rotationX: 7,
            rotationZ: 4,
            scale: 1.04,
            ease: "none",
            scrollTrigger: {
              trigger: root,
              start: "top 65%",
              end: "bottom -20%",
              scrub: 0.5,
            },
          });
        }

        /* Deltas en px depuis la position CSS statique (recalculés au resize
           via invalidate() : valeurs fonctionnelles). */
        const px = (targetX: number, baseX: number) => () =>
          ((targetX - baseX) / 100) * court.offsetWidth;
        const py = (targetY: number, baseY: number) => () =>
          ((targetY - baseY) / 100) * court.offsetHeight;
        /* La balle est posée statiquement au centre (50, 44). */
        const bx = (x: number) => px(x, 50);
        const by = (y: number) => py(y, 44);

        /* État initial (avant premier paint) : début du round 1. */
        const r0 = ROUNDS[0];
        setText(roundEl, r0.label);
        setText(teamEl(1), teamLabel(teamOf(r0, 1)));
        setText(teamEl(2), teamLabel(teamOf(r0, 2)));
        setText(scoreEl(1), String(r0.start[0]));
        setText(scoreEl(2), String(r0.start[1]));
        ALL_PLAYERS.forEach((id, i) => {
          setText(rowPts(id), "0");
          const row = rowEl(id);
          if (row) gsap.set(row, { y: Math.min(i, WINDOW) * ROW_H, autoAlpha: i < WINDOW ? 1 : 0 });
        });
        if (crown) gsap.set(crown, { scale: 0, autoAlpha: 0 });
        gsap.set(ballOuter, { x: bx(66), y: by(28) });

        /* Respiration des joueurs (boucle indépendante). */
        gsap.to(q("[data-bob]"), {
          y: -3,
          duration: 1.6,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          stagger: 0.35,
        });

        /* ---------- Construction de la timeline maîtresse ---------- */
        const master = gsap.timeline({ repeat: -1, delay: 0.8 });
        let lastSide: 1 | 2 = 1; // côté où la balle se trouve (1 = haut)
        let xi = 0;
        const X_CYCLE = [34, 66, 46, 70, 30, 58, 40, 62];
        const Y_SIDE: Record<1 | 2, number[]> = { 1: [24, 18, 30], 2: [74, 84, 70] };

        /** Un point : échange de N frappes puis balle qui meurt côté perdant. */
        const playPoint = (winner: 1 | 2, hits: number, onWin: () => void) => {
          const loser: 1 | 2 = winner === 1 ? 2 : 1;
          let side: 1 | 2 = lastSide === 1 ? 2 : 1;
          /* Parité : la dernière traversée doit finir côté perdant. */
          const endSide = hits % 2 === 1 ? side : side === 1 ? 2 : 1;
          if (endSide !== loser) hits += 1;

          for (let i = 0; i < hits; i++) {
            const x = X_CYCLE[xi % X_CYCLE.length];
            const y = Y_SIDE[side][xi % 3];
            xi++;
            const seg = gsap.timeline();
            /* Frappe : squash de départ */
            seg.fromTo(
              ballVis,
              { scaleY: 0.72, scaleX: 1.22 },
              { scaleY: 1, scaleX: 1, duration: 0.14, ease: "power2.out" },
              0,
            );
            /* Trajectoire au sol (linéaire) + arc vertical (billboard) */
            seg.to(ballOuter, { x: bx(x), y: by(y), duration: HIT_DUR, ease: "none" }, 0);
            seg.to(ballHop, { y: -26, duration: HIT_DUR / 2, ease: "power2.out" }, 0);
            seg.to(ballHop, { y: 0, duration: HIT_DUR / 2, ease: "power2.in" }, HIT_DUR / 2);
            /* L'ombre se détache pendant le vol */
            seg.to(
              ballShadow,
              { scale: 0.55, opacity: 0.12, duration: HIT_DUR / 2, ease: "power2.out" },
              0,
            );
            seg.to(
              ballShadow,
              { scale: 1, opacity: 0.28, duration: HIT_DUR / 2, ease: "power2.in" },
              HIT_DUR / 2,
            );
            master.add(seg);
            side = side === 1 ? 2 : 1;
          }
          lastSide = loser;

          /* Le point tombe : flash lime côté vainqueur + pop du score. */
          master.call(onWin);
          const sc = scoreEl(winner);
          if (sc) master.fromTo(sc, { scale: 1.5 }, { scale: 1, duration: 0.35, ease: "power2.out" }, "<");
          const fl = flashEl(winner);
          if (fl) master.fromTo(fl, { opacity: 0.3 }, { opacity: 0, duration: 0.5, ease: "power1.out" }, "<");
          master.to({}, { duration: 0.4 }); // respiration entre les points
        };

        /** Joue un round complet (points + mise à jour du classement top-4). */
        const playRound = (r: RoundScript, ri: number) => {
          let [a, b] = r.start;
          r.winners.forEach((w, wi) => {
            if (w === 1) a++;
            else b++;
            const sa = String(a);
            const sb = String(b);
            playPoint(w, 3 + ((ri + wi) % 2), () => {
              setText(scoreEl(1), sa);
              setText(scoreEl(2), sb);
            });
          });

          /* Fin du round : le classement se réordonne (fenêtre top-4,
             les joueurs hors fenêtre glissent dessous et s'estompent). */
          master.call(() => {
            r.standings.forEach(({ id, pts }) => setText(rowPts(id), String(pts)));
          });
          r.standings.forEach(({ id }, rank) => {
            const row = rowEl(id);
            if (!row) return;
            master.to(
              row,
              {
                y: Math.min(rank, WINDOW) * ROW_H,
                autoAlpha: rank < WINDOW ? 1 : 0,
                duration: 0.65,
                ease: "power3.inOut",
              },
              rank === 0 ? ">" : "<",
            );
          });
          master.fromTo(
            q("[data-lb-pts]"),
            { color: CLAY },
            { color: "inherit", duration: 0.7, ease: "power1.out" },
            "<",
          );

          /* Dernier round : petit sacre du vainqueur. */
          if (ri === ROUNDS.length - 1 && crown) {
            master.fromTo(
              crown,
              { scale: 0, autoAlpha: 0, rotation: -25 },
              { scale: 1, autoAlpha: 1, rotation: 0, duration: 0.5, ease: "back.out(2.2)" },
              ">+0.1",
            );
            master.to({}, { duration: 1.1 });
          } else {
            master.to({}, { duration: 0.5 });
          }
        };

        /** Transition : rotation des joueurs/paires vers le round suivant. */
        const rotateTo = (r: RoundScript, reset = false) => {
          master.call(() => setText(rotChipText, r.chip));
          if (rotChip) {
            master.fromTo(
              rotChip,
              { autoAlpha: 0, scale: 0.7, y: 8 },
              { autoAlpha: 1, scale: 1, y: 0, duration: 0.35, ease: "back.out(2)" },
              ">",
            );
          }
          /* La balle est ramassée : elle revient près du filet. */
          master.to(ballOuter, { x: bx(50), y: by(48), duration: 0.5, ease: "power2.inOut" }, "<");
          master.to(ballHop, { y: 0, duration: 0.3 }, "<");
          lastSide = 2;

          /* Les 8 joueurs rejoignent leur nouvelle place (court ↔ banc). */
          ALL_PLAYERS.forEach((id, k) => {
            const puck = puckEl(id);
            if (!puck) return;
            const slot = SLOTS[r.positions[id]];
            master.to(
              puck,
              {
                x: px(slot.x, BASE_SLOT[id].x),
                y: py(slot.y, BASE_SLOT[id].y),
                duration: 1,
                ease: "power3.inOut",
              },
              k === 0 ? ">-0.05" : "<0.08",
            );
            const ring = ringEl(id);
            if (ring) {
              master.to(ring, { borderColor: ringColor(r.positions[id]), duration: 0.5 }, "<0.3");
            }
          });

          /* Nouveau round : libellés + scores de départ. */
          master.call(() => {
            setText(roundEl, r.label);
            setText(teamEl(1), teamLabel(teamOf(r, 1)));
            setText(teamEl(2), teamLabel(teamOf(r, 2)));
            setText(scoreEl(1), String(r.start[0]));
            setText(scoreEl(2), String(r.start[1]));
            if (reset) ALL_PLAYERS.forEach((id) => setText(rowPts(id), "0"));
          });
          if (reset) {
            ALL_PLAYERS.forEach((id, i) => {
              const row = rowEl(id);
              if (!row) return;
              master.to(
                row,
                {
                  y: Math.min(i, WINDOW) * ROW_H,
                  autoAlpha: i < WINDOW ? 1 : 0,
                  duration: 0.5,
                  ease: "power3.inOut",
                },
                i === 0 ? ">" : "<",
              );
            });
            if (crown) master.to(crown, { scale: 0, autoAlpha: 0, duration: 0.3 }, "<");
          }
          const rp = roundEl;
          if (rp) master.fromTo(rp, { y: 7, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.35 }, "<");
          if (rotChip) master.to(rotChip, { autoAlpha: 0, y: -8, duration: 0.3 }, ">+0.15");
          master.to({}, { duration: 0.25 });
        };

        /* Boucle : R1 → rotation joueurs → R2 → rotation paires → R3
           → sacre → rotation joueurs (reset) → R1… */
        ROUNDS.forEach((r, ri) => {
          playRound(r, ri);
          const next = ROUNDS[(ri + 1) % ROUNDS.length];
          rotateTo(next, ri === ROUNDS.length - 1);
        });

        /* Recalcule les deltas de position au resize. */
        const ro = new ResizeObserver(() => master.invalidate());
        ro.observe(court);

        return () => {
          ro.disconnect();
        };
      });
    }, root);

    return () => ctx.revert();
  }, []);

  /* Damier QR déterministe (même astuce que la landing) */
  const qrCells = Array.from({ length: 25 }, (_, i) => (i * 7 + (i % 4) * 3) % 5 < 2);

  /* État statique (fallback reduced-motion) : fin du round 1. */
  const r0 = ROUNDS[0];
  const staticStandings = r0.standings;

  return (
    <div
      ref={rootRef}
      data-cursor
      role="img"
      aria-label="Démonstration animée : un americano de padel à 8 joueurs. Les joueurs au repos entrent en jeu à chaque rotation, les paires tournent, la balle traverse le filet, le score monte en direct et le classement se réordonne."
      className="relative w-full h-[26rem] sm:h-[30rem] select-none"
    >
      {/* Halo au sol derrière la scène */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[60%] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(200,245,66,0.22), rgba(20,53,31,0.06) 55%, transparent 72%)",
        }}
      />

      {/* ---- Scène 3D ---- */}
      <div aria-hidden className="absolute inset-0" style={{ perspective: "1100px" }}>
        <div data-tilt className="absolute inset-0 will-change-transform" style={{ transformStyle: "preserve-3d" }}>
          <div data-boost className="absolute inset-0 will-change-transform" style={{ transformStyle: "preserve-3d" }}>
            <div
              data-court
              className="absolute left-1/2 max-sm:left-[57%] top-1/2 w-[74%] max-w-72 max-sm:w-[68%] aspect-[10/16]"
              style={{
                transform: "translate(-54%, -48%) rotateX(55deg) rotateZ(-33deg)",
                transformStyle: "preserve-3d",
              }}
            >
              {/* Surface du terrain */}
              <div
                className="absolute inset-0 rounded-[10px]"
                style={{
                  background: "linear-gradient(155deg, #1c4a2b 0%, #17402a 45%, #14351f 100%)",
                  boxShadow: "0 0 0 6px rgba(20,33,15,0.25), 0 60px 90px -30px rgba(20,33,15,0.5)",
                }}
              />
              {/* Marquages (SVG, lignes crème) */}
              <svg
                viewBox="0 0 100 160"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full"
              >
                <rect x="2" y="2" width="96" height="156" fill="none" stroke="rgba(243,240,230,0.55)" strokeWidth="1.1" rx="1.5" />
                <line x1="2" y1="26" x2="98" y2="26" stroke="rgba(243,240,230,0.45)" strokeWidth="0.9" />
                <line x1="2" y1="134" x2="98" y2="134" stroke="rgba(243,240,230,0.45)" strokeWidth="0.9" />
                <line x1="50" y1="26" x2="50" y2="134" stroke="rgba(243,240,230,0.45)" strokeWidth="0.9" />
                <line x1="2" y1="80" x2="98" y2="80" stroke="rgba(243,240,230,0.25)" strokeWidth="1.6" />
              </svg>

              {/* Flashs de point (une moitié par équipe) */}
              <div
                data-flash="1"
                className="absolute inset-x-0 top-0 h-1/2 rounded-t-[10px] pointer-events-none"
                style={{ opacity: 0, background: "radial-gradient(ellipse at 50% 60%, rgba(200,245,66,0.75), transparent 70%)" }}
              />
              <div
                data-flash="2"
                className="absolute inset-x-0 bottom-0 h-1/2 rounded-b-[10px] pointer-events-none"
                style={{ opacity: 0, background: "radial-gradient(ellipse at 50% 40%, rgba(200,245,66,0.75), transparent 70%)" }}
              />

              {/* Vitre du fond (cage) */}
              <div
                className="absolute inset-x-0 top-0 h-16 origin-top"
                style={{
                  transform: "rotateX(90deg)",
                  background:
                    "linear-gradient(to top, rgba(243,240,230,0.2), rgba(243,240,230,0.04)), repeating-linear-gradient(to right, rgba(243,240,230,0.28) 0 1px, transparent 1px 20%)",
                  borderTop: "1.5px solid rgba(243,240,230,0.45)",
                }}
              />

              {/* Filet (debout au milieu) */}
              <div
                className="absolute left-[-2%] right-[-2%] top-1/2 h-7 origin-top"
                style={{
                  transform: "rotateX(90deg)",
                  background:
                    "repeating-linear-gradient(to right, rgba(243,240,230,0.3) 0 1px, transparent 1px 5px), repeating-linear-gradient(to bottom, rgba(243,240,230,0.3) 0 1px, transparent 1px 5px), rgba(20,33,15,0.35)",
                  borderTop: "2px solid rgba(243,240,230,0.8)",
                }}
              />

              {/* Étiquette du banc (sous le dernier joueur au repos) */}
              <div className="absolute" style={{ left: "-18%", top: "100%" }}>
                <div
                  className="absolute origin-bottom"
                  style={{ transform: "translate(-50%, -100%) rotateZ(33deg) rotateX(-55deg)" }}
                >
                  <span className="px-2 py-0.5 rounded-full bg-court/70 text-cream/90 text-[0.55rem] font-bold uppercase tracking-wider whitespace-nowrap">
                    Au repos
                  </span>
                </div>
              </div>

              {/* Joueurs (4 sur le court + 4 au banc) */}
              {ALL_PLAYERS.map((id) => {
                const slot = BASE_SLOT[id];
                const color = ringColor(r0.positions[id]);
                return (
                  <div
                    key={id}
                    data-puck={id}
                    className="absolute will-change-transform"
                    style={{ left: `${slot.x}%`, top: `${slot.y}%`, transformStyle: "preserve-3d" }}
                  >
                    {/* Ombre au sol */}
                    <div
                      className="absolute -translate-x-1/2 -translate-y-1/2 w-9 h-3.5 rounded-full bg-black/30 blur-[3px]"
                      aria-hidden
                    />
                    {/* Billboard (toujours face caméra) */}
                    <div
                      className="absolute origin-bottom"
                      style={{ transform: "translate(-50%, -100%) rotateZ(33deg) rotateX(-55deg)" }}
                    >
                      <div data-bob className="flex flex-col items-center gap-1">
                        <span
                          data-ring={id}
                          className="flex items-center justify-center size-9 rounded-full bg-cream font-display font-bold text-[0.7rem] text-court"
                          style={{ border: `3px solid ${color}`, boxShadow: "0 6px 14px -4px rgba(20,33,15,0.5)" }}
                        >
                          {PLAYER_NAMES[id][0]}
                        </span>
                        <span className="px-1.5 py-px rounded-full bg-court/80 text-cream text-[0.55rem] font-bold leading-tight whitespace-nowrap">
                          {PLAYER_NAMES[id]}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Balle */}
              <div
                data-ball-outer
                className="absolute will-change-transform"
                style={{ left: "50%", top: "44%", transformStyle: "preserve-3d" }}
              >
                <div
                  data-ball-shadow
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-2 rounded-full bg-black/30 blur-[2px]"
                  style={{ opacity: 0.28 }}
                  aria-hidden
                />
                <div
                  className="absolute origin-bottom"
                  style={{ transform: "translate(-50%, -100%) rotateZ(33deg) rotateX(-55deg)" }}
                >
                  <div data-ball-hop className="will-change-transform">
                    <div data-ball className="size-4 rounded-full ball-lime" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Chips UI (espace écran, par-dessus la scène) ---- */}

      {/* Scoreboard live */}
      <div
        data-scene-chip
        data-parallax="16"
        className="absolute left-0 top-0 z-10 max-w-52 origin-top-left max-sm:scale-90"
      >
        <div className="bg-surface/95 backdrop-blur-sm border border-border rounded-2xl shadow-club-lg px-3.5 py-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="font-display font-bold text-[0.8rem] leading-none">Americano du lundi</p>
            <span className="inline-flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-wider text-clay shrink-0">
              <span className="size-1.5 rounded-full bg-clay animate-pulse-soft" aria-hidden />
              Live
            </span>
          </div>
          <p data-round className="inline-block text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink-faint mb-2">
            {r0.label}
          </p>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <span data-team="1" className="text-xs font-bold truncate">
                {teamLabel(teamOf(r0, 1))}
              </span>
              <span
                data-score="1"
                className="tnum inline-block min-w-7 text-center text-sm font-extrabold bg-lime text-on-lime rounded-lg px-1.5 py-0.5"
              >
                14
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span data-team="2" className="text-xs font-bold truncate">
                {teamLabel(teamOf(r0, 2))}
              </span>
              <span
                data-score="2"
                className="tnum inline-block min-w-7 text-center text-sm font-extrabold bg-clay/15 text-clay rounded-lg px-1.5 py-0.5"
              >
                10
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticker QR */}
      <div
        data-scene-chip
        data-parallax="30"
        className="absolute right-0 top-6 z-10 rotate-6 origin-top-right max-sm:scale-90"
      >
        <div className="flex items-center gap-2 bg-court text-cream rounded-2xl pl-2 pr-3 py-2 shadow-club-lg">
          <span className="grid grid-cols-5 gap-px bg-cream p-1 rounded-md" aria-hidden>
            {qrCells.map((on, i) => (
              <span key={i} className={`size-1 ${on ? "bg-court" : "bg-cream"}`} />
            ))}
          </span>
          <span className="text-[0.62rem] font-bold uppercase tracking-wider leading-tight">
            Scanne
            <br />
            &amp; joue
          </span>
          <QrCode className="size-3.5 opacity-70" aria-hidden />
        </div>
      </div>

      {/* Classement live : fenêtre top-4 sur les 8 joueurs */}
      <div
        data-scene-chip
        data-parallax="22"
        className="absolute right-0 bottom-0 z-10 w-44 origin-bottom-right max-sm:scale-90"
      >
        <div className="relative bg-surface/95 backdrop-blur-sm border border-border rounded-2xl shadow-club-lg px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink-faint">
              Classement
            </p>
            <span className="size-1.5 rounded-full bg-court animate-pulse-soft" aria-hidden />
          </div>
          <div className="relative overflow-hidden" style={{ height: ROW_H * WINDOW }}>
            {ALL_PLAYERS.map((id) => {
              const rank = staticStandings.findIndex((s) => s.id === id);
              const visible = rank < WINDOW;
              return (
                <div
                  key={id}
                  data-lb-row={id}
                  className="absolute inset-x-0 top-0 flex items-center gap-2 will-change-transform"
                  style={{
                    height: ROW_H,
                    transform: `translateY(${Math.min(rank, WINDOW) * ROW_H}px)`,
                    opacity: visible ? 1 : 0,
                  }}
                >
                  <span
                    className="flex items-center justify-center size-5 rounded-full bg-surface-2 border border-border text-[0.6rem] font-bold text-court shrink-0"
                    aria-hidden
                  >
                    {PLAYER_NAMES[id][0]}
                  </span>
                  <span className="flex-1 text-[0.72rem] font-semibold truncate">{PLAYER_NAMES[id]}</span>
                  <span data-lb-pts={id} className="tnum text-[0.72rem] font-extrabold">
                    {staticStandings[rank]?.pts ?? 0}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Couronne du vainqueur (fin de partie) */}
          <span
            data-lb-crown
            className="absolute -top-2.5 -left-2 text-base"
            style={{ transform: "scale(0)", opacity: 0 }}
            aria-hidden
          >
            👑
          </span>
        </div>
      </div>

      {/* Chip de transition « Rotation des joueurs / des paires » */}
      <div
        data-rot-chip
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
        style={{ opacity: 0 }}
        aria-hidden
      >
        <span className="flex items-center gap-1.5 bg-clay text-cream rounded-full px-3.5 py-2 text-xs font-bold shadow-club-lg whitespace-nowrap">
          <Repeat className="size-3.5" aria-hidden />
          <span data-rot-chip-text>Rotation des joueurs</span>
        </span>
      </div>
    </div>
  );
}
