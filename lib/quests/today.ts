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
  currentLogWindow,
  callData,
  fromWei,
  getLogsRange,
  LogWindowNarrowed,
  multicall,
  padUint,
  toAddress,
  toBigInt,
  toNumber,
  transactionLogs,
  transactionSender,
  transactionValue,
  words,
  type Log,
} from "./chain";
import {
  AGE_OF_RONKE,
  COLLECTIONS,
  FORTUNE_SPIN,
  MINES_TABLES,
  POOLS,
  SELECTORS,
  SWAP_TOPIC,
  TOKENS,
  TRANSFER_TOPIC,
} from "./contracts";
import {
  blockAtSecond,
  readDaily,
  readMinesWindow,
  type AorPlay,
  type DayBuy,
  type MinesRound,
} from "./read";
import { fetchFloorRon, fetchSales, type Sale } from "./market";
import { dayIndex, dayStart, scoreDay } from "./daily";
import {
  priorSweepStreaks,
  readFeatured,
  readPools,
  recordMany,
  socialVerifiedOn,
  sweptOn,
} from "./store";
import { poolOnDay } from "./pool";

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
/**
 * Mines ids one pass will catch up on, per table. Only a stalled instance
 * ever reaches it; a normal pass reads the handful of rounds run in the last
 * thirty seconds.
 */
const MAX_CATCHUP = 400;

