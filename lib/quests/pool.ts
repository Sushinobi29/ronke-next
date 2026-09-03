/**
 * The quest pool as something an admin can change.
 *
 * Two rules make that safe.
 *
 * A pool is dated. Day D uses the newest snapshot effective on or before D,
 * so once D starts its board is settled — an edit saved today is written
 * against tomorrow and cannot reshuffle a board somebody is halfway through,
 * or rewrite what yesterday's quests were after they have been scored.
 *
 * And a pool is checked before it is written. The draw budgets every board to
 * the same worth, which means a badly priced quest does not just look wrong:
 * it can become undrawable, silently, the way adopting a monke did for weeks.
 * So the panel simulates thousands of boards against a proposed pool and says
 * what it would actually do before anybody signs it.
 */

import {
  BASE_POOL,
  QUESTS_PER_DAY,
  ALL_DONE_BONUS,
  drawableOn,
  questsForDay,
  type CostTier,
  type QuestDef,
  type QuestGame,
} from "@/lib/quests/daily";
import { isMetric, metric } from "@/lib/quests/metrics";

export const GAMES: QuestGame[] = [
  "casino",
  "gacha",
  "vote",
  "ronkeverse",
  "age-of-ronke",
  "social",
];
export const COSTS: CostTier[] = ["free", "tokens", "ron", "big"];

export const MAX_POOL = 60;

/* --------------------------------------------------------------- reading */

/** The pool in force on a given day: the newest snapshot dated on or before it. */
export function poolOnDay(
  day: number,
  snapshots: { from: number; pool: QuestDef[] }[]
): QuestDef[] {
  let chosen: QuestDef[] | null = null;
  let best = -Infinity;
  for (const snapshot of snapshots) {
    if (snapshot.from <= day && snapshot.from > best) {
      best = snapshot.from;
      chosen = snapshot.pool;
    }
  }
  return chosen ?? BASE_POOL;
}

/* ------------------------------------------------------------ validation */

export type Sanitized = { ok: true; pool: QuestDef[] } | { ok: false; error: string };

const text = (value: unknown, limit: number): string =>
  String(value ?? "").trim().slice(0, limit);

export function sanitizePool(input: unknown): Sanitized {
  if (!Array.isArray(input)) return { ok: false, error: "A pool has to be a list of quests." };
  if (input.length > MAX_POOL) return { ok: false, error: `At most ${MAX_POOL} quests.` };

  const pool: QuestDef[] = [];
  const seen = new Set<string>();

  for (const raw of input as Partial<QuestDef>[]) {
    const id = text(raw.id, 40);
    if (!/^[a-z0-9]+\.[a-z0-9]+$/.test(id)) {
      return { ok: false, error: `"${id}" is not a quest id — use the form game.thing.` };
    }
    if (seen.has(id)) return { ok: false, error: `Two quests share the id "${id}".` };
    seen.add(id);

    const title = text(raw.title, 40);
    const task = text(raw.task, 120);
    if (!title || !task) return { ok: false, error: `${id} needs a title and a task.` };

    const metricKey = text(raw.metric, 40);
    if (!isMetric(metricKey)) {
      return { ok: false, error: `${id}: "${metricKey}" is not something the site can measure.` };
    }

    const game = GAMES.includes(raw.game as QuestGame) ? (raw.game as QuestGame) : "ronkeverse";
    const cost = COSTS.includes(raw.cost as CostTier) ? (raw.cost as CostTier) : "free";
    const tier = raw.tier === "bonus" ? "bonus" : "core";

    const target = Math.max(1, Math.round(Number(raw.target) || 0));
    const points = Math.round(Number(raw.points) || 0);
    if (points < 25 || points > 5000) {
      return { ok: false, error: `${id}: points have to be between 25 and 5000.` };
    }

    const quest: QuestDef = {
      id,
      title,
      task,
      game,
      tier,
      group: text(raw.group, 40) || id,
      cost,
      metric: metricKey,
      target,
      points,
    };

    const note = text(raw.note, 140);
    if (note) quest.note = note;
    const unit = text(raw.unit, 20) || metric(metricKey)?.unit;
    if (unit && target > 1) quest.unit = unit;
    for (const key of ["link", "art", "copy", "copyLabel"] as const) {
      const value = text(raw[key], 400);
      if (value) quest[key] = value;
    }
    if (quest.link && !/^https?:\/\//.test(quest.link)) {
      return { ok: false, error: `${id}: that link is not an http address.` };
    }
    if (raw.floorLinked) quest.floorLinked = true;
    if (raw.retired) quest.retired = true;

    if (game === "social") {
      const ask = raw.ask ?? { all: [], any: [] };
      const words = (list: unknown) =>
        (Array.isArray(list) ? list : [])
          .map((word) => String(word ?? "").trim())
          .filter(Boolean)
          .slice(0, 12);
      const all = words(ask.all);
      const any = words(ask.any);
      if (!all.length && !any.length) {
        return { ok: false, error: `${id}: a social quest needs words a post must contain.` };
      }
      quest.ask = { all, any };
    }

    pool.push(quest);
  }

  return { ok: true, pool };
}

