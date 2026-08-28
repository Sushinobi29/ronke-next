/**
 * Reads season quest state straight off Ronin. No database, no indexer.
 *
 * Two tricks make a season window possible without either:
 *
 *   1. The Mines contracts expose `gameCounter()` and `games(id)`, and every
 *      round carries its own timestamp — so a season's rounds are readable by
 *      id, walking back until the timestamps fall out of the window. That
 *      matters because the public Ronin node caps `eth_getLogs` at 200 blocks.
 *   2. Everything else is a running total, and `eth_call` takes a block. Read
 *      the same view at the season's opening block, subtract, and you have the
 *      season's delta — flips played, citizens founded, monkes adopted.
 */

import {
  CASINO,
  COLLECTIONS,
  POOLS,
  FORTUNE_SPIN,
  MINES_STATUS,
  MINES_TABLES,
  SELECTORS,
  TOKENS,
  VOTE,
} from "./contracts";
import {
  blockAtTimestamp,
  callData,
  ethCall,
  fromWei,
  getBalance,
  multicall,
  padAddress,
  padUint,
  toAddress,
  toBigInt,
  toNumber,
  words,
} from "./chain";
import { EMPTY_DAILY, type DailyStats } from "./daily";
import { seasonAt, type Season } from "./season";

/** Rounds read per table per page, and the most pages we will walk back. */
const PAGE = 150;
const MAX_PAGES = 4;

export interface MinesRound {
  table: string;
  id: number;
  at: number;
  player: string;
  bet: number;
  status: number;
  payout: number;
}

export interface SeasonSnapshot {
  season: Season;
  startBlock: number;
  minesLifetime: number;
  minesThisSeason: number;
  minesByTable: { label: string; lifetime: number }[];
  voteSeason: number;
  voteTotal: number;
  votePlayers: number;
  votePool: number;
  spinPot: number;
  topVoters: { address: string; votes: number }[];
}

/* ------------------------------------------------------------ mines window */

/**
 * Walks each Mines table back from its newest round until the timestamps drop
 * out of the season, or the page budget runs out. Returns newest first.
 */
export async function readMinesWindow(since: number): Promise<MinesRound[]> {
  const counters = await multicall(
    MINES_TABLES.map((t) => ({ target: t.address, data: SELECTORS.gameCounter }))
  );

  const cursors = MINES_TABLES.map((table, i) => ({
    table: table.label,
    address: table.address,
    next: toNumber(words(counters[i] ?? "0x")[0]),
    done: false,
  }));

  const rounds: MinesRound[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const live = cursors.filter((c) => !c.done && c.next >= 1);
    if (live.length === 0) break;

    const calls: { target: string; data: string; table: string; id: number }[] = [];
    for (const cursor of live) {
      const first = Math.max(1, cursor.next - PAGE + 1);
      for (let id = cursor.next; id >= first; id--) {
        calls.push({
          target: cursor.address,
          data: callData(SELECTORS.games, padUint(id)),
          table: cursor.table,
          id,
        });
      }
      cursor.next = first - 1;
    }

    const results = await multicall(calls.map(({ target, data }) => ({ target, data })));
    const oldestSeen = new Map<string, number>();

    results.forEach((result, i) => {
      if (!result) return;
      const w = words(result);
      const player = toAddress(w[1]);
      if (/^0x0+$/.test(player)) return;
      const at = toNumber(w[0]);
      const table = calls[i].table;
      oldestSeen.set(table, Math.min(oldestSeen.get(table) ?? at, at));
      if (at < since) return;
      rounds.push({
        table,
        id: calls[i].id,
        at,
        player,
        bet: fromWei(toBigInt(w[2])),
        status: toNumber(w[3]),
        payout: fromWei(toBigInt(w[4])),
      });
    });

    // A table is finished once its oldest round in this page predates the season.
    for (const cursor of live) {
      const oldest = oldestSeen.get(cursor.table);
      if (oldest === undefined || oldest < since) cursor.done = true;
    }
  }

  return rounds.sort((a, b) => b.at - a.at);
}

/* ------------------------------------------------------------------ season */

