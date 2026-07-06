"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Camera,
  Check,
  Flame,
  History,
  Loader2,
  LogOut,
  Medal,
  Percent,
  Sparkles,
  Swords,
  TrendingUp,
  Trophy,
  Users,
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
  Toast,
  type ToastData,
} from "@/components/ui";
import { CountUp } from "@/components/motion";

const SIDE_LABELS: Record<PreferredSide, string> = {
  left: "Côté gauche",
  right: "Côté droit",
  both: "Les deux côtés",
};

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  /* Champs du profil (édition) */
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [side, setSide] = useState<PreferredSide>("both");
  const [racket, setRacket] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [elo, setElo] = useState<number | null>(null);
  const [memberSince, setMemberSince] = useState<string | null>(null);
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
          .select("display_name, bio, preferred_side, racket, avatar_url, created_at")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.rpc("global_leaderboard"),
      ]);
      setName(profile?.display_name ?? "");
      setBio(profile?.bio ?? "");
      setSide((profile?.preferred_side as PreferredSide | null) ?? "both");
      setRacket(profile?.racket ?? "");
      setAvatarUrl(profile?.avatar_url ?? null);
      setMemberSince(profile?.created_at ?? null);
      const mine = (board ?? []).find((r: { p_id: string }) => r.p_id === user.id);
      setElo(mine ? mine.p_elo : null);
    })();
  }, [supabase]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: name.trim(),
        bio: bio.trim() || null,
        preferred_side: side,
        racket: racket.trim() || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      setToast({ message: "Impossible d'enregistrer le profil.", tone: "danger" });
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  /** Upload de la photo dans le bucket "avatars" (dossier = uid). */
  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > AVATAR_MAX_BYTES) {
      setToast({ message: "Photo trop lourde : 2 Mo maximum.", tone: "danger" });
      return;
    }
    setUploading(true);
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const previous = avatarUrl?.split("/avatars/")[1];
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { contentType: file.type, upsert: true });
    if (uploadError) {
      setUploading(false);
      setToast({ message: "Échec de l'envoi de la photo.", tone: "danger" });
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);
    setUploading(false);
    if (updateError) {
      setToast({ message: "Photo envoyée mais profil non mis à jour.", tone: "danger" });
      return;
    }
    setAvatarUrl(publicUrl);
    if (previous) void supabase.storage.from("avatars").remove([previous]);
    setToast({ message: "Photo de profil mise à jour !" });
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

  /* Trophées du club : débloqués par la carrière */
  const trophies: Array<{
    icon: typeof Trophy;
    label: string;
    hint: string;
    done: boolean;
  }> = [
    { icon: Sparkles, label: "Premiers pas", hint: "Jouer un match", done: (stats?.matches ?? 0) >= 1 },
    { icon: Trophy, label: "Première victoire", hint: "Gagner un match", done: (stats?.wins ?? 0) >= 1 },
    { icon: Flame, label: "Habitué du club", hint: "Jouer 10 matchs", done: (stats?.matches ?? 0) >= 10 },
    { icon: Medal, label: "Serial winner", hint: "Gagner 10 matchs", done: (stats?.wins ?? 0) >= 10 },
    { icon: Users, label: "Pilier du club", hint: "Participer à 5 événements", done: (stats?.events ?? 0) >= 5 },
    { icon: TrendingUp, label: "Grimpeur", hint: "Atteindre 1100 Elo", done: (elo ?? 0) >= 1100 },
  ];
  const unlockedCount = trophies.filter((t) => t.done).length;

  return (
    <>
      <TopBar title="Profil" />
      <AppPage>
        {/* Carte joueur — licence de club */}
        <section className="sec-court grain relative overflow-hidden rounded-[1.75rem] border border-border shadow-club-lg mb-7 animate-fade-up">
          <div className="relative p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                <Avatar name={name || "Joueur"} src={avatarUrl} size="xl" className="ring-2 ring-lime/60" />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  aria-label="Changer la photo de profil"
                  className="absolute -bottom-1 -right-1 size-9 rounded-full bg-lime text-on-lime border-2 border-court flex items-center justify-center cursor-pointer transition-transform hover:scale-110 active:scale-95 disabled:opacity-60"
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Camera className="size-4" aria-hidden />
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={onPickAvatar}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-lime mb-1">
                  Licence PadelPro
                </p>
                <h1 className="font-display text-2xl font-bold truncate">{name || "Joueur"}</h1>
                <p className="text-sm text-ink-muted truncate">{user.email}</p>
                {memberSince && (
                  <p className="text-xs text-ink-faint mt-1">
                    Membre depuis {new Date(memberSince).getFullYear()}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="tnum font-display text-3xl font-bold text-lime">
                  {elo === null ? "–" : <CountUp value={elo} />}
                </p>
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-ink-faint">Elo</p>
              </div>
            </div>

            {bio.trim() && (
              <p className="font-serif-display italic text-lg leading-snug mt-4 text-ink">
                « {bio.trim()} »
              </p>
            )}

            <div className="flex flex-wrap gap-2 mt-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-2 border border-border text-xs font-semibold">
                <ArrowLeftRight className="size-3.5 text-lime" aria-hidden />
                {SIDE_LABELS[side]}
              </span>
              {racket.trim() && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-2 border border-border text-xs font-semibold">
                  <Zap className="size-3.5 text-lime" aria-hidden />
                  {racket.trim()}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-2 border border-border text-xs font-semibold">
                <Trophy className="size-3.5 text-lime" aria-hidden />
                {unlockedCount}/{trophies.length} trophées
              </span>
            </div>
          </div>
        </section>

        {/* Trophées */}
        <section className="mb-7">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-clay mb-3">
            Trophées du club
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {trophies.map(({ icon: Icon, label, hint, done }, i) => (
              <div
                key={label}
                className={`stagger-i rounded-(--radius-card) border p-3 flex flex-col items-center text-center gap-1.5 transition-colors ${
                  done
                    ? "bg-lime/25 border-lime-deep/50"
                    : "bg-surface border-border opacity-60 grayscale"
                }`}
                style={{ "--i": i } as React.CSSProperties}
              >
                <span
                  className={`size-10 rounded-full flex items-center justify-center ${
                    done ? "bg-lime text-on-lime" : "bg-surface-2 text-ink-faint"
                  }`}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <p className="text-xs font-bold leading-tight">{label}</p>
                <p className="text-[0.65rem] text-ink-faint leading-tight">{hint}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-7">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-clay mb-3">
            Carrière
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {statCards.map(({ icon: Icon, label, value, suffix }, i) => (
              <div
                key={label}
                className="stagger-i bg-surface border border-border rounded-(--radius-card) p-4 flex flex-col gap-2 card-lift"
                style={{ "--i": i } as React.CSSProperties}
              >
                <Icon className="size-5 text-court" aria-hidden />
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
            <Link href="/leaderboard" className="text-court hover:underline">
              Voir le classement global
            </Link>
          </p>
        </section>

        {/* Historique détaillé */}
        <section className="mb-7">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-clay mb-3">
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

        {/* Édition du profil */}
        <section className="mb-7">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-clay mb-3">
            Ma fiche joueur
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
            <Field
              label="Description"
              htmlFor="bio"
              hint={`Ton style de jeu, ton point fort, ton cri de guerre… (${bio.length}/280)`}
            >
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={280}
                placeholder="Lobs vicieux et bandeja létale. Ne me laissez jamais monter au filet."
              />
            </Field>
            <Field label="Côté préféré" htmlFor="preferred-side">
              <Segmented<PreferredSide>
                options={[
                  { value: "left", label: "Gauche" },
                  { value: "both", label: "Les deux" },
                  { value: "right", label: "Droite" },
                ]}
                value={side}
                onChange={setSide}
              />
            </Field>
            <Field label="Raquette" htmlFor="racket" hint="Marque et modèle.">
              <Input
                id="racket"
                value={racket}
                onChange={(e) => setRacket(e.target.value)}
                maxLength={60}
                placeholder="Bullpadel Vertex 04"
              />
            </Field>
            <Button type="submit" loading={saving} full>
              {saved ? (
                <>
                  <Check className="size-4" />
                  Enregistré
                </>
              ) : (
                "Enregistrer ma fiche"
              )}
            </Button>
          </form>
        </section>

        <Button variant="danger" full onClick={logout}>
          <LogOut className="size-4" />
          Se déconnecter
        </Button>
      </AppPage>
      {toast && <Toast toast={toast} onDone={() => setToast(null)} />}
      <BottomNav />
    </>
  );
}
