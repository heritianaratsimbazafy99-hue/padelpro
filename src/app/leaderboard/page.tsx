"use client";

import { useEffect, useMemo, useState } from "react";
import { Crown, Medal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AppPage, BottomNav, TopBar } from "@/components/shell";
import { Avatar, EmptyState, Skeleton, SkeletonList } from "@/components/ui";

interface LeaderRow {
  p_id: string;
  p_name: string;
  p_elo: number;
  p_played: number;
  p_wins: number;
  p_losses: number;
  p_draws: number;
}

const medalTones = [
  "bg-lime/15 text-court border-lime/30",
  "bg-surface-3 text-ink-muted border-border-strong",
  "bg-amber-600/15 text-amber-700 border-amber-600/30",
];

/**
 * Classement Elo global : tous les comptes inscrits ayant joué au moins un
 * match. Rating d'équipe = moyenne des deux joueurs, K = 32, invités à 1000.
 */
export default function LeaderboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data }, { data: auth }] = await Promise.all([
        supabase.rpc("global_leaderboard"),
        supabase.auth.getUser(),
      ]);
      setMeId(auth.user?.id ?? null);
      setRows((data ?? []) as LeaderRow[]);
    })();
  }, [supabase]);

  return (
    <>
      <TopBar title="Classement global" />
      <AppPage>
        <p className="text-sm text-ink-muted mb-5 leading-relaxed">
          Elo calculé sur tous les matchs des joueurs inscrits. Gagne contre plus fort que toi
          pour grimper plus vite.
        </p>
        {rows === null ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full rounded-(--radius-card)" />
            <SkeletonList rows={6} height="h-14" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Medal className="size-6" />}
            title="Personne au classement"
            body="Le classement se remplit dès qu'un joueur inscrit termine un match. Rejoins un événement avec ton compte !"
          />
        ) : (
          <div className="bg-surface border border-border rounded-(--radius-card) overflow-hidden">
            <div className="grid grid-cols-[2.5rem_1fr_3rem_3rem_3.5rem] items-center gap-2 px-4 py-2.5 text-[0.6875rem] font-bold text-ink-faint uppercase tracking-wider border-b border-border">
              <span>#</span>
              <span>Joueur</span>
              <span className="text-center">J</span>
              <span className="text-center">V</span>
              <span className="text-right">Elo</span>
            </div>
            <ol>
              {rows.map((row, i) => {
                const me = row.p_id === meId;
                return (
                  <li
                    key={row.p_id}
                    className={`stagger-i grid grid-cols-[2.5rem_1fr_3rem_3rem_3.5rem] items-center gap-2 px-4 py-3 border-b border-border last:border-b-0 transition-colors hover:bg-surface-2/60 ${
                      me ? "bg-lime/5" : ""
                    }`}
                    style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
                  >
                    <span
                      className={`inline-flex items-center justify-center size-7 rounded-full border text-xs font-extrabold ${
                        i < 3 ? medalTones[i] : "border-transparent text-ink-faint"
                      }`}
                    >
                      {i === 0 ? <Crown className="size-4" aria-label="1er" /> : i + 1}
                    </span>
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={row.p_name} size="sm" />
                      <span className={`truncate text-sm ${me ? "font-bold text-court" : "font-semibold"}`}>
                        {row.p_name}
                        {me && <span className="text-ink-faint font-medium"> (toi)</span>}
                      </span>
                    </span>
                    <span className="tnum text-center text-sm text-ink-muted">{row.p_played}</span>
                    <span className="tnum text-center text-sm text-ink-muted">{row.p_wins}</span>
                    <span className="tnum text-right text-base font-extrabold">{row.p_elo}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </AppPage>
      <BottomNav />
    </>
  );
}
