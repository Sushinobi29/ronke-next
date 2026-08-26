/**
 * Quest definitions and the single scoring function.
 *
 * Kept pure and dependency-free on purpose: a leaderboard argument should be
 * settled by reading one file. Two shapes only —
 *
 *   linear  points = min(perUnit * count, cap)
 *   sqrt    points = min(coefficient * sqrt(ronSpent), cap)
 *
 * The square root is what stops spend quests becoming a wallet-size ranking:
 * 10,000x the RON earns 100x the points. Everything else is a cap.
 */

import { FORTUNE_SPIN } from "./contracts";

/**
 * Everything is measured inside the season window. Where a contract only
 * exposes a running total, the season figure is that total now minus the same
 * total read at the season's opening block — so a quest genuinely resets when
 * the season rolls, rather than rewarding history.
 */
export interface WalletStats {
  /** Ronke Casino — coinflips played and won inside the season. */
  coinflipPlays: number;
  coinflipWins: number;
  /** Ronke Casino — Mines rounds inside the season, by round timestamp. */
  minesRounds: number;
  minesCashouts: number;
  minesWagerRon: number;
  /** Ronke Vote — citizens founded this season, and options backed. */
  citizensFounded: number;
  citizens: number;
  maxCitizens: number;
  votedOptions: number;
  /** Collected this season. */
  monkesGained: number;
  barracksGained: number;
  trophiesGained: number;
  /** Standing, right now. `monkesHeldThrough` is the count never sold since
   *  the season opened — the honest reading of diamond hands. */
  monkesHeldThrough: number;
  monkes: number;
  barracks: number;
  trophies: number;
  hasRonke: boolean;
  hasRonkestr: boolean;
}

export const EMPTY_STATS: WalletStats = {
  coinflipPlays: 0,
  coinflipWins: 0,
  minesRounds: 0,
  minesCashouts: 0,
  minesWagerRon: 0,
  citizensFounded: 0,
  citizens: 0,
  maxCitizens: 0,
  votedOptions: 0,
  monkesGained: 0,
  barracksGained: 0,
  trophiesGained: 0,
  monkesHeldThrough: 0,
  monkes: 0,
  barracks: 0,
  trophies: 0,
  hasRonke: false,
  hasRonkestr: false,
};

export type QuestGame = "casino" | "vote" | "ronkeverse" | "age-of-ronke";

/**
 * What window a quest measures. Printed on every card, because the answer is
 * genuinely different per quest: Mines is read by round id so it only covers
 * the recent tail, while Coinflip and Ronke Vote expose lifetime views.
 */
export type QuestScope = "season" | "held";

export const SCOPE_LABELS: Record<QuestScope, string> = {
  season: "This season",
  held: "Standing",
};

export interface QuestDef {
  id: string;
  title: string;
  blurb: string;
  game: QuestGame;
  scope: QuestScope;
  href: string;
  /** What the progress meter counts, e.g. "flips". */
  unit: string;
  /** Count at which the quest is maxed — drives the meter, never the points. */
  target: number;
  cap: number;
  progress: (s: WalletStats) => number;
  score: (s: WalletStats) => number;
}

const GAME_URLS = {
  casino: "https://games.ronkeverse.com",
  mines: "https://games.ronkeverse.com/mines",
  vote: "https://ronke-vote.netlify.app",
  market: "https://marketplace.roninchain.com/collections/ronkeverse",
  aor: "https://0x-pewpew.com/lenta/#f9home",
  spin: FORTUNE_SPIN.url,
} as const;

const linear = (perUnit: number, cap: number) => (count: number) =>
  Math.min(Math.round(perUnit * count), cap);

const sqrtScore = (coefficient: number, cap: number, floor = 2) => (ron: number) =>
  ron < floor ? 0 : Math.min(Math.round(coefficient * Math.sqrt(ron)), cap);

/** How many corners of the Ronkeverse a wallet has a foot in. */
const corners = (s: WalletStats) =>
  [s.monkes > 0, s.barracks > 0, s.trophies > 0, s.hasRonke, s.hasRonkestr].filter(Boolean).length;