/* ------------------------------------------------------------- the check */

export interface DrawShare {
  id: string;
  title: string;
  cost: CostTier;
  points: number;
  /** Share of boards this quest lands on, as a percentage. */
  share: number;
}

export interface PoolReport {
  /** Structural problems. The draw cannot run, so the pool cannot be saved. */
  errors: string[];
  /** It would run, but somebody would notice. Saving is allowed. */
  warnings: string[];
  draws: DrawShare[];
  worth: { min: number; median: number; max: number; mean: number };
  /** How far apart two wallets clearing every board end a 14-day season. */
  seasonSpread: number;
  boards: number;
}

const SIM_WALLETS = 160;
const SIM_DAYS = 14;

/**
 * What this pool would actually do. Simulated rather than reasoned about,
 * because the draw is a rejection sampler and the interesting failures are
 * emergent: a quest priced so high that no board containing it can land in
 * budget is perfectly valid on its own and never appears.
 */
export function reportOn(pool: QuestDef[], fromDay: number): PoolReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Eligible over the window being simulated, by the same rule the draw uses.
  const eligible = (quest: QuestDef) => drawableOn(quest, fromDay);
  const live = pool.filter((quest) => !quest.retired);
  const free = live.filter((quest) => quest.cost === "free");
  const cheap = live.filter((quest) => quest.tier === "core" && quest.cost !== "free");
  const paid = live.filter((quest) => quest.tier === "bonus");
  const groups = (list: QuestDef[]) => new Set(list.map((quest) => quest.group)).size;

  // The draw needs one free quest, then either two cheap and two paid or
  // three cheap and one paid — and one quest per group.
  if (!free.length) errors.push("No free quest. An empty wallet could never start a board.");
  if (groups(cheap) < 3) {
    errors.push(`Only ${groups(cheap)} groups of cheap quests; the draw needs 3.`);
  }
  if (groups(paid) < 2) {
    errors.push(`Only ${groups(paid)} groups of paid quests; the draw needs 2.`);
  }
  for (const quest of live) {
    if (!isMetric(quest.metric)) {
      errors.push(`${quest.id} measures "${quest.metric}", which the site cannot read.`);
    }
  }

  if (errors.length) {
    return {
      errors,
      warnings,
      draws: [],
      worth: { min: 0, median: 0, max: 0, mean: 0 },
      seasonSpread: 0,
      boards: 0,
    };
  }

  const counts = new Map<string, number>();
  const worths: number[] = [];
  const seasons: number[] = [];
  let boards = 0;

  for (let w = 0; w < SIM_WALLETS; w++) {
    const wallet = "0x" + (w * 7919 + 13).toString(16).padStart(40, "0");
    let season = 0;
    for (let d = fromDay; d < fromDay + SIM_DAYS; d++) {
      const set = questsForDay(d, wallet, pool);
      boards += 1;
      const worth = set.reduce((sum, quest) => sum + quest.points, 0);
      worths.push(worth);
      season += worth + ALL_DONE_BONUS;
      for (const quest of set) counts.set(quest.id, (counts.get(quest.id) ?? 0) + 1);
      if (set.length < QUESTS_PER_DAY) {
        warnings.push(`Day ${d} could only fill ${set.length} of ${QUESTS_PER_DAY} slots.`);
      }
    }
    seasons.push(season);
  }

  const draws: DrawShare[] = live
    .filter(eligible)
    .map((quest) => ({
      id: quest.id,
      title: quest.title,
      cost: quest.cost,
      points: quest.points,
      share: Number((((counts.get(quest.id) ?? 0) / boards) * 100).toFixed(1)),
    }))
    .sort((a, b) => a.share - b.share);

  const dark = live.filter((quest) => !eligible(quest));
  if (dark.length) {
    warnings.push(
      `${dark.length} quest${dark.length === 1 ? " is" : "s are"} out of season and will not be drawn: ${dark
        .map((quest) => quest.title)
        .join(", ")}.`
    );
  }

  for (const drawn of draws) {
    if (drawn.share === 0) {
      warnings.push(
        `"${drawn.title}" can never be drawn — at ${drawn.points} points no board containing it lands in budget.`
      );
    } else if (drawn.share < 2) {
      warnings.push(`"${drawn.title}" lands on only ${drawn.share}% of boards.`);
    }
  }

  worths.sort((a, b) => a - b);
  const mean = worths.reduce((sum, value) => sum + value, 0) / (worths.length || 1);
  const worth = {
    min: worths[0] ?? 0,
    median: worths[Math.floor(worths.length / 2)] ?? 0,
    max: worths[worths.length - 1] ?? 0,
    mean: Math.round(mean),
  };

  const seasonMean = seasons.reduce((sum, value) => sum + value, 0) / (seasons.length || 1);
  const variance =
    seasons.reduce((sum, value) => sum + (value - seasonMean) ** 2, 0) / (seasons.length || 1);
  const seasonSpread = Number(((Math.sqrt(variance) / (seasonMean || 1)) * 100).toFixed(2));

  if (seasonSpread > 4) {
    warnings.push(
      `Two wallets clearing every board would end a season ${seasonSpread}% apart. Under about 2% is fair.`
    );
  }

  return { errors, warnings, draws, worth, seasonSpread, boards };
}