export interface TodayState {
  day: number;
  at: number;
  startBlock: number;
  rounds: MinesRound[];
  spins: Map<string, number>;
  /** RON spent spinning today, by wallet — the settle event carries the total. */
  spinRon: Map<string, number>;
  aor: Map<string, AorPlay>;
  /** RON spent buying $RONKE and $RONKESTR today, by wallet. */
  buys: Map<string, DayBuy>;
  /**
   * RON paid for a Ronkeverse monke today, by wallet, read off the collection
   * rather than the marketplace — a purchase is a purchase whichever venue
   * matched it.
   */
  monkeBuys: Map<string, number>;
  /** Marketplace side, read over GraphQL rather than the node. */
  floorRon: number;
  sales: Sale[];
  /** The spin, Age of Ronke and buy quests could not be read this pass. */
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
  buys: [string, DayBuy][];
  /** Monke purchases read off the collection, buyer -> RON paid. */
  monkeBuys: [string, number][];
  /** Where each Mines table's id counter stood when the rounds were read. */
  minesLatest: [string, number][];
  /** True when the walk back ran out of pages before it reached midnight. */
  minesTruncated: boolean;
  /** True when the log scan failed and the spin / Age of Ronke / buy quests
   *  are therefore unread. The rest of the board is still good. */
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

const POOL_SIDE = new Map<string, keyof DayBuy>([
  [POOLS.ronke.address, "ronke"],
  [POOLS.ronkestr.address, "ronkestr"],
]);

/**
 * The day's buys, from the pairs' own Swap events.
 *
 * Neither indexed address on a Swap is the buyer — both are normally the
 * aggregator the player clicked through — so each swap costs one transaction
 * lookup to attribute. At this pool's volume that is a few dozen requests a
 * day, and several swaps in one transaction only pay for it once.
 *
 * What counts is the RON that went in, not the tokens that came out. That is
 * what the quest asks for, and it is the only reading $RONKESTR's 10% tax
 * cannot shrink below the bar a player actually cleared.
 */
async function collectBuys(swapLogs: Log[], buys: Map<string, DayBuy>) {
  const senders = new Map<string, string | null>();

  for (const log of swapLogs) {
    const side = POOL_SIDE.get(log.address.toLowerCase());
    if (!side) continue;

    const w = words(log.data);
    if (w.length < 4) continue;

    // (amount0In, amount1In, amount0Out, amount1Out), and which of the pair is
    // WRON is not the same in both pools.
    const wronIsToken0 = POOLS[side].wronIsToken0;
    const ronIn = toBigInt(wronIsToken0 ? w[0] : w[1]);
    const tokenOut = toBigInt(wronIsToken0 ? w[3] : w[2]);
    // RON in and tokens out is a buy. The other direction is somebody selling.
    if (ronIn <= BigInt(0) || tokenOut <= BigInt(0)) continue;

    const hash = log.transactionHash;
    if (!senders.has(hash)) senders.set(hash, await transactionSender(hash));
    const buyer = senders.get(hash);
    if (!buyer || /^0x0+$/.test(buyer)) continue;

    const entry = buys.get(buyer) ?? { ronke: 0, ronkestr: 0 };
    entry[side] += fromWei(ronIn);
    buys.set(buyer, entry);
  }
}

/**
 * The day's monke purchases, read off the collection itself.
 *
 * The marketplace feed only knows about sales made on the marketplace. A
 * player who buys the same monke through Seaport is buying it just as much,
 * and the board told them it did not count — the first day of the season had
 * people posting transaction hashes in chat asking why.
 *
 * The chain does not care which venue moved it: one Transfer filter over the
 * collection catches every one. Price comes from the transaction, which is
 * also what keeps this honest — a monke handed between two wallets carries no
 * value and stays under the quest's floor, so a gift cannot pay like a buy.
 */
async function collectMonkeBuys(transferLogs: Log[], monkeBuys: Map<string, number>) {
  const paid = new Map<string, number | null>();
  const receipts = new Map<string, Log[]>();

  for (const log of transferLogs) {
    // ERC-721: [topic, from, to, tokenId]. A 20-byte Transfer with no tokenId
    // is an ERC-20 sharing the signature, and not what this is looking for.
    if (log.topics.length < 4) continue;
    const to = toAddress(log.topics[2]?.replace(/^0x/, ""))?.toLowerCase();
    if (!to || /^0x0+$/.test(to)) continue;

    const hash = log.transactionHash;
    if (!paid.has(hash)) paid.set(hash, await transactionValue(hash));
    let ron = paid.get(hash) ?? 0;

    /**
     * Nothing on the transaction itself means either a gift or a sale settled
     * in wrapped RON — an accepted offer is always the latter, because an
     * offer has to be made in a token. Reading what the buyer sent tells the
     * two apart, and only costs a receipt on the transfers that look free.
     */
    if (ron <= 0) {
      if (!receipts.has(hash)) receipts.set(hash, await transactionLogs(hash));
      ron = wronPaidBy(receipts.get(hash)!, to);
    }
    if (ron <= 0) continue;

    // Several monkes in one transaction share its value; the quest asks what
    // a purchase cost, so the largest single reading is the honest one.
    monkeBuys.set(to, Math.max(monkeBuys.get(to) ?? 0, ron));
  }
}

/** Wrapped RON leaving one wallet inside a transaction, in RON. */
function wronPaidBy(logs: Log[], buyer: string): number {
  let total = 0;
  for (const log of logs) {
    if (log.address.toLowerCase() !== TOKENS.WRON) continue;
    // ERC-20 Transfer: [topic, from, to], value in data.
    if (log.topics[0] !== TRANSFER_TOPIC || log.topics.length < 3) continue;
    const from = toAddress(log.topics[1]?.replace(/^0x/, ""))?.toLowerCase();
    if (from !== buyer) continue;
    total += fromWei(toBigInt(log.data.replace(/^0x/, "")));
  }
  return total;
}

async function scan(from: number, to: number) {
  if (from > to) return { spinLogs: [], aorLogs: [], swapLogs: [], monkeLogs: [] };
  // Sequential, not parallel: the throttle paces them either way, and one at a
  // time keeps a slow scan from starving the rest of the request.
  const spinLogs = await getLogsRange(FORTUNE_SPIN.pack, FORTUNE_SPIN.settleTopic, from, to);
  const aorLogs = await getLogsRange(AGE_OF_RONKE.play, AGE_OF_RONKE.playTopic, from, to);
  // Both pairs in one filter, so watching the market costs one scan, not two.
  const swapLogs = await getLogsRange(
    [POOLS.ronke.address, POOLS.ronkestr.address],
    SWAP_TOPIC,
    from,
    to
  );
  const monkeLogs = await getLogsRange(COLLECTIONS.ronkeverse, TRANSFER_TOPIC, from, to);
  return { spinLogs, aorLogs, swapLogs, monkeLogs };
}

/**
 * A pass over part of the day, sliced to what the endpoint will serve.
 *
 * The first ask of a process is deliberately optimistic — a dedicated node
 * hands over the whole day in one request, and the only way to find that out
 * is to ask for it. When the public node refuses instead, that answer arrives
 * as LogWindowNarrowed, and the same pass is re-cut to a slice that fits.
 * Without the re-cut the refusal would be paid for twice: once for the wasted
 * request, and again walking a whole day in 200-block windows.
 */
async function scanSlice(to: number, floor: number) {
  const from = sliceFrom(to, floor);
  try {
    return { from, ...(await scan(from, to)) };
  } catch (error) {
    if (!(error instanceof LogWindowNarrowed)) throw error;
    const narrowed = sliceFrom(to, floor);
    return { from: narrowed, ...(await scan(narrowed, to)) };
  }
}

/**
 * The pass that keeps up with the head of the chain. Its range is small and
 * has to be covered exactly — the cursor moves to head afterwards, so a slice
 * would leave a hole nothing goes back for. A narrowed window just means
 * asking again, this time in windows the endpoint will serve.
 */
async function scanForward(from: number, to: number) {
  try {
    return await scan(from, to);
  } catch (error) {
    if (!(error instanceof LogWindowNarrowed)) throw error;
    return await scan(from, to);
  }
}

/** How much of the day's log range is behind us, 0 to 1. */
function coverage(startBlock: number, coveredFrom: number, head: number): number {
  const span = Math.max(1, head - startBlock);
  return Math.min(1, Math.max(0, (head - coveredFrom + 1) / span));
}

/**
 * The widest range worth asking for in one pass.
 *
 * On the public node that is twelve 200-block windows, and the day gets
 * covered over several passes. On an endpoint that serves tens of thousands of
 * blocks at once there is nothing to slice — the whole day is one request, so
 * take it in one go and skip the walk-back entirely.
 */
function sliceFrom(to: number, floor: number): number {
  const window = currentLogWindow();
  const span = window >= 10_000 ? window : MAX_WINDOWS * WINDOW;
  return Math.max(floor, to - span + 1);
}

/* -------------------------------------------------------------------- seed */

async function buildSeed(day: number): Promise<Seed> {
  const startBlock = await blockAtSecond(day * 86_400);
  const atBlock = Number(toBigInt((await blockNumber()).replace(/^0x/, "")));

  const mines = await readMinesWindow(day * 86_400);
  const spins = new Map<string, number>();
  const spinRon = new Map<string, number>();
  const aor = new Map<string, AorPlay>();
  const buys = new Map<string, DayBuy>();
  const monkeBuys = new Map<string, number>();

  // Log scanning is the expensive half and the first thing a stingy node
  // refuses. Losing it costs six quests; losing the whole board costs
  // eighteen, so it is allowed to fail on its own.
  // Newest slice first: whatever a player just did is the part they will look
  // for, and the rest of the day fills in behind it. A pass that fails covers
  // nothing, which is what leaving the cursor above the head block says.
  let coveredFrom = atBlock + 1;
  try {
    const { from, spinLogs, aorLogs, swapLogs, monkeLogs } = await scanSlice(atBlock, startBlock);
    collect(spinLogs, aorLogs, spins, spinRon, aor);
    await collectBuys(swapLogs, buys);
    await collectMonkeBuys(monkeLogs, monkeBuys);
    coveredFrom = from;
  } catch {
    // Nothing collected, nothing covered.
  }

  return {
    atBlock,
    coveredFrom,
    startBlock,
    rounds: mines.rounds,
    minesLatest: mines.latest,
    minesTruncated: mines.truncated,
    // Still missing while any of the day sits behind the covered window — the
    // remaining slices land over the next few passes.
    logsMissing: coveredFrom > startBlock,
    spins: [...spins.entries()],
    spinRon: [...spinRon.entries()],
    aor: [...aor.entries()].map(([k, v]) => [
      k,
      { plays: v.plays, labels: [...v.labels], ronkeSpent: v.ronkeSpent },
    ]),
    buys: [...buys.entries()],
    monkeBuys: [...monkeBuys.entries()],
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

  // A seed cached by the build before buys existed has no buys on it, and a
  // board that throws on a stale cache entry is worse than one that fills in
  // on the next pass.
  const buys = new Map<string, DayBuy>((seed.buys ?? []).map(([k, v]) => [k, { ...v }]));
  // A seed cached before monke buys were read has none; the next pass fills it.
  const monkeBuys = new Map<string, number>(seed.monkeBuys ?? []);

  /**
   * Where the forward read picks up, per table.
   *
   * It has to be the counter the seed actually read, not the newest round it
   * found today: a table nobody has played today yields no rounds at all, and
   * a cursor guessed from that is either zero — re-reading the table's whole
   * history every pass — or, worse, silently set to wherever the table
   * happens to stand now, skipping every round played while the seed was
   * being built. A seed cached before the counters were recorded has none, so
   * those tables start from their oldest round today and the first pass
   * re-reads a little rather than skipping anything.
   */
  const minesCursor = new Map<string, number>(seed.minesLatest ?? []);
  for (const table of MINES_TABLES) {
    if (minesCursor.has(table.label)) continue;
    const ids = seed.rounds.filter((r) => r.table === table.label).map((r) => r.id);
    if (ids.length) minesCursor.set(table.label, Math.min(...ids) - 1);
  }

  return {
    day,
    at: Date.now(),
    startBlock: seed.startBlock,
    rounds: seed.rounds,
    spins,
    spinRon,
    aor,
    buys,
    monkeBuys,
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

/**
 * Reads the rounds a table has run since the last pass.
 *
 * Two rules, both learned the hard way. Ids are read oldest first, because a
 * backlog wider than one pass has to close from the bottom — reading the
 * newest slice each time leaves the middle unread forever. And the cursor
 * moves only across ids this pass actually decoded: a pass cut short by the
 * request timeout, or a chunk the node refused, used to leave the cursor
 * parked above rounds nobody ever read. Rounds are contiguous per player —
 * one sitting is one run of ids — so a dropped slice does not thin everyone's
 * day out evenly, it erases a handful of players completely.
 */
async function newRounds(current: Internal): Promise<MinesRound[]> {
  const counters = await multicall(
    MINES_TABLES.map((t) => ({ target: t.address, data: SELECTORS.gameCounter }))
  );

  const calls: { target: string; data: string; table: string; id: number }[] = [];
  const asked = new Map<string, number[]>();

  MINES_TABLES.forEach((table, i) => {
    const latest = toNumber(words(counters[i] ?? "0x")[0]);
    const seen = current.minesCursor.get(table.label) ?? latest;
    if (latest <= seen) return;

    // Bounded so one pass cannot outgrow the request, but the cursor stays
    // put on whatever is left and the next pass carries on from there.
    const ids: number[] = [];
    for (let id = seen + 1; id <= Math.min(latest, seen + MAX_CATCHUP); id++) ids.push(id);
    asked.set(table.label, ids);

    for (const id of ids) {
      calls.push({
        target: table.address,
        data: callData(SELECTORS.games, padUint(id)),
        table: table.label,
        id,
      });
    }
  });

  if (calls.length === 0) return [];

  const results = await multicall(calls.map(({ target, data }) => ({ target, data })));
  const since = dayStart();
  const fresh: MinesRound[] = [];
  const decoded = new Map<string, Set<number>>();

  results.forEach((result, i) => {
    if (!result) return;
    const { table, id } = calls[i];
    const seenIds = decoded.get(table) ?? new Set<number>();
    seenIds.add(id);
    decoded.set(table, seenIds);

    const w = words(result);
    const player = toAddress(w[1]);
    // An empty row still counts as read — the cursor may pass it.
    if (/^0x0+$/.test(player)) return;
    const at = toNumber(w[0]);
    if (at < since) return;
    fresh.push({
      table,
      id,
      at,
      player,
      bet: fromWei(toBigInt(w[2])),
      status: toNumber(w[3]),
      payout: fromWei(toBigInt(w[4])),
    });
  });

  // Up to the first id that did not come back, and no further.
  for (const [table, ids] of asked) {
    const seenIds = decoded.get(table);
    if (!seenIds) continue;
    let cursor = current.minesCursor.get(table) ?? ids[0] - 1;
    for (const id of ids) {
      if (!seenIds.has(id)) break;
      cursor = id;
    }
    current.minesCursor.set(table, cursor);
  }

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
    // The floor is taken once a day and then held. Both the monke quest's
    // threshold and its points hang off it, and neither may move under
    // somebody halfway through buying — two wallets doing the same quest on
    // the same day have to be worth the same, whenever the scoring pass runs.
    // The day's state is dropped at rollover, so tomorrow takes a fresh one.
    if (floorRon > 0 && current.floorRon <= 0) current.floorRon = floorRon;
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
    const { spinLogs, aorLogs, swapLogs, monkeLogs } = await scanForward(current.logBlock + 1, head);
    collect(spinLogs, aorLogs, current.spins, current.spinRon, current.aor);
    await collectBuys(swapLogs, current.buys);
    await collectMonkeBuys(monkeLogs, current.monkeBuys);
    current.logBlock = head;
    if (current.coveredFrom > head) current.coveredFrom = head + 1;

    // Then reclaim a slice of the day still behind us.
    if (current.coveredFrom > current.startBlock) {
      const older = await scanSlice(current.coveredFrom - 1, current.startBlock);
      collect(older.spinLogs, older.aorLogs, current.spins, current.spinRon, current.aor);
      await collectBuys(older.swapLogs, current.buys);
      await collectMonkeBuys(older.monkeLogs, current.monkeBuys);
      current.coveredFrom = older.from;
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
      monkeBuys: new Map(),
      buys: new Map(),
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
  points: number;
  done: number;
  bonus: number;
  streak: number;
  actions: number;
}

/** Everyone the chain has seen do something today, busiest first. */
function activeToday(today: TodayState): string[] {
  const actions = new Map<string, number>();
  const bump = (address: string, by = 1) => {
    const key = address.toLowerCase();
    actions.set(key, (actions.get(key) ?? 0) + by);
  };

  for (const round of today.rounds) bump(round.player);
  for (const [address, count] of today.spins) bump(address, count);
  for (const [address, play] of today.aor) bump(address, play.plays);
  for (const sale of today.sales) bump(sale.buyer);
  for (const [address] of today.buys) bump(address);

  return [...actions.entries()].sort((a, b) => b[1] - a[1]).map(([address]) => address);
}

/**
 * The day's standings, in points.
 *
 * Scoring a wallet costs two multicalls, so this is deliberately bounded: only
 * wallets the chain has seen act today are candidates, ranked by how busy they
 * were, and only the busiest are scored. That keeps a rebuild at about fifty
 * requests — affordable once every few minutes behind the shared cache, and
 * ruinous if it ran per visitor, which is why it is cached rather than live.
 *
 * "Today's" is doing real work in the name: a wallet that did nothing today
 * is not ranked, even though holding quests would score it something.
 */
const LEADERBOARD_TTL_MS = 180_000;
const SCORE_AT_MOST = 60;

let cached: { day: number; at: number; rows: BoardEntry[] } | null = null;
let building: Promise<BoardEntry[]> | null = null;

async function scoreWallets(today: TodayState, day: number): Promise<BoardEntry[]> {
  // Everyone the chain saw act today, plus anyone who swept yesterday: their
  // run is on the line and it should not depend on them opening the page.
  const [yesterdaySweepers, social, snapshots, featured] = await Promise.all([
    sweptOn(day - 1),
    socialVerifiedOn(day),
    readPools(),
    readFeatured(day),
  ]);

  /**
   * The same pool the player's own board was drawn from.
   *
   * Not a detail: the draw walks a weighted stream and redraws against a
   * points budget, so one edited quest in the admin panel moves the whole
   * board for most wallets. Scoring here against the committed default while
   * the page shows the live pool ranks people on five quests they were never
   * given — and since this is what writes the season record, the reward split
   * inherits it.
   */
  const pool = poolOnDay(day, snapshots);

  const candidates = [
    ...new Set([...activeToday(today).slice(0, SCORE_AT_MOST), ...yesterdaySweepers]),
  ];

  const streaks = await priorSweepStreaks(candidates, day);

  const rows = await Promise.all(
    candidates.map(async (address) => {
      try {
        const stats = await readDaily(
          address,
          today.rounds,
          today.startBlock,
          today.spins,
          today.aor,
          today.spinRon,
          today.sales,
          social,
          today.buys,
          today.monkeBuys
        );
        // Each wallet is scored against its own five, not a shared set.
        const score = scoreDay(
          stats,
          day,
          { floorRon: today.floorRon, priorStreak: streaks.get(address) ?? 0 },
          address,
          pool,
          featured
        );
        return {
          address,
          points: score.total,
          done: score.done,
          bonus: score.bonus,
          streak: score.streak,
          actions: score.done,
        };
      } catch {
        return null;
      }
    })
  );

  const scored = rows.filter((row): row is BoardEntry => row !== null && row.points > 0);

  // The season is the sum of its days, and a day is only knowable while it is
  // today — so every rebuild writes what it just worked out.
  await recordMany(day, scored);

  return scored.sort((a, b) => b.points - a.points || b.done - a.done).slice(0, 15);
}

/**
 * Standings, without making the page wait for them.
 *
 * Scoring sixty wallets is a hundred-odd chain reads and takes a good few
 * seconds. Blocking the board on that means the five quests — the actual point
 * of the page — sit behind a spinner for the first visitor of every window.
 * So a stale or absent leaderboard is served immediately and the rebuild runs
 * behind it; the page polls anyway, and picks it up on the next pass.
 */
export function getLeaderboard(today: TodayState): BoardEntry[] {
  const day = dayIndex();
  const fresh = cached?.day === day && Date.now() - cached.at < LEADERBOARD_TTL_MS;

  if (!fresh && !building) {
    building = scoreWallets(today, day)
      .then((rows) => {
        cached = { day, at: Date.now(), rows };
        return rows;
      })
      .catch(() => cached?.rows ?? [])
      .finally(() => {
        building = null;
      });
  }

  return cached?.day === day ? cached.rows : [];
}
