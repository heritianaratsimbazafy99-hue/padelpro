"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Coffee,
  Flag,
  Play,
  Plus,
  QrCode,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEvent } from "@/lib/use-event";
import {
  addAmericanoCycle,
  completeEvent,
  deleteEvent,
  nextMexicanoRound,
  replaceEventRoster,
  startEvent,
  type RosterPlayerInput,
} from "@/lib/actions";
import {
  currentCycleNumber,
  formatRoundLabel,
  resolveAmericanoSettings,
} from "@/lib/americano-settings";
import { planFixedCycle, planRemixedCycle } from "@/lib/engine/cycle-planning";
import {
  assignmentsFromTeams,
  composeFixedTeams,
  fixedTeamsFromAssignments,
  swapAssignments,
  type TeamAssignments,
} from "@/lib/engine/fixed-teams";
import { getPlayerReporterName, resolveEventPlayerId } from "@/lib/event-identity";
import { FORMAT_LABELS, friendlyError } from "@/lib/utils";
import type { Match } from "@/lib/types";
import { AppPage, BottomNav, TopBar } from "@/components/shell";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Input,
  PageLoader,
  Segmented,
  Toast,
  type ToastData,
} from "@/components/ui";
import { useEscapeClose, useFocusTrap } from "@/components/motion";
import { MatchCard } from "@/components/match-card";
import { ScoreSheet } from "@/components/score-sheet";
import { Standings } from "@/components/standings";
import { QRShare } from "@/components/qr-share";
import { BracketView } from "@/components/bracket-view";
import { Podium } from "@/components/podium";
import { FixedTeamComposer } from "@/components/fixed-team-composer";

type Tab = "matches" | "standings" | "players";

