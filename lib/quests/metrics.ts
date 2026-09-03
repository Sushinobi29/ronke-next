/**
 * What a quest can be measured by.
 *
 * A quest stored as data cannot carry a function, so it names a metric
 * instead and the code holds the readings. That limit is the honest one: an
 * admin can add a quest that counts coinflips or RON spent on monkes without
 * a deploy, because those readings already exist — but a genuinely new kind
 * of check needs somebody to go and read a new contract, which is code.
 *
 * Whether a reading comes from event logs lives here rather than on the quest.
 * It is a property of how the number is obtained, and a quest that inherits it
 * cannot get it wrong — which is the bug that put "reading today's history" on
 * three quests answered from balances.
 */

import type { DailyStats } from "@/lib/quests/daily";

export type MetricKind = "count" | "ron" | "flag";

export interface Metric {
  key: keyof DailyStats;
  /** How the panel describes it. */
  label: string;
  kind: MetricKind;
  /** Shown after the number on the progress bar. */
  unit?: string;
  /** Read from event logs, so it is still catching up early in the day. */
  needsLogs?: boolean;
}

export const METRICS: Metric[] = [
  { key: "flips", label: "Coinflips played", kind: "count", unit: "flips" },
  { key: "flipWins", label: "Coinflips won", kind: "count", unit: "wins" },
  { key: "minesRounds", label: "Mines rounds played", kind: "count", unit: "rounds" },
  { key: "minesCashouts", label: "Mines rounds cashed out", kind: "count", unit: "cashouts" },
  { key: "minesTables", label: "Different Mines tables played", kind: "count", unit: "tables" },
  { key: "minesStakedRon", label: "RON staked on Mines", kind: "ron", unit: "RON" },
  { key: "votes", label: "Votes cast", kind: "count", unit: "votes" },
  { key: "citizens", label: "Citizens founded", kind: "count", unit: "citizens" },
  { key: "barracks", label: "Barracks gained", kind: "count", unit: "barracks" },
  { key: "trophies", label: "Trophies claimed", kind: "count", unit: "trophies" },
  { key: "monkes", label: "Monkes gained", kind: "count", unit: "monkes" },
  { key: "ronkeRon", label: "RON spent on $RONKE", kind: "ron", unit: "RON" },
  { key: "ronkestrRon", label: "RON spent on $RONKESTR", kind: "ron", unit: "RON" },
  { key: "monkeRon", label: "RON spent on monkes", kind: "ron", unit: "RON" },
  { key: "spins", label: "Fortune spins", kind: "count", unit: "spins", needsLogs: true },
  { key: "spinRon", label: "RON spent on Fortune spins", kind: "ron", unit: "RON", needsLogs: true },
  { key: "aorPlays", label: "Age of Ronke games played", kind: "count", unit: "games", needsLogs: true },
  { key: "aorBlocks", label: "Ronke Blocks played", kind: "count", unit: "games", needsLogs: true },
  { key: "aorPinball", label: "Ronke Pinball played", kind: "count", unit: "games", needsLogs: true },
  { key: "aorHighStakes", label: "Age of Ronke at the 69 stake", kind: "count", unit: "games", needsLogs: true },
  { key: "socialVerified", label: "Posted on X today", kind: "flag" },
  { key: "heldTheLine", label: "Sold no monke today", kind: "flag" },
];

const BY_KEY = new Map(METRICS.map((metric) => [metric.key as string, metric]));

export const metric = (key: string): Metric | undefined => BY_KEY.get(key);

export const isMetric = (key: string): key is keyof DailyStats => BY_KEY.has(key);

/**
 * The reading itself. A flag is one or nothing; RON is floored, because a
 * threshold of 100 should not be met by 99.6.
 */
export function readMetric(key: string, stats: DailyStats): number {
  const found = BY_KEY.get(key);
  if (!found) return 0;
  const raw = stats[found.key];
  if (found.kind === "flag") return raw ? 1 : 0;
  if (found.kind === "ron") return Math.floor(Number(raw) || 0);
  return Number(raw) || 0;
}
