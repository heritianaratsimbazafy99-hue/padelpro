"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock, MapPin, PartyPopper, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEvent } from "@/lib/use-event";
import { FORMAT_LABELS } from "@/lib/utils";
import type { Match } from "@/lib/types";
import { Logo } from "@/components/logo";
import { Avatar, Badge, Button, EmptyState, PageLoader, Segmented } from "@/components/ui";
import { MatchCard } from "@/components/match-card";
import { ScoreSheet } from "@/components/score-sheet";
import { Standings } from "@/components/standings";
import { BracketView } from "@/components/bracket-view";
import { Podium } from "@/components/podium";

type Tab = "matches" | "standings";

export default function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const supabase = useMemo(() => createClient(), []);
  const { event, players, matches, loading, notFound, refresh } = useEvent({ shareCode: code });
  const [meId, setMeId] = useState<string | null>(null);
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("matches");
  const [scoringMatch, setScoringMatch] = useState<Match | null>(null);

  const storageKey = event ? `padelpro:player:${event.id}` : null;

  const playerName = useMemo(() => {
    const map = new Map(players.map((p) => [p.id, p.display_name]));
    return (pid: string | null) => (pid ? (map.get(pid) ?? null) : null);
  }, [players]);

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

  const me = players.find((p) => p.id === meId);
  const myNextMatch = meId
    ? matches.find(
        (m) =>
          m.status === "pending" &&
          [m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2].includes(meId),
      )
    : undefined;

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
          <h1 className="text-2xl font-extrabold mb-1">{event.name}</h1>
          <p className="text-ink-muted mb-6">Qui es-tu ? Sélectionne ton nom pour continuer.</p>
          <ul className="flex flex-col gap-2">
            {players.map((p, i) => (
              <li key={p.id} className="stagger-i" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                <button
                  onClick={() => selectIdentity(p.id)}
                  className="w-full flex items-center gap-3 bg-surface border border-border rounded-(--radius-card) px-4 py-3.5 cursor-pointer card-lift"
                >
                  <Avatar name={p.display_name} />
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
            <Avatar name={me.display_name} size="sm" />
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-4 py-5 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Badge tone="lime">{FORMAT_LABELS[event.format]}</Badge>
          {event.status === "active" && <Badge tone="warning">En cours</Badge>}
          {event.status === "completed" && <Badge tone="success">Terminé</Badge>}
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
              <Standings players={players} matches={matches} meId={meId} />
            )}
          </>
        )}

        {event.status === "active" && (
          <>
            {/* Mon prochain match */}
            {myNextMatch ? (
              <section className="mb-6 animate-fade-up">
                <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-court mb-2.5">
                  <span className="size-2 rounded-full bg-lime animate-pulse-soft" aria-hidden />
                  Ton prochain match
                </h2>
                <MatchCard
                  match={myNextMatch}
                  playerName={playerName}
                  meId={meId}
                  roundTag={event.format === "tournament" ? undefined : `Round ${myNextMatch.round_number}`}
                  onClick={() => setScoringMatch(myNextMatch)}
                />
                <p className="text-xs text-ink-faint mt-2 text-center">
                  Touche le match pour annoncer le score.
                </p>
              </section>
            ) : (
              <section className="mb-6 flex items-center gap-3 bg-surface-2 border border-border rounded-(--radius-card) px-4 py-3.5">
                <PartyPopper className="size-5 text-court shrink-0" aria-hidden />
                <p className="text-sm text-ink-muted">
                  Pas de match en attente pour toi — repos ou tous tes matchs sont joués.
                </p>
              </section>
            )}

            <Segmented<Tab>
              className="mb-5"
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
                          roundTag={`Round ${m.round_number}`}
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
                <Standings players={players} matches={matches} meId={meId} />
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
          reporter={me.display_name}
          onClose={() => setScoringMatch(null)}
          onSaved={refresh}
        />
      )}
    </main>
  );
}
