/**
 * PoD seasons.
 *
 * Quests are scored inside a season window, so every quest has a deadline and
 * the board resets when the season rolls. Seasons run on a fixed cadence from
 * one epoch rather than a hand-maintained list, so nothing needs a deploy to
 * roll over.
 *
 * >>> Set EPOCH and LENGTH_DAYS to the real PoD season boundaries. Everything
 * >>> else — the countdown, the season number, the scoring window — follows.
 * The default matches the casino's own biweekly leaderboard cadence.
 */

const EPOCH_ISO = "2026-08-26T00:00:00Z";
const LENGTH_DAYS = 14;

const EPOCH = Math.floor(Date.parse(EPOCH_ISO) / 1000);
const LENGTH = LENGTH_DAYS * 24 * 60 * 60;

export interface Season {
  /** 1-indexed, counting from the epoch. */
  number: number;
  name: string;
  startsAt: number;
  endsAt: number;
}

export function seasonAt(unix: number = Math.floor(Date.now() / 1000)): Season {
  const index = Math.max(0, Math.floor((unix - EPOCH) / LENGTH));
  const startsAt = EPOCH + index * LENGTH;
  return {
    number: index + 1,
    name: `PoD Season ${index + 1}`,
    startsAt,
    endsAt: startsAt + LENGTH,
  };
}

/** 0 → just started, 1 → over. Drives the season meter. */
export function seasonProgress(season: Season, unix = Math.floor(Date.now() / 1000)): number {
  return Math.min(1, Math.max(0, (unix - season.startsAt) / (season.endsAt - season.startsAt)));
}

export function secondsLeft(season: Season, unix = Math.floor(Date.now() / 1000)): number {
  return Math.max(0, season.endsAt - unix);
}
