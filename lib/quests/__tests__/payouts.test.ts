/**
 * The payout rules, tested against the ways a distribution actually goes
 * wrong: run twice, interrupted halfway, recomputed after someone is paid,
 * or started against a wallet that cannot cover it.
 *
 * Run with: npm run test
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  checksumOf,
  freezeRows,
  pendingOf,
  readiness,
  reconcile,
  totalsOf,
  type PayoutRow,
  matchBatch,
} from "@/lib/quests/payouts";
import { distribute, previewRewards, weightsFor, type RewardsConfig, type SeasonRow } from "@/lib/quests/rewards";

const standings = (n: number): SeasonRow[] =>
  Array.from({ length: n }, (_, i) => ({
    address: "0x" + String(i + 1).padStart(40, "0"),
    points: 10000 - i * 10,
    days: 30,
    sweeps: 30,
  })) as unknown as SeasonRow[];

const config: RewardsConfig = {
  note: "",
  published: true,
  showShares: true,
  items: [
    { id: "tok", kind: "token", mode: "rank", topN: 100, label: "RONKESTR", amount: 250000, falloff: 1, minPoints: 0, precision: 0 },
    { id: "nft", kind: "nft", mode: "rank", topN: 10, label: "NFT", amount: 10, falloff: 0, minPoints: 0, precision: 0 },
  ],
};

const frozen = () => freezeRows(previewRewards(standings(120), config));

test("every unit configured is handed to somebody, and no more", () => {
  const rows = frozen();
  for (const item of config.items) {
    const paid = totalsOf(rows).find((t) => t.itemId === item.id)!;
    assert.equal(paid.total, item.amount, `${item.label} must pay out exactly what was configured`);
  }
});

test("nobody is down for nothing, or for a negative", () => {
  for (const row of frozen()) assert.ok(row.amount > 0, `${row.address} has ${row.amount}`);
});

test("the NFT reaches exactly the top ten, one each", () => {
  const nft = frozen().filter((r) => r.itemId === "nft");
  assert.equal(nft.length, 10);
  assert.deepEqual([...new Set(nft.map((r) => r.amount))], [1]);
  assert.deepEqual(nft.map((r) => r.rank).sort((a, b) => a - b), [1,2,3,4,5,6,7,8,9,10]);
});

test("freezing twice gives the identical list", () => {
  assert.equal(checksumOf(frozen()), checksumOf(frozen()));
});

test("the fingerprint moves if any amount moves", () => {
  const rows = frozen();
  const tampered = rows.map((r, i) => (i === 3 ? { ...r, amount: r.amount + 1 } : r));
  assert.notEqual(checksumOf(rows), checksumOf(tampered));
});

test("a paid row is never queued again", () => {
  const rows = frozen();
  const half = rows.map((r, i) => (i < 20 ? { ...r, status: "sent" as const, txHash: "0xabc" } : r));
  const still = pendingOf(half);
  assert.equal(still.length, rows.length - 20);
  assert.ok(!still.some((r) => r.status === "sent"));
});

test("recomputing mid-payout leaves paid rows exactly as they were", () => {
  const first = frozen();
  const paid = first.map((r, i) => (i < 15 ? { ...r, status: "sent" as const, txHash: `0x${i}` } : r));
  // The standings shifted: a credit landed and ranks moved.
  const later = freezeRows(previewRewards(standings(140), config));
  const { rows, conflicts } = reconcile(paid, later);
  for (const before of paid.filter((r) => r.status === "sent")) {
    const after = rows.find((r) => r.address === before.address && r.itemId === before.itemId)!;
    assert.equal(after.amount, before.amount, "a paid amount must not be rewritten");
    assert.equal(after.txHash, before.txHash);
    assert.equal(after.status, "sent");
  }
  assert.ok(Array.isArray(conflicts));
});

test("an amount that changed after being paid is reported, not hidden", () => {
  const rows = frozen();
  const paid = [{ ...rows[0], status: "sent" as const, txHash: "0xaa" }];
  const later = [{ ...rows[0], amount: rows[0].amount + 500 }];
  const { conflicts } = reconcile(paid, later);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].paid, rows[0].amount);
  assert.equal(conflicts[0].wanted, rows[0].amount + 500);
});

test("a wallet paid under an old list keeps its money when it drops off a new one", () => {
  const rows = frozen();
  const paid = [{ ...rows[0], status: "sent" as const, txHash: "0xaa" }];
  const { rows: merged, orphaned } = reconcile(paid, []);
  assert.equal(orphaned, 1);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].status, "sent");
});

test("an interrupted run resumes without paying anyone twice", () => {
  const rows = frozen();
  const sent = new Set<string>();
  let ledger = rows;
  // Three passes that each die partway through.
  for (const stopAfter of [7, 25, 10_000]) {
    let done = 0;
    ledger = ledger.map((row) => {
      if (row.status === "sent" || done >= stopAfter) return row;
      done += 1;
      const key = `${row.address}|${row.itemId}`;
      assert.ok(!sent.has(key), `${key} was paid twice`);
      sent.add(key);
      return { ...row, status: "sent" as const, txHash: "0x" + sent.size };
    });
  }
  assert.equal(pendingOf(ledger).length, 0);
  assert.equal(sent.size, rows.length);
  for (const item of config.items) {
    const t = totalsOf(ledger).find((x) => x.itemId === item.id)!;
    assert.equal(t.sent, item.amount, "the whole prize went out, exactly once");
  }
});

test("a wallet that cannot cover the payout is refused", () => {
  const rows = frozen();
  assert.equal(readiness(rows, { tok: 250000, nft: 10 }).ok, true);
  const short = readiness(rows, { tok: 249999, nft: 10 });
  assert.equal(short.ok, false);
  assert.match(short.reasons[0], /RONKESTR/);
});

test("a missing balance is refused rather than assumed", () => {
  assert.equal(readiness(frozen(), { tok: 250000 }).ok, false);
});

test("only the unpaid remainder has to be covered", () => {
  const rows = frozen().map((r) => (r.itemId === "tok" && r.rank === 1 ? { ...r, status: "sent" as const, txHash: "0x1" } : r));
  const first = rows.find((r) => r.itemId === "tok" && r.rank === 1)!;
  assert.equal(readiness(rows, { tok: 250000 - first.amount, nft: 10 }).ok, true);
});

test("an empty or finished payout does not claim to be ready", () => {
  assert.equal(readiness([], {}).ok, false);
  const done: PayoutRow[] = frozen().map((r) => ({ ...r, status: "sent", txHash: "0x1" }));
  assert.equal(readiness(done, { tok: 0, nft: 0 }).ok, false);
});

test("rounding never invents or loses a unit, at any pool size", () => {
  for (const amount of [1, 7, 99, 250000, 2500001]) {
    for (const n of [1, 3, 10, 97, 100]) {
      const rows = standings(n);
      const item = { ...config.items[0], amount, topN: 100 };
      const out = distribute(weightsFor(rows, item), amount, 0);
      const sum = out.reduce((a, b) => a + b, 0);
      assert.equal(sum, amount, `${amount} over ${n} wallets came to ${sum}`);
    }
  }
});

/* ----------------------------------------------------------- batch sends */

