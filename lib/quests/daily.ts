/**
 * Daily quests.
 *
 * Five quests a day, drawn from a pool by a seed that is just the date — so
 * everyone in the Ronkeverse gets the same five, nobody can reroll for an
 * easier set, and the board is reproducible by anyone who reads this file.
 * A new set lands at midnight UTC.
 *
 * The draw is 3 core + 2 bonus rather than 5 at random, so every day has an
 * approachable spine: a player with an empty wallet can always finish most of
 * the board, and the bonus slots are where the real commitments live.
 */

import { TOKENS } from "./contracts";

export const DAY_SECONDS = 86_400;
export const QUESTS_PER_DAY = 5;

/** What a buy has to be worth to count. Keeps a one-RON tap off the board. */
export const MIN_BUY_RON = 10;

/**
 * Ronke Vote runs in seasons — a week or two a month — and the rest of the
 * time the site closes voting. There is no on-chain signal for it: the
 * contract still accepts a vote when the front-end says closed, so the gate
 * has to live here.
 *
 * Add a window when a voting season is announced and the vote quests rejoin
 * the pool for exactly those days. Leave it empty and they never appear.
 * Dates are inclusive-from, exclusive-to, in UTC.
 */
export const VOTE_SEASONS: { from: string; to: string }[] = [
  // { from: "2026-09-01", to: "2026-09-15" },
];

/** Whether a vote season covers a given day index. */
export function voteOpenOn(day: number): boolean {
  const at = day * DAY_SECONDS;
  return VOTE_SEASONS.some(
    ({ from, to }) => at >= Date.parse(`${from}T00:00:00Z`) / 1000 && at < Date.parse(`${to}T00:00:00Z`) / 1000
  );
}

export type QuestGame = "casino" | "gacha" | "vote" | "ronkeverse" | "age-of-ronke" | "social";

/**
 * What a quest actually costs to do. Points follow this, so a quest that asks
 * for a monke off the floor is never worth the same as posting on X.
 */
export type CostTier = "free" | "tokens" | "ron" | "big";

export const COST_LABELS: Record<CostTier, string> = {
  free: "Free",
  tokens: "A few tokens",
  ron: "Costs RON",
  big: "Big ticket",
};

/** Clearing all five in a day pays this on top. */
export const ALL_DONE_BONUS = 400;

export const GAME_LABELS: Record<QuestGame, string> = {
  casino: "Ronke Casino",
  gacha: "Fortune Spin",
  vote: "Ronke Vote",
  ronkeverse: "Ronkeverse",
  "age-of-ronke": "Age of Ronke",
  social: "Out in the world",
};

/** Where each quest sends you, and the art that fronts it. */
export const GAME_LINKS: Record<QuestGame, string> = {
  casino: "https://games.ronkeverse.com",
  gacha:
    "https://marketplace.roninchain.com/fortune-spin?packAddress=0x7962c19767f10df016f1f7154b5fe286e502e023",
  vote: "https://ronke-vote.netlify.app",
  ronkeverse: "https://marketplace.roninchain.com/collections/ronkeverse",
  "age-of-ronke": "https://0x-pewpew.com/lenta/#f9home",
  social: "https://x.com/RonkeOnRon",
};

/**
 * Where a quest sends you when the game's front door is not the right door.
 * Katana's swap for a token buy, the Mines table rather than the casino
 * lobby — a quest that lands you a click away from what it asked for reads as
 * broken even when the scoring is right.
 */
const swapFor = (token: string) =>
  `https://app.roninchain.com/swap?outputCurrency=${token}&inputCurrency=RON`;

export const LINKS = {
  coinflip: "https://games.ronkeverse.com",
  mines: "https://games.ronkeverse.com/mines",
  buyRonke: swapFor(TOKENS.RONKE),
  buyRonkestr: swapFor(TOKENS.RONKESTR),
} as const;

export const GAME_ART: Record<QuestGame, string> = {
  casino: "/ronkemines.png",
  gacha: "/casino-card.webp",
  vote: "/vote-card.webp",
  ronkeverse: "/ronkeverse.png",
  "age-of-ronke": "/age-of-ronke-poster.jpg",
  social: "/ronke-logo.webp",
};

