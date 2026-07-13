"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Clock, PartyPopper, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEvent } from "@/lib/use-event";
import {
  currentCycleNumber,
  formatRoundLabel,
  resolveAmericanoSettings,
} from "@/lib/americano-settings";
import { FORMAT_LABELS, friendlyError } from "@/lib/utils";
import type { Match } from "@/lib/types";
import { Logo } from "@/components/logo";
import { Avatar, Badge, EmptyState, PageLoader, Segmented, Toast, type ToastData } from "@/components/ui";
import { MatchCard } from "@/components/match-card";
import { ScoreSheet } from "@/components/score-sheet";
import { Standings } from "@/components/standings";
import { BracketView } from "@/components/bracket-view";
import { Podium } from "@/components/podium";
import { Celebration, type CelebrationData } from "@/components/celebration";

type Tab = "matches" | "standings";

export default function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const supabase = useMemo(() => createClient(), []);
  const { event, players, matches, loading, notFound, refresh, reportScore } = useEvent({
    shareCode: code,
  });
  const [meId, setMeId] = useState<string | null>(null);
  const [identityLoaded, setIdentityLoaded] = useState(false);
  /* Photos de profil des joueurs ayant lié leur compte (profile_id → url). */
  const [avatars, setAvatars] = useState<Map<string, string>>(new Map());
  const [tab, setTab] = useState<Tab>("matches");
  const [scoringMatch, setScoringMatch] = useState<Match | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);

  const storageKey = event ? `padelpro:player:${event.id}` : null;

  /* Célébration quand un de MES matchs passe à « terminé » — que j'aie
     annoncé moi-même (optimistic) ou qu'un partenaire l'ait fait (Realtime) :
     un seul joueur de la paire suffit, tout le monde vit le moment. */
  const prevStatuses = useRef(new Map<string, string>());
  const celebrated = useRef(new Set<string>());
  useEffect(() => {
    for (const m of matches) {
      const prev = prevStatuses.current.get(m.id);
      /* Rollback (échec serveur) : réarme la célébration pour ce match. */
      if (prev === "done" && m.status === "pending") celebrated.current.delete(m.id);
      if (
        meId &&
        prev === "pending" &&
        m.status === "done" &&
        !celebrated.current.has(m.id) &&
        m.score1 !== null &&
        m.score2 !== null &&
        m.score1 !== m.score2 &&
        [m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2].includes(meId)
      ) {
        celebrated.current.add(m.id);
        const inTeam1 = [m.team1_p1, m.team1_p2].includes(meId);
        const won = inTeam1 ? m.score1 > m.score2 : m.score2 > m.score1;
        setCelebration({
          kind: won ? "win" : "loss",
          variant: Math.floor(Math.random() * 3) as CelebrationData["variant"],
        });
      }
    }
    prevStatuses.current = new Map(matches.map((m) => [m.id, m.status]));
  }, [matches, meId]);

  const playerName = useMemo(() => {
    const map = new Map(players.map((p) => [p.id, p.display_name]));
    return (pid: string | null) => (pid ? (map.get(pid) ?? null) : null);
  }, [players]);

  // Photos de profil des joueurs qui ont lié leur compte (fiches publiques).
  const claimedIds = useMemo(
    () =>
      [...new Set(players.map((p) => p.profile_id).filter((id): id is string => !!id))].sort(),
    [players],
  );
  useEffect(() => {
    if (claimedIds.length === 0) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("id, avatar_url").in("id", claimedIds);
      setAvatars(
        new Map(
          ((data ?? []) as Array<{ id: string; avatar_url: string | null }>)
            .filter((p) => p.avatar_url)
            .map((p) => [p.id, p.avatar_url!]),
        ),
      );
    })();
  }, [claimedIds, supabase]);

  // Identité : localStorage, sinon fiche déjà liée au compte connecté.
  useEffect(() => {
    if (!event || players.length === 0) return;
    (async () => {
      const stored = storageKey ? localStorage.getItem(storageKey) : null;
      if (stored && players.some((p) => p.id === stored)) {
        setMeId(stored);
        setIdentityLoaded(true);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const mine = players.find((p) => p.profile_id === user.id);
        if (mine) {
          setMeId(mine.id);
          if (storageKey) localStorage.setItem(storageKey, mine.id);
        }
      }
      setIdentityLoaded(true);
    })();
  }, [event, players, storageKey, supabase]);

  async function selectIdentity(playerId: string) {
    setMeId(playerId);
    if (storageKey) localStorage.setItem(storageKey, playerId);
    // Si l'utilisateur est connecté, on relie sa fiche à son compte (stats).
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && event) {
      await supabase.rpc("claim_player", { p_player_id: playerId, p_share_code: event.share_code });
      refresh();
    }
  }

  if (loading || (event && !identityLoaded)) {
    return (
      <main className="flex-1">
        <header className="flex justify-center pt-8 pb-4">
          <Logo />
        </header>
        <PageLoader />
      </main>
    );
  }

  if (notFound || !event) {
    return (
      <main className="flex-1 flex flex-col">
        <header className="flex justify-center pt-8 pb-4">
          <Logo />
        </header>
        <EmptyState
          title="Code invalide"
          body="Cet événement n'existe pas ou a été supprimé. Vérifie le lien ou le QR code."
        />
      </main>
    );
  }

  const avatarOf = (p: { profile_id: string | null }) =>
    p.profile_id ? avatars.get(p.profile_id) : undefined;

  const americanoSettings =
    event.format === "americano" ? resolveAmericanoSettings(event.settings) : null;
  const isFixedAmericano = americanoSettings?.teamMode === "fixed";
  const currentCycle = currentCycleNumber(matches);
  const activeRound = Math.min(
    Infinity,
    ...matches
      .filter((match) => match.status === "pending")
      .map((match) => match.round_number),
  );
  const activeRoundMatches = matches.filter((match) => match.round_number === activeRound);
  const me = players.find((p) => p.id === meId);
  const myCurrentMatch =
    meId == null
      ? undefined
      : activeRoundMatches.find((match) =>
          [match.team1_p1, match.team1_p2, match.team2_p1, match.team2_p2].includes(meId),
        );
  const myNextMatch =
    meId == null
      ? undefined
      : matches
          .filter(
            (match) => match.status === "pending" && match.round_number >= activeRound,
          )
          .sort(
            (first, second) =>
              first.round_number - second.round_number || first.court - second.court,
          )
          .find((match) =>
            [match.team1_p1, match.team1_p2, match.team2_p1, match.team2_p2].includes(meId),
          );

  /* ---- Écran de sélection du nom ---- */
  if (!me) {
    return (
      <main className="flex-1 flex flex-col">
        <header className="flex justify-center pt-8 pb-2">
          <Logo />
        </header>
        <div className="mx-auto w-full max-w-md px-4 py-6 animate-fade-up">
          <Badge tone="lime" className="mb-3">
            {FORMAT_LABELS[event.format]}
          </Badge>
          {americanoSettings && (
            <Badge tone="info" className="mb-3 ml-2">
              {isFixedAmericano ? "Équipes fixes" : "Équipes remixées"}
            </Badge>
          )}
          <h1 className="text-2xl font-extrabold mb-1">{event.name}</h1>
          <p className="text-ink-muted mb-6">Qui es-tu ? Sélectionne ton nom pour continuer.</p>
          <ul className="flex flex-col gap-2">
            {players.map((p, i) => (
              <li key={p.id} className="stagger-i" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                <button
                  onClick={() => selectIdentity(p.id)}
                  className="w-full flex items-center gap-3 bg-surface border border-border rounded-(--radius-card) px-4 py-3.5 cursor-pointer card-lift"
                >
                  <Avatar name={p.display_name} src={avatarOf(p)} />
                  <span className="flex-1 text-left font-bold">{p.display_name}</span>
                  <UserCheck className="size-5 text-ink-faint" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <p className="text-sm text-ink-muted text-center mt-6 leading-relaxed">
            Ton nom n&apos;est pas dans la liste ? Demande à l&apos;organisateur de t&apos;ajouter.
          </p>
          <p className="text-sm text-center mt-3">
            <Link href="/signup" className="text-court font-semibold hover:underline">
              Crée un compte
            </Link>{" "}
            <span className="text-ink-faint">pour suivre tes statistiques.</span>
          </p>
        </div>
      </main>
    );
  }

  /* ---- Vue participant ---- */
  return (
    <main className="flex-1 flex flex-col">
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-lg border-b border-border">
        <div className="mx-auto max-w-2xl px-4 h-14 flex items-center justify-between gap-3">
          <Logo href={`/join/${code}`} />
          <button
            onClick={() => {
              if (storageKey) localStorage.removeItem(storageKey);
              setMeId(null);
            }}
            className="flex items-center gap-2 cursor-pointer group"
            aria-label="Changer de joueur"
          >
            <span className="text-sm font-semibold text-ink-muted group-hover:text-ink transition-colors">
              {me.display_name}
            </span>
            <Avatar name={me.display_name} src={avatarOf(me)} size="sm" />
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-4 py-5 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Badge tone="lime">{FORMAT_LABELS[event.format]}</Badge>
          {event.status === "active" && <Badge tone="warning">En cours</Badge>}
          {event.status === "completed" && <Badge tone="success">Terminé</Badge>}
          {americanoSettings && (
            <Badge tone="info">
              {isFixedAmericano ? "Équipes fixes" : "Équipes remixées"}
            </Badge>
          )}
          {americanoSettings && event.status !== "draft" && (
            <Badge tone="muted">Cycle {currentCycle}</Badge>
          )}
        </div>
        <h1 className="text-2xl font-extrabold mb-5">{event.name}</h1>

        {event.status === "draft" && (
          <EmptyState
            icon={<Clock className="size-6" />}
            title="En attente du lancement"
            body="L'organisateur n'a pas encore lancé la partie. Cette page se mettra à jour automatiquement."
          />
        )}

        {event.status === "completed" && (
          <>
            <Podium event={event} players={players} matches={matches} />
            {event.format !== "tournament" && (
              <Standings event={event} players={players} matches={matches} meId={meId} />
            )}
          </>
        )}

        {event.status === "active" && (
          <>
            {activeRound === Infinity ? (
              <section className="mb-6 flex items-center gap-3 rounded-(--radius-card) border border-border bg-surface-2 px-4 py-3.5">
                <PartyPopper className="size-5 shrink-0 text-court" aria-hidden />
                <p className="text-sm text-ink-muted">
                  Cycle terminé — en attente de l&apos;organisateur
                </p>
              </section>
            ) : (
              <>
                {!myCurrentMatch && (
                  <section className="mb-3 flex items-center gap-3 rounded-(--radius-card) border border-border bg-surface-2 px-4 py-3.5">
                    <PartyPopper className="size-5 shrink-0 text-court" aria-hidden />
                    <p className="text-sm text-ink-muted">
                      {isFixedAmericano
                        ? "Ton équipe est au repos ce round"
                        : "Tu es au repos ce round"}
                    </p>
                  </section>
                )}
                {myNextMatch && (
                  <section className="mb-6 animate-fade-up">
                    <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-court mb-2.5">
                      <span
                        className="size-2 rounded-full bg-lime animate-pulse-soft"
                        aria-hidden
                      />
                      Ton prochain match
                    </h2>
                    <MatchCard
                      match={myNextMatch}
                      playerName={playerName}
                      meId={meId}
                      roundTag={
                        event.format === "tournament"
                          ? undefined
                          : event.format === "americano"
                            ? formatRoundLabel(myNextMatch, event.settings)
                            : `Round ${myNextMatch.round_number}`
                      }
                      onClick={() => setScoringMatch(myNextMatch)}
                    />
                    <p className="text-xs text-ink-faint mt-2 text-center">
                      Touche le match pour annoncer le score.
                    </p>
                  </section>
                )}
              </>
            )}

            <Segmented<Tab>
              className="mb-5"
              ariaLabel="Navigation participant"
              options={[
                { value: "matches", label: event.format === "tournament" ? "Tableau" : "Tous les matchs" },
                { value: "standings", label: "Classement" },
              ]}
              value={tab}
              onChange={setTab}
            />

            {tab === "matches" &&
              (event.format === "tournament" ? (
                <BracketView
                  matches={matches}
                  playerName={playerName}
                  meId={meId}
                  onSelect={(m) => setScoringMatch(m)}
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {[...matches]
                    .sort(
                      (a, b) =>
                        Number(a.status === "done") - Number(b.status === "done") ||
                        a.round_number - b.round_number ||
                        a.court - b.court,
                    )
                    .map((m, i) => (
                      <div key={m.id} className="stagger-i" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
                        <MatchCard
                          match={m}
                          playerName={playerName}
                          meId={meId}
                          roundTag={
                            event.format === "americano"
                              ? formatRoundLabel(m, event.settings)
                              : `Round ${m.round_number}`
                          }
                          onClick={m.status === "pending" ? () => setScoringMatch(m) : undefined}
                        />
                      </div>
                    ))}
                </div>
              ))}

            {tab === "standings" &&
              (event.format === "tournament" ? (
                <EmptyState
                  title="Classement par tableau"
                  body="Suis ta progression dans le tableau. Le podium s'affichera à la fin."
                />
              ) : (
                <Standings event={event} players={players} matches={matches} meId={meId} />
              ))}
          </>
        )}

        <footer className="mt-10 pb-8 text-center">
          <p className="text-xs text-ink-faint">
            Propulsé par PadelPro ·{" "}
            <Link href="/signup" className="text-court hover:underline">
              Crée tes propres tournois
            </Link>
          </p>
        </footer>
      </div>

      {scoringMatch && (
        <ScoreSheet
          event={event}
          match={scoringMatch}
          playerName={playerName}
          onClose={() => setScoringMatch(null)}
          onReport={async (m, s1, s2) => {
            const err = await reportScore(m, s1, s2, me.display_name);
            setToast(
              err
                ? { message: friendlyError(err), tone: "danger" }
                : { message: "Score enregistré", tone: "success" },
            );
          }}
        />
      )}
      {toast && <Toast toast={toast} onDone={() => setToast(null)} />}
      {celebration && <Celebration data={celebration} onDone={() => setCelebration(null)} />}
    </main>
  );
}
