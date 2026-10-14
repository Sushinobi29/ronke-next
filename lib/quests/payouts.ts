/**
 * Paying a season out.
 *
 * Everything here is pure and has no idea what a blockchain is. That is the
 * point: the arithmetic of who is owed what, what has already gone out, and
 * what must never go out twice is worked out and tested on its own, and the
 * part that actually signs transactions is left with nothing to decide.
 *
 * The rule the whole file exists to enforce: once a row has been paid, it is
 * a record, not a plan. Standings move, prices move, a config gets edited —
 * none of that may rewrite what somebody was already sent, and none of it may
 * put a paid row back in the queue.
 */

import type { RewardKind, RewardRow } from "@/lib/quests/rewards";

export type PayoutStatus = "pending" | "sent";

export interface PayoutRow {
  address: string;
  rank: number;
  itemId: string;
  label: string;
  kind: RewardKind;
  amount: number;
  status: PayoutStatus;
  /** The transaction that paid it, once it has been paid. */
  txHash: string | null;
}

/** One row per wallet per prize, so each can be sent and recorded on its own. */
export function freezeRows(preview: RewardRow[]): PayoutRow[] {
  const rows: PayoutRow[] = [];
  for (const entry of preview) {
    for (const share of entry.shares) {
      if (!(share.amount > 0)) continue;
      rows.push({
        address: entry.address.toLowerCase(),
        rank: entry.rank,
        itemId: share.id,
        label: share.label,
        kind: share.kind,
        amount: share.amount,
        status: "pending",
        txHash: null,
      });
    }
  }
  return sortRows(rows);
}

/**
 * A fixed order, so two runs of the same payout queue the same way and the
 * fingerprint below means something. Best rank first, then by prize, so the
 * list reads the way the leaderboard does.
 */
export function sortRows(rows: PayoutRow[]): PayoutRow[] {
  return [...rows].sort(
    (a, b) => a.rank - b.rank || a.itemId.localeCompare(b.itemId) || a.address.localeCompare(b.address)
  );
}

const keyOf = (row: Pick<PayoutRow, "address" | "itemId">) =>
  `${row.address.toLowerCase()}|${row.itemId}`;

export interface Totals {
  itemId: string;
  label: string;
  kind: RewardKind;
  /** Everything owed for this prize, paid or not. */
  total: number;
  /** Still to go out. */
  pending: number;
  /** Already gone out. */
  sent: number;
  wallets: number;
}

/** What each prize costs in total, and how far through it is. */
export function totalsOf(rows: PayoutRow[]): Totals[] {
  const by = new Map<string, Totals>();
  for (const row of rows) {
    let entry = by.get(row.itemId);
    if (!entry) {
      entry = { itemId: row.itemId, label: row.label, kind: row.kind, total: 0, pending: 0, sent: 0, wallets: 0 };
      by.set(row.itemId, entry);
    }
    entry.total += row.amount;
    entry.wallets += 1;
    if (row.status === "sent") entry.sent += row.amount;
    else entry.pending += row.amount;
  }
  return [...by.values()];
}

/** What still has to be sent, in the order it should be sent. */
export const pendingOf = (rows: PayoutRow[]): PayoutRow[] =>
  sortRows(rows.filter((row) => row.status === "pending"));

/**
 * A short fingerprint of the list, so the screen that asks "send all this?"
 * and the server that records the answer can prove they meant the same list.
 * FNV-1a over the rows that matter, in their fixed order.
 */
export function checksumOf(rows: PayoutRow[]): string {
  let hash = 0x811c9dc5;
  for (const row of sortRows(rows)) {
    for (const char of `${row.address}|${row.itemId}|${row.amount}`) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, "0");
}

export interface Reconciled {
  rows: PayoutRow[];
  /** Rows whose amount changed after they had already been paid. */
  conflicts: { address: string; itemId: string; paid: number; wanted: number }[];
  added: number;
  /** Rows that were owed before and are not in the new list, but were paid. */
  orphaned: number;
}

/**
 * Lay a freshly computed payout over what is already on record.
 *
 * Standings keep moving while a season is being paid out — a late scoring
 * pass, a credit applied by hand — so the list can legitimately be recomputed
 * halfway through. What cannot happen is a recomputation quietly changing
 * what somebody was already sent, or returning a paid row to the queue. A paid
 * row therefore wins over the fresh one every time, and any disagreement is
 * reported rather than silently resolved.
 */
export function reconcile(stored: PayoutRow[], fresh: PayoutRow[]): Reconciled {
  const have = new Map(stored.map((row) => [keyOf(row), row]));
  const want = new Map(fresh.map((row) => [keyOf(row), row]));
  const conflicts: Reconciled["conflicts"] = [];
  const rows: PayoutRow[] = [];
  let added = 0;
  let orphaned = 0;

  for (const [key, next] of want) {
    const current = have.get(key);
    if (!current) {
      rows.push({ ...next, status: "pending", txHash: null });
      added += 1;
      continue;
    }
    if (current.status === "sent") {
      if (current.amount !== next.amount) {
        conflicts.push({
          address: current.address,
          itemId: current.itemId,
          paid: current.amount,
          wanted: next.amount,
        });
      }
      rows.push(current);
      continue;
    }
    // Still owed, so the fresh amount is the right one — but keep the row's
    // identity rather than replacing it wholesale.
    rows.push({ ...current, rank: next.rank, label: next.label, kind: next.kind, amount: next.amount });
  }

  // A paid row the new list no longer knows about is kept: the money left.
  for (const [key, current] of have) {
    if (want.has(key)) continue;
    if (current.status === "sent") {
      rows.push(current);
      orphaned += 1;
    }
  }

  return { rows: sortRows(rows), conflicts, added, orphaned };
}