/** Today's numbers for one wallet. Everything resets at midnight UTC. */
export interface DailyStats {
  flips: number;
  flipWins: number;
  minesRounds: number;
  minesCashouts: number;
  minesTables: number;
  minesStakedRon: number;
  votes: number;
  citizens: number;
  monkes: number;
  barracks: number;
  trophies: number;
  /** What today's token gains are worth in RON, priced off the Katana pools.
   *  Denominating in RON is the point: a token minimum drifts as price moves,
   *  a RON minimum does not. */
  ronkeRon: number;
  ronkestrRon: number;
  /** Pulls on the Fortune Spin machine today. */
  spins: number;
  /** Age of Ronke — the play contract names the game, so each has its own quest. */
  aorPlays: number;
  aorPaidPlays: number;
  aorBlocks: number;
  aorPinball: number;
  aorHighStakes: number;
  /** Held every monke they woke up with, and woke up with at least one. */
  heldTheLine: boolean;
  /** The same, for barracks. */
  heldBarracks: boolean;
}

export const EMPTY_DAILY: DailyStats = {
  flips: 0,
  flipWins: 0,
  minesRounds: 0,
  minesCashouts: 0,
  minesTables: 0,
  minesStakedRon: 0,
  votes: 0,
  citizens: 0,
  monkes: 0,
  barracks: 0,
  trophies: 0,
  ronkeRon: 0,
  ronkestrRon: 0,
  spins: 0,
  aorPlays: 0,
  aorPaidPlays: 0,
  aorBlocks: 0,
  aorPinball: 0,
  aorHighStakes: 0,
  heldTheLine: false,
  heldBarracks: false,
};

export interface QuestDef {
  id: string;
  title: string;
  /** One line, written as an instruction. This is the whole explanation. */
  task: string;
  game: QuestGame;
  tier: "core" | "bonus";
  /** Quests sharing a group measure the same thing — only one is drawn a day,
   *  so the board never spends two of its five slots on the same action. */
  group: string;
  target: number;
  points: number;
  /** Roughly what it costs to do — drives the points, and shown on the card so
   *  the weighting is legible rather than arbitrary. */
  cost: CostTier;
  /** Overrides the game's default link when the quest needs a specific door. */
  link?: string;
  /** What the progress meter counts, for quests asking for more than one.
   *  Without it "1 / 2" leaves the player guessing whether it means rounds,
   *  tables or tokens. */
  unit?: string;
  /** "chain" is proved by Ronin. "honour" is the player's own word — used only
   *  for the social slot, and flagged as such on the card. */
  verify?: "chain" | "honour";
  progress: (s: DailyStats) => number;
}

