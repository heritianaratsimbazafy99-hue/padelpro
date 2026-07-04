"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Home, Medal, Plus, Trophy, User } from "lucide-react";
import { Logo } from "./logo";
import type { ReactNode } from "react";

/** Top bar for app pages: back button or logo + optional actions. */
export function TopBar({
  title,
  back,
  actions,
}: {
  title?: string;
  back?: boolean;
  actions?: ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-lg border-b border-border">
      <div className="mx-auto max-w-2xl px-4 h-14 flex items-center gap-3">
        {back ? (
          <button
            onClick={() => router.back()}
            aria-label="Retour"
            className="size-10 -ml-2 rounded-xl flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-2 cursor-pointer transition-colors"
          >
            <ArrowLeft className="size-5" />
          </button>
        ) : (
          <Logo href="/dashboard" />
        )}
        {title && <h1 className="text-base font-bold truncate flex-1">{title}</h1>}
        {!title && <div className="flex-1" />}
        {actions}
      </div>
    </header>
  );
}

const navItems = [
  { href: "/dashboard", label: "Accueil", icon: Home },
  { href: "/events", label: "Événements", icon: Trophy },
  { href: "/events/new", label: "Créer", icon: Plus },
  { href: "/leaderboard", label: "Classement", icon: Medal },
  { href: "/profile", label: "Profil", icon: User },
];

/** Fixed bottom navigation for the authenticated app (mobile-first). */
export function BottomNav() {
  const pathname = usePathname();
  const activeIndex = navItems.findIndex(({ href }) =>
    href === "/events"
      ? pathname === "/events" || (pathname.startsWith("/events/") && pathname !== "/events/new")
      : pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/")),
  );
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed bottom-0 inset-x-0 z-40 bg-background/90 backdrop-blur-lg border-t border-border pb-safe"
    >
      <div className="mx-auto max-w-2xl grid grid-cols-5 relative">
        {/* Indicateur actif : pilule qui glisse d'un onglet à l'autre */}
        {activeIndex >= 0 && (
          <span
            aria-hidden
            className="absolute top-1.5 h-8 w-[20%] flex justify-center transition-[left] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] pointer-events-none"
            style={{ left: `${activeIndex * 20}%` }}
          >
            <span className="h-8 w-14 rounded-full bg-lime/12 border border-lime/20" />
          </span>
        )}
        {navItems.map(({ href, label, icon: Icon }, i) => {
          const active = i === activeIndex;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-col items-center gap-1 pt-2.5 pb-1.5 text-[0.6875rem] font-semibold transition-colors ${
                active ? "text-lime" : "text-ink-faint hover:text-ink-muted active:scale-95"
              }`}
            >
              <Icon
                className={`size-5 transition-transform duration-300 ${active ? "-translate-y-px scale-110" : ""}`}
                aria-hidden
              />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Page container that leaves room for the fixed bottom nav. */
export function AppPage({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-28 flex-1">{children}</main>;
}