export async function readSeason(rounds: MinesRound[], startBlock: number): Promise<SeasonSnapshot> {
  const [batch, packBalance] = await Promise.all([
    multicall([
      { target: VOTE.current, data: SELECTORS.stats },
      { target: VOTE.current, data: SELECTORS.getTop20 },
      ...MINES_TABLES.map((t) => ({ target: t.address, data: SELECTORS.gameCounter })),
    ]),
    getBalance(FORTUNE_SPIN.pack).catch(() => "0x0"),
  ]);

  const statsWords = words(batch[0] ?? "0x");
  const topWords = words(batch[1] ?? "0x");

  const topVoters: { address: string; votes: number }[] = [];
  if (topWords.length >= 40) {
    for (let i = 0; i < 20; i++) {
      const address = toAddress(topWords[i]);
      const votes = toNumber(topWords[20 + i]);
      if (/^0x0+$/.test(address) || votes === 0) continue;
      topVoters.push({ address, votes });
    }
  }

  const minesByTable = MINES_TABLES.map((table, i) => ({
    label: table.label,
    lifetime: toNumber(words(batch[2 + i] ?? "0x")[0]),
  }));

  return {
    season: seasonAt(),
    startBlock,
    minesLifetime: minesByTable.reduce((sum, t) => sum + t.lifetime, 0),
    minesThisSeason: rounds.length,
    minesByTable,
    voteSeason: toNumber(statsWords[0]),
    voteTotal: toNumber(statsWords[1]),
    votePlayers: toNumber(statsWords[2]),
    votePool: fromWei(toBigInt(statsWords[3])),
    spinPot: fromWei(BigInt(packBalance || "0x0")),
    topVoters,
  };
}

/** The block the current season opened at. */
export function seasonStartBlock(season: Season): Promise<number> {
  return blockAtSecond(season.startsAt);
}

/* ------------------------------------------------------------------- daily */

/**
 * One wallet's day. Two multicalls: every running total as it stands now, and
 * the same totals at the block the day opened. The difference is what they did
 * today — which is the whole trick that lets a daily board exist with no
 * database behind it.
 */
