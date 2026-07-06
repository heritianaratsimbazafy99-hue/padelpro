import { Flame, Medal, Sparkles, TrendingUp, Trophy, Users, type LucideIcon } from "lucide-react";
import type { PlayerStats } from "./use-stats";

/**
 * Trophées du club : définis côté client, débloqués par la carrière et
 * persistés dans public.profile_trophies (date de déblocage + célébration).
 * Les ids sont stables : ne jamais les renommer, seulement en ajouter.
 */
export interface TrophyDef {
  id: string;
  icon: LucideIcon;
  label: string;
  hint: string;
  done: (stats: PlayerStats, elo: number | null) => boolean;
}

export const TROPHIES: TrophyDef[] = [
  {
    id: "first-match",
    icon: Sparkles,
    label: "Premiers pas",
    hint: "Jouer un match",
    done: (s) => s.matches >= 1,
  },
  {
    id: "first-win",
    icon: Trophy,
    label: "Première victoire",
    hint: "Gagner un match",
    done: (s) => s.wins >= 1,
  },
  {
    id: "regular-10",
    icon: Flame,
    label: "Habitué du club",
    hint: "Jouer 10 matchs",
    done: (s) => s.matches >= 10,
  },
  {
    id: "winner-10",
    icon: Medal,
    label: "Serial winner",
    hint: "Gagner 10 matchs",
    done: (s) => s.wins >= 10,
  },
  {
    id: "events-5",
    icon: Users,
    label: "Pilier du club",
    hint: "Participer à 5 événements",
    done: (s) => s.events >= 5,
  },
  {
    id: "climber-1100",
    icon: TrendingUp,
    label: "Grimpeur",
    hint: "Atteindre 1100 Elo",
    done: (_, elo) => (elo ?? 0) >= 1100,
  },
];

/** Ids des trophées mérités d'après la carrière courante. */
export function earnedTrophyIds(stats: PlayerStats | null, elo: number | null): string[] {
  if (!stats) return [];
  return TROPHIES.filter((t) => t.done(stats, elo)).map((t) => t.id);
}

/**
 * Titre de licence par palier d'Elo — l'échelon affiché sur la carte joueur.
 * `null` = aucun match joué (l'Elo n'existe pas encore).
 */
export function eloTitle(elo: number | null): string {
  if (elo === null) return "Recrue du club";
  if (elo < 980) return "Challenger";
  if (elo < 1050) return "Compétiteur";
  if (elo < 1120) return "Cadre du club";
  if (elo < 1200) return "Maître du filet";
  return "Légende du club";
}
