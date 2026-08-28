/**
 * The day's shared chain state.
 *
 * Two layers, because this runs on serverless and the public Ronin node is
 * not generous:
 *
 *   1. A **seed** — the whole day up to some block — cached across instances
 *      via the Next data cache. A cold lambda reads it instead of re-scanning
 *      the day, which is what made the board rate-limit itself: every new
 *      instance was independently walking ~290 requests' worth of logs.
 *   2. A cheap **forward scan** in process, from the seed's block to head.
 *      That is a request or two however long the instance lives.
 *
 * Both go through the throttle in chain.ts, so even a cold seed cannot burst
 * past what the node will serve.
 */

import { unstable_cache } from "next/cache";
import {
  blockNumber,
  callData,
  fromWei,
  getLogsRange,
  multicall,
  padUint,
  toAddress,
  toBigInt,
  toNumber,
  words,
} from "./chain";
import { AGE_OF_RONKE, FORTUNE_SPIN, MINES_TABLES, SELECTORS } from "./contracts";
import { blockAtSecond, readMinesWindow, type AorPlay, type MinesRound } from "./read";
import { dayIndex, dayStart } from "./daily";

/** How long a cached seed stands before one instance refreshes it. */
const SEED_TTL_S = 300;
/** How long the in-process forward scan stands. */
const TTL_MS = 30_000;
/** A forced refresh still will not re-read anything younger than this. */
const FLOOR_MS = 8_000;

export interface TodayState {
  day: number;
  at: number;
  startBlock: number;
  rounds: MinesRound[];
  spins: Map<string, number>;
  aor: Map<string, AorPlay>;
  /** The spin and Age of Ronke quests could not be read this pass. */
  logsMissing: boolean;
  error: string | null;
}

/** The seed crosses a cache boundary, so it has to be plain JSON. */
interface Seed {
  atBlock: number;
  startBlock: number;
  rounds: MinesRound[];
  spins: [string, number][];
  aor: [string, { plays: number; labels: string[]; ronkeSpent: number }][];
  /** True when the log scan failed and the spin / Age of Ronke quests are
   *  therefore unread. The rest of the board is still good. */
  logsMissing: boolean;
}

/* -------------------------------------------------------------- log parsing */

function collect(
  spinLogs: { topics: string[] }[],
  aorLogs: { topics: string[]; data: string }[],
  spins: Map<string, number>,
  aor: Map<string, AorPlay>
) {
  for (const log of spinLogs) {
    const spinner = toAddress(log.topics[2]?.replace(/^0x/, ""))?.toLowerCase();
    if (!spinner || /^0x0+$/.test(spinner)) continue;
    spins.set(spinner, (spins.get(spinner) ?? 0) + 1);
  }

  for (const log of aorLogs) {
    const player = toAddress(log.topics[1]?.replace(/^0x/, ""))?.toLowerCase();
    if (!player || /^0x0+$/.test(player)) continue;

    const w = words(log.data);
    if (w.length < 6) continue;
    let label = "";
    try {
      label = Buffer.from(w[5].slice(0, toNumber(w[4]) * 2), "hex").toString("utf8");
    } catch {
      continue;
    }

    const entry = aor.get(player) ?? { plays: 0, labels: new Set<string>(), ronkeSpent: 0 };
    entry.plays += 1;
    entry.labels.add(label);
    entry.ronkeSpent += fromWei(toBigInt(w[1]));
    aor.set(player, entry);
  }
}

async function scan(from: number, to: number) {
  if (from > to) return { spinLogs: [], aorLogs: [] };
  // Sequential, not parallel: the throttle paces them either way, and one at a
  // time keeps a slow scan from starving the rest of the request.
  const spinLogs = await getLogsRange(FORTUNE_SPIN.pack, FORTUNE_SPIN.settleTopic, from, to);
  const aorLogs = await getLogsRange(AGE_OF_RONKE.play, AGE_OF_RONKE.playTopic, from, to);
  return { spinLogs, aorLogs };
}

/* -------------------------------------------------------------------- seed */

async function buildSeed(day: number): Promise<Seed> {
  const startBlock = await blockAtSecond(day * 86_400);
  const atBlock = Number(toBigInt((await blockNumber()).replace(/^0x/, "")));

  const rounds = await readMinesWindow(day * 86_400);
  const spins = new Map<string, number>();
  const aor = new Map<string, AorPlay>();

  // Log scanning is the expensive half and the first thing a stingy node
  // refuses. Losing it costs four quests; losing the whole board costs
  // eighteen, so it is allowed to fail on its own.
  let logsMissing = false;
  try {
    const { spinLogs, aorLogs } = await scan(startBlock, atBlock);
    collect(spinLogs, aorLogs, spins, aor);
  } catch {
    logsMissing = true;
  }

  return {
    atBlock: logsMissing ? startBlock : atBlock,
    startBlock,
    rounds,
    logsMissing,
    spins: [...spins.entries()],
    aor: [...aor.entries()].map(([k, v]) => [
      k,
      { plays: v.plays, labels: [...v.labels], ronkeSpent: v.ronkeSpent },
    ]),
  };
}

