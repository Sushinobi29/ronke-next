/**
 * PoD seasons.
 *
 * Quests are scored inside a season window, so every quest has a deadline and
 * the board resets when the season rolls. Seasons run on a fixed cadence from
 * one epoch rather than a hand-maintained list, so nothing needs a deploy to
 * roll over.
 *
 * These are Ronin's real Proof of Distribution boundaries, triangulated from
 * three published facts rather than assumed:
 *
 *   - PoD began 14 May 2026.
 *   - "Season 1 Ends: June 13th at 7am UTC / Season 2 Begins: June 13th at
 *     7am UTC" — blog.roninchain.com/p/proof-of-distribution-s2-is-almost
 *   - Season 3 had concluded by 13 August 2026, when its results were written
 *     up.
 *
 * Thirty days from 14 May 07:00 UTC satisfies all three: S2 opens 13 June
 * 07:00 to the minute, and S3 closes 12 August, the day before its write-up.
 * The programme is described as monthly, and thirty days is the reading of
 * "monthly" that matches the one timestamp Ronin published exactly.
 *
 * If Ronin ever shifts the cadence, these two constants are the whole change.
 */

const EPOCH_ISO = "2026-05-14T07:00:00Z";
const LENGTH_DAYS = 30;

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

/**
 * The days a season scores.
 *
 * A season rolls at 07:00 UTC; a quest day rolls at midnight. So the day a
 * season opens on is shared with the one before it, and counting it in both —
 * which taking the window from the raw timestamps does — would pay a day's
 * points twice, once into each season's leaderboard. A season therefore owns
 * whole days, from the day it opens to the day before the next one does.
 */
export function seasonDays(season: Season): { fromDay: number; toDay: number } {
  return {
    fromDay: Math.floor(season.startsAt / 86_400),
    toDay: Math.floor(season.endsAt / 86_400) - 1,
  };
}
