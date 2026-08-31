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
import { fetchFloorRon, fetchSales, type Sale } from "./market";
import { dayIndex, dayStart } from "./daily";

/** How long a cached seed stands before one instance refreshes it. */
const SEED_TTL_S = 300;
/**
 * Windows of 200 blocks to scan per pass, per contract.
 *
 * The public node enforces a sustained quota, not just a burst cap: a single
 * full-day scan is ~150 windows per contract and reliably exhausts it, after
 * which even eth_blockNumber is refused. So the day is covered a slice at a
 * time — newest first, walking back toward midnight over successive passes —
 * and the spin / Age of Ronke quests fill in within a few minutes instead of
 * failing outright.
 */
const MAX_WINDOWS = 12;
const WINDOW = 200;
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
  /** RON spent spinning today, by wallet — the settle event carries the total. */
  spinRon: Map<string, number>;
  aor: Map<string, AorPlay>;
  /** Marketplace side, read over GraphQL rather than the node. */
  floorRon: number;
  sales: Sale[];
  /** The spin and Age of Ronke quests could not be read this pass. */
  logsMissing: boolean;
  /** 0-1: how much of the day's logs are accounted for. Climbs as slices land. */
  logCoverage: number;
  error: string | null;
}

/** The seed crosses a cache boundary, so it has to be plain JSON. */
interface Seed {
  atBlock: number;
  /** Oldest block whose logs are accounted for. Walks back toward midnight. */
  coveredFrom: number;
  startBlock: number;
  rounds: MinesRound[];
  spins: [string, number][];
  spinRon: [string, number][];
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
  spinRon: Map<string, number>,
  aor: Map<string, AorPlay>
) {
  for (const log of spinLogs) {
    const spinner = toAddress(log.topics[2]?.replace(/^0x/, ""))?.toLowerCase();
    if (!spinner || /^0x0+$/.test(spinner)) continue;
    spins.set(spinner, (spins.get(spinner) ?? 0) + 1);
    // topic3 is the total RON the spin was paid for.
    const paid = fromWei(toBigInt(log.topics[3]?.replace(/^0x/, "") ?? ""));
    spinRon.set(spinner, (spinRon.get(spinner) ?? 0) + paid);
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

/** How much of the day's log range is behind us, 0 to 1. */
function coverage(startBlock: number, coveredFrom: number, head: number): number {
  const span = Math.max(1, head - startBlock);
  return Math.min(1, Math.max(0, (head - coveredFrom + 1) / span));
}

/** The widest range worth asking for in one pass. */
const sliceFrom = (to: number, floor: number) => Math.max(floor, to - MAX_WINDOWS * WINDOW + 1);

/* -------------------------------------------------------------------- seed */

async function buildSeed(day: number): Promise<Seed> {
  const startBlock = await blockAtSecond(day * 86_400);
  const atBlock = Number(toBigInt((await blockNumber()).replace(/^0x/, "")));

  const rounds = await readMinesWindow(day * 86_400);
  const spins = new Map<string, number>();
  const spinRon = new Map<string, number>();
  const aor = new Map<string, AorPlay>();

  // Log scanning is the expensive half and the first thing a stingy node
  // refuses. Losing it costs four quests; losing the whole board costs
  // eighteen, so it is allowed to fail on its own.
  // Newest slice first: whatever a player just did is the part they will look
  // for, and the rest of the day fills in behind it.
  const sliceStart = sliceFrom(atBlock, startBlock);
  let logsMissing = false;
  try {
    const { spinLogs, aorLogs } = await scan(sliceStart, atBlock);
    collect(spinLogs, aorLogs, spins, spinRon, aor);
  } catch {
    logsMissing = true;
  }

  const coveredFrom = logsMissing ? atBlock + 1 : sliceStart;

  return {
    atBlock,
    coveredFrom,
    startBlock,
    rounds,
    // Still missing while any of the day sits behind the covered window — the
    // remaining slices land over the next few passes.
    logsMissing: coveredFrom > startBlock,
    spins: [...spins.entries()],
    spinRon: [...spinRon.entries()],
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
  coveredFrom: number;
  minesCursor: Map<string, number>;
}

let state: Internal | null = null;

function hydrate(day: number, seed: Seed): Internal {
  const spins = new Map(seed.spins);
  const spinRon = new Map(seed.spinRon);
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
    spinRon,
    aor,
    floorRon: 0,
    sales: [],
    logsMissing: seed.logsMissing,
    logCoverage: coverage(seed.startBlock, seed.coveredFrom, seed.atBlock),
    error: null,
    logBlock: seed.atBlock,
    coveredFrom: seed.coveredFrom,
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

/**
 * Floor and sales come from the marketplace, not the node, so they are
 * refreshed on their own and a failure there costs only the monke quest.
 */
async function refreshMarket(current: Internal) {
  try {
    const [floorRon, sales] = await Promise.all([
      fetchFloorRon(),
      fetchSales(current.day * 86_400),
    ]);
    current.floorRon = floorRon;
    current.sales = sales;
  } catch {
    // Leave the last good copy in place.
  }
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
    // Forward to head first — new activity matters more than old.
    const { spinLogs, aorLogs } = await scan(current.logBlock + 1, head);
    collect(spinLogs, aorLogs, current.spins, current.spinRon, current.aor);
    current.logBlock = head;
    if (current.coveredFrom > head) current.coveredFrom = head + 1;

    // Then reclaim a slice of the day still behind us.
    if (current.coveredFrom > current.startBlock) {
      const to = current.coveredFrom - 1;
      const from = sliceFrom(to, current.startBlock);
      const older = await scan(from, to);
      collect(older.spinLogs, older.aorLogs, current.spins, current.spinRon, current.aor);
      current.coveredFrom = from;
    }

    current.logsMissing = current.coveredFrom > current.startBlock;
    current.logCoverage = coverage(current.startBlock, current.coveredFrom, head);
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
        await refreshMarket(state);
        return;
      }
      await stepForward(state);
      await refreshMarket(state);
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
      spinRon: new Map(),
      floorRon: 0,
      sales: [],
      logsMissing: true,
      logCoverage: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    inflight = null;
  }

  return state!;
}

/* ------------------------------------------------------------- leaderboard */

export interface BoardEntry {
  address: string;
  mines: number;
  spins: number;
  plays: number;
  monkes: number;
  ronSpent: number;
  actions: number;
}

/**
 * Who has been busiest today, built entirely from state already gathered for
 * the quests — no extra reads, however many people are on the page.
 *
 * It ranks observed activity, not quest points: scoring a wallet needs its own
 * balance reads, and doing that for every player on every refresh is exactly
 * the spending pattern that rate-limited the board before. Actions first, RON
 * as the tie-break, so grinding free rounds cannot outrank real commitment.
 */
export function buildLeaderboard(today: TodayState, limit = 15): BoardEntry[] {
  const by = new Map<string, BoardEntry>();

  const entry = (address: string) => {
    const key = address.toLowerCase();
    const found = by.get(key) ?? {
      address: key,
      mines: 0,
      spins: 0,
      plays: 0,
      monkes: 0,
      ronSpent: 0,
      actions: 0,
    };
    by.set(key, found);
    return found;
  };

  for (const round of today.rounds) {
    const e = entry(round.player);
    e.mines += 1;
    if (round.table === "RON") e.ronSpent += round.bet;
  }

  for (const [address, count] of today.spins) {
    entry(address).spins += count;
  }
  for (const [address, ron] of today.spinRon) {
    entry(address).ronSpent += ron;
  }

  for (const [address, play] of today.aor) {
    entry(address).plays += play.plays;
  }

  for (const sale of today.sales) {
    const e = entry(sale.buyer);
    e.monkes += 1;
    e.ronSpent += sale.ron;
  }

  for (const e of by.values()) {
    e.actions = e.mines + e.spins + e.plays + e.monkes;
    e.ronSpent = Math.round(e.ronSpent * 100) / 100;
  }

  return [...by.values()]
    .filter((e) => e.actions > 0)
    .sort((a, b) => b.actions - a.actions || b.ronSpent - a.ronSpent)
    .slice(0, limit);
}