export default function EventAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { event, players, matches, loading, notFound, refresh, reportScore } = useEvent({ id });
  const [tab, setTab] = useState<Tab>("matches");
  const [showQR, setShowQR] = useState(false);
  const [scoringMatch, setScoringMatch] = useState<Match | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [confirmAction, setConfirmAction] = useState<"complete" | "delete" | null>(null);
  const [newPlayer, setNewPlayer] = useState("");
  const [organizerPlayerId, setOrganizerPlayerId] = useState<string | null>(null);
  const [viewRound, setViewRound] = useState<number | null>(null);
  const [roundAnim, setRoundAnim] = useState<"l" | "r" | null>(null);
  const [draftAssignments, setDraftAssignments] = useState<TeamAssignments>({});
  const [composerGeneration, setComposerGeneration] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const playerName = useMemo(() => {
    const map = new Map(players.map((p) => [p.id, p.display_name]));
    return (pid: string | null) => (pid ? (map.get(pid) ?? null) : null);
  }, [players]);
  const organizerStorageKey = event ? `padelpro:player:${event.id}` : null;
  const organizerPlayer = organizerPlayerId
    ? (players.find((player) => player.id === organizerPlayerId) ?? null)
    : null;
  const reporterName = getPlayerReporterName(players, organizerPlayerId, "organisateur");

  useEscapeClose(confirmAction !== null, () => setConfirmAction(null));
  useEscapeClose(showQR, () => setShowQR(false));
  const confirmTrapRef = useFocusTrap<HTMLDivElement>(confirmAction !== null);

  // Identité joueur de l'organisateur : même stockage/claim que la page QR.
  useEffect(() => {
    if (!event) return;
    let cancelled = false;
    (async () => {
      const stored = organizerStorageKey ? localStorage.getItem(organizerStorageKey) : null;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setOrganizerPlayerId(resolveEventPlayerId(players, user?.id ?? null, stored));
    })();
    return () => {
      cancelled = true;
    };
  }, [event, organizerStorageKey, players, supabase]);

  useEffect(() => {
    if (!event || event.status !== "draft") return;
    const nextAssignments = Object.fromEntries(
      players
        .filter((player) => player.team_number != null)
        .map((player) => [player.id, player.team_number!]),
    );
    // Le roster chargé est la source de vérité après chaque RPC atomique.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftAssignments(nextAssignments);
    setComposerGeneration((generation) => generation + 1);
  }, [event, players]);

  /* Navigation entre rounds : clic sur les pastilles ou swipe horizontal
     (mobile) — le contenu glisse dans le sens du geste. */
  function goToRound(r: number, max: number, current: number) {
    if (r < 1 || r > max || r === current) return;
    setRoundAnim(r > current ? "l" : "r");
    setViewRound(r);
  }

  /* Optimistic UI : le score s'applique localement tout de suite, le toast
     confirme (ou signale le rollback en cas d'erreur serveur). */
  async function handleReport(match: Match, s1: number, s2: number) {
    const err = await reportScore(match, s1, s2, reporterName);
    setToast(
      err
        ? { message: friendlyError(err), tone: "danger" }
        : { message: "Score enregistré", tone: "success" },
    );
  }

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
  const loadedEvent = event;

  const isDraft = event.status === "draft";
  const isActive = event.status === "active";
  const isDone = event.status === "completed";
  const isPointsBased = event.format !== "tournament";
  const americanoSettings =
    event.format === "americano" ? resolveAmericanoSettings(event.settings) : null;
  const isFixedAmericano = americanoSettings?.teamMode === "fixed";
  const currentCycle = currentCycleNumber(matches);
  const currentCycleMatches = matches.filter(
    (match) => (match.cycle_number ?? 1) === currentCycle,
  );

  const maxRound = Math.max(0, ...matches.map((m) => m.round_number));
  const activeRound = Math.min(
    Infinity,
    ...matches
      .filter((match) => match.status === "pending")
      .map((match) => match.round_number),
  );
  const firstOpenRound = matches.length === 0 ? 1 : activeRound;
  const displayRound = viewRound ?? (firstOpenRound === Infinity ? maxRound : firstOpenRound);
  const roundMatches = matches.filter((m) => m.round_number === displayRound);
  const activePlayerIds = new Set(
    roundMatches.flatMap((match) => [
      match.team1_p1,
      match.team1_p2,
      match.team2_p1,
      match.team2_p2,
    ]),
  );
  const fixedGroups = new Map<number, typeof players>();
  if (isFixedAmericano) {
    for (const player of players) {
      if (player.team_number == null) continue;
      fixedGroups.set(player.team_number, [
        ...(fixedGroups.get(player.team_number) ?? []),
        player,
      ]);
    }
  }
  const restingLabels = isFixedAmericano
    ? [...fixedGroups.entries()]
        .filter(
          ([, members]) =>
            members.length === 2 && members.every((member) => !activePlayerIds.has(member.id)),
        )
        .sort(([first], [second]) => first - second)
        .map(
          ([teamNumber, members]) =>
            `Équipe ${teamNumber} · ${members.map((member) => member.display_name).join(" & ")}`,
        )
    : players
        .filter((player) => !activePlayerIds.has(player.id))
        .map((player) => player.display_name);
  const allDone =
    matches.length > 0 &&
    matches.every(
      (match) => match.status === "done" && match.score1 != null && match.score2 != null,
    );
  const currentCycleDone =
    currentCycleMatches.length > 0 &&
    currentCycleMatches.every(
      (match) => match.status === "done" && match.score1 != null && match.score2 != null,
    );
  const currentRoundDone = roundMatches.length > 0 && roundMatches.every((m) => m.status === "done");
  const mexicanoCanAdvance =
    event.format === "mexicano" && isActive && allDone && maxRound < event.settings.rounds;
  const activeRoundMatches = matches.filter((match) => match.round_number === activeRound);
  const organizerCurrentMatch =
    organizerPlayerId == null
      ? undefined
      : activeRoundMatches.find((match) =>
          [match.team1_p1, match.team1_p2, match.team2_p1, match.team2_p2].includes(
            organizerPlayerId,
          ),
        );
  const organizerNextMatch =
    organizerPlayerId == null
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
            [match.team1_p1, match.team1_p2, match.team2_p1, match.team2_p2].includes(
              organizerPlayerId,
            ),
          );
  const draftRoster: RosterPlayerInput[] = players.map((player, index) => ({
    id: player.id,
    display_name: player.display_name,
    level: player.level,
    seed: index + 1,
    preferred_side: player.preferred_side,
    team_number: player.team_number,
  }));
  let fixedDraftError: string | null = null;
  if (isDraft && isFixedAmericano) {
    try {
      fixedTeamsFromAssignments(
        draftRoster.map((player) => ({
          id: player.id,
          level: player.level,
          side: player.preferred_side ?? undefined,
          teamNumber: draftAssignments[player.id] ?? null,
        })),
      );
    } catch (draftError) {
      fixedDraftError =
        draftError instanceof Error
          ? draftError.message
          : "La composition des équipes est invalide.";
    }
  }

  async function run(action: () => Promise<string | null>): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError(null);
    let success = false;
    try {
      const actionError = await action();
      if (actionError) setError(friendlyError(actionError));
      else success = true;
    } catch (actionError) {
      setError(
        friendlyError(
          actionError instanceof Error ? actionError.message : "Une erreur est survenue.",
        ),
      );
    } finally {
      try {
        await refresh();
      } finally {
        setBusy(false);
      }
    }
    if (success) setConfirmAction(null);
    return success;
  }

  function automaticRoundsForDraftRoster(
    nextPlayers: readonly RosterPlayerInput[],
    nextAssignments: TeamAssignments,
  ): number | null {
    if (loadedEvent.format !== "americano") return null;
    const settings = resolveAmericanoSettings(loadedEvent.settings);
    if (settings.legacy || nextPlayers.length < 4) return null;

    if (settings.teamMode === "remixed") {
      return planRemixedCycle(nextPlayers.length, loadedEvent.settings.courts).roundsPerCycle;
    }

    try {
      fixedTeamsFromAssignments(
        nextPlayers.map((player) => ({
          id: player.id,
          level: player.level,
          side: player.preferred_side ?? undefined,
          teamNumber: nextAssignments[player.id] ?? null,
        })),
      );
      return planFixedCycle(
        nextPlayers.length / 2,
        loadedEvent.settings.courts,
      ).roundsPerCycle;
    } catch {
      return null;
    }
  }

  async function persistDraftRoster(
    nextPlayers: readonly RosterPlayerInput[],
    nextAssignments: TeamAssignments,
  ): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError(null);
    const fixed =
      loadedEvent.format === "americano" &&
      resolveAmericanoSettings(loadedEvent.settings).teamMode === "fixed";
    const payload = nextPlayers.map((player, index) => ({
      ...player,
      seed: index + 1,
      team_number: fixed ? nextAssignments[player.id] ?? null : null,
    }));
    let success = false;
    try {
      const rosterError = await replaceEventRoster(
        loadedEvent.id,
        payload,
        automaticRoundsForDraftRoster(payload, nextAssignments),
      );
      if (rosterError) {
        setToast({ message: friendlyError(rosterError), tone: "danger" });
      } else {
        setDraftAssignments(nextAssignments);
        setComposerGeneration((generation) => generation + 1);
        success = true;
      }
    } catch (rosterError) {
      setToast({
        message: friendlyError(
          rosterError instanceof Error ? rosterError.message : "Une erreur est survenue.",
        ),
        tone: "danger",
      });
    } finally {
      try {
        await refresh();
      } finally {
        setBusy(false);
      }
    }
    return success;
  }

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    const name = newPlayer.trim();
    if (!name || busy) return;
    const nextPlayers: RosterPlayerInput[] = [
      ...draftRoster,
      {
        id: crypto.randomUUID(),
        display_name: name,
        level: 5,
        seed: draftRoster.length + 1,
        preferred_side: null,
        team_number: null,
      },
    ];
    const nextAssignments = isFixedAmericano ? {} : draftAssignments;
    if (await persistDraftRoster(nextPlayers, nextAssignments)) setNewPlayer("");
  }

  async function removePlayer(playerId: string) {
    if (busy) return;
    const nextPlayers = draftRoster.filter((player) => player.id !== playerId);
    const nextAssignments = isFixedAmericano ? {} : draftAssignments;
    await persistDraftRoster(nextPlayers, nextAssignments);
  }

  async function recomposeDraftTeams() {
    if (!isFixedAmericano || !americanoSettings || busy) return;
    try {
      const nextAssignments =
        americanoSettings.composition === "manual"
          ? Object.fromEntries(
              draftRoster.map((player, index) => [player.id, Math.floor(index / 2) + 1]),
            )
          : assignmentsFromTeams(
              composeFixedTeams(
                draftRoster.map((player) => ({
                  id: player.id,
                  level: player.level,
                  side: player.preferred_side ?? undefined,
                })),
                americanoSettings.composition,
              ),
            );
      await persistDraftRoster(draftRoster, nextAssignments);
    } catch (compositionError) {
      setToast({
        message:
          compositionError instanceof Error
            ? compositionError.message
            : "La composition des équipes est invalide.",
        tone: "danger",
      });
    }
  }

  async function swapDraftPlayers(firstId: string, secondId: string) {
    if (busy) return;
    await persistDraftRoster(
      draftRoster,
      swapAssignments(draftAssignments, firstId, secondId),
    );
  }

  async function startDraftEvent() {
    if (busy) return;
    if (isFixedAmericano) {
      try {
        fixedTeamsFromAssignments(
          draftRoster.map((player) => ({
            id: player.id,
            level: player.level,
            side: player.preferred_side ?? undefined,
            teamNumber: draftAssignments[player.id] ?? null,
          })),
        );
      } catch (launchError) {
        setError(
          launchError instanceof Error
            ? launchError.message
            : "La composition des équipes est invalide.",
        );
        return;
      }
    }
    await run(() => startEvent(loadedEvent, players));
  }

  async function addCycle() {
    const success = await run(() => addAmericanoCycle(loadedEvent, players, matches));
    if (success) setViewRound(null);
  }

  async function selectOrganizerPlayer(playerId: string | null) {
    const selected = playerId ? players.find((player) => player.id === playerId) : null;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (selected?.profile_id && user && selected.profile_id !== user.id) {
      setToast({ message: "Ce nom est déjà lié à un autre compte.", tone: "danger" });
      return;
    }

    setOrganizerPlayerId(playerId);
    if (organizerStorageKey) {
      if (playerId) localStorage.setItem(organizerStorageKey, playerId);
      else localStorage.removeItem(organizerStorageKey);
    }

    if (!playerId || !event || !user) return;
    const { error } = await supabase.rpc("claim_player", {
      p_player_id: playerId,
      p_share_code: event.share_code,
    });
    if (error) {
      setToast({ message: friendlyError(error.message), tone: "danger" });
      return;
    }
    await refresh();
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
            className="size-10 rounded-xl flex items-center justify-center text-court bg-lime/10 border border-lime/25 hover:bg-lime/20 cursor-pointer transition-colors"
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
          {americanoSettings && (
            <Badge tone="info">
              {americanoSettings.teamMode === "fixed"
                ? "Équipes fixes"
                : "Équipes remixées"}
            </Badge>
          )}
          {americanoSettings && !isDraft && <Badge tone="muted">Cycle {currentCycle}</Badge>}
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

        {players.length > 0 && (
          <section className="bg-surface border border-border rounded-(--radius-card) p-4 mb-5 animate-fade-up">
            <div className="flex items-start gap-3 mb-3">
              <span className="size-10 rounded-xl bg-lime/15 border border-lime/25 flex items-center justify-center text-court shrink-0">
                <UserCheck className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-extrabold">Jouer comme participant</h2>
                <p className="text-sm text-ink-muted leading-relaxed">
                  {organizerPlayer
                    ? `Tu es sélectionné comme ${organizerPlayer.display_name}.`
                    : "Choisis ton nom pour voir tes matchs et annoncer les scores en tant que joueur."}
                </p>
                {organizerPlayer && isActive && (
                  <p className="mt-1 text-xs font-semibold text-ink-muted">
                    {activeRound === Infinity
                      ? "Cycle terminé — en attente de l'organisateur"
                      : organizerCurrentMatch
                        ? `Ton match de ce round est sur le terrain ${organizerCurrentMatch.court}.`
                        : isFixedAmericano
                          ? "Ton équipe est au repos ce round"
                          : "Tu es au repos ce round"}
                    {!organizerCurrentMatch && organizerNextMatch && (
                      <span className="block text-ink-faint">
                        Prochain match :{" "}
                        {event.format === "americano"
                          ? formatRoundLabel(organizerNextMatch, event.settings)
                          : `Round ${organizerNextMatch.round_number}`}
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {players.map((player) => {
                const selected = organizerPlayerId === player.id;
                return (
                  <button
                    key={player.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectOrganizerPlayer(player.id)}
                    className={`shrink-0 h-12 max-w-56 flex items-center gap-2 rounded-full border pl-2 pr-3 text-sm font-semibold cursor-pointer transition-colors ${
                      selected
                        ? "bg-lime text-on-lime border-lime"
                        : "bg-surface-2 text-ink-muted border-border hover:text-ink hover:border-border-strong"
                    }`}
                  >
                    <Avatar name={player.display_name} size="sm" />
                    <span className="truncate">{player.display_name}</span>
                    {selected && <CheckCircle2 className="size-4 shrink-0" aria-hidden />}
                  </button>
                );
              })}
              {organizerPlayerId && (
                <button
                  type="button"
                  onClick={() => selectOrganizerPlayer(null)}
                  className="shrink-0 h-12 rounded-full border border-border px-4 text-sm font-semibold text-ink-muted bg-surface-2 hover:text-ink cursor-pointer transition-colors"
                >
                  Aucun
                </button>
              )}
            </div>
          </section>
        )}

        {isDone && <Podium event={event} players={players} matches={matches} />}

        {/* ---- Brouillon : roster + lancement ---- */}
        {isDraft && (
          <section className="flex flex-col gap-4 animate-fade-up">
            <div className="bg-surface border border-border rounded-(--radius-card) p-4">
              <h2 className="font-bold mb-1">Prêt à lancer ?</h2>
              <p className="text-sm text-ink-muted leading-relaxed">
                {event.format === "americano" && !isFixedAmericano &&
                  `${event.settings.rounds} rounds seront générés avec une rotation équitable des partenaires et des repos.`}
                {event.format === "americano" && isFixedAmericano &&
                  `${event.settings.rounds} rounds formeront un championnat complet entre les équipes ci-dessous.`}
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
                disabled={busy}
              />
              <Button
                type="submit"
                variant="secondary"
                aria-label="Ajouter"
                className="shrink-0 w-12 px-0"
                disabled={busy}
              >
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
                  {(americanoSettings?.composition === "balanced" ||
                    (!americanoSettings && event.settings.pairing === "balanced")) && (
                    <Badge tone="muted">Niv. {p.level}</Badge>
                  )}
                  <button
                    type="button"
                    aria-label={`Retirer ${p.display_name}`}
                    disabled={busy}
                    onClick={() => removePlayer(p.id)}
                    className="size-9 rounded-lg flex items-center justify-center text-ink-faint hover:text-danger hover:bg-danger/10 cursor-pointer transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>

            {isFixedAmericano && !fixedDraftError && (
              <div className="rounded-(--radius-card) border border-border bg-surface p-4">
                <FixedTeamComposer
                  key={composerGeneration}
                  players={players.map((player) => ({
                    id: player.id,
                    name: player.display_name,
                  }))}
                  assignments={draftAssignments}
                  editable={americanoSettings?.composition === "manual" && !busy}
                  onSwap={(firstId, secondId) => {
                    void swapDraftPlayers(firstId, secondId);
                  }}
                  onRegenerate={
                    americanoSettings?.composition === "manual"
                      ? undefined
                      : () => {
                          void recomposeDraftTeams();
                        }
                  }
                />
              </div>
            )}

            {isFixedAmericano && fixedDraftError && (
              <Button
                type="button"
                variant="secondary"
                full
                disabled={busy || players.length < 4 || players.length % 2 !== 0}
                onClick={() => void recomposeDraftTeams()}
              >
                Recomposer les équipes
              </Button>
            )}

            <Button
              size="lg"
              full
              loading={busy}
              disabled={
                players.length < 4 ||
                (event.format === "tournament" && players.length % 2 !== 0) ||
                (isFixedAmericano && fixedDraftError !== null)
              }
              onClick={() => void startDraftEvent()}
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
            {isFixedAmericano && fixedDraftError && (
              <p className="text-center text-sm text-warning">{fixedDraftError}</p>
            )}
          </section>
        )}

        {/* ---- Actif / terminé : onglets ---- */}
        {!isDraft && (
          <>
            <Segmented<Tab>
              className="mb-5"
              ariaLabel="Navigation de l'événement"
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
                meId={organizerPlayerId}
                onSelect={isActive ? (m) => setScoringMatch(m) : undefined}
              />
            )}

            {tab === "matches" && event.format !== "tournament" && (
              <div className="flex flex-col gap-4">
                {/* Sélecteur de round */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4">
                  {Array.from({ length: maxRound }, (_, i) => i + 1).map((r) => {
                    const matchesInRound = matches.filter((m) => m.round_number === r);
                    const done = matchesInRound.every((m) => m.status === "done");
                    const roundLabel =
                      event.format === "americano" && matchesInRound[0]
                        ? formatRoundLabel(matchesInRound[0], event.settings)
                        : `R${r}`;
                    return (
                      <button
                        key={r}
                        onClick={() => goToRound(r, maxRound, displayRound)}
                        aria-pressed={displayRound === r}
                        className={`shrink-0 h-9 px-4 rounded-full text-sm font-bold cursor-pointer transition-colors border ${
                          displayRound === r
                            ? "bg-lime text-on-lime border-lime"
                            : done
                              ? "bg-surface-2 text-ink-faint border-border"
                              : "bg-surface text-ink-muted border-border-strong"
                        }`}
                      >
                        {roundLabel}
                        {done && <CheckCircle2 className="inline size-3.5 ml-1 -mt-0.5" aria-label="terminé" />}
                      </button>
                    );
                  })}
                </div>

                {/* Matchs du round : swipe gauche/droite pour changer de round */}
                <div
                  key={displayRound}
                  className={`flex flex-col gap-4 ${
                    roundAnim === "l" ? "animate-slide-l" : roundAnim === "r" ? "animate-slide-r" : ""
                  }`}
                  onTouchStart={(e) => {
                    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                  }}
                  onTouchEnd={(e) => {
                    const s = touchStart.current;
                    touchStart.current = null;
                    if (!s) return;
                    const dx = e.changedTouches[0].clientX - s.x;
                    const dy = e.changedTouches[0].clientY - s.y;
                    /* Geste franchement horizontal uniquement (le scroll vertical garde la main) */
                    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
                    goToRound(displayRound + (dx < 0 ? 1 : -1), maxRound, displayRound);
                  }}
                >
                  {roundMatches.map((m, i) => (
                    <div key={m.id} className="stagger-i" style={{ "--i": i } as React.CSSProperties}>
                      <MatchCard
                        match={m}
                        playerName={playerName}
                        meId={organizerPlayerId}
                        roundTag={
                          event.format === "americano"
                            ? formatRoundLabel(m, event.settings)
                            : `R${m.round_number}`
                        }
                        onClick={isActive ? () => setScoringMatch(m) : undefined}
                      />
                    </div>
                  ))}

                  {restingLabels.length > 0 && (
                    <div className="flex items-center gap-2.5 bg-surface-2 border border-border rounded-(--radius-field) px-4 py-3">
                      <Coffee className="size-4 text-ink-faint shrink-0" aria-hidden />
                      <p className="text-sm text-ink-muted">
                        <span className="font-semibold text-ink">Au repos :</span>{" "}
                        {restingLabels.join(", ")}
                      </p>
                    </div>
                  )}
                </div>

                {mexicanoCanAdvance && (
                  <Button size="lg" full loading={busy} onClick={() => run(() => nextMexicanoRound(event, players, matches))}>
                    Générer le round suivant ({maxRound + 1}/{event.settings.rounds})
                  </Button>
                )}
                {currentRoundDone && displayRound < maxRound && (
                  <Button
                    variant="secondary"
                    full
                    onClick={() => goToRound(displayRound + 1, maxRound, displayRound)}
                  >
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
                <Standings
                  event={event}
                  players={players}
                  matches={matches}
                  meId={organizerPlayerId}
                />
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
            {isActive && event.format === "americano" && currentCycleDone && (
              <div className="mt-6 flex flex-col gap-2">
                <Button size="lg" full loading={busy} onClick={() => void addCycle()}>
                  Ajouter un cycle
                </Button>
                <Button
                  variant="secondary"
                  full
                  disabled={busy}
                  onClick={() => setConfirmAction("complete")}
                >
                  <Flag className="size-5" />
                  Terminer l&apos;événement
                </Button>
              </div>
            )}
            {isActive && event.format !== "americano" && allDone && !mexicanoCanAdvance && (
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
          </>
        )}

        <Button
          variant="danger"
          full
          className="mt-4"
          disabled={busy}
          onClick={() => setConfirmAction("delete")}
        >
          <Trash2 className="size-4" />
          Supprimer l&apos;événement
        </Button>
      </AppPage>

      {/* Confirmation destructive */}
      {confirmAction && (
        <div
          ref={confirmTrapRef}
          tabIndex={-1}
          className="fixed inset-0 z-50 flex items-center justify-center p-5 outline-none"
          role="dialog"
          aria-modal="true"
          aria-label={confirmAction === "delete" ? "Confirmer la suppression" : "Confirmer la clôture"}
        >
          <button
            aria-label="Annuler"
            tabIndex={-1}
            className="absolute inset-0 bg-court/60 backdrop-blur-sm cursor-pointer animate-backdrop"
            onClick={() => setConfirmAction(null)}
          />
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
          onClose={() => setScoringMatch(null)}
          onReport={handleReport}
        />
      )}
      {toast && <Toast toast={toast} onDone={() => setToast(null)} />}
      <BottomNav />
    </>
  );
}
