import type { EventFormat, EventStatus } from "./types";

export const FORMAT_LABELS: Record<EventFormat, string> = {
  americano: "Americano",
  mexicano: "Mexicano",
  tournament: "Tournoi",
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

/** Message d'erreur lisible pour les erreurs RPC connues. */
export function friendlyError(message: string | undefined): string {
  if (!message) return "Une erreur est survenue. Réessaie.";
  if (message.includes("score_sum_mismatch"))
    return "Le total des deux scores doit être égal aux points du match.";
  if (message.includes("invalid_share_code")) return "Code de partage invalide.";
  if (message.includes("event_not_active")) return "L'événement n'est pas en cours.";
  if (message.includes("draw_not_allowed")) return "Un match de tournoi ne peut pas être nul.";
  if (message.includes("match_not_found")) return "Match introuvable.";
  return message;
}
