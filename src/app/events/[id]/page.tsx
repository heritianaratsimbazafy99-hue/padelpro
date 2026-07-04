"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Coffee,
  Flag,
  Play,
  Plus,
  QrCode,
  Trash2,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEvent } from "@/lib/use-event";
import { completeEvent, deleteEvent, nextMexicanoRound, startEvent } from "@/lib/actions";
import { FORMAT_LABELS, friendlyError } from "@/lib/utils";
import type { Match } from "@/lib/types";
import { AppPage, BottomNav, TopBar } from "@/components/shell";
import { Avatar, Badge, Button, EmptyState, Input, PageLoader, Segmented } from "@/components/ui";
import { useEscapeClose } from "@/components/motion";
import { MatchCard } from "@/components/match-card";
import { ScoreSheet } from "@/components/score-sheet";
import { Standings } from "@/components/standings";
import { QRShare } from "@/components/qr-share";
import { BracketView } from "@/components/bracket-view";
import { Podium } from "@/components/podium";

type Tab = "matches" | "standings" | "players";

export default function EventAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { event, players, matches, loading, notFound, refresh } = useEvent({ id });
  const [tab, setTab] = useState<Tab>("matches");
  const [showQR, setShowQR] = useState(false);
  const [scoringMatch, setScoringMatch] = useState<Match | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"complete" | "delete" | null>(null);
  const [newPlayer, setNewPlayer] = useState("");
  const [viewRound, setViewRound] = useState<number | null>(null);

  const playerName = useMemo(() => {
    const map = new Map(players.map((p) => [p.id, p.display_name]));
    return (pid: string | null) => (pid ? (map.get(pid) ?? null) : null);
  }, [players]);

  useEscapeClose(confirmAction !== null, () => setConfirmAction(null));
  useEscapeClose(showQR, () => setShowQR(false));

  if (loading) {
    return (
      <>
        <TopBar back title="Événement" />
        <PageLoader />
        <BottomNav />
      </>
    );
  }
  if (notFound || !event) {
    return (
      <>
        <TopBar back title="Événement" />
        <EmptyState title="Événement introuvable" body="Il a peut-être été supprimé." />
        <BottomNav />
      </>
    );
  }

  const isDraft = event.status === "draft";
  const isActive = event.status === "active";
  const isDone = event.status === "completed";
  const isPointsBased = event.format !== "tournament";

  const maxRound = Math.max(0, ...matches.map((m) => m.round_number));
  const firstOpenRound =
    matches.length === 0
      ? 1
      : (matches
          .filter((m) => m.status === "pending")
          .reduce((min, m) => Math.min(min, m.round_number), Infinity) as number);
  const displayRound = viewRound ?? (firstOpenRound === Infinity ? maxRound : firstOpenRound);
  const roundMatches = matches.filter((m) => m.round_number === displayRound);
  const restingIds = players
    .filter(
      (p) =>
        !roundMatches.some((m) =>
          [m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2].includes(p.id),
        ),
    )
    .map((p) => p.display_name);
  const allDone = matches.length > 0 && matches.every((m) => m.status === "done");
  const currentRoundDone = roundMatches.length > 0 && roundMatches.every((m) => m.status === "done");
  const mexicanoCanAdvance =
    event.format === "mexicano" && isActive && allDone && maxRound < event.settings.rounds;

  async function run(action: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    const err = await action();
    if (err) setError(friendlyError(err));
    await refresh();
    setBusy(false);
    setConfirmAction(null);
  }

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    const name = newPlayer.trim();
    if (!name) return;
    const supabase = createClient();
    const { error } = await supabase.from("event_players").insert({
      event_id: event!.id,
      display_name: name,
      seed: players.length + 1,
    });
    if (error) {
      setError(
        error.message.includes("duplicate") ? "Ce nom est déjà dans la liste." : error.message,
      );
      return;
    }
    setNewPlayer("");
    setError(null);
    refresh();
  }

  return (
    <>
      <TopBar
        back
        title={event.name}
        actions={
          <button
            onClick={() => setShowQR(true)}
            aria-label="Partager par QR code"
            className="size-10 rounded-xl flex items-center justify-center text-lime bg-lime/10 border border-lime/25 hover:bg-lime/20 cursor-pointer transition-colors"
          >
            <QrCode className="size-5" />
          </button>
        }
      />
      <AppPage>
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <Badge tone="lime">{FORMAT_LABELS[event.format]}</Badge>
          {isDraft && <Badge tone="muted">Brouillon</Badge>}
          {isActive && <Badge tone="warning">En cours</Badge>}
          {isDone && <Badge tone="success">Terminé</Badge>}
          <Badge tone="muted">
            <Users className="size-3.5" aria-hidden /> {players.length}
          </Badge>
          {isPointsBased && <Badge tone="muted">{event.settings.points_per_match} pts/match</Badge>}
          <Badge tone="muted">
            {event.settings.courts} terrain{event.settings.courts > 1 ? "s" : ""}
          </Badge>
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger font-medium mb-4">
            {error}
          </p>
        )}

        {isDone && <Podium event={event} players={players} matches={matches} />}

        {/* ---- Brouillon : roster + lancement ---- */}
        {isDraft && (
          <section className="flex flex-col gap-4 animate-fade-up">
            <div className="bg-surface border border-border rounded-(--radius-card) p-4">
              <h2 className="font-bold mb-1">Prêt à lancer ?</h2>
              <p className="text-sm text-ink-muted leading-relaxed">
                {event.format === "americano" &&
                  `${event.settings.rounds} rounds seront générés avec une rotation équitable des partenaires et des repos.`}
                {event.format === "mexicano" &&
                  "Le round 1 sera généré ; les suivants se formeront selon le classement."}
                {event.format === "tournament" &&
                  "Les équipes seront composées et le tableau à élimination directe généré."}
              </p>
            </div>

            <form onSubmit={addPlayer} className="flex gap-2">
              <Input
                aria-label="Ajouter un joueur"
                value={newPlayer}
                onChange={(e) => setNewPlayer(e.target.value)}
                placeholder="Ajouter un joueur"
                maxLength={40}
              />
              <Button type="submit" variant="secondary" aria-label="Ajouter" className="shrink-0 w-12 px-0">
                <Plus className="size-5" />
              </Button>
            </form>

            <ul className="flex flex-col gap-2">
              {players.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 bg-surface border border-border rounded-(--radius-field) px-3 py-2.5"
                >
                  <Avatar name={p.display_name} size="sm" />
                  <span className="flex-1 text-sm font-semibold truncate">{p.display_name}</span>
                  {event.settings.pairing === "balanced" && (
                    <Badge tone="muted">Niv. {p.level}</Badge>
                  )}
                  <button
                    aria-label={`Retirer ${p.display_name}`}
                    onClick={async () => {
                      const supabase = createClient();
                      await supabase.from("event_players").delete().eq("id", p.id);
                      refresh();
                    }}
                    className="size-9 rounded-lg flex items-center justify-center text-ink-faint hover:text-danger hover:bg-danger/10 cursor-pointer transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>

            <Button
              size="lg"
              full
              loading={busy}
              disabled={
                players.length < 4 || (event.format === "tournament" && players.length % 2 !== 0)
              }
              onClick={() => run(() => startEvent(event, players))}
            >
              <Play className="size-5" />
              Lancer l&apos;événement
            </Button>
            {players.length < 4 && (
              <p className="text-sm text-ink-muted text-center">Ajoute au moins 4 joueurs.</p>
            )}
            {event.format === "tournament" && players.length >= 4 && players.length % 2 !== 0 && (
              <p className="text-sm text-warning text-center">
                Nombre pair de joueurs requis pour composer les équipes.
              </p>
            )}
          </section>
        )}

        {/* ---- Actif / terminé : onglets ---- */}
        {!isDraft && (
          <>
            <Segmented<Tab>
              className="mb-5"
              options={[
                { value: "matches", label: event.format === "tournament" ? "Tableau" : "Matchs" },
                { value: "standings", label: "Classement" },
                { value: "players", label: "Joueurs" },
              ]}
              value={tab}
              onChange={setTab}
            />

            {tab === "matches" && event.format === "tournament" && (
              <BracketView
                matches={matches}
                playerName={playerName}
                onSelect={isActive ? (m) => setScoringMatch(m) : undefined}
              />
            )}

            {tab === "matches" && event.format !== "tournament" && (
              <div className="flex flex-col gap-4">
                {/* Sélecteur de round */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4">
                  {Array.from({ length: maxRound }, (_, i) => i + 1).map((r) => {
                    const done = matches
                      .filter((m) => m.round_number === r)
                      .every((m) => m.status === "done");
                    return (
                      <button
                        key={r}
                        onClick={() => setViewRound(r)}
                        aria-pressed={displayRound === r}
                        className={`shrink-0 h-9 px-4 rounded-full text-sm font-bold cursor-pointer transition-colors border ${
                          displayRound === r
                            ? "bg-lime text-on-lime border-lime"
                            : done
                              ? "bg-surface-2 text-ink-faint border-border"
                              : "bg-surface text-ink-muted border-border-strong"
                        }`}
                      >
                        R{r}
                        {done && <CheckCircle2 className="inline size-3.5 ml-1 -mt-0.5" aria-label="terminé" />}
                      </button>
                    );
                  })}
                </div>

                {roundMatches.map((m, i) => (
                  <div key={m.id} className="stagger-i" style={{ "--i": i } as React.CSSProperties}>
                    <MatchCard
                      match={m}
                      playerName={playerName}
                      onClick={isActive ? () => setScoringMatch(m) : undefined}
                    />
                  </div>
                ))}

                {restingIds.length > 0 && (
                  <div className="flex items-center gap-2.5 bg-surface-2 border border-border rounded-(--radius-field) px-4 py-3">
                    <Coffee className="size-4 text-ink-faint shrink-0" aria-hidden />
                    <p className="text-sm text-ink-muted">
                      <span className="font-semibold text-ink">Au repos :</span>{" "}
                      {restingIds.join(", ")}
                    </p>
                  </div>
                )}

                {mexicanoCanAdvance && (
                  <Button size="lg" full loading={busy} onClick={() => run(() => nextMexicanoRound(event, players, matches))}>
                    Générer le round suivant ({maxRound + 1}/{event.settings.rounds})
                  </Button>
                )}
                {currentRoundDone && displayRound < maxRound && (
                  <Button variant="secondary" full onClick={() => setViewRound(displayRound + 1)}>
                    Voir le round {displayRound + 1}
                  </Button>
                )}
              </div>
            )}

            {tab === "standings" &&
              (event.format === "tournament" ? (
                <EmptyState
                  title="Classement par tableau"
                  body="Pour un tournoi, la progression se lit dans le tableau. Le podium s'affichera à la fin."
                />
              ) : (
                <Standings players={players} matches={matches} />
              ))}

            {tab === "players" && (
              <ul className="flex flex-col gap-2">
                {players.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 bg-surface border border-border rounded-(--radius-field) px-3 py-2.5"
                  >
                    <Avatar name={p.display_name} size="sm" />
                    <span className="flex-1 text-sm font-semibold truncate">{p.display_name}</span>
                    {p.profile_id && <Badge tone="success">Compte lié</Badge>}
                    {event.settings.pairing === "balanced" && <Badge tone="muted">Niv. {p.level}</Badge>}
                  </li>
                ))}
              </ul>
            )}

            {/* Actions organisateur */}
            {isActive && allDone && !mexicanoCanAdvance && (
              <Button
                size="lg"
                full
                className="mt-6"
                loading={busy}
                onClick={() => setConfirmAction("complete")}
              >
                <Flag className="size-5" />
                Terminer et afficher le podium
              </Button>
            )}
            {isActive && !allDone && (
              <Button
                variant="ghost"
                full
                className="mt-6"
                onClick={() => setConfirmAction("complete")}
              >
                Terminer l&apos;événement maintenant
              </Button>
            )}
          </>
        )}

        <Button variant="danger" full className="mt-4" onClick={() => setConfirmAction("delete")}>
          <Trash2 className="size-4" />
          Supprimer l&apos;événement
        </Button>
      </AppPage>

      {/* Confirmation destructive */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5" role="dialog" aria-modal="true">
          <button aria-label="Annuler" className="absolute inset-0 bg-black/70 cursor-pointer animate-backdrop" onClick={() => setConfirmAction(null)} />
          <div className="relative bg-surface border border-border rounded-3xl p-6 w-full max-w-sm animate-scale-in">
            <h2 className="text-lg font-extrabold mb-2">
              {confirmAction === "delete" ? "Supprimer l'événement ?" : "Terminer l'événement ?"}
            </h2>
            <p className="text-sm text-ink-muted mb-5 leading-relaxed">
              {confirmAction === "delete"
                ? "Tous les matchs et scores seront définitivement supprimés."
                : "Le classement sera figé et le podium affiché. Les scores ne pourront plus être modifiés."}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" full onClick={() => setConfirmAction(null)}>
                Annuler
              </Button>
              <Button
                variant={confirmAction === "delete" ? "danger" : "primary"}
                full
                loading={busy}
                onClick={() =>
                  confirmAction === "delete"
                    ? run(async () => {
                        const err = await deleteEvent(event.id);
                        if (!err) router.push("/dashboard");
                        return err;
                      })
                    : run(() => completeEvent(event.id))
                }
              >
                {confirmAction === "delete" ? "Supprimer" : "Terminer"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showQR && <QRShare shareCode={event.share_code} onClose={() => setShowQR(false)} />}
      {scoringMatch && (
        <ScoreSheet
          event={event}
          match={scoringMatch}
          playerName={playerName}
          reporter="organisateur"
          onClose={() => setScoringMatch(null)}
          onSaved={refresh}
        />
      )}
      <BottomNav />
    </>
  );
}