export const POOL: QuestDef[] = [
  // ---- free: costs nothing but showing up ----
  {
    id: "social.shout",
    title: "Spread the word",
    task: "Post about the Ronkeverse on X",
    game: "social",
    tier: "core",
    group: "social",
    cost: "free",
    target: 1,
    points: 50,
    verify: "honour",
    progress: () => 0,
  },
  {
    id: "hold.line",
    title: "Diamond hands",
    task: "Do not sell a single monke today",
    game: "ronkeverse",
    tier: "core",
    group: "hold",
    cost: "free",
    target: 1,
    points: 75,
    progress: (s) => (s.heldTheLine ? 1 : 0),
  },
  {
    id: "hold.barracks",
    title: "Hold the line",
    task: "Do not sell a single barracks today",
    game: "age-of-ronke",
    tier: "core",
    group: "hold-barracks",
    cost: "free",
    target: 1,
    points: 75,
    progress: (s) => (s.heldBarracks ? 1 : 0),
  },
  {
    id: "vote.cast",
    title: "Have your say",
    task: "Cast a vote",
    game: "vote",
    tier: "core",
    group: "vote",
    cost: "free",
    target: 1,
    points: 100,
    progress: (s) => s.votes,
  },

  // ---- a few tokens: Genka's games and a single round at the casino ----
  {
    id: "aor.pinball",
    title: "Tilt the table",
    task: "Play a round of Ronke Pinball",
    game: "age-of-ronke",
    tier: "core",
    group: "aor-pinball",
    cost: "tokens",
    target: 1,
    points: 150,
    progress: (s) => s.aorPinball,
  },
  {
    id: "flip.one",
    title: "Call it in the air",
    task: "Flip a coin",
    game: "casino",
    tier: "core",
    group: "flips",
    cost: "tokens",
    link: LINKS.coinflip,
    target: 1,
    points: 150,
    progress: (s) => s.flips,
  },
  {
    id: "mines.one",
    title: "Into the minefield",
    task: "Play a round of Mines",
    game: "casino",
    tier: "core",
    group: "mines-rounds",
    cost: "tokens",
    link: LINKS.mines,
    target: 1,
    points: 150,
    progress: (s) => s.minesRounds,
  },
  {
    id: "aor.blocks",
    title: "Stack the blocks",
    task: "Play a round of Ronke Blocks",
    game: "age-of-ronke",
    tier: "core",
    group: "aor-blocks",
    cost: "tokens",
    target: 1,
    points: 200,
    progress: (s) => s.aorBlocks,
  },
  {
    id: "mines.cashout",
    title: "Get out clean",
    task: "Cash out of Mines before you hit one",
    game: "casino",
    tier: "core",
    group: "cash-out",
    cost: "tokens",
    link: LINKS.mines,
    target: 1,
    points: 200,
    progress: (s) => s.minesCashouts,
  },
  {
    id: "flip.win",
    title: "Called it right",
    task: "Win a coinflip",
    game: "casino",
    tier: "core",
    group: "flip-wins",
    cost: "tokens",
    link: LINKS.coinflip,
    target: 1,
    points: 225,
    progress: (s) => s.flipWins,
  },
  {
    id: "flip.three",
    title: "Best of three",
    task: "Flip three coins",
    game: "casino",
    tier: "core",
    group: "flips",
    cost: "tokens",
    link: LINKS.coinflip,
    target: 3,
    unit: "flips",
    points: 250,
    progress: (s) => s.flips,
  },
  {
    id: "mines.three",
    title: "Clear the field",
    task: "Play three rounds of Mines",
    game: "casino",
    tier: "core",
    group: "mines-rounds",
    cost: "tokens",
    link: LINKS.mines,
    target: 3,
    unit: "rounds",
    points: 250,
    progress: (s) => s.minesRounds,
  },
  {
    id: "mines.tables",
    title: "Table hopper",
    task: "Play Mines with two different tokens",
    game: "casino",
    tier: "core",
    group: "tables",
    cost: "tokens",
    link: LINKS.mines,
    target: 2,
    unit: "tokens",
    points: 275,
    progress: (s) => s.minesTables,
  },

  // ---- costs RON: a real, unrefundable outlay ----
  {
    id: "aor.highstakes",
    title: "Nice",
    task: "Play Ronke Blocks at the 69 stake",
    game: "age-of-ronke",
    tier: "bonus",
    group: "aor-blocks",
    cost: "ron",
    target: 1,
    points: 300,
    progress: (s) => s.aorHighStakes,
  },
  {
    id: "token.ronke",
    title: "Stack the blue",
    task: `Buy at least ${MIN_BUY_RON} RON of $RONKE`,
    game: "ronkeverse",
    tier: "bonus",
    group: "tokens",
    cost: "ron",
    link: LINKS.buyRonke,
    target: MIN_BUY_RON,
    unit: "RON",
    points: 300,
    progress: (s) => Math.floor(s.ronkeRon),
  },
  {
    id: "mines.stake",
    title: "On the line",
    task: "Bet 10 RON on Mines",
    game: "casino",
    tier: "bonus",
    group: "stake",
    cost: "ron",
    link: LINKS.mines,
    target: 10,
    unit: "RON",
    points: 350,
    progress: (s) => Math.floor(s.minesStakedRon),
  },
  {
    id: "token.ronkestr",
    title: "Feed the machine",
    task: `Buy at least ${MIN_BUY_RON} RON of $RONKESTR`,
    game: "ronkeverse",
    tier: "bonus",
    group: "tokens",
    cost: "ron",
    link: LINKS.buyRonkestr,
    target: MIN_BUY_RON,
    unit: "RON",
    points: 350,
    progress: (s) => Math.floor(s.ronkestrRon),
  },
  {
    id: "gacha.spin",
    title: "Pull the lever",
    task: "Spin the Fortune machine",
    game: "gacha",
    tier: "bonus",
    group: "spin",
    cost: "ron",
    target: 1,
    points: 400,
    progress: (s) => s.spins,
  },
  {
    id: "barracks.take",
    title: "Take a barracks",
    task: "Get a barracks — win one or spin for it",
    game: "age-of-ronke",
    tier: "bonus",
    group: "barracks",
    cost: "ron",
    target: 1,
    points: 400,
    progress: (s) => s.barracks,
  },
  {
    id: "vote.found",
    title: "Found a citizen",
    task: "Found a citizen on Ronke Vote",
    game: "vote",
    tier: "bonus",
    group: "citizen",
    cost: "ron",
    target: 1,
    points: 450,
    progress: (s) => s.citizens,
  },

  // ---- big ticket: the ones that move real money ----
  {
    id: "trophy.claim",
    title: "Claim a trophy",
    task: "Win a PewPew trophy",
    game: "age-of-ronke",
    tier: "bonus",
    group: "trophy",
    cost: "big",
    target: 1,
    points: 500,
    progress: (s) => s.trophies,
  },
  {
    id: "monke.adopt",
    title: "Adopt a monke",
    task: "Buy a Ronkeverse monke",
    game: "ronkeverse",
    tier: "bonus",
    group: "monke",
    cost: "big",
    target: 1,
    points: 600,
    progress: (s) => s.monkes,
  },
];

