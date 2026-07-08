import type { EventPlayer } from "./types";

export function resolveEventPlayerId(
  players: EventPlayer[],
  userId: string | null,
  storedPlayerId: string | null,
): string | null {
  if (userId) {
    const claimed = players.find((player) => player.profile_id === userId);
    if (claimed) return claimed.id;
  }

  if (storedPlayerId && players.some((player) => player.id === storedPlayerId)) {
    return storedPlayerId;
  }

  return null;
}

export function getPlayerReporterName(
  players: EventPlayer[],
  playerId: string | null,
  fallback: string,
): string {
  if (!playerId) return fallback;
  return players.find((player) => player.id === playerId)?.display_name ?? fallback;
}