export interface Readiness {
  ok: boolean;
  reasons: string[];
}

/**
 * Whether this payout can safely start, given what the paying wallet holds.
 * `held` is keyed by item id, in the same units the amounts are written in.
 */
export function readiness(rows: PayoutRow[], held: Record<string, number>): Readiness {
  const reasons: string[] = [];
  const pending = pendingOf(rows);
  if (!rows.length) reasons.push("Nothing has been frozen for this season yet.");
  else if (!pending.length) reasons.push("Every row has already been paid.");

  for (const total of totalsOf(rows)) {
    if (total.pending <= 0) continue;
    const have = held[total.itemId];
    if (have === undefined) {
      reasons.push(`No balance was read for ${total.label}.`);
      continue;
    }
    if (have < total.pending) {
      reasons.push(
        `${total.label}: ${total.pending} still to send, wallet holds ${have}.`
      );
    }
  }

  for (const row of pending) {
    if (!/^0x[0-9a-f]{40}$/.test(row.address)) {
      reasons.push(`${row.address} is not an address this can pay.`);
      break;
    }
    if (!(row.amount > 0)) {
      reasons.push(`${row.address} is down for ${row.amount} of ${row.label}.`);
      break;
    }
  }

  return { ok: reasons.length === 0, reasons };
}

/* ----------------------------------------------------------- batch sends */

/** One ERC-20 Transfer, as read back off the chain. */
export interface Transfer {
  to: string;
  value: bigint;
}

export interface Matched {
  /** Rows this transaction actually paid, to be marked sent. */
  paid: PayoutRow[];
  /** Rows it did not pay, which stay owed. */
  missed: PayoutRow[];
  /** Transfers that answered to no row — not an error, but worth saying. */
  spare: Transfer[];
}

/**
 * Which owed rows a single transaction actually paid.
 *
 * Batch tools send one transaction to many wallets, which is far better than
 * a hundred signatures — but it means the panel never sees the individual
 * sends, and marking a hundred rows paid on somebody's say-so is exactly the
 * thing the rest of this file exists to prevent. So nothing is taken on
 * trust: the transaction's own Transfer logs are read back off the chain and
 * matched against what was owed, and a row is only marked paid when a
 * transfer of exactly its amount, to exactly its wallet, is found.
 *
 * Transfers are consumed as they match, so two rows owed to the same wallet
 * need two transfers rather than one counted twice.
 */
export function matchBatch(
  rows: PayoutRow[],
  transfers: Transfer[],
  unitsOf: (row: PayoutRow) => bigint
): Matched {
  const left = new Map<string, bigint[]>();
  for (const transfer of transfers) {
    const key = transfer.to.toLowerCase();
    const list = left.get(key) ?? [];
    list.push(transfer.value);
    left.set(key, list);
  }

  const paid: PayoutRow[] = [];
  const missed: PayoutRow[] = [];

  for (const row of sortRows(rows)) {
    const list = left.get(row.address.toLowerCase());
    const want = unitsOf(row);
    const at = list?.findIndex((value) => value === want) ?? -1;
    if (list && at >= 0) {
      list.splice(at, 1);
      paid.push(row);
    } else {
      missed.push(row);
    }
  }

  const spare: Transfer[] = [];
  for (const [to, values] of left) for (const value of values) spare.push({ to, value });

  return { paid, missed, spare };
}

/* ------------------------------------------------------- what gets signed */

/**
 * The words an admin signs, built the same way on both sides.
 *
 * The server rebuilds these from what it is about to write rather than
 * trusting the body, so a signature only ever authorises the exact list, or
 * the exact payment, actually being recorded.
 */
export const freezeMessage = (season: number, checksum: string, rows: number, who: string, at: string) =>
  [
    `Ronke Quest — freeze the Season ${season} payout`,
    `${rows} payments, fingerprint ${checksum}`,
    `by ${who.toLowerCase()}`,
    at,
  ].join("\n");

export const batchMessage = (season: number, itemId: string, tx: string, rows: number, at: string) =>
  [
    `Ronke Quest — record a Season ${season} batch payment`,
    `${itemId} · ${rows} wallets`,
    tx.toLowerCase(),
    at,
  ].join("\n");

export const sentMessage = (season: number, address: string, itemId: string, tx: string, at: string) =>
  [
    `Ronke Quest — record a Season ${season} payment`,
    `${address.toLowerCase()} · ${itemId}`,
    tx.toLowerCase(),
    at,
  ].join("\n");