/* ------------------------------------------------------------ the daily draw */

/** mulberry32 — small, fast, and identical everywhere it runs. */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Neighbouring seeds share a low-entropy first output; burn a few so
  // consecutive days draw genuinely different boards.
  for (let i = 0; i < 12; i++) next();
  return next;
}

function pick(
  items: QuestDef[],
  count: number,
  next: () => number,
  taken: Set<string>
): QuestDef[] {
  const pool = items.filter((q) => !taken.has(q.group));
  const out: QuestDef[] = [];
  while (out.length < count && pool.length > 0) {
    const [chosen] = pool.splice(Math.floor(next() * pool.length), 1);
    taken.add(chosen.group);
    out.push(chosen);
    // Drop anything measuring the same thing.
    for (let i = pool.length - 1; i >= 0; i--) {
      if (taken.has(pool[i].group)) pool.splice(i, 1);
    }
  }
  return out;
}

export function dayIndex(unix: number = Math.floor(Date.now() / 1000)): number {
  return Math.floor(unix / DAY_SECONDS);
}

export function dayStart(unix: number = Math.floor(Date.now() / 1000)): number {
  return dayIndex(unix) * DAY_SECONDS;
}

export function secondsUntilReset(unix: number = Math.floor(Date.now() / 1000)): number {
  return dayStart(unix) + DAY_SECONDS - unix;
}

/**
 * The five quests for a given day. Same five for everyone, everywhere.
 *
 * The shape is fixed even though the picks are not: one free quest, two that
 * cost a few tokens, two that cost real money. The free slot is the important
 * one — without it a run of expensive draws would lock an empty wallet out of
 * the board entirely.
 */
export function questsForDay(day: number = dayIndex()): QuestDef[] {
  const next = rng(day * 2654435761);
  const taken = new Set<string>();

  // Vote quests only exist on days a voting season covers.
  const live = voteOpenOn(day) ? POOL : POOL.filter((q) => q.game !== "vote");

  const free = live.filter((q) => q.cost === "free");
  const cheap = live.filter((q) => q.tier === "core" && q.cost !== "free");
  const paid = live.filter((q) => q.tier === "bonus");

  const chosen = [
    ...pick(free, 1, next, taken),
    ...pick(cheap, 2, next, taken),
    ...pick(paid, 2, next, taken),
  ];

  // Cheapest first, so the board reads as a ramp rather than a wall.
  const order: CostTier[] = ["free", "tokens", "ron", "big"];
  return chosen.sort(
    (a, b) => order.indexOf(a.cost) - order.indexOf(b.cost) || a.points - b.points
  );
}

export interface ScoredQuest extends QuestDef {
  value: number;
  done: boolean;
  href: string;
  art: string;
  gameLabel: string;
}

export interface DailyScore {
  day: number;
  quests: ScoredQuest[];
  done: number;
  /** Points from finished quests, before the clean-sweep bonus. */
  points: number;
  /** Awarded once all five are done. */
  bonus: number;
  /** points + bonus. */
  total: number;
  maxPoints: number;
}

export function scoreDay(stats: DailyStats, day: number = dayIndex()): DailyScore {
  const quests = questsForDay(day).map((quest) => {
    const value = Math.min(quest.progress(stats), quest.target);
    return {
      ...quest,
      value,
      done: value >= quest.target,
      href: quest.link ?? GAME_LINKS[quest.game],
      art: GAME_ART[quest.game],
      gameLabel: GAME_LABELS[quest.game],
    };
  });

  const done = quests.filter((q) => q.done).length;
  const points = quests.filter((q) => q.done).reduce((sum, q) => sum + q.points, 0);
  const bonus = done === QUESTS_PER_DAY ? ALL_DONE_BONUS : 0;

  return {
    day,
    quests,
    done,
    points,
    bonus,
    total: points + bonus,
    maxPoints: quests.reduce((sum, q) => sum + q.points, 0) + ALL_DONE_BONUS,
  };
}