const units = (row: { amount: number }) => BigInt(Math.round(row.amount * 1e4)) * BigInt(10) ** BigInt(14);

const owed = (address: string, amount: number, rank = 1): PayoutRow => ({
  address,
  rank,
  itemId: "tok",
  label: "RONKESTR",
  kind: "token",
  amount,
  status: "pending",
  txHash: null,
});

const W1 = "0x1111111111111111111111111111111111111111";
const W2 = "0x2222222222222222222222222222222222222222";
const W3 = "0x3333333333333333333333333333333333333333";

test("a batch pays only the rows its logs actually prove", () => {
  const rows = [owed(W1, 100, 1), owed(W2, 50, 2), owed(W3, 25, 3)];
  const { paid, missed, spare } = matchBatch(
    rows,
    [{ to: W1, value: units({ amount: 100 }) }, { to: W2, value: units({ amount: 50 }) }],
    units
  );
  assert.deepEqual(paid.map((r) => r.address), [W1, W2]);
  assert.deepEqual(missed.map((r) => r.address), [W3]);
  assert.equal(spare.length, 0);
});

test("a transfer of the wrong amount does not pay the row", () => {
  const rows = [owed(W1, 100)];
  const { paid, missed, spare } = matchBatch(rows, [{ to: W1, value: units({ amount: 99 }) }], units);
  assert.equal(paid.length, 0);
  assert.deepEqual(missed.map((r) => r.address), [W1]);
  // The money did leave, so it is reported rather than swallowed.
  assert.equal(spare.length, 1);
});

test("a transfer to the wrong wallet pays nobody", () => {
  const { paid, missed } = matchBatch([owed(W1, 100)], [{ to: W2, value: units({ amount: 100 }) }], units);
  assert.equal(paid.length, 0);
  assert.equal(missed.length, 1);
});

test("one transfer cannot pay two rows owed to the same wallet", () => {
  const rows = [owed(W1, 100, 1), { ...owed(W1, 100, 2), itemId: "tok2" }];
  const { paid, missed } = matchBatch(rows, [{ to: W1, value: units({ amount: 100 }) }], units);
  assert.equal(paid.length, 1);
  assert.equal(missed.length, 1);
});

test("two transfers do pay two rows owed to the same wallet", () => {
  const rows = [owed(W1, 100, 1), { ...owed(W1, 100, 2), itemId: "tok2" }];
  const { paid, missed } = matchBatch(
    rows,
    [{ to: W1, value: units({ amount: 100 }) }, { to: W1, value: units({ amount: 100 }) }],
    units
  );
  assert.equal(paid.length, 2);
  assert.equal(missed.length, 0);
});

test("case in an address never decides whether somebody got paid", () => {
  const { paid } = matchBatch([owed(W1.toUpperCase(), 100)], [{ to: W1, value: units({ amount: 100 }) }], units);
  assert.equal(paid.length, 1);
});

test("an empty transaction pays nothing and loses nothing", () => {
  const rows = [owed(W1, 100), owed(W2, 50)];
  const { paid, missed } = matchBatch(rows, [], units);
  assert.equal(paid.length, 0);
  assert.equal(missed.length, 2);
});
