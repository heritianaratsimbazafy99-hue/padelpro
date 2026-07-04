export type EventFormat = "americano" | "mexicano" | "tournament";
export type EventStatus = "draft" | "active" | "completed";
export type MatchStatus = "pending" | "done";
export type PairingMode = "random" | "balanced";

export interface Profile {
  id: string;
  display_name: string;
  created_at: string;
}

export interface EventSettings {
  /** Americano/Mexicano: total points per match (both teams combined). */
  points_per_match: number;
  /** Number of available courts. */
  courts: number;
  /** Americano: number of rounds to play. */
  rounds: number;
  /** Team balancing strategy for pairings. */
  pairing: PairingMode;
  /** Tournament: sets to win a match (1 = one set). */
  best_of?: number;
}

export interface PadelEvent {
  id: string;
  organizer_id: string;
  name: string;
  format: EventFormat;
  status: EventStatus;
  share_code: string;
  settings: EventSettings;
  current_round: number;
  created_at: string;
  scheduled_at: string | null;
}

export interface EventPlayer {
  id: string;
  event_id: string;
  display_name: string;
  profile_id: string | null;
  level: number; // 1-10 self/organizer assessed level, used for balanced pairing
  seed: number; // tournament seeding order
  created_at: string;
}

export interface Match {
  id: string;
  event_id: string;
  round_number: number;
  court: number;
  /** Player ids (event_players). Tournament: slots may be null until the bracket fills. */
  team1_p1: string | null;
  team1_p2: string | null;
  team2_p1: string | null;
  team2_p2: string | null;
  score1: number | null;
  score2: number | null;
  status: MatchStatus;
  /** Tournament bracket linkage. */
  bracket_pos: number | null;
  next_match_pos: number | null;
  next_match_slot: 1 | 2 | null;
  reported_by: string | null;
  created_at: string;
}

export interface StandingRow {
  playerId: string;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
}
