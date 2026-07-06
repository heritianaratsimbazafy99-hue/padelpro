"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, ChevronRight, Flame, Plus, QrCode, Target, Trophy, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { usePlayerStats } from "@/lib/use-stats";
import { FORMAT_LABELS, STATUS_LABELS } from "@/lib/utils";
import type { PadelEvent } from "@/lib/types";
import { AppPage, BottomNav, TopBar } from "@/components/shell";
import { Badge, Button, Input, SkeletonList } from "@/components/ui";
import { CountUp } from "@/components/motion";

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [recent, setRecent] = useState<PadelEvent[] | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [photoNudge, setPhotoNudge] = useState(false);
  const stats = usePlayerStats(user?.id ?? null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);
      const [{ data: profile }, { data: events }] = await Promise.all([
        supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle(),
        supabase
          .from("events")
          .select("*")
          .eq("organizer_id", user.id)
          .order("created_at", { ascending: false })
          .limit(4),
      ]);
      setDisplayName(profile?.display_name ?? "");
      setRecent((events ?? []) as PadelEvent[]);
      // Incite à compléter la licence : pas de photo et pas encore écarté.
      setPhotoNudge(!profile?.avatar_url && localStorage.getItem("padelpro:photo-nudge") !== "off");
    })();
  }, [supabase]);

  function dismissPhotoNudge() {
    localStorage.setItem("padelpro:photo-nudge", "off");
    setPhotoNudge(false);
  }

  function joinByCode(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code) router.push(`/join/${code}`);
  }

  const active = (recent ?? []).filter((e) => e.status === "active");

  return (
    <>
      <TopBar />
      <AppPage>
        <section className="mb-6 animate-fade-up">
          <h1 className="text-2xl font-extrabold">
            Salut{displayName ? ` ${displayName.split(" ")[0]}` : ""}
          </h1>
          <p className="text-ink-muted">Prêt à faire tourner les paires ?</p>
        </section>

        {/* Complète ta licence : photo de profil manquante */}
        {photoNudge && (
          <section className="mb-6 animate-fade-up">
            <div className="relative flex items-center gap-3 bg-surface border border-border rounded-(--radius-card) p-4 shadow-club">
              <span className="size-11 shrink-0 rounded-full bg-lime/30 border border-lime-deep/40 flex items-center justify-center text-court">
                <Camera className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-tight">Mets un visage sur ta licence</p>
                <p className="text-xs text-ink-muted mt-0.5">
                  Ta photo apparaîtra sur le classement et dans les événements.
                </p>
              </div>
              <Link
                href="/profile"
                className="shrink-0 h-9 px-3.5 inline-flex items-center rounded-full bg-court text-cream text-xs font-bold hover:bg-court-2 transition-colors"
              >
                Ajouter
              </Link>
              <button
                type="button"
                onClick={dismissPhotoNudge}
                aria-label="Ne plus afficher"
                className="absolute -top-2 -right-2 size-6 rounded-full bg-surface-2 border border-border text-ink-faint hover:text-ink flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          </section>
        )}

        {/* Actions rapides */}
        <section className="grid grid-cols-2 gap-3 mb-6 animate-fade-up [animation-delay:60ms]">
          <Link
            href="/events/new"
            className="btn-shine flex flex-col gap-3 bg-lime text-on-lime rounded-(--radius-card) p-4 cursor-pointer transition-all duration-200 hover:bg-lime-deep hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] glow-lime"
          >
            <Plus className="size-6" aria-hidden />
            <span className="font-extrabold leading-tight">
              Créer un
              <br />
              événement
            </span>
          </Link>
          <form
            onSubmit={joinByCode}
            className="flex flex-col justify-between gap-2 bg-surface border border-border rounded-(--radius-card) p-4"
          >
            <label htmlFor="join-code" className="flex items-center gap-2 font-extrabold text-sm">
              <QrCode className="size-5 text-court" aria-hidden />
              Rejoindre
            </label>
            <div className="flex gap-1.5">
              <Input
                id="join-code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="CODE"
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="h-10 px-3 text-sm tracking-widest font-bold uppercase"
              />
              <Button type="submit" size="sm" aria-label="Rejoindre" className="h-10 shrink-0 px-3">
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </form>
        </section>

        {/* Stats perso */}
        <section className="mb-6 animate-fade-up [animation-delay:120ms]">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-clay mb-3">
            Tes statistiques
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Trophy, label: "Victoires", value: stats?.wins, suffix: "" },
              { icon: Target, label: "Matchs", value: stats?.matches, suffix: "" },
              { icon: Flame, label: "% victoire", value: stats?.winRate, suffix: "%" },
            ].map(({ icon: Icon, label, value, suffix }) => (
              <div
                key={label}
                className="bg-surface border border-border rounded-(--radius-card) p-3.5 flex flex-col gap-1.5 card-lift"
              >
                <Icon className="size-4 text-court" aria-hidden />
                <p className="tnum text-xl font-extrabold">
                  {value === undefined ? "–" : <CountUp value={value} suffix={suffix} />}
                </p>
                <p className="text-[0.6875rem] text-ink-faint font-semibold">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Événements */}
        <section className="animate-fade-up [animation-delay:180ms]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-clay">
              {active.length > 0 ? "En cours" : "Récents"}
            </h2>
            <Link href="/events" className="text-sm font-semibold text-court hover:underline">
              Tout voir
            </Link>
          </div>
          {recent === null ? (
            <SkeletonList rows={3} />
          ) : recent.length === 0 ? (
            <div className="bg-surface border border-dashed border-border-strong rounded-(--radius-card) p-6 text-center">
              <p className="text-sm text-ink-muted leading-relaxed">
                Aucun événement pour l&apos;instant.
                <br />
                Lance ton premier americano !
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {(active.length > 0 ? active : recent).map((e, i) => (
                <li key={e.id} className="stagger-i" style={{ "--i": i } as React.CSSProperties}>
                  <Link
                    href={`/events/${e.id}`}
                    className="group flex items-center gap-3 bg-surface border border-border rounded-(--radius-card) p-4 card-lift"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{e.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge tone="lime">{FORMAT_LABELS[e.format]}</Badge>
                        <Badge
                          tone={
                            e.status === "active"
                              ? "warning"
                              : e.status === "completed"
                                ? "success"
                                : "muted"
                          }
                        >
                          {e.status === "active" && (
                            <span className="size-1.5 rounded-full bg-warning animate-pulse-soft" aria-hidden />
                          )}
                          {STATUS_LABELS[e.status]}
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight
                      className="size-5 text-ink-faint shrink-0 transition-transform group-hover:translate-x-1 group-hover:text-court"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </AppPage>
      <BottomNav />
    </>
  );
}
