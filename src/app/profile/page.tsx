"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, History, LogOut, Medal, Percent, Swords, TrendingUp, Trophy } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { usePlayerStats } from "@/lib/use-stats";
import { usePlayerHistory } from "@/lib/use-history";
import { FORMAT_LABELS, formatDate } from "@/lib/utils";
import { AppPage, BottomNav, TopBar } from "@/components/shell";
import { Avatar, Badge, Button, EmptyState, Field, Input, PageLoader } from "@/components/ui";

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [elo, setElo] = useState<number | null>(null);
  const stats = usePlayerStats(user?.id ?? null);
  const history = usePlayerHistory(user?.id ?? null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);
      const [{ data: profile }, { data: board }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
        supabase.rpc("global_leaderboard"),
      ]);
      setName(profile?.display_name ?? "");
      const mine = (board ?? []).find((r: { p_id: string }) => r.p_id === user.id);
      setElo(mine ? mine.p_elo : null);
    })();
  }, [supabase]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setSaving(true);
    await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (!user) {
    return (
      <>
        <TopBar title="Profil" />
        <PageLoader />
        <BottomNav />
      </>
    );
  }

  const statCards = [
    { icon: TrendingUp, label: "Elo global", value: elo ?? "–" },
    { icon: Swords, label: "Matchs joués", value: stats?.matches ?? "–" },
    { icon: Trophy, label: "Victoires", value: stats?.wins ?? "–" },
    { icon: Percent, label: "Taux de victoire", value: stats ? `${stats.winRate}%` : "–" },
    { icon: Medal, label: "Événements", value: stats?.events ?? "–" },
    { icon: History, label: "Défaites", value: stats?.losses ?? "–" },
  ];

  return (
    <>
      <TopBar title="Profil" />
      <AppPage>
        <section className="flex items-center gap-4 mb-7 animate-fade-up">
          <Avatar name={name || "Joueur"} size="lg" />
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold truncate">{name || "Joueur"}</h1>
            <p className="text-sm text-ink-muted truncate">{user.email}</p>
          </div>
        </section>

        <section className="mb-7">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-ink-faint mb-3">
            Carrière
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {statCards.map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="bg-surface border border-border rounded-(--radius-card) p-4 flex flex-col gap-2"
              >
                <Icon className="size-5 text-lime" aria-hidden />
                <p className="tnum text-2xl font-extrabold">{value}</p>
                <p className="text-xs text-ink-faint font-semibold">{label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-faint mt-3 leading-relaxed">
            Tes stats se remplissent automatiquement quand tu sélectionnes ton nom dans un événement
            en étant connecté.{" "}
            <Link href="/leaderboard" className="text-lime hover:underline">
              Voir le classement global
            </Link>
          </p>
        </section>

        {/* Historique détaillé */}
        <section className="mb-7">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-ink-faint mb-3">
            Historique des matchs
          </h2>
          {history === null ? (
            <PageLoader label="" />
          ) : history.length === 0 ? (
            <EmptyState
              icon={<History className="size-6" />}
              title="Aucun match joué"
              body="Rejoins un événement via QR code en étant connecté : chaque match apparaîtra ici."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {history.map((h) => (
                <li
                  key={h.matchId}
                  className="bg-surface border border-border rounded-(--radius-card) px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="flex items-center gap-2 min-w-0">
                      <Badge
                        tone={h.result === "win" ? "success" : h.result === "loss" ? "danger" : "muted"}
                      >
                        {h.result === "win" ? "Victoire" : h.result === "loss" ? "Défaite" : "Nul"}
                      </Badge>
                      <span className="tnum text-base font-extrabold shrink-0">
                        {h.myScore}–{h.theirScore}
                      </span>
                    </span>
                    <span className="text-xs text-ink-faint shrink-0">{formatDate(h.playedAt)}</span>
                  </div>
                  <p className="text-sm text-ink-muted truncate">
                    {h.partner ? (
                      <>
                        Avec <span className="text-ink font-semibold">{h.partner}</span> contre{" "}
                      </>
                    ) : (
                      <>Contre </>
                    )}
                    <span className="text-ink font-semibold">{h.opponents.join(" & ")}</span>
                  </p>
                  <p className="text-xs text-ink-faint mt-1 truncate">
                    {FORMAT_LABELS[h.eventFormat]} · {h.eventName} · Round {h.round}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-7">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-ink-faint mb-3">
            Paramètres
          </h2>
          <form onSubmit={saveName} className="flex flex-col gap-3">
            <Field label="Nom affiché" htmlFor="display-name" hint="Visible sur les classements.">
              <div className="flex gap-2">
                <Input
                  id="display-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  minLength={2}
                  maxLength={40}
                  required
                />
                <Button type="submit" loading={saving} className="shrink-0 h-12">
                  {saved ? <Check className="size-4" /> : "Enregistrer"}
                </Button>
              </div>
            </Field>
          </form>
        </section>

        <Button variant="danger" full onClick={logout}>
          <LogOut className="size-4" />
          Se déconnecter
        </Button>
      </AppPage>
      <BottomNav />
    </>
  );
}
