"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Repeat, Scale, Shuffle, Trash2, TrendingUp, Trophy, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AppPage, BottomNav, TopBar } from "@/components/shell";
import { FixedTeamComposer } from "@/components/fixed-team-composer";
import { Avatar, Badge, Button, Field, Input, Segmented, Stepper } from "@/components/ui";
import { deleteEvent, replaceEventRoster } from "@/lib/actions";
import { planFixedCycle, planRemixedCycle } from "@/lib/engine/cycle-planning";
import {
  assignmentsFromTeams,
  composeFixedTeams,
  swapAssignments,
  type TeamAssignments,
} from "@/lib/engine/fixed-teams";
import type {
  CompositionMode,
  EventFormat,
  PairingMode,
  PreferredSide,
  TeamMode,
} from "@/lib/types";
import { friendlyError } from "@/lib/utils";

interface DraftPlayer {
  id: string;
  name: string;
  level: number;
  side: PreferredSide | null;
}

const FORMATS: Array<{
  value: EventFormat;
  title: string;
  desc: string;
  icon: typeof Repeat;
}> = [
  {
    value: "americano",
    title: "Americano",
    desc: "En individuel remixé ou par équipes fixes, chacun cumule ses points au fil des cycles.",
    icon: Repeat,
  },
  {
    value: "mexicano",
    title: "Mexicano",
    desc: "Comme l'americano, mais les matchs suivants sont formés selon le classement : toujours équilibré.",
    icon: TrendingUp,
  },
  {
    value: "tournament",
    title: "Tournoi",
    desc: "Équipes fixes, tableau à élimination directe avec têtes de série et byes automatiques.",
    icon: Trophy,
  },
];