export async function readDaily(
  address: string,
  roundsToday: MinesRound[],
  dayStartBlock: number,
  spinsToday: Map<string, number> = new Map(),
  aorToday: Map<string, AorPlay> = new Map()
): Promise<DailyStats> {
  const who = padAddress(address);
  const balanceOf = (target: string) => ({ target, data: callData(SELECTORS.balanceOf, who) });

  const calls = [
    { target: CASINO.coinflip, data: callData(SELECTORS.playHistory, who) },
    { target: VOTE.current, data: callData(SELECTORS.getPlayerVotes, who) },
    { target: VOTE.current, data: callData(SELECTORS.activeCitizenCount, who) },
    balanceOf(COLLECTIONS.ronkeverse),
    balanceOf(COLLECTIONS.barracks),
    balanceOf(COLLECTIONS.trophies),
    balanceOf(TOKENS.RONKE),
    balanceOf(TOKENS.RONKESTR),
    { target: POOLS.ronke.address, data: SELECTORS.getReserves },
    { target: POOLS.ronkestr.address, data: SELECTORS.getReserves },
  ];

  const [now, then] = await Promise.all([
    multicall(calls),
    multicall(calls, 200, "0x" + dayStartBlock.toString(16)).catch(() => calls.map(() => null)),
  ]);

  const word = (source: (string | null)[], index: number, at = 0) =>
    toNumber(words(source[index] ?? "0x")[at]);

  // A historical read the node cannot serve is treated as "the day opened at
  // your current total" — that shows zero progress rather than inventing any.
  const openedAt = (index: number, at = 0) =>
    then[index] ? toNumber(words(then[index]!)[at]) : word(now, index, at);

  const gained = (index: number, at = 0) => Math.max(0, word(now, index, at) - openedAt(index, at));

  const aor = aorToday.get(address.toLowerCase());
  const labels = [...(aor?.labels ?? [])];
  const paidLabels = labels.filter((l) => l !== "freeplay");

  const mine = roundsToday.filter((r) => r.player.toLowerCase() === address.toLowerCase());
  const monkesNow = word(now, 3);
  const monkesAtOpen = openedAt(3);

  const tokenGain = (index: number) => {
    const before = then[index] ? toBigInt(words(then[index]!)[0]) : toBigInt(words(now[index] ?? "0x")[0]);
    const after = toBigInt(words(now[index] ?? "0x")[0]);
    return after > before ? fromWei(after - before) : 0;
  };

  /**
   * RON per token, from the pair's reserves. Buys route through an aggregator
   * whose address is what the Swap event records, so the swap itself cannot be
   * attributed to a player without a transaction lookup per swap — pricing the
   * balance delta instead costs one call per pool and needs no log scanning.
   */
  const ronPerToken = (index: number, wronIsToken0: boolean) => {
    const w = words(now[index] ?? "0x");
    if (w.length < 2) return 0;
    const reserve0 = fromWei(toBigInt(w[0]));
    const reserve1 = fromWei(toBigInt(w[1]));
    const [wron, token] = wronIsToken0 ? [reserve0, reserve1] : [reserve1, reserve0];
    return token > 0 ? wron / token : 0;
  };

  return {
    ...EMPTY_DAILY,
    flips: gained(0, 0),
    flipWins: gained(0, 1),
    minesRounds: mine.length,
    minesCashouts: mine.filter((r) => r.status === MINES_STATUS.CASHED_OUT).length,
    minesTables: new Set(mine.map((r) => r.table)).size,
    minesStakedRon: mine.filter((r) => r.table === "RON").reduce((sum, r) => sum + r.bet, 0),
    votes: gained(1, 0),
    citizens: gained(2),
    monkes: Math.max(0, monkesNow - monkesAtOpen),
    barracks: gained(4),
    trophies: gained(5),
    ronkeRon: tokenGain(6) * ronPerToken(8, POOLS.ronke.wronIsToken0),
    ronkestrRon: tokenGain(7) * ronPerToken(9, POOLS.ronkestr.wronIsToken0),
    spins: spinsToday.get(address.toLowerCase()) ?? 0,
    aorPlays: aor?.plays ?? 0,
    aorPaidPlays: paidLabels.length,
    aorBlocks: labels.filter((l) => l.startsWith("blocks")).length,
    aorPinball: labels.filter((l) => l === "pinball").length,
    aorHighStakes: labels.filter((l) => l === "blocks_69").length,
    heldTheLine: monkesAtOpen > 0 && monkesNow >= monkesAtOpen,
    heldBarracks: openedAt(4) > 0 && word(now, 4) >= openedAt(4),
  };
}

/** What one wallet did at Age of Ronke today. */
export interface AorPlay {
  plays: number;
  labels: Set<string>;
  ronkeSpent: number;
}

/** The block a given wall-clock second maps to. Cached per key. */
const blockCache = new Map<number, number>();

export async function blockAtSecond(second: number): Promise<number> {
  const hit = blockCache.get(second);
  if (hit !== undefined) return hit;
  const block = await blockAtTimestamp(second);
  blockCache.set(second, block);
  return block;
}

/* -------------------------------------------------------------- live board */

export interface BoardEntry {
  address: string;
  rounds: number;
  cashouts: number;
  wagered: number;
  best: number;
}

/** Ranks the wallets that played this season, busiest first. */
export function buildBoard(rounds: MinesRound[], limit = 25): BoardEntry[] {
  const by = new Map<string, BoardEntry>();
  for (const round of rounds) {
    const key = round.player.toLowerCase();
    const entry = by.get(key) ?? {
      address: round.player,
      rounds: 0,
      cashouts: 0,
      wagered: 0,
      best: 0,
    };
    entry.rounds += 1;
    if (round.status === MINES_STATUS.CASHED_OUT) entry.cashouts += 1;
    if (round.table === "RON") entry.wagered += round.bet;
    entry.best = Math.max(entry.best, round.payout);
    by.set(key, entry);
  }
  return [...by.values()]
    .sort((a, b) => b.rounds - a.rounds || b.wagered - a.wagered)
    .slice(0, limit);
}

export function isAddress(value: string | null): value is string {
  return !!value && /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

/** Reads the live implementation behind the Fortune Spin beacon proxy. */
export async function readSpinImplementation(): Promise<string | null> {
  try {
    return toAddress(words(await ethCall(FORTUNE_SPIN.beacon, "0x5c60da1b"))[0]);
  } catch {
    return null;
  }
}