function cachedSeed(day: number): Promise<Seed> {
  return unstable_cache(() => buildSeed(day), ["ronke-quest-seed", String(day)], {
    revalidate: SEED_TTL_S,
    tags: [`ronke-quest-day-${day}`],
  })();
}

/* ------------------------------------------------------------------- state */

interface Internal extends TodayState {
  logBlock: number;
  minesCursor: Map<string, number>;
}

let state: Internal | null = null;

function hydrate(day: number, seed: Seed): Internal {
  const spins = new Map(seed.spins);
  const aor = new Map<string, AorPlay>(
    seed.aor.map(([k, v]) => [k, { plays: v.plays, labels: new Set(v.labels), ronkeSpent: v.ronkeSpent }])
  );

  const minesCursor = new Map<string, number>();
  for (const table of MINES_TABLES) {
    const highest = seed.rounds
      .filter((r) => r.table === table.label)
      .reduce((max, r) => Math.max(max, r.id), 0);
    if (highest) minesCursor.set(table.label, highest);
  }

  return {
    day,
    at: Date.now(),
    startBlock: seed.startBlock,
    rounds: seed.rounds,
    spins,
    aor,
    logsMissing: seed.logsMissing,
    error: null,
    logBlock: seed.atBlock,
    minesCursor,
  };
}

/** Reads only the rounds whose ids are newer than the last read. */
async function newRounds(current: Internal): Promise<MinesRound[]> {
  const counters = await multicall(
    MINES_TABLES.map((t) => ({ target: t.address, data: SELECTORS.gameCounter }))
  );

  const calls: { target: string; data: string; table: string; id: number }[] = [];
  MINES_TABLES.forEach((table, i) => {
    const latest = toNumber(words(counters[i] ?? "0x")[0]);
    const seen = current.minesCursor.get(table.label) ?? latest;
    const from = Math.max(seen + 1, latest - 200);
    for (let id = latest; id >= from; id--) {
      calls.push({
        target: table.address,
        data: callData(SELECTORS.games, padUint(id)),
        table: table.label,
        id,
      });
    }
    current.minesCursor.set(table.label, latest);
  });

  if (calls.length === 0) return [];

  const results = await multicall(calls.map(({ target, data }) => ({ target, data })));
  const since = dayStart();
  const fresh: MinesRound[] = [];

  results.forEach((result, i) => {
    if (!result) return;
    const w = words(result);
    const player = toAddress(w[1]);
    if (/^0x0+$/.test(player)) return;
    const at = toNumber(w[0]);
    if (at < since) return;
    fresh.push({
      table: calls[i].table,
      id: calls[i].id,
      at,
      player,
      bet: fromWei(toBigInt(w[2])),
      status: toNumber(w[3]),
      payout: fromWei(toBigInt(w[4])),
    });
  });

  return fresh;
}

async function stepForward(current: Internal) {
  const head = Number(toBigInt((await blockNumber()).replace(/^0x/, "")));

  const fresh = await newRounds(current);
  if (fresh.length) {
    // A round can come back with a changed status (open → cashed out), so
    // replace by id rather than append.
    const byId = new Map(current.rounds.map((r) => [`${r.table}-${r.id}`, r]));
    for (const round of fresh) byId.set(`${round.table}-${round.id}`, round);
    current.rounds = [...byId.values()].sort((a, b) => b.at - a.at);
  }

  try {
    const { spinLogs, aorLogs } = await scan(current.logBlock + 1, head);
    collect(spinLogs, aorLogs, current.spins, current.aor);
    current.logBlock = head;
    current.logsMissing = false;
  } catch {
    current.logsMissing = true;
  }

  current.at = Date.now();
  current.error = null;
}

let inflight: Promise<void> | null = null;

/**
 * The day as it stands. `force` is the refresh button: it re-reads anything
 * older than the floor, and returns the last good copy plus an error string if
 * the node refuses.
 */
export async function getToday(force = false): Promise<TodayState> {
  const day = dayIndex();
  if (state && state.day !== day) state = null;

  const age = state ? Date.now() - state.at : Infinity;
  if (state && age < (force ? FLOOR_MS : TTL_MS)) return state;

  inflight =
    inflight ??
    (async () => {
      if (!state) {
        state = hydrate(day, await cachedSeed(day));
        return;
      }
      await stepForward(state);
    })().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      // Never advance a cursor on failure — the next attempt re-reads the same
      // range rather than skipping it.
      if (state) state.error = message;
      else throw error;
    });

  try {
    await inflight;
  } catch (error) {
    return {
      day,
      at: 0,
      startBlock: 0,
      rounds: [],
      spins: new Map(),
      aor: new Map(),
      logsMissing: true,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    inflight = null;
  }

  return state!;
}
