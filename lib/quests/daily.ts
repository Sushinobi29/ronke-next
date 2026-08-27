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

export const DAY_SECONDS = 86_400;
export const QUESTS_PER_DAY = 5;

export type QuestGame = "casino" | "gacha" | "vote" | "ronkeverse" | "age-of-ronke" | "social";

/** Clearing all five in a day pays this on top. */
export const ALL_DONE_BONUS = 250;

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
  /** Whole tokens added to the bag today. */
  ronkeGained: number;
  ronkestrGained: number;
  /** Pulls on the Fortune Spin machine today. */
  spins: number;
  /** Held every monke they woke up with, and woke up with at least one. */
  heldTheLine: boolean;
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
  ronkeGained: 0,
  ronkestrGained: 0,
  spins: 0,
  heldTheLine: false,
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
  /** "chain" is proved by Ronin. "honour" is the player's own word — used only
   *  for the social slot, and flagged as such on the card. */
  verify?: "chain" | "honour";
  progress: (s: DailyStats) => number;
}

export const POOL: QuestDef[] = [
  // ---- core: reachable with what most wallets already have ----
  {
    id: "flip.one",
    title: "Call it in the air",
    task: "Play one coinflip",
    game: "casino",
    tier: "core",
    group: "flips",
    target: 1,
    points: 100,
    progress: (s) => s.flips,
  },
  {
    id: "flip.three",
    title: "Best of three",
    task: "Play three coinflips",
    game: "casino",
    tier: "core",
    group: "flips",
    target: 3,
    points: 150,
    progress: (s) => s.flips,
  },
  {
    id: "flip.win",
    title: "Called it right",
    task: "Win a coinflip",
    game: "casino",
    tier: "core",
    group: "flip-wins",
    target: 1,
    points: 150,
    progress: (s) => s.flipWins,
  },
  {
    id: "mines.one",
    title: "Step on the field",
    task: "Open one Mines round",
    game: "casino",
    tier: "core",
    group: "mines-rounds",
    target: 1,
    points: 100,
    progress: (s) => s.minesRounds,
  },
  {
    id: "mines.three",
    title: "Clear the field",
    task: "Open three Mines rounds",
    game: "casino",
    tier: "core",
    group: "mines-rounds",
    target: 3,
    points: 150,
    progress: (s) => s.minesRounds,
  },
  {
    id: "mines.cashout",
    title: "Out clean",
    task: "Cash out of a Mines round",
    game: "casino",
    tier: "core",
    group: "cash-out",
    target: 1,
    points: 150,
    progress: (s) => s.minesCashouts,
  },
  {
    id: "mines.tables",
    title: "Table hopper",
    task: "Play two different Mines tables",
    game: "casino",
    tier: "core",
    group: "tables",
    target: 2,
    points: 200,
    progress: (s) => s.minesTables,
  },
  {
    id: "vote.cast",
    title: "Have your say",
    task: "Back an option in the live vote",
    game: "vote",
    tier: "core",
    group: "vote",
    target: 1,
    points: 100,
    progress: (s) => s.votes,
  },
  {
    id: "hold.line",
    title: "Diamond hands",
    task: "Still hold every monke you woke up with",
    game: "ronkeverse",
    tier: "core",
    group: "hold",
    target: 1,
    points: 100,
    progress: (s) => (s.heldTheLine ? 1 : 0),
  },

  // ---- bonus: a real commitment, worth real points ----
  {
    id: "mines.stake",
    title: "On the line",
    task: "Stake 10 RON at the Mines tables",
    game: "casino",
    tier: "bonus",
    group: "stake",
    target: 10,
    points: 200,
    progress: (s) => Math.floor(s.minesStakedRon),
  },
  {
    id: "vote.found",
    title: "Found a citizen",
    task: "Stand up a citizen on Ronke Vote",
    game: "vote",
    tier: "bonus",
    group: "citizen",
    target: 1,
    points: 250,
    progress: (s) => s.citizens,
  },
  {
    id: "monke.adopt",
    title: "Adopt a monke",
    task: "Bring home a Ronkeverse monke",
    game: "ronkeverse",
    tier: "bonus",
    group: "monke",
    target: 1,
    points: 250,
    progress: (s) => s.monkes,
  },
  {
    id: "barracks.take",
    title: "Take a barracks",
    task: "Win a barracks in game or from the spin machine",
    game: "age-of-ronke",
    tier: "bonus",
    group: "barracks",
    target: 1,
    points: 200,
    progress: (s) => s.barracks,
  },
  {
    id: "trophy.claim",
    title: "Claim a trophy",
    task: "Add a PewPew trophy to the shelf",
    game: "age-of-ronke",
    tier: "bonus",
    group: "trophy",
    target: 1,
    points: 250,
    progress: (s) => s.trophies,
  },
  {
    id: "gacha.spin",
    title: "Pull the lever",
    task: "Spin the Fortune Spin machine",
    game: "gacha",
    tier: "bonus",
    group: "spin",
    target: 1,
    points: 250,
    progress: (s) => s.spins,
  },
  {
    id: "token.ronke",
    title: "Stack the blue",
    task: "Add $RONKE to your bag",
    game: "ronkeverse",
    tier: "bonus",
    group: "tokens",
    target: 1,
    points: 200,
    progress: (s) => (s.ronkeGained >= 1 ? 1 : 0),
  },
  {
    id: "token.ronkestr",
    title: "Feed the machine",
    task: "Add $RONKESTR to your bag",
    game: "ronkeverse",
    tier: "bonus",
    group: "tokens",
    target: 1,
    points: 200,
    progress: (s) => (s.ronkestrGained >= 1 ? 1 : 0),
  },
  {
    id: "social.shout",
    title: "Spread the word",
    task: "Post about the Ronkeverse on X",
    game: "social",
    tier: "core",
    group: "social",
    target: 1,
    points: 100,
    verify: "honour",
    progress: () => 0,
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

/** The five quests for a given day. Same five for everyone, everywhere. */
export function questsForDay(day: number = dayIndex()): QuestDef[] {
  const next = rng(day * 2654435761);
  const taken = new Set<string>();
  const core = POOL.filter((q) => q.tier === "core");
  const bonus = POOL.filter((q) => q.tier === "bonus");
  const chosen = [...pick(core, 3, next, taken), ...pick(bonus, 2, next, taken)];
  // Keep a stable on-screen order regardless of draw order.
  return chosen.sort((a, b) => POOL.indexOf(a) - POOL.indexOf(b));
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
      href: GAME_LINKS[quest.game],
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