export const QUESTS: QuestDef[] = [
  {
    id: "coinflip.plays",
    title: "Call it in the air",
    blurb: "Coinflips played since the season opened. Heads or butt, they all count.",
    game: "casino",
    scope: "season",
    href: GAME_URLS.casino,
    unit: "flips",
    target: 40,
    cap: 320,
    progress: (s) => s.coinflipPlays,
    score: (s) => linear(8, 320)(s.coinflipPlays),
  },
  {
    id: "coinflip.wins",
    title: "Called it right",
    blurb: "The flips that went your way this season. Luck is a quest too.",
    game: "casino",
    scope: "season",
    href: GAME_URLS.casino,
    unit: "wins",
    target: 20,
    cap: 200,
    progress: (s) => s.coinflipWins,
    score: (s) => linear(10, 200)(s.coinflipWins),
  },
  {
    id: "mines.rounds",
    title: "Clear the field",
    blurb: "Rounds opened at any Mines table this season — RON, RONKE, RICE or RONKESTR.",
    game: "casino",
    scope: "season",
    href: GAME_URLS.mines,
    unit: "rounds",
    target: 20,
    cap: 200,
    progress: (s) => s.minesRounds,
    score: (s) => linear(10, 200)(s.minesRounds),
  },
  {
    id: "mines.cashouts",
    title: "Cash out clean",
    blurb: "Rounds you walked away from with a payout instead of a boom.",
    game: "casino",
    scope: "season",
    href: GAME_URLS.mines,
    unit: "cash-outs",
    target: 15,
    cap: 180,
    progress: (s) => s.minesCashouts,
    score: (s) => linear(12, 180)(s.minesCashouts),
  },
  {
    id: "mines.wager",
    title: "High roller",
    blurb: "RON staked at the Mines table this season. Scored on the square root, so size helps but never decides.",
    game: "casino",
    scope: "season",
    href: GAME_URLS.mines,
    unit: "RON staked",
    target: 2500,
    cap: 150,
    progress: (s) => Math.round(s.minesWagerRon),
    score: (s) => sqrtScore(3, 150)(s.minesWagerRon),
  },
  {
    id: "vote.citizens",
    title: "Found a citizen",
    blurb: "Citizens stood up this season. Each locks 11 RON of endowment and votes with ten thousand power — refundable whenever you retire them.",
    game: "vote",
    scope: "season",
    href: GAME_URLS.vote,
    unit: "founded",
    target: 5,
    cap: 300,
    progress: (s) => s.citizensFounded,
    score: (s) => linear(60, 300)(s.citizensFounded),
  },
  {
    id: "vote.spread",
    title: "Have your say",
    blurb: "Back an option in the live vote. All four is the full sweep.",
    game: "vote",
    scope: "season",
    href: GAME_URLS.vote,
    unit: "options backed",
    target: 4,
    cap: 80,
    progress: (s) => s.votedOptions,
    score: (s) => linear(20, 80)(s.votedOptions),
  },
  {
    id: "vote.senate",
    title: "Full senate",
    blurb: "Fill every citizen slot your monkes entitle you to. One monke unlocks one slot, up to fifty.",
    game: "vote",
    scope: "held",
    href: GAME_URLS.vote,
    unit: "slots filled",
    target: 1,
    cap: 100,
    progress: (s) => (s.maxCitizens > 0 && s.citizens >= s.maxCitizens ? 1 : 0),
    score: (s) => (s.maxCitizens > 0 && s.citizens >= s.maxCitizens ? 100 : 0),
  },
  {
    id: "hold.adopt",
    title: "Adopt a monke",
    blurb: "Monkes that joined your wallet this season, from the floor or from a friend.",
    game: "ronkeverse",
    scope: "season",
    href: GAME_URLS.market,
    unit: "adopted",
    target: 4,
    cap: 200,
    progress: (s) => s.monkesGained,
    score: (s) => linear(50, 200)(s.monkesGained),
  },
  {
    id: "hold.diamond",
    title: "Diamond hands",
    blurb: "Monkes you have held unbroken since the season opened. Sell one and this one notices.",
    game: "ronkeverse",
    scope: "held",
    href: GAME_URLS.market,
    unit: "held through",
    target: 20,
    cap: 200,
    progress: (s) => s.monkesHeldThrough,
    score: (s) => linear(10, 200)(s.monkesHeldThrough),
  },
  {
    id: "hold.spread",
    title: "The full set",
    blurb: "A foot in every corner of the Ronkeverse: a monke, a barracks, a trophy, $RONKE and $RONKESTR.",
    game: "ronkeverse",
    scope: "held",
    href: GAME_URLS.market,
    unit: "corners",
    target: 5,
    cap: 125,
    progress: (s) => corners(s),
    score: (s) => linear(25, 125)(corners(s)),
  },
  {
    id: "hold.barracks",
    title: "Storm the barracks",
    blurb: "Barracks earned this season — won in Age of Ronke or pulled out of the Fortune Spin machine.",
    game: "age-of-ronke",
    scope: "season",
    href: GAME_URLS.aor,
    unit: "barracks",
    target: 10,
    cap: 150,
    progress: (s) => s.barracksGained,
    score: (s) => linear(15, 150)(s.barracksGained),
  },
  {
    id: "hold.trophies",
    title: "Trophy shelf",
    blurb: "PewPew trophies claimed this season. You do not buy these, you win them.",
    game: "age-of-ronke",
    scope: "season",
    href: GAME_URLS.spin,
    unit: "trophies",
    target: 4,
    cap: 100,
    progress: (s) => s.trophiesGained,
    score: (s) => linear(25, 100)(s.trophiesGained),
  },
];

export interface ScoredQuest extends Omit<QuestDef, "progress" | "score"> {
  value: number;
  points: number;
  complete: boolean;
}

export interface WalletScore {
  total: number;
  maxTotal: number;
  quests: ScoredQuest[];
}

export function scoreWallet(stats: WalletStats): WalletScore {
  const quests = QUESTS.map((quest) => {
    const value = quest.progress(stats);
    const points = quest.score(stats);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { progress, score, ...rest } = quest;
    return { ...rest, value, points, complete: points >= quest.cap };
  });

  return {
    total: quests.reduce((sum, q) => sum + q.points, 0),
    maxTotal: QUESTS.reduce((sum, q) => sum + q.cap, 0),
    quests,
  };
}

export const GAME_LABELS: Record<QuestGame, string> = {
  casino: "Ronke Casino",
  vote: "Ronke Vote",
  ronkeverse: "Ronkeverse",
  "age-of-ronke": "Age of Ronke",
};

/** Ronke art already shipping in /public, one per quest family. */
export const GAME_ART: Record<QuestGame, { src: string; alt: string }> = {
  casino: { src: "/ronkemines.png", alt: "Ronke at the Mines table" },
  vote: { src: "/vote-card.webp", alt: "Ronke dropping a ballot" },
  ronkeverse: { src: "/ronkeverse.png", alt: "The Ronkeverse collection" },
  "age-of-ronke": { src: "/age-of-ronke-poster.jpg", alt: "The Age of Ronke castle" },
};
