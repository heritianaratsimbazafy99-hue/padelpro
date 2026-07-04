import Link from "next/link";
import {
  BarChart3,
  QrCode,
  Repeat,
  Scale,
  Trophy,
  Zap,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/logo";

const features = [
  {
    icon: Repeat,
    title: "Americano & Mexicano",
    desc: "Rotations générées automatiquement : jamais deux fois le même partenaire tant qu'une alternative existe, repos répartis équitablement.",
  },
  {
    icon: Trophy,
    title: "Tournois à élimination",
    desc: "Tableau avec têtes de série et byes automatiques. Le vainqueur avance tout seul dans le bracket.",
  },
  {
    icon: Scale,
    title: "Équilibrage intelligent",
    desc: "Mode équilibré : les équipes de chaque match sont formées pour des scores serrés, selon le niveau des joueurs.",
  },
  {
    icon: QrCode,
    title: "QR code magique",
    desc: "Les joueurs scannent, choisissent leur nom et annoncent les scores eux-mêmes. Zéro friction, zéro papier.",
  },
  {
    icon: Zap,
    title: "Scores en direct",
    desc: "Classement et prochains matchs mis à jour en temps réel sur tous les téléphones.",
  },
  {
    icon: BarChart3,
    title: "Statistiques joueur",
    desc: "Compte gratuit : victoires, taux de réussite et historique sur tous tes événements.",
  },
];

const steps = [
  { n: "1", title: "Crée ton événement", desc: "Format, points, terrains, joueurs : prêt en 60 secondes." },
  { n: "2", title: "Partage le QR code", desc: "Chaque joueur le scanne et sélectionne son nom." },
  { n: "3", title: "Jouez, tout s'enchaîne", desc: "Rounds, scores et classement live. Podium à la fin." },
];

export default function LandingPage() {
  return (
    <main className="flex-1">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-lg border-b border-border">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
          <Logo href="/" />
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="h-10 px-4 inline-flex items-center rounded-xl text-sm font-semibold text-ink-muted hover:text-ink transition-colors"
            >
              Connexion
            </Link>
            <Link
              href="/signup"
              className="h-10 px-4 inline-flex items-center rounded-xl bg-lime text-on-lime text-sm font-bold hover:bg-lime-deep transition-colors"
            >
              Commencer
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="court-grid border-b border-border">
        <div className="mx-auto max-w-5xl px-4 pt-16 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-surface border border-border rounded-full px-4 py-1.5 mb-6 text-xs font-semibold text-ink-muted">
            <span className="size-2 rounded-full bg-lime animate-pulse-soft" aria-hidden />
            Scores en temps réel, sur tous les téléphones
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.1] mb-5">
            Tes americanos de padel,
            <br />
            <span className="text-lime">sans prise de tête.</span>
          </h1>
          <p className="text-ink-muted text-lg max-w-xl mx-auto mb-9 leading-relaxed">
            Rotations équitables, équipes équilibrées, QR code pour les joueurs, classement live.
            L&apos;organisation d&apos;un tournoi ne devrait prendre que 60 secondes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="h-13 min-h-[3.25rem] px-8 inline-flex items-center justify-center rounded-2xl bg-lime text-on-lime text-base font-bold hover:bg-lime-deep transition-all active:scale-[0.98] glow-lime w-full sm:w-auto"
            >
              Organiser ma première partie
            </Link>
            <Link
              href="/login"
              className="h-13 min-h-[3.25rem] px-8 inline-flex items-center justify-center rounded-2xl border border-border-strong text-base font-semibold hover:border-lime hover:text-lime transition-colors w-full sm:w-auto"
            >
              J&apos;ai déjà un compte
            </Link>
          </div>

          {/* Aperçu produit stylisé */}
          <div className="mt-14 mx-auto max-w-sm bg-surface border border-border rounded-3xl p-5 text-left shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between mb-4">
              <p className="font-extrabold">Americano du vendredi</p>
              <span className="text-xs font-bold text-warning">Round 3/7</span>
            </div>
            <div className="bg-surface-2 border border-border rounded-2xl p-4 mb-3">
              <div className="flex items-center justify-between text-sm font-semibold mb-2">
                <span>Léa & Marco</span>
                <span className="tnum text-lime text-lg font-extrabold">14</span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold text-ink-muted">
                <span>Sofia & Karim</span>
                <span className="tnum text-lg font-extrabold">10</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-ink-faint px-1">
              <span>Terrain 1 · 24 pts</span>
              <span className="text-lime font-semibold">Score annoncé par Léa</span>
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-10">
          Comment ça marche
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {steps.map((s) => (
            <div key={s.n} className="bg-surface border border-border rounded-(--radius-card) p-5">
              <span className="inline-flex items-center justify-center size-9 rounded-xl bg-lime text-on-lime font-extrabold mb-3">
                {s.n}
              </span>
              <h3 className="font-bold mb-1.5">{s.title}</h3>
              <p className="text-sm text-ink-muted leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Fonctionnalités */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-3">
            Tout ce qu&apos;il faut pour jouer
          </h2>
          <p className="text-ink-muted text-center max-w-lg mx-auto mb-10">
            Pensé pour le bord du terrain : rapide, lisible, utilisable d&apos;une main entre deux
            matchs.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-surface border border-border rounded-(--radius-card) p-5 hover:border-lime/40 transition-colors"
              >
                <div className="size-11 rounded-xl bg-lime/10 border border-lime/25 flex items-center justify-center mb-4">
                  <Icon className="size-5 text-lime" aria-hidden />
                </div>
                <h3 className="font-bold mb-1.5">{title}</h3>
                <p className="text-sm text-ink-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-5xl px-4 py-20 text-center">
        <LogoMark className="size-14 mx-auto mb-6" />
        <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
          Le prochain americano, c&apos;est toi qui l&apos;organises.
        </h2>
        <p className="text-ink-muted mb-8 max-w-md mx-auto">
          Gratuit, sans installation : tout se passe dans le navigateur, même pour tes invités.
        </p>
        <Link
          href="/signup"
          className="h-13 min-h-[3.25rem] px-8 inline-flex items-center justify-center rounded-2xl bg-lime text-on-lime text-base font-bold hover:bg-lime-deep transition-all active:scale-[0.98] glow-lime"
        >
          Créer mon compte gratuit
        </Link>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Logo href="/" />
          <p className="text-xs text-ink-faint">
            © {new Date().getFullYear()} PadelPro — Americanos, mexicanos & tournois.
          </p>
        </div>
      </footer>
    </main>
  );
}
