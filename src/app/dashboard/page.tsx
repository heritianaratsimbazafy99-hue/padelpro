"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronRight, Flame, Plus, QrCode, Target, Trophy } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { usePlayerStats } from "@/lib/use-stats";
import { FORMAT_LABELS, STATUS_LABELS } from "@/lib/utils";
import type { PadelEvent } from "@/lib/types";
import { AppPage, BottomNav, TopBar } from "@/components/shell";
import { Badge, Button, Input, PageLoader } from "@/components/ui";

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [recent, setRecent] = useState<PadelEvent[] | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const stats = usePlayerStats(user?.id ?? null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);
      const [{ data: profile }, { data: events }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
        supabase
          .from("events")
          .select("*")
          .eq("organizer_id", user.id)
          .order("created_at", { ascending: false })
          .limit(4),
      ]);
      setDisplayName(profile?.display_name ?? "");
      setRecent((events ?? []) as PadelEvent[]);
    })();
  }, [supabase]);

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

        {/* Actions rapides */}
        <section className="grid grid-cols-2 gap-3 mb-6">
          <Link
            href="/events/new"
            className="flex flex-col gap-3 bg-lime text-on-lime rounded-(--radius-card) p-4 cursor-pointer transition-all duration-150 hover:bg-lime-deep active:scale-[0.98] glow-lime"
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
              <QrCode className="size-5 text-lime" aria-hidden />
              Rejoindre
            </label>
            <div className="flex gap-1.5">
              <Input
                id="join-code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="CODE"
                maxLength={6}
                className="h-10 px-3 text-sm tracking-widest font-bold uppercase"
              />
              <Button type="submit" size="sm" aria-label="Rejoindre" className="h-10 shrink-0 px-3">
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </form>
        </section>

        {/* Stats perso */}
        <section className="mb-6">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-ink-faint mb-3">
            Tes statistiques
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Trophy, label: "Victoires", value: stats?.wins ?? "–" },
              { icon: Target, label: "Matchs", value: stats?.matches ?? "–" },
              { icon: Flame, label: "% victoire", value: stats ? `${stats.winRate}%` : "–" },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="bg-surface border border-border rounded-(--radius-card) p-3.5 flex flex-col gap-1.5"
              >
                <Icon className="size-4 text-lime" aria-hidden />
                <p className="tnum text-xl font-extrabold">{value}</p>
                <p className="text-[0.6875rem] text-ink-faint font-semibold">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Événements */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-ink-faint">
              {active.length > 0 ? "En cours" : "Récents"}
            </h2>
            <Link href="/events" className="text-sm font-semibold text-lime hover:underline">
              Tout voir
            </Link>
          </div>
          {recent === null ? (
            <PageLoader label="" />
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
              {(active.length > 0 ? active : recent).map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/events/${e.id}`}
                    className="flex items-center gap-3 bg-surface border border-border rounded-(--radius-card) p-4 transition-all duration-150 hover:border-border-strong active:scale-[0.99]"
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
                          {STATUS_LABELS[e.status]}
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="size-5 text-ink-faint shrink-0" aria-hidden />
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
