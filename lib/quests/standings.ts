/**
 * The season table, in the one order everything else must agree on.
 *
 * The leaderboard a player reads and the list the payout pays are the same
 * list, so they are built here rather than ordered separately in four routes.
 * Points first — that is the game. Ties then break on Ronke Score, which is
 * what holders were told would break them.
 *
 * Why it needs saying at all: the draw now hands every wallet a season worth
 * the same, so two players who complete everything finish on exactly the same
 * number. Ties are no longer an edge case, they are the expected result, and
 * `order by points desc` alone decides them by whatever the database returns
 * first — which is not stable, and which paid rank 6 half again what it paid
 * rank 9 on identical points.
 */

import { seasonStandings, type SeasonRow } from "@/lib/quests/store";
import { ronkeScores } from "@/lib/quests/score";

export interface RankedRow extends SeasonRow {
  /** Ronke Score at the last rebuild, or null if the scores were unreadable. */
  score: number | null;
}

/**
 * Enough rows past the cut that a tie straddling it is resolved before the
 * list is trimmed. Without it the database truncates on points alone and the
 * score never gets to decide who the last row is.
 */
const MARGIN = 50;

/**
 * Points, then score, then address.
 *
 * The address is not a tiebreak anybody earns — it is there so that two
 * wallets level on both counts still come out in the same order every time
 * this runs. An arbitrary order is survivable; an unstable one is not, since
 * the list is signed and paid.
 */
export function orderStandings(rows: SeasonRow[], scores: Map<string, number> | null): RankedRow[] {
  const ranked: RankedRow[] = rows.map((row) => ({
    ...row,
    score: scores ? (scores.get(row.address.toLowerCase()) ?? 0) : null,
  }));
  return ranked.sort(
    (a, b) =>
      b.points - a.points ||
      (b.score ?? 0) - (a.score ?? 0) ||
      a.address.localeCompare(b.address)
  );
}

/** Wallets sharing a points total with at least one other wallet. */
export function tiedOn(rows: SeasonRow[], key: (row: RankedRow) => number | string): number {
  const by = new Map<number | string, number>();
  for (const row of rows as RankedRow[]) {
    const value = key(row);
    by.set(value, (by.get(value) ?? 0) + 1);
  }
  let tied = 0;
  for (const count of by.values()) if (count > 1) tied += count;
  return tied;
}

export interface Standings {
  rows: RankedRow[];
  /** False when the score API could not be read, so ties fell back to address. */
  scored: boolean;
  /** When the scores were last rebuilt. */
  asOf: string | null;
  /** Wallets level on points with somebody else. */
  tied: number;
  /** Wallets the score could not separate either. */
  unbroken: number;
}

/** The season table, ordered and trimmed, with the scores already applied. */
export async function rankedStandings(
  fromDay: number,
  toDay: number,
  limit: number
): Promise<Standings> {
  const [raw, scores] = await Promise.all([
    seasonStandings(fromDay, toDay, limit + MARGIN),
    ronkeScores(),
  ]);

  const ordered = orderStandings(raw, scores?.of ?? null);
  const rows = ordered.slice(0, limit);
  return {
    rows,
    scored: !!scores,
    asOf: scores?.asOf ?? null,
    tied: tiedOn(rows, (row) => row.points),
    unbroken: tiedOn(rows, (row) => `${row.points}:${row.score ?? ""}`),
  };
}
