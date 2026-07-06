"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { History, Medal, Percent, Swords, TrendingUp, Trophy, UserX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { usePlayerStats } from "@/lib/use-stats";
import type { PreferredSide } from "@/lib/types";
import { TROPHIES, earnedTrophyIds, eloTitle } from "@/lib/trophies";
import { AppPage, BottomNav, TopBar } from "@/components/shell";
import { PlayerCard, TrophyGrid, type EloPoint } from "@/components/player-card";
import { EmptyState, PageLoader } from "@/components/ui";
import { CountUp } from "@/components/motion";

interface PublicProfile {
  display_name: string;
  bio: string | null;
  preferred_side: PreferredSide | null;
  racket: string | null;
  avatar_url: string | null;
  created_at: string;
}

/** Fiche joueur publique : licence, trophées et carrière d'un membre. */
export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<PublicProfile | null | "missing">(null);
  const [elo, setElo] = useState<number | null>(null);
  const [eloHistory, setEloHistory] = useState<EloPoint[] | null>(null);
  const [unlockedAt, setUnlockedAt] = useState<Map<string, string> | undefined>(undefined);
  const stats = usePlayerStats(id ?? null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: p }, { data: board }, { data: hist }, { data: trophies }] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, bio, preferred_side, racket, avatar_url, created_at")
          .eq("id", id)
          .maybeSingle(),
        supabase.rpc("global_leaderboard"),
        supabase.rpc("player_elo_history", { p_profile_id: id }),
        supabase.from("profile_trophies").select("trophy_id, unlocked_at").eq("profile_id", id),
      ]);
      setProfile((p as PublicProfile | null) ?? "missing");
      const mine = (board ?? []).find((r: { p_id: string }) => r.p_id === id);
      setElo(mine ? mine.p_elo : null);
      setEloHistory(((hist ?? []) as Array<{ h_elo: number }>).map((h) => ({ elo: h.h_elo })));
      setUnlockedAt(
        new Map(
          ((trophies ?? []) as Array<{ trophy_id: string; unlocked_at: string }>).map((t) => [
            t.trophy_id,
            t.unlocked_at,
          ]),
        ),
      );
    })();
  }, [supabase, id]);

  const earned = useMemo(() => new Set(earnedTrophyIds(stats, elo)), [stats, elo]);

  if (profile === null) {
    return (
      <>
        <TopBar title="Fiche joueur" back />
        <PageLoader />
        <BottomNav />
      </>
    );
  }

  if (profile === "missing") {
    return (
      <>
        <TopBar title="Fiche joueur" back />
        <AppPage>
          <EmptyState
            icon={<UserX className="size-6" />}
            title="Joueur introuvable"
            body="Ce profil n'existe pas ou a été supprimé."
          />
        </AppPage>
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
      <TopBar title="Fiche joueur" back />
      <AppPage>
        <div className="mb-7">
          <PlayerCard
            name={profile.display_name}
            title={eloTitle(elo)}
            avatarUrl={profile.avatar_url}
            elo={elo}
            memberSince={profile.created_at}
            bio={profile.bio}
            side={profile.preferred_side}
            racket={profile.racket}
            trophies={{ unlocked: earned.size, total: TROPHIES.length }}
            eloHistory={eloHistory}
          />
        </div>

        <section className="mb-7">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-clay mb-3">
            Trophées du club
          </h2>
          <TrophyGrid earned={earned} unlockedAt={unlockedAt} />
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
        </section>
      </AppPage>
      <BottomNav />
    </>
  );
}
