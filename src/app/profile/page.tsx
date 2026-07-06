"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, History, LogOut, Medal, Percent, Swords, TrendingUp, Trophy } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { usePlayerStats } from "@/lib/use-stats";
import { usePlayerHistory } from "@/lib/use-history";
import { FORMAT_LABELS, formatDate } from "@/lib/utils";
import type { PreferredSide } from "@/lib/types";
import { TROPHIES, earnedTrophyIds, eloTitle } from "@/lib/trophies";
import { prepareAvatar } from "@/lib/avatar";
import { shareLicence } from "@/lib/licence-image";
import { AppPage, BottomNav, TopBar } from "@/components/shell";
import { PlayerCard, TrophyGrid, type EloPoint } from "@/components/player-card";
import {
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
  initialsOf,
  type ToastData,
} from "@/components/ui";
import { CountUp, Confetti } from "@/components/motion";

const AVATAR_MAX_BYTES = 8 * 1024 * 1024;

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
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
  const [sharing, setSharing] = useState(false);
  const [elo, setElo] = useState<number | null>(null);
  const [eloHistory, setEloHistory] = useState<EloPoint[] | null>(null);
  const [memberSince, setMemberSince] = useState<string | null>(null);

  /* Trophées persistés : id → date de déblocage. null = pas encore chargé. */
  const [unlockedAt, setUnlockedAt] = useState<Map<string, string> | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const syncingTrophies = useRef(false);

  const stats = usePlayerStats(user?.id ?? null);
  const history = usePlayerHistory(user?.id ?? null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);
      const [{ data: profile }, { data: board }, { data: hist }, { data: trophies }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("display_name, bio, preferred_side, racket, avatar_url, created_at")
            .eq("id", user.id)
            .maybeSingle(),
          supabase.rpc("global_leaderboard"),
          supabase.rpc("player_elo_history", { p_profile_id: user.id }),
          supabase.from("profile_trophies").select("trophy_id, unlocked_at").eq("profile_id", user.id),
        ]);
      setName(profile?.display_name ?? "");
      setBio(profile?.bio ?? "");
      setSide((profile?.preferred_side as PreferredSide | null) ?? "both");
      setRacket(profile?.racket ?? "");
      setAvatarUrl(profile?.avatar_url ?? null);
      setMemberSince(profile?.created_at ?? null);
      const mine = (board ?? []).find((r: { p_id: string }) => r.p_id === user.id);
      setElo(mine ? mine.p_elo : null);
      setEloHistory(
        ((hist ?? []) as Array<{ h_elo: number }>).map((h) => ({ elo: h.h_elo })),
      );
      setUnlockedAt(
        new Map(
          ((trophies ?? []) as Array<{ trophy_id: string; unlocked_at: string }>).map((t) => [
            t.trophy_id,
            t.unlocked_at,
          ]),
        ),
      );
    })();
  }, [supabase]);

  /* Persiste les trophées fraîchement mérités et déclenche la célébration. */
  useEffect(() => {
    if (!user || !stats || unlockedAt === null || syncingTrophies.current) return;
    const fresh = earnedTrophyIds(stats, elo).filter((id) => !unlockedAt.has(id));
    if (fresh.length === 0) return;
    syncingTrophies.current = true;
    (async () => {
      const { error } = await supabase
        .from("profile_trophies")
        .insert(fresh.map((id) => ({ profile_id: user.id, trophy_id: id })));
      if (!error) {
        const nowIso = new Date().toISOString();
        setUnlockedAt((prev) => {
          const next = new Map(prev);
          fresh.forEach((id) => next.set(id, nowIso));
          return next;
        });
        const labels = TROPHIES.filter((t) => fresh.includes(t.id)).map((t) => t.label);
        setCelebrating(true);
        setToast({
          message:
            labels.length === 1
              ? `Trophée débloqué : ${labels[0]} !`
              : `${labels.length} trophées débloqués !`,
        });
      }
      syncingTrophies.current = false;
    })();
  }, [user, stats, elo, unlockedAt, supabase]);

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

  /** Recadre/compresse la photo puis l'upload dans le bucket "avatars". */
  async function onPickAvatar(file: File) {
    if (!user) return;
    if (file.size > AVATAR_MAX_BYTES) {
      setToast({ message: "Photo trop lourde : 8 Mo maximum.", tone: "danger" });
      return;
    }
    setUploading(true);
    let blob: Blob = file;
    let contentType = file.type;
    let ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    try {
      blob = await prepareAvatar(file);
      contentType = "image/webp";
      ext = "webp";
    } catch {
      /* navigateur sans createImageBitmap/webp : on envoie l'original */
    }
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const previous = avatarUrl?.split("/avatars/")[1];
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { contentType, upsert: true });
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

  const earned = useMemo(() => new Set(earnedTrophyIds(stats, elo)), [stats, elo]);

  /** Exporte la licence en PNG et la partage (ou la télécharge). */
  async function onShare() {
    setSharing(true);
    try {
      const result = await shareLicence({
        name: name || "Joueur",
        title: eloTitle(elo),
        elo,
        avatarUrl,
        initials: initialsOf(name || "Joueur"),
        bio: bio.trim() || null,
        side,
        racket: racket.trim() || null,
        memberSince: memberSince ? new Date(memberSince).getFullYear() : null,
        trophies: { unlocked: earned.size, total: TROPHIES.length },
      });
      if (result === "downloaded") setToast({ message: "Licence téléchargée !" });
    } catch {
      setToast({ message: "Impossible de générer l'image.", tone: "danger" });
    }
    setSharing(false);
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
        <div className="mb-7">
          <PlayerCard
            name={name}
            subtitle={user.email}
            title={eloTitle(elo)}
            avatarUrl={avatarUrl}
            elo={elo}
            memberSince={memberSince}
            bio={bio}
            side={side}
            racket={racket}
            trophies={{ unlocked: earned.size, total: TROPHIES.length }}
            eloHistory={eloHistory}
            onPickAvatar={onPickAvatar}
            uploading={uploading}
            onShare={onShare}
            sharing={sharing}
          />
        </div>

        {/* Trophées */}
        <section className="mb-7">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-clay mb-3">
            Trophées du club
          </h2>
          <TrophyGrid earned={earned} unlockedAt={unlockedAt ?? undefined} />
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
      {celebrating && <Confetti />}
      {toast && <Toast toast={toast} onDone={() => setToast(null)} />}
      <BottomNav />
    </>
  );
}
