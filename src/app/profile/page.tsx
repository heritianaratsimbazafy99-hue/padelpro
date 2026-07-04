"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LogOut, Medal, Percent, Swords, Trophy } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { usePlayerStats } from "@/lib/use-stats";
import { AppPage, BottomNav, TopBar } from "@/components/shell";
import { Avatar, Button, Field, Input, PageLoader } from "@/components/ui";

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const stats = usePlayerStats(user?.id ?? null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      setName(profile?.display_name ?? "");
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
    { icon: Swords, label: "Matchs joués", value: stats?.matches ?? "–" },
    { icon: Trophy, label: "Victoires", value: stats?.wins ?? "–" },
    { icon: Percent, label: "Taux de victoire", value: stats ? `${stats.winRate}%` : "–" },
    { icon: Medal, label: "Événements", value: stats?.events ?? "–" },
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
            en étant connecté.
          </p>
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
