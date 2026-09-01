/**
 * Season rewards.
 *
 * A season pays out a pool — so many tokens, so many NFTs — split down the
 * leaderboard. Two things make that harder than a division:
 *
 *   1. NFTs come in whole units. Ten of them across twenty-five wallets is not
 *      a proportion, it is an allocation, and naive rounding either hands out
 *      eleven or nine.
 *   2. Whatever the split, the parts have to add back up to the pool exactly.
 *      Dust in either direction is someone's money.
 *
 * Both are the same problem, and largest-remainder solves it once: work in
 * whole units of the smallest amount an item can be paid in, floor everyone's
 * exact share, then hand the leftover units to whoever was rounded down
 * hardest. NFTs are simply an item whose smallest unit is one.
 *
 * The weights themselves are the part the admin tunes, and the panel previews
 * the result against the live standings before any of it is written.
 */

export interface SeasonRow {
  address: string;
  points: number;
  days: number;
  sweeps: number;
}

export type RewardKind = "token" | "nft";
/** Share of the pool by points earned, or by finishing position alone. */
export type RewardMode = "points" | "rank";

export interface RewardItem {
  id: string;
  label: string;
  kind: RewardKind;
  /** The whole pool for this item, across everyone. */
  amount: number;
  /** Decimal places this item can be paid in. NFTs are 0 and stay 0. */
  precision: number;
  /** How far down the board it reaches. */
  topN: number;
  /**
   * A floor to qualify at all. A rank cap limits how many wallets share the
   * pool; this limits which ones can, and it is the better brake on a farm of
   * wallets clearing only the free quests — those never earn much in a season.
   */
  minPoints: number;
  mode: RewardMode;
  /**
   * Rank mode only. weight = 1 / rank^falloff, so 0 splits evenly, 1 gives
   * second place half of first, and 2 gives them a quarter.
   */
  falloff: number;
}

export interface RewardsConfig {
  items: RewardItem[];
  /** Draft until this is on; players see nothing before then. */
  published: boolean;
  /** Free text shown with the pool, for payout timing and the like. */
  note: string;
}

export const MAX_ITEMS = 8;
export const MAX_TOP_N = 500;
export const MAX_FALLOFF = 3;

export const EMPTY_REWARDS: RewardsConfig = { items: [], published: false, note: "" };

/** What the first season is set to pay, as a starting point in the panel. */
export const SUGGESTED_ITEMS: RewardItem[] = [
  {
    id: "ronkestr",
    label: "RONKESTR",
    kind: "token",
    amount: 250_000,
    precision: 0,
    topN: 25,
    minPoints: 2_000,
    mode: "rank",
    falloff: 1,
  },
  {
    id: "ronkeverse",
    label: "Ronkeverse NFT",
    kind: "nft",
    amount: 10,
    precision: 0,
    topN: 10,
    minPoints: 2_000,
    mode: "rank",
    falloff: 0,
  },
];

/**
 * Largest remainder. Everyone's exact share is floored to a whole unit, and
 * the units that leaves over go to the largest fractions — so the parts sum to
 * the pool exactly, and nobody is rounded down twice for the same reason.
 */
export function distribute(weights: number[], amount: number, precision: number): number[] {
  const step = Math.pow(10, precision);
  const units = Math.round(amount * step);
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);

  if (!weights.length || units <= 0 || total <= 0) return weights.map(() => 0);

  const exact = weights.map((weight) => (Math.max(0, weight) / total) * units);
  const whole = exact.map(Math.floor);
  let left = units - whole.reduce((sum, value) => sum + value, 0);

  // Ties go to the better rank, which is the order the rows arrive in.
  const byRemainder = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let i = 0; left > 0 && i < byRemainder.length; i += 1, left -= 1) {
    whole[byRemainder[i].index] += 1;
  }

  return whole.map((value) => value / step);
}

/** Row weights for one item. Anyone past its reach weighs nothing. */
export function weightsFor(rows: SeasonRow[], item: RewardItem): number[] {
  const reach = Math.max(0, Math.min(item.topN, rows.length));
  return rows.map((row, index) => {
    if (index >= reach) return 0;
    if (row.points < (item.minPoints ?? 0)) return 0;
    if (item.mode === "points") return Math.max(0, row.points);
    return 1 / Math.pow(index + 1, Math.max(0, item.falloff));
  });
}