/**
 * A quest with its optional fields settled, so two forms of the same quest
 * compare equal. Without this a pool that has been through sanitising differs
 * from the one it came from on every quest — and a signing prompt that claims
 * twenty quests changed when one did is worse than no prompt at all.
 */
function canonical(quest: QuestDef): string {
  const entries = Object.entries(quest)
    .filter(([, value]) => value !== undefined && value !== "" && value !== false)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

/** Which named fields actually differ, for a message worth reading. */
function changedFields(before: QuestDef, after: QuestDef): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: string[] = [];
  for (const key of keys) {
    const a = before[key as keyof QuestDef];
    const b = after[key as keyof QuestDef];
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) out.push(key);
  }
  return out.sort();
}

/** The line the admin signs: what changed, not the whole pool. */
export function poolMessage(
  pool: QuestDef[],
  previous: QuestDef[],
  from: number,
  address: string,
  issuedAt: string
): string {
  const was = new Map(previous.map((quest) => [quest.id, quest]));
  const now = new Map(pool.map((quest) => [quest.id, quest]));
  const lines: string[] = [];

  for (const quest of pool) {
    const before = was.get(quest.id);
    if (!before) {
      lines.push(`+ added ${quest.id} "${quest.title}" — ${quest.points} pts, ${quest.cost}`);
      continue;
    }
    if (canonical(before) === canonical(quest)) continue;

    if (quest.retired && !before.retired) {
      lines.push(`- retired ${quest.id} "${quest.title}"`);
    } else if (before.retired && !quest.retired) {
      lines.push(`+ brought back ${quest.id} "${quest.title}"`);
    } else if (before.points !== quest.points || before.target !== quest.target) {
      const moved = [
        before.points !== quest.points ? `${before.points} → ${quest.points} pts` : "",
        before.target !== quest.target ? `target ${before.target} → ${quest.target}` : "",
      ].filter(Boolean);
      lines.push(`~ ${quest.id}: ${moved.join(", ")}`);
    } else {
      lines.push(`~ ${quest.id}: ${changedFields(before, quest).join(", ")}`);
    }
  }
  for (const quest of previous) {
    if (!now.has(quest.id)) lines.push(`- removed ${quest.id} "${quest.title}"`);
  }

  return [
    "Ronke Quest — quest pool",
    "",
    `Wallet: ${address.toLowerCase()}`,
    `Issued: ${issuedAt}`,
    `In force from day ${from}`,
    `Quests: ${pool.filter((quest) => !quest.retired).length} live of ${pool.length}`,
    "",
    lines.length ? lines.join("\n") : "- no changes",
  ].join("\n");
}

/* ------------------------------------------------- wording, applied today */

/**
 * The fields the draw can see. Everything else is what a quest says, not what
 * it is, and changing it cannot move a single board.
 */
const STRUCTURAL: (keyof QuestDef)[] = [
  "id",
  "game",
  "tier",
  "group",
  "cost",
  "metric",
  "target",
  "points",
  "floorLinked",
  "retired",
];

const WORDING: (keyof QuestDef)[] = [
  "title",
  "task",
  "note",
  "unit",
  "link",
  "art",
  "copy",
  "copyLabel",
  "ask",
];

export const structureOf = (pool: QuestDef[]) =>
  JSON.stringify(pool.map((quest) => STRUCTURAL.map((key) => quest[key] ?? null)));

/**
 * Today's pool with today's wording replaced by the edit.
 *
 * A change to what a quest is has to wait for the next reset — it moves the
 * draw, and boards in progress are not up for renegotiation. A change to what
 * a quest says has no such problem, and making people live with a wrong link
 * or a confusing note until midnight for the sake of a rule that does not
 * apply to it would be pedantry. So a save lands in both places, and the split
 * is decided by the fields themselves rather than by anyone's judgement.
 */
export function mergeWording(live: QuestDef[], edited: QuestDef[]): QuestDef[] {
  const words = new Map(edited.map((quest) => [quest.id, quest]));
  return live.map((quest) => {
    const from = words.get(quest.id);
    if (!from) return quest;
    const next = { ...quest };
    for (const key of WORDING) {
      if (from[key] === undefined) delete (next as Record<string, unknown>)[key];
      else (next as Record<string, unknown>)[key] = from[key];
    }
    return next;
  });
}
