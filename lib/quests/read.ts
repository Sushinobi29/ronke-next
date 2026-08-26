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
import { EMPTY_STATS, type WalletStats } from "./scoring";
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

/** The block the current season opened at. Cached — it only moves once a season. */
let startBlockCache: { season: number; block: number } | null = null;

export async function seasonStartBlock(season: Season): Promise<number> {
  if (startBlockCache?.season === season.number) return startBlockCache.block;
  const block = await blockAtTimestamp(season.startsAt);
  startBlockCache = { season: season.number, block };
  return block;
}

/* ------------------------------------------------------------------ wallet */

export async function readWallet(
  address: string,
  rounds: MinesRound[],
  startBlock: number
): Promise<WalletStats> {
  const who = padAddress(address);
  const balanceOf = (target: string) => ({ target, data: callData(SELECTORS.balanceOf, who) });

  const nowCalls = [
    { target: CASINO.coinflip, data: callData(SELECTORS.playHistory, who) },
    { target: VOTE.current, data: callData(SELECTORS.activeCitizenCount, who) },
    { target: VOTE.current, data: callData(SELECTORS.maxCitizensFor, who) },
    { target: VOTE.current, data: callData(SELECTORS.getPlayerVotes, who) },
    balanceOf(COLLECTIONS.ronkeverse),
    balanceOf(COLLECTIONS.barracks),
    balanceOf(COLLECTIONS.trophies),
    balanceOf(TOKENS.RONKE),
    balanceOf(TOKENS.RONKESTR),
  ];

  // The same running totals, read at the block the season opened.
  const thenCalls = [
    { target: CASINO.coinflip, data: callData(SELECTORS.playHistory, who) },
    { target: VOTE.current, data: callData(SELECTORS.activeCitizenCount, who) },
    balanceOf(COLLECTIONS.ronkeverse),
    balanceOf(COLLECTIONS.barracks),
    balanceOf(COLLECTIONS.trophies),
  ];

  const [now, then] = await Promise.all([
    multicall(nowCalls),
    multicall(thenCalls, 200, "0x" + startBlock.toString(16)).catch(() => thenCalls.map(() => null)),
  ]);

  const num = (source: (string | null)[], index: number, word = 0) =>
    toNumber(words(source[index] ?? "0x")[word]);

  const history = words(now[0] ?? "0x");
  const playerVotes = words(now[3] ?? "0x");
  // getPlayerVotes returns (total, uint256[4] perOption) — the fixed-size array
  // is inlined, so the four options follow the total directly.
  const votedOptions = playerVotes.slice(1, 5).filter((w) => toBigInt(w) > BigInt(0)).length;

  const monkes = num(now, 4);
  const barracks = num(now, 5);
  const trophies = num(now, 6);

  // A missing historical read means the node could not serve that block; fall
  // back to treating the season as opening at the current total, which shows
  // zero progress rather than inventing any.
  const hadFlips = then[0] ? toNumber(words(then[0])[0]) : toNumber(history[0]);
  const hadWins = then[0] ? toNumber(words(then[0])[1]) : toNumber(history[1]);
  const hadCitizens = then[1] ? num(then, 1) : num(now, 1);
  const hadMonkes = then[2] ? num(then, 2) : monkes;
  const hadBarracks = then[3] ? num(then, 3) : barracks;
  const hadTrophies = then[4] ? num(then, 4) : trophies;

  const mine = rounds.filter((r) => r.player.toLowerCase() === address.toLowerCase());
  const positive = (value: number) => Math.max(0, value);

  return {
    ...EMPTY_STATS,
    coinflipPlays: positive(toNumber(history[0]) - hadFlips),
    coinflipWins: positive(toNumber(history[1]) - hadWins),
    minesRounds: mine.length,
    minesCashouts: mine.filter((r) => r.status === MINES_STATUS.CASHED_OUT).length,
    minesWagerRon: mine.filter((r) => r.table === "RON").reduce((sum, r) => sum + r.bet, 0),
    citizensFounded: positive(num(now, 1) - hadCitizens),
    citizens: num(now, 1),
    maxCitizens: num(now, 2),
    votedOptions,
    monkesGained: positive(monkes - hadMonkes),
    barracksGained: positive(barracks - hadBarracks),
    trophiesGained: positive(trophies - hadTrophies),
    monkesHeldThrough: Math.min(monkes, hadMonkes),
    monkes,
    barracks,
    trophies,
    hasRonke: toBigInt(words(now[7] ?? "0x")[0]) > BigInt(0),
    hasRonkestr: toBigInt(words(now[8] ?? "0x")[0]) > BigInt(0),
  };
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