export interface RewardShare {
  id: string;
  label: string;
  kind: RewardKind;
  amount: number;
}

export interface RewardRow {
  address: string;
  rank: number;
  points: number;
  shares: RewardShare[];
}

/**
 * What the current standings would pay. Rows arrive ranked, and rows that win
 * nothing are kept so the panel can show where the pool stops reaching.
 */
export function previewRewards(rows: SeasonRow[], config: RewardsConfig): RewardRow[] {
  const columns = config.items.map((item) => ({
    item,
    amounts: distribute(weightsFor(rows, item), item.amount, item.precision),
  }));

  return rows.map((row, index) => ({
    address: row.address,
    rank: index + 1,
    points: row.points,
    shares: columns
      .map(({ item, amounts }) => ({
        id: item.id,
        label: item.label,
        kind: item.kind,
        amount: amounts[index] ?? 0,
      }))
      .filter((share) => share.amount > 0),
  }));
}

/** Rejects anything the panel should not be able to write. */
export function sanitize(input: unknown): RewardsConfig | { error: string } {
  if (!input || typeof input !== "object") return { error: "No rewards were sent." };
  const raw = input as Partial<RewardsConfig>;
  if (!Array.isArray(raw.items)) return { error: "Rewards need a list of items." };
  if (raw.items.length > MAX_ITEMS) return { error: `At most ${MAX_ITEMS} reward items.` };

  const items: RewardItem[] = [];
  const seen = new Set<string>();

  for (const entry of raw.items as Partial<RewardItem>[]) {
    const label = String(entry.label ?? "").trim();
    if (!label) return { error: "Every reward needs a name." };
    if (label.length > 40) return { error: `"${label}" is too long a name.` };

    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: `Give ${label} an amount above zero.` };
    }

    const kind: RewardKind = entry.kind === "nft" ? "nft" : "token";
    // Whole things cannot be paid in fractions, whatever the form says.
    const precision = kind === "nft" ? 0 : clamp(Math.round(Number(entry.precision) || 0), 0, 6);
    const topN = clamp(Math.round(Number(entry.topN) || 0), 1, MAX_TOP_N);
    const minPoints = Math.max(0, Math.round(Number(entry.minPoints) || 0));
    const falloff = clamp(Number(entry.falloff) || 0, 0, MAX_FALLOFF);
    const mode: RewardMode = entry.mode === "rank" ? "rank" : "points";

    const id = String(entry.id ?? "").trim() || slug(label);
    if (seen.has(id)) return { error: `Two rewards share the id "${id}".` };
    seen.add(id);

    items.push({ id, label, kind, amount, precision, topN, minPoints, mode, falloff });
  }

  return {
    items,
    published: Boolean(raw.published),
    note: String(raw.note ?? "").trim().slice(0, 280),
  };
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, Number.isFinite(value) ? value : low));

const slug = (label: string) =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "reward";

/** 250000 → "250,000", 12.5 → "12.5" */
export function formatAmount(amount: number, precision = 0): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.max(precision, amount % 1 ? 2 : 0),
  });
}

export function describeItem(item: RewardItem): string {
  const reach = `top ${item.topN}`;
  const floor = item.minPoints > 0 ? `, ${item.minPoints.toLocaleString()}+ points` : "";
  if (item.mode === "points") return `${reach}${floor}, by points earned`;
  if (item.falloff === 0) return `${reach}${floor}, split evenly`;
  return `${reach}${floor}, by rank`;
}

/**
 * The exact words the admin signs, rebuilt server-side from what was actually
 * submitted. Signing the numbers themselves rather than a hash of them means
 * the wallet prompt shows the payout being authorised, and a tampered body
 * simply fails to reproduce the signature.
 */
export function adminMessage(
  config: RewardsConfig,
  season: number,
  address: string,
  issuedAt: string
): string {
  const lines = config.items.map(
    (item) =>
      `- ${formatAmount(item.amount, item.precision)} ${item.label} to ${describeItem(item)}`
  );

  return [
    "Ronke Quest — season rewards",
    "",
    `Season: ${season}`,
    `Wallet: ${address.toLowerCase()}`,
    `Status: ${config.published ? "published to players" : "draft"}`,
    `Issued: ${issuedAt}`,
    "",
    lines.length ? lines.join("\n") : "- no rewards",
    ...(config.note ? ["", `Note: ${config.note}`] : []),
  ].join("\n");
}
