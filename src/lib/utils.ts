import type { EventFormat, EventStatus, PreferredSide } from "./types";

export const FORMAT_LABELS: Record<EventFormat, string> = {
  americano: "Americano",
  mexicano: "Mexicano",
  tournament: "Tournoi",
};

export const SIDE_LABELS: Record<PreferredSide, string> = {
  left: "Côté gauche",
  right: "Côté droit",
  both: "Les deux côtés",
};

export const STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Brouillon",
  active: "En cours",
  completed: "Terminé",
};

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function joinUrl(shareCode: string): string {
  if (typeof window === "undefined") return `/join/${shareCode}`;
  return `${window.location.origin}/join/${shareCode}`;
}

const RPC_ERROR_MESSAGES: Record<string, string> = {
  not_event_organizer: "Seul l'organisateur peut effectuer cette action.",
  invalid_event_format: "Ce format d'événement ne permet pas cette action.",
  invalid_roster_payload: "La liste des joueurs est invalide.",
  fixed_teams_invalid: "Chaque équipe fixe doit contenir exactement deux joueurs.",
  invalid_cycle_payload: "Le planning du cycle est invalide.",
  cycle_incomplete: "Termine tous les matchs du cycle en cours avant de continuer.",
  cycle_already_added: "Ce cycle a déjà été ajouté.",
  unexpected_cycle: "Le prochain cycle n'est plus à jour. Recharge la page.",
  event_not_active: "L'événement n'est pas en cours.",
  event_locked: "Cet événement ne peut plus être modifié.",
  roster_locked: "La liste des joueurs est verrouillée après le lancement.",
  roster_write_forbidden: "Cette modification de la liste des joueurs est interdite.",
  match_write_forbidden: "Cette modification des matchs est interdite.",
  score_sum_mismatch: "Le total des deux scores doit être égal aux points du match.",
  invalid_share_code: "Code de partage invalide.",
  draw_not_allowed: "Un match de tournoi ne peut pas être nul.",
  match_not_found: "Match introuvable.",
};

/** Message d'erreur lisible pour les erreurs RPC connues. */
export function friendlyError(message: string | undefined): string {
  if (!message) return "Une erreur est survenue. Réessaie.";
  for (const [code, friendlyMessage] of Object.entries(RPC_ERROR_MESSAGES)) {
    if (message.includes(code)) return friendlyMessage;
  }
  return message;
}
