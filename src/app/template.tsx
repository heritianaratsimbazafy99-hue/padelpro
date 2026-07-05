"use client";

/**
 * Template racine : remonté à chaque navigation, il rejoue une courte
 * transition d'entrée sur chaque page (fondu + translation).
 *
 * La classe d'animation est retirée dès qu'elle se termine : une animation
 * avec transform (même figée à translateY(0) par `fill: both`) fait de cet
 * élément le « containing block » de tous ses descendants `position: fixed`
 * (header flottant, wrapper ScrollSmoother…), ce qui casse leur ancrage.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex-1 flex flex-col animate-page-in"
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) {
          e.currentTarget.classList.remove("animate-page-in");
        }
      }}
    >
      {children}
    </div>
  );
}
