"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Check,
  History,
  LogOut,
  Medal,
  Percent,
  Quote,
  Swords,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { usePlayerStats } from "@/lib/use-stats";
import { usePlayerHistory } from "@/lib/use-history";
import { FORMAT_LABELS, formatDate } from "@/lib/utils";
import type { PreferredSide } from "@/lib/types";
import { AppPage, BottomNav, TopBar } from "@/components/shell";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  PageLoader,
  Segmented,
  SkeletonList,
  Textarea,
} from "@/components/ui";
import { CountUp } from "@/components/motion";

const SIDE_LABELS: Record<PreferredSide, string> = {
  left: "Gauche",
  right: "Droite",
  both: "Polyvalent",
};

/** Mini terrain de padel : visualise le côté préféré du joueur. */
function MiniCourt({ side }: { side: PreferredSide }) {
  const active = "bg-lime/25";
  const idle = "bg-surface-3/60";
  return (
    <span
      aria-hidden
      className="inline-flex h-7 w-11 rounded-md border border-lime/40 overflow-hidden shrink-0"
    >
      <span className={`flex-1 ${side !== "right" ? active : idle}`} />
      <span className="w-px bg-lime/40" />
      <span className={`flex-1 ${side !== "left" ? active : idle}`} />
    </span>
  );
}

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [side, setSide] = useState<PreferredSide | "">("");
  const [racket, setRacket] = useState("");
  const [bio, setBio] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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
        supabase
          .from("profiles")
          .select("display_name, preferred_side, racket, bio")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.rpc("global_leaderboard"),
      ]);
      setName(profile?.display_name ?? "");
      setSide((profile?.preferred_side as PreferredSide | null) ?? "");
      setRacket(profile?.racket ?? "");
      setBio(profile?.bio ?? "");
      const mine = (board ?? []).find((r: { p_id: string }) => r.p_id === user.id);
      setElo(mine ? mine.p_elo : null);
    })();
  }, [supabase]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setSaving(true);
    setSaveError(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: name.trim(),
        preferred_side: side || null,
        racket: racket.trim() || null,
        bio: bio.trim() || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
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

  const statCards: Array<{
    icon: typeof TrendingUp;
    label: string;
    value: number | undefined | null;
    suffix?: string;
  }> = [
    { icon: TrendingUp, label: "Elo global", value: elo },
    { icon: Swords, label: "Matchs joués", value: stats?.matches },
    { icon: Trophy, label: "Victoires", value: stats?.wins },
    { icon: Percent, label: "Taux de victoire", value: stats?.winRate, suffix: "%" },
    { icon: Medal, label: "Événements", value: stats?.events },
    { icon: History, label: "Défaites", value: stats?.losses },
  ];

  return (
    <>
      <TopBar title="Profil" />
      <AppPage>
        {/* Carte joueur */}
        <section className="relative gradient-border rounded-(--radius-card) p-5 mb-7 overflow-hidden animate-scale-in">
          <div
            aria-hidden
            className="absolute -top-16 -right-16 size-48 rounded-full bg-lime/10 blur-3xl pointer-events-none"
          />
          <div className="relative flex items-center gap-4">
            <Avatar name={name || "Joueur"} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl font-bold truncate">{name || "Joueur"}</h1>
              <p className="text-sm text-ink-muted truncate">{user.email}</p>
            </div>
            {elo !== null && (
              <div className="text-right shrink-0">
                <p className="tnum font-display text-2xl font-bold text-lime leading-none">
                  <CountUp value={elo} />
                </p>
                <p className="text-[0.625rem] font-bold uppercase tracking-wider text-ink-faint mt-1">
                  Elo
                </p>
              </div>
            )}
          </div>

          {(side || racket) && (
            <div className="relative flex items-center gap-2 mt-4 flex-wrap">
              {side && (
                <Badge tone="lime">
                  <MiniCourt side={side} />
                  <ArrowLeftRight className="size-3.5" aria-hidden />
                  Côté {SIDE_LABELS[side].toLowerCase()}
                </Badge>
              )}
              {racket && (
                <Badge tone="info">
                  <Zap className="size-3.5" aria-hidden />
                  {racket}
                </Badge>
              )}
            </div>
          )}

          {bio && (
            <p className="relative mt-4 text-sm text-ink-muted leading-relaxed italic flex gap-2">
              <Quote className="size-4 text-lime/60 shrink-0 mt-0.5" aria-hidden />
              {bio}
            </p>
          )}
        </section>

        <section className="mb-7">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-ink-faint mb-3">
            Carrière
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {statCards.map(({ icon: Icon, label, value, suffix }, i) => (
              <div
                key={label}
                className="stagger-i bg-surface border border-border rounded-(--radius-card) p-4 flex flex-col gap-2 card-lift"
                style={{ "--i": i } as React.CSSProperties}
              >
                <Icon className="size-5 text-lime" aria-hidden />
                <p className="tnum text-2xl font-extrabold">
                  {value === undefined || value === null ? "–" : <CountUp value={value} suffix={suffix ?? ""} />}
                </p>
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
            <SkeletonList rows={3} height="h-24" />
          ) : history.length === 0 ? (
            <EmptyState
              icon={<History className="size-6" />}
              title="Aucun match joué"
              body="Rejoins un événement via QR code en étant connecté : chaque match apparaîtra ici."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {history.map((h, i) => (
                <li
                  key={h.matchId}
                  className="stagger-i bg-surface border border-border rounded-(--radius-card) px-4 py-3"
                  style={{ "--i": Math.min(i, 10) } as React.CSSProperties}
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

        {/* Paramètres + préférences de jeu */}
        <section className="mb-7">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-ink-faint mb-3">
            Mon jeu
          </h2>
          <form onSubmit={saveProfile} className="flex flex-col gap-4">
            <Field label="Nom affiché" htmlFor="display-name" hint="Visible sur les classements.">
              <Input
                id="display-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={40}
                required
              />
            </Field>

            <Field label="Côté préféré sur le terrain">
              <Segmented<PreferredSide>
                options={[
                  { value: "left", label: "Gauche" },
                  { value: "right", label: "Droite" },
                  { value: "both", label: "Polyvalent" },
                ]}
                value={side as PreferredSide}
                onChange={setSide}
              />
            </Field>

            <Field
              label="Raquette"
              htmlFor="racket"
              hint="Ton arme du moment — ex. « Bullpadel Vertex 04 »"
            >
              <Input
                id="racket"
                value={racket}
                onChange={(e) => setRacket(e.target.value)}
                maxLength={60}
                placeholder="Bullpadel Vertex 04"
              />
            </Field>

            <Field
              label="Description"
              htmlFor="bio"
              hint={`${bio.length}/280 — ton style de jeu, en une phrase de légende.`}
              error={saveError}
            >
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={280}
                placeholder="Lob assassin, bandeja létale, jamais un smash dans la vitre."
              />
            </Field>

            <Button type="submit" size="lg" full loading={saving}>
              {saved ? (
                <>
                  <Check className="size-5" /> Enregistré
                </>
              ) : (
                "Enregistrer mon profil"
              )}
            </Button>
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