export default function NewEventPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [format, setFormat] = useState<EventFormat>("americano");
  const [name, setName] = useState("");
  const [courts, setCourts] = useState(2);
  const [points, setPoints] = useState(24);
  const [rounds, setRounds] = useState(7);
  const [pairing, setPairing] = useState<PairingMode>("random");
  const [teamMode, setTeamMode] = useState<TeamMode>("remixed");
  const [composition, setComposition] = useState<CompositionMode>("random");
  const [assignments, setAssignments] = useState<TeamAssignments | null>(null);
  const [assignmentGeneration, setAssignmentGeneration] = useState(0);
  const [players, setPlayers] = useState<DraftPlayer[]>([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const isTournament = format === "tournament";
  const isAmericano = format === "americano";
  const minPlayers = 4;
  const fixedCyclePlan =
    isAmericano &&
    teamMode === "fixed" &&
    players.length >= minPlayers &&
    players.length % 2 === 0
      ? planFixedCycle(players.length / 2, courts)
      : null;
  const remixedCyclePlan =
    isAmericano && teamMode === "remixed" && players.length >= minPlayers
      ? planRemixedCycle(players.length, courts)
      : null;
  const cyclePlan = fixedCyclePlan ?? remixedCyclePlan;
  const teamSizes = new Map<number, number>();
  for (const player of players) {
    const teamNumber = assignments?.[player.id];
    if (teamNumber != null) teamSizes.set(teamNumber, (teamSizes.get(teamNumber) ?? 0) + 1);
  }
  const assignmentsComplete =
    assignments != null &&
    Object.keys(assignments).length === players.length &&
    players.every((player) => assignments[player.id] != null) &&
    teamSizes.size === players.length / 2 &&
    [...teamSizes.values()].every((count) => count === 2);
  const playersValid =
    players.length >= minPlayers &&
    (!isTournament || players.length % 2 === 0) &&
    (!isAmericano ||
      teamMode === "remixed" ||
      (players.length % 2 === 0 && assignmentsComplete && cyclePlan != null));
  const balancing = isAmericano ? composition === "balanced" : pairing === "balanced";

  function buildAssignments(
    roster: readonly DraftPlayer[],
    mode: CompositionMode,
  ): TeamAssignments | null {
    if (roster.length < 4 || roster.length % 2 !== 0) return null;
    if (mode === "manual") {
      return Object.fromEntries(
        roster.map((player, index) => [player.id, Math.floor(index / 2) + 1]),
      );
    }
    return assignmentsFromTeams(
      composeFixedTeams(
        roster.map((player) => ({ id: player.id, level: player.level, side: player.side })),
        mode,
      ),
    );
  }

  function replaceRoster(next: DraftPlayer[]) {
    setPlayers(next);
    setAssignments(teamMode === "fixed" ? buildAssignments(next, composition) : null);
    setAssignmentGeneration((generation) => generation + 1);
  }

  function changeFormat(nextFormat: EventFormat) {
    setFormat(nextFormat);
    if (nextFormat === "americano" && teamMode === "fixed") {
      setAssignments(buildAssignments(players, composition));
      setAssignmentGeneration((generation) => generation + 1);
    }
  }

  function changeTeamMode(nextMode: TeamMode) {
    const nextComposition =
      nextMode === "remixed" && composition === "manual" ? "random" : composition;
    setTeamMode(nextMode);
    if (nextComposition !== composition) setComposition(nextComposition);
    setAssignments(nextMode === "fixed" ? buildAssignments(players, nextComposition) : null);
    setAssignmentGeneration((generation) => generation + 1);
  }

  function changeComposition(nextComposition: CompositionMode) {
    setComposition(nextComposition);
    setAssignments(
      teamMode === "fixed" ? buildAssignments(players, nextComposition) : null,
    );
    setAssignmentGeneration((generation) => generation + 1);
  }

  function updatePlayer(id: string, update: Partial<Pick<DraftPlayer, "level" | "side">>) {
    const next = players.map((player) =>
      player.id === id ? { ...player, ...update } : player,
    );
    setPlayers(next);
    if (isAmericano && teamMode === "fixed" && composition === "balanced") {
      setAssignments(buildAssignments(next, composition));
      setAssignmentGeneration((generation) => generation + 1);
    }
  }

  function addPlayer() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError("Ce nom est déjà dans la liste.");
      return;
    }
    setError(null);
    replaceRoster([
      ...players,
      { id: crypto.randomUUID(), name: trimmed, level: 5, side: null },
    ]);
    setNewName("");
  }

  async function create() {
    setCreating(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    if (isAmericano && !cyclePlan) {
      setError("La liste des joueurs ne permet pas de préparer ce cycle.");
      setCreating(false);
      return;
    }
    const { data: event, error: evErr } = await supabase
      .from("events")
      .insert({
        organizer_id: user.id,
        name: name.trim() || FORMATS.find((f) => f.value === format)!.title,
        format,
        settings: isAmericano
          ? {
              points_per_match: points,
              courts,
              rounds: cyclePlan!.roundsPerCycle,
              pairing: composition === "balanced" ? "balanced" : "random",
              team_mode: teamMode,
              composition,
              rounds_per_cycle: cyclePlan!.roundsPerCycle,
            }
          : { points_per_match: points, courts, rounds, pairing },
      })
      .select()
      .single();
    if (evErr || !event) {
      setError(friendlyError(evErr?.message ?? "Impossible de créer l'événement."));
      setCreating(false);
      return;
    }
    const rosterError = await replaceEventRoster(
      event.id,
      players.map((player, index) => ({
        id: player.id,
        display_name: player.name,
        level: player.level,
        seed: index + 1,
        preferred_side: player.side,
        team_number:
          isAmericano && teamMode === "fixed"
            ? assignments?.[player.id] ?? null
            : null,
      })),
      isAmericano ? cyclePlan!.roundsPerCycle : null,
    );
    if (rosterError) {
      await deleteEvent(event.id);
      setError(friendlyError(rosterError));
      setCreating(false);
      return;
    }
    router.push(`/events/${event.id}`);
  }

  return (
    <>
      <TopBar back title="Nouvel événement" />
      <AppPage>
        {/* Indicateur d'étape */}
        <div className="flex gap-1.5 mb-6" aria-label={`Étape ${step} sur 3`}>
          {[1, 2, 3].map((s) => (
            <div key={s} className="h-1.5 flex-1 rounded-full bg-surface-3 overflow-hidden">
              <div
                className={`h-full rounded-full bg-lime transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  s <= step ? "w-full" : "w-0"
                }`}
              />
            </div>
          ))}
        </div>

        {step === 1 && (
          <section className="flex flex-col gap-4 animate-fade-up">
            <h2 className="text-xl font-extrabold">Quel format ?</h2>
            <div className="flex flex-col gap-3" role="radiogroup" aria-label="Format de jeu">
              {FORMATS.map(({ value, title, desc, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={format === value}
                  onClick={() => changeFormat(value)}
                  className={`flex items-start gap-3.5 text-left p-4 rounded-(--radius-card) border cursor-pointer transition-all duration-150 ${
                    format === value
                      ? "bg-lime/5 border-lime/50"
                      : "bg-surface border-border hover:border-border-strong"
                  }`}
                >
                  <div
                    className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${
                      format === value ? "bg-lime text-on-lime" : "bg-surface-2 text-ink-muted"
                    }`}
                  >
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <div>
                    <p className="font-bold">{title}</p>
                    <p className="text-sm text-ink-muted leading-relaxed">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <Field label="Nom de l'événement" htmlFor="event-name" hint="Optionnel — ex. « Americano du vendredi »">
              <Input
                id="event-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Americano du vendredi"
                maxLength={60}
              />
            </Field>
            <Button size="lg" full onClick={() => setStep(2)}>
              Continuer
            </Button>
          </section>
        )}

        {step === 2 && (
          <section className="flex flex-col gap-5 animate-fade-up">
            <h2 className="text-xl font-extrabold">Réglages</h2>

            <div className="bg-surface border border-border rounded-(--radius-card) p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-sm">Terrains disponibles</p>
                <p className="text-xs text-ink-muted">Matchs simultanés possibles</p>
              </div>
              <Stepper value={courts} onChange={setCourts} min={1} max={8} label="terrains" />
            </div>

            {!isTournament && (
              <div className="bg-surface border border-border rounded-(--radius-card) p-4 flex flex-col gap-3">
                <div>
                  <p className="font-bold text-sm">Points par match</p>
                  <p className="text-xs text-ink-muted">
                    Total partagé entre les deux équipes (ex. 24 → 14-10)
                  </p>
                </div>
                <Segmented
                  ariaLabel="Points par match"
                  options={[16, 21, 24, 32].map((value) => ({
                    value: String(value),
                    label: value,
                  }))}
                  value={String(points)}
                  onChange={(value) => setPoints(Number(value))}
                />
              </div>
            )}

            {format === "mexicano" && (
              <div className="bg-surface border border-border rounded-(--radius-card) p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">Nombre de rounds</p>
                  <p className="text-xs text-ink-muted">Chacun joue 1 match par round</p>
                </div>
                <Stepper value={rounds} onChange={setRounds} min={2} max={15} label="rounds" />
              </div>
            )}

            {isAmericano && (
              <div className="bg-surface border border-border rounded-(--radius-card) p-4 flex flex-col gap-3">
                <div>
                  <p className="font-bold text-sm">Mode de jeu</p>
                  <p className="text-xs text-ink-muted">
                    Change de partenaires à chaque round ou garde les mêmes binômes.
                  </p>
                </div>
                <Segmented<TeamMode>
                  ariaLabel="Mode des équipes"
                  options={[
                    { value: "remixed", label: "Individuel · remixé" },
                    { value: "fixed", label: "Par équipes · fixe" },
                  ]}
                  value={teamMode}
                  onChange={changeTeamMode}
                />
              </div>
            )}

            <div className="bg-surface border border-border rounded-(--radius-card) p-4 flex flex-col gap-3">
              <div>
                <p className="font-bold text-sm">
                  {isTournament || (isAmericano && teamMode === "fixed")
                    ? "Composition des équipes"
                    : "Répartition des joueurs"}
                </p>
                <p className="text-xs text-ink-muted">
                  {isTournament
                    ? "Équilibré : le plus fort joue avec le moins fort."
                    : "Équilibré : équipes de niveau proche à chaque match."}
                </p>
              </div>
              {isAmericano ? (
                <Segmented<CompositionMode>
                  ariaLabel="Méthode de composition"
                  options={[
                    {
                      value: "random",
                      label: (
                        <span className="inline-flex items-center gap-1.5">
                          <Shuffle className="size-4" aria-hidden /> Aléatoire
                        </span>
                      ),
                    },
                    {
                      value: "balanced",
                      label: (
                        <span className="inline-flex items-center gap-1.5">
                          <Scale className="size-4" aria-hidden /> Équilibré
                        </span>
                      ),
                    },
                    ...(teamMode === "fixed"
                      ? [{ value: "manual" as const, label: "Manuelle" }]
                      : []),
                  ]}
                  value={composition}
                  onChange={changeComposition}
                />
              ) : (
                <Segmented<PairingMode>
                  ariaLabel={isTournament ? "Composition des équipes" : "Répartition des joueurs"}
                  options={[
                    {
                      value: "random",
                      label: (
                        <span className="inline-flex items-center gap-1.5">
                          <Shuffle className="size-4" aria-hidden /> Aléatoire
                        </span>
                      ),
                    },
                    {
                      value: "balanced",
                      label: (
                        <span className="inline-flex items-center gap-1.5">
                          <Scale className="size-4" aria-hidden /> Équilibré
                        </span>
                      ),
                    },
                  ]}
                  value={pairing}
                  onChange={setPairing}
                />
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" size="lg" onClick={() => setStep(1)}>
                Retour
              </Button>
              <Button size="lg" full onClick={() => setStep(3)}>
                Continuer
              </Button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="flex flex-col gap-4 animate-fade-up">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold">Joueurs</h2>
              <Badge tone={playersValid ? "lime" : "muted"}>
                <Users className="size-3.5" aria-hidden />
                {players.length} joueur{players.length > 1 ? "s" : ""}
              </Badge>
            </div>
            <p className="text-sm text-ink-muted -mt-2">
              {isTournament
                ? "Nombre pair requis (min. 4) — les équipes seront composées au lancement."
                : isAmericano && teamMode === "fixed"
                  ? "Nombre pair requis (min. 4) pour former des binômes fixes."
                  : "Minimum 4 joueurs. Pas besoin d'un multiple de 4 : les repos tournent équitablement."}
            </p>

            {isAmericano && (fixedCyclePlan || remixedCyclePlan) && (
              <p className="rounded-(--radius-field) border border-border bg-surface-2 px-3 py-2.5 text-sm font-semibold text-ink">
                {fixedCyclePlan
                  ? `${players.length} joueurs · ${fixedCyclePlan.teamCount} équipes · ${fixedCyclePlan.roundsPerCycle} rounds · ${fixedCyclePlan.restsPerTeam} repos par équipe`
                  : `${players.length} joueurs · ${remixedCyclePlan!.roundsPerCycle} rounds · ${remixedCyclePlan!.matchesPerPlayer} matchs et ${remixedCyclePlan!.restsPerPlayer} repos par joueur`}
              </p>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addPlayer();
              }}
              className="flex gap-2"
            >
              <Input
                aria-label="Nom du joueur"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nom du joueur"
                maxLength={40}
              />
              <Button
                type="submit"
                aria-label="Ajouter le joueur"
                className="h-12 min-h-12 min-w-[6.75rem] shrink-0 px-4"
              >
                <span>Ajouter</span>
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </form>
            {error && (
              <p role="alert" className="text-sm text-danger font-medium">
                {error}
              </p>
            )}

            <ul className="flex flex-col gap-2">
              {players.map((player) => (
                <li
                  key={player.id}
                  className="flex flex-wrap items-center gap-3 bg-surface border border-border rounded-(--radius-field) px-3 py-2.5"
                >
                  <Avatar name={player.name} size="sm" />
                  <span className="min-w-24 flex-1 text-sm font-semibold truncate">
                    {player.name}
                  </span>
                  {balancing && (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                        Niveau
                        <select
                          aria-label={`Niveau de ${player.name}`}
                          value={player.level}
                          onChange={(event) =>
                            updatePlayer(player.id, { level: Number(event.target.value) })
                          }
                          className="h-9 px-2 rounded-lg bg-surface-2 border border-border text-ink text-sm cursor-pointer"
                        >
                          {Array.from({ length: 10 }, (_, index) => (
                            <option key={index + 1} value={index + 1}>
                              {index + 1}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                        Côté
                        <select
                          aria-label={`Côté de ${player.name}`}
                          value={player.side ?? ""}
                          onChange={(event) =>
                            updatePlayer(player.id, {
                              side: (event.target.value || null) as PreferredSide | null,
                            })
                          }
                          className="h-9 px-2 rounded-lg bg-surface-2 border border-border text-ink text-sm cursor-pointer"
                        >
                          <option value="">Indifférent</option>
                          <option value="left">Gauche</option>
                          <option value="right">Droite</option>
                          <option value="both">Les deux</option>
                        </select>
                      </label>
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label={`Retirer ${player.name}`}
                    onClick={() => replaceRoster(players.filter(({ id }) => id !== player.id))}
                    className="size-9 rounded-lg flex items-center justify-center text-ink-faint hover:text-danger hover:bg-danger/10 cursor-pointer transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>

            {isTournament && players.length >= 4 && players.length % 2 !== 0 && (
              <p className="text-sm text-warning font-medium">
                Ajoute encore un joueur : il faut un nombre pair pour former les équipes.
              </p>
            )}

            {isAmericano &&
              teamMode === "fixed" &&
              players.length >= 4 &&
              players.length % 2 !== 0 && (
                <p className="text-sm text-warning font-medium">
                  Ajoute encore un joueur : chaque équipe fixe doit avoir deux membres.
                </p>
              )}

            {isAmericano && teamMode === "fixed" && assignments && (
              <div className="rounded-(--radius-card) border border-border bg-surface p-4">
                <FixedTeamComposer
                  key={assignmentGeneration}
                  players={players}
                  assignments={assignments}
                  editable={composition === "manual"}
                  onSwap={(firstId, secondId) =>
                    setAssignments((current) =>
                      current ? swapAssignments(current, firstId, secondId) : current,
                    )
                  }
                  onRegenerate={
                    composition === "manual"
                      ? undefined
                      : () => {
                          setAssignments(buildAssignments(players, composition));
                          setAssignmentGeneration((generation) => generation + 1);
                        }
                  }
                />
              </div>
            )}

            <div className="flex gap-2 mt-2">
              <Button variant="secondary" size="lg" onClick={() => setStep(2)}>
                Retour
              </Button>
              <Button size="lg" full disabled={!playersValid} loading={creating} onClick={create}>
                Créer l&apos;événement
              </Button>
            </div>
          </section>
        )}
      </AppPage>
      <BottomNav />
    </>
  );
}
