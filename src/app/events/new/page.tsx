"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Repeat, Scale, Shuffle, Trash2, TrendingUp, Trophy, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AppPage, BottomNav, TopBar } from "@/components/shell";
import { Avatar, Badge, Button, Field, Input, Segmented, Stepper } from "@/components/ui";
import type { EventFormat, PairingMode } from "@/lib/types";

interface DraftPlayer {
  name: string;
  level: number;
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
    desc: "Tournoi individuel : les paires tournent à chaque round, chacun cumule ses points.",
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
  const [players, setPlayers] = useState<DraftPlayer[]>([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const isTournament = format === "tournament";
  const minPlayers = 4;
  const playersValid =
    players.length >= minPlayers && (!isTournament || players.length % 2 === 0);

  function addPlayer() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError("Ce nom est déjà dans la liste.");
      return;
    }
    setError(null);
    setPlayers([...players, { name: trimmed, level: 5 }]);
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
    const { data: event, error: evErr } = await supabase
      .from("events")
      .insert({
        organizer_id: user.id,
        name: name.trim() || FORMATS.find((f) => f.value === format)!.title,
        format,
        settings: {
          points_per_match: points,
          courts,
          rounds,
          pairing,
        },
      })
      .select()
      .single();
    if (evErr || !event) {
      setError(evErr?.message ?? "Impossible de créer l'événement.");
      setCreating(false);
      return;
    }
    const { error: plErr } = await supabase.from("event_players").insert(
      players.map((p, i) => ({
        event_id: event.id,
        display_name: p.name,
        level: p.level,
        seed: i + 1,
      })),
    );
    if (plErr) {
      setError(plErr.message);
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
                  onClick={() => setFormat(value)}
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
              <>
                <div className="bg-surface border border-border rounded-(--radius-card) p-4 flex flex-col gap-3">
                  <div>
                    <p className="font-bold text-sm">Points par match</p>
                    <p className="text-xs text-ink-muted">
                      Total partagé entre les deux équipes (ex. 24 → 14-10)
                    </p>
                  </div>
                  <Segmented
                    options={[16, 21, 24, 32].map((v) => ({ value: String(v) as string, label: v }))}
                    value={String(points)}
                    onChange={(v) => setPoints(Number(v))}
                  />
                </div>
                <div className="bg-surface border border-border rounded-(--radius-card) p-4 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm">Nombre de rounds</p>
                    <p className="text-xs text-ink-muted">Chacun joue 1 match par round</p>
                  </div>
                  <Stepper value={rounds} onChange={setRounds} min={2} max={15} label="rounds" />
                </div>
              </>
            )}

            <div className="bg-surface border border-border rounded-(--radius-card) p-4 flex flex-col gap-3">
              <div>
                <p className="font-bold text-sm">
                  {isTournament ? "Composition des équipes" : "Répartition des joueurs"}
                </p>
                <p className="text-xs text-ink-muted">
                  {isTournament
                    ? "Équilibré : le plus fort joue avec le moins fort."
                    : "Équilibré : équipes de niveau proche à chaque match."}
                </p>
              </div>
              <Segmented<PairingMode>
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
                : "Minimum 4 joueurs. Pas besoin d'un multiple de 4 : les repos tournent équitablement."}
            </p>

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
              <Button type="submit" aria-label="Ajouter le joueur" className="shrink-0 w-12 px-0">
                <Plus className="size-5" />
              </Button>
            </form>
            {error && (
              <p role="alert" className="text-sm text-danger font-medium">
                {error}
              </p>
            )}

            <ul className="flex flex-col gap-2">
              {players.map((p, i) => (
                <li
                  key={p.name}
                  className="flex items-center gap-3 bg-surface border border-border rounded-(--radius-field) px-3 py-2.5"
                >
                  <Avatar name={p.name} size="sm" />
                  <span className="flex-1 text-sm font-semibold truncate">{p.name}</span>
                  {pairing === "balanced" && (
                    <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                      Niveau
                      <select
                        aria-label={`Niveau de ${p.name}`}
                        value={p.level}
                        onChange={(e) =>
                          setPlayers(
                            players.map((x, j) =>
                              j === i ? { ...x, level: Number(e.target.value) } : x,
                            ),
                          )
                        }
                        className="h-9 px-2 rounded-lg bg-surface-2 border border-border text-ink text-sm cursor-pointer"
                      >
                        {Array.from({ length: 10 }, (_, n) => (
                          <option key={n + 1} value={n + 1}>
                            {n + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button
                    type="button"
                    aria-label={`Retirer ${p.name}`}
                    onClick={() => setPlayers(players.filter((_, j) => j !== i))}
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
