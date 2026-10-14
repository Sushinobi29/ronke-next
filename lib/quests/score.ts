/**
 * Ronke Score, read from the public scoring API.
 *
 * Used to break ties on the season table. Points measure what you did this
 * season; the score measures what you hold and how long you have held it, so
 * two players who did exactly the same quests are separated by their standing
 * in the ecosystem rather than by whatever order the database felt like.
 *
 * The snapshot behind the API is rebuilt once a day at 07:00 UTC, so this is
 * cached hard and shared across requests. A score that is a few hours stale
 * cannot change an ordering that a daily rebuild would not have changed too.
 */

const SCORE_API = "https://ronke-score-nine.vercel.app";
const TTL_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 8_000;

export interface Scores {
  /** Lower-cased address to score. Missing means the wallet scores nothing. */
  of: Map<string, number>;
  /** When the scoring snapshot was built, straight from the API. */
  asOf: string;
  /** Which scorer produced it, so a changed ordering can be explained. */
  version: string;
}

interface Cached {
  at: number;
  value: Scores | null;
}

let cached: Cached | null = null;
let inFlight: Promise<Scores | null> | null = null;

async function load(): Promise<Scores | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SCORE_API}/api/v1/scores/all`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: { scores?: { address?: string; score?: number }[]; complete?: boolean };
      meta?: { as_of?: string; score_version?: string };
    };
    const rows = body.data?.scores;
    // A partial answer would order some wallets on a real score and the rest
    // on nothing, which is worse than ordering none of them on it.
    if (!Array.isArray(rows) || body.data?.complete !== true) return null;

    const of = new Map<string, number>();
    for (const row of rows) {
      if (typeof row?.address !== "string") continue;
      const score = Number(row.score);
      if (Number.isFinite(score)) of.set(row.address.toLowerCase(), score);
    }
    if (!of.size) return null;
    return {
      of,
      asOf: body.meta?.as_of ?? new Date().toISOString(),
      version: body.meta?.score_version ?? "unknown",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The current scores, or null if they could not be read.
 *
 * Null is a real answer and callers are expected to handle it: a tie broken
 * on a score that could not be loaded is not a tie broken on a score.
 */
export async function ronkeScores(): Promise<Scores | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  // One fetch, however many requests arrive while it is in the air.
  inFlight =
    inFlight ??
    load()
      .then((value) => {
        // A failure is cached far more briefly than a success, so an outage
        // does not freeze the table at "unscored" for a whole hour.
        cached = { at: value ? Date.now() : Date.now() - TTL_MS + 60_000, value };
        return value;
      })
      .finally(() => {
        inFlight = null;
      });
  return inFlight;
}

/** Drops the cache. Only for tests. */
export function forgetScores(): void {
  cached = null;
  inFlight = null;
}
