/**
 * The day's shared chain state, read incrementally.
 *
 * Everything here is identical for every visitor, so it is read once and
 * shared. The first read of a day is the expensive one; after that only the
 * blocks and game ids that are actually new get fetched, which is what keeps
 * the board off the public node's rate limit.
 *
 * That limit is real and it bites: the node caps eth_getLogs at 200 blocks a
 * request, so a naive re-scan of the whole day costs a few hundred requests
 * every refresh. Incremental scanning turns the steady state into about four.
 */

import { blockNumber, getLogsRange, toBigInt } from "./chain";
import { MINES_TABLES, SELECTORS } from "./contracts";
import { callData, multicall, padUint, toAddress, toNumber, words, fromWei } from "./chain";
import { AGE_OF_RONKE, FORTUNE_SPIN } from "./contracts";
import { blockAtSecond, readMinesWindow, type AorPlay, type MinesRound } from "./read";
import { dayIndex, dayStart } from "./daily";

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
  /** Set when the last read failed; the data below is then the last good copy. */
  error: string | null;
}

interface Internal extends TodayState {
  minesCursor: Map<string, number>;
  logBlock: number;
  seeded: boolean;
}

function empty(day: number): Internal {
  return {
    day,
    at: 0,
    startBlock: 0,
    rounds: [],
    spins: new Map(),
    aor: new Map(),
    error: null,
    minesCursor: new Map(),
    logBlock: 0,
    seeded: false,
  };
}

let state: Internal = empty(dayIndex());
let inflight: Promise<void> | null = null;

/* ------------------------------------------------------------------ mines */

/** Reads only the rounds whose ids are newer than the last read. */
async function newRounds(): Promise<MinesRound[]> {
  const counters = await multicall(
    MINES_TABLES.map((t) => ({ target: t.address, data: SELECTORS.gameCounter }))
  );

  const calls: { target: string; data: string; table: string; id: number }[] = [];
  MINES_TABLES.forEach((table, i) => {
    const latest = toNumber(words(counters[i] ?? "0x")[0]);
    const seen = state.minesCursor.get(table.label) ?? latest;
    // Bound the catch-up so a long gap cannot fire an unbounded batch.
    const from = Math.max(seen + 1, latest - 200);
    for (let id = latest; id >= from; id--) {
      calls.push({ target: table.address, data: callData(SELECTORS.games, padUint(id)), table: table.label, id });
    }
    state.minesCursor.set(table.label, latest);
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

/* ------------------------------------------------------------------- logs */

async function scanLogs(from: number, to: number) {
  if (from > to) return;

  const [spinLogs, aorLogs] = await Promise.all([
    getLogsRange(FORTUNE_SPIN.pack, FORTUNE_SPIN.settleTopic, from, to),
    getLogsRange(AGE_OF_RONKE.play, AGE_OF_RONKE.playTopic, from, to),
  ]);

  for (const log of spinLogs) {
    const spinner = toAddress(log.topics[2]?.replace(/^0x/, ""))?.toLowerCase();
    if (!spinner || /^0x0+$/.test(spinner)) continue;
    state.spins.set(spinner, (state.spins.get(spinner) ?? 0) + 1);
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

    const entry = state.aor.get(player) ?? { plays: 0, labels: new Set<string>(), ronkeSpent: 0 };
    entry.plays += 1;
    entry.labels.add(label);
    entry.ronkeSpent += fromWei(toBigInt(w[1]));
    state.aor.set(player, entry);
  }
}

/* ------------------------------------------------------------------ update */

async function refresh() {
  const startBlock = await blockAtSecond(dayStart());
  const head = Number(toBigInt((await blockNumber()).replace(/^0x/, "")));

  if (!state.seeded) {
    // First read of the day: walk the tables back to midnight, then scan the
    // day's logs once. Everything after this is incremental.
    state.rounds = await readMinesWindow(dayStart());
    for (const table of MINES_TABLES) {
      const highest = state.rounds
        .filter((r) => r.table === table.label)
        .reduce((max, r) => Math.max(max, r.id), 0);
      if (highest) state.minesCursor.set(table.label, highest);
    }
    await scanLogs(startBlock, head);
    state.seeded = true;
  } else {
    const fresh = await newRounds();
    if (fresh.length) {
      // A round that comes back again may have changed status (open → cashed
      // out), so replace by id rather than append.
      const byId = new Map(state.rounds.map((r) => [`${r.table}-${r.id}`, r]));
      for (const round of fresh) byId.set(`${round.table}-${round.id}`, round);
      state.rounds = [...byId.values()].sort((a, b) => b.at - a.at);
    }
    await scanLogs(state.logBlock + 1, head);
  }

  state.logBlock = head;
  state.startBlock = startBlock;
  state.at = Date.now();
  state.error = null;
}

/**
 * The day as it stands. `force` is the refresh button: it re-reads anything
 * older than the floor, and returns the last good copy plus an error string if
 * the node refuses.
 */
export async function getToday(force = false): Promise<TodayState> {
  const day = dayIndex();
  if (state.day !== day) state = empty(day);

  const age = state.at === 0 ? Infinity : Date.now() - state.at;
  if (age < (force ? FLOOR_MS : TTL_MS)) return state;

  inflight =
    inflight ??
    refresh().catch((error: unknown) => {
      state.error = error instanceof Error ? error.message : String(error);
      // Never advance the cursors on a failure — the next attempt re-reads the
      // same range rather than skipping over it.
    });

  try {
    await inflight;
  } finally {
    inflight = null;
  }

  return state;
}
