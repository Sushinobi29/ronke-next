import test from "node:test";
import assert from "node:assert/strict";
import { orderStandings, tiedOn, type RankedRow } from "@/lib/quests/standings";
import type { SeasonRow } from "@/lib/quests/store";

const row = (address: string, points: number): SeasonRow => ({
  address,
  points,
  days: 30,
  sweeps: 30,
});

const A = "0xaaaa000000000000000000000000000000000001";
const B = "0xbbbb000000000000000000000000000000000002";
const C = "0xcccc000000000000000000000000000000000003";
const D = "0xdddd000000000000000000000000000000000004";

const scores = (pairs: [string, number][]) => new Map(pairs.map(([a, s]) => [a.toLowerCase(), s]));

const order = (rows: SeasonRow[], s: Map<string, number> | null) =>
  orderStandings(rows, s).map((r) => r.address);

test("points beat score, always", () => {
  const rows = [row(A, 100), row(B, 200)];
  // B has the lower score and still wins, because it did more.
  assert.deepEqual(order(rows, scores([[A, 9000], [B, 1]])), [B, A]);
});

test("a tie on points breaks on Ronke Score", () => {
  const rows = [row(A, 8200), row(B, 8200), row(C, 8200)];
  assert.deepEqual(order(rows, scores([[A, 10], [B, 500], [C, 99]])), [B, C, A]);
});

test("a wallet the scorer has never seen counts as zero, not as missing", () => {
  const rows = [row(A, 8200), row(B, 8200)];
  assert.deepEqual(order(rows, scores([[B, 1]])), [B, A]);
  assert.equal(orderStandings(rows, scores([[B, 1]])).find((r) => r.address === A)!.score, 0);
});

test("level on points and score, the order is still fixed", () => {
  const rows = [row(C, 500), row(A, 500), row(B, 500)];
  const s = scores([[A, 7], [B, 7], [C, 7]]);
  assert.deepEqual(order(rows, s), [A, B, C]);
});

test("the input order cannot change the output order", () => {
  const rows = [row(A, 500), row(B, 500), row(C, 900), row(D, 500)];
  const s = scores([[A, 3], [B, 9], [C, 1], [D, 9]]);
  const once = order(rows, s);
  for (const shuffled of [
    [rows[3], rows[1], rows[0], rows[2]],
    [rows[2], rows[3], rows[1], rows[0]],
    [...rows].reverse(),
  ]) {
    assert.deepEqual(order(shuffled, s), once);
  }
  // B and D are level on points and score, so the address decides and says so.
  assert.deepEqual(once, [C, B, D, A]);
});

test("with no scores at all the order is arbitrary but never unstable", () => {
  const rows = [row(C, 500), row(A, 500), row(B, 500)];
  assert.deepEqual(order(rows, null), [A, B, C]);
  assert.deepEqual(order([...rows].reverse(), null), [A, B, C]);
  for (const r of orderStandings(rows, null)) assert.equal(r.score, null);
});

test("ties are counted before and after the score is applied", () => {
  const rows = orderStandings(
    [row(A, 8200), row(B, 8200), row(C, 8200), row(D, 100)],
    scores([[A, 5], [B, 5], [C, 900]])
  ) as RankedRow[];
  // Three wallets are level on points.
  assert.equal(tiedOn(rows, (r) => r.points), 3);
  // The score separated one of them; two are still level on both.
  assert.equal(tiedOn(rows, (r) => `${r.points}:${r.score ?? ""}`), 2);
});

test("nobody is tied when every total differs", () => {
  const rows = [row(A, 3), row(B, 2), row(C, 1)];
  assert.equal(tiedOn(orderStandings(rows, null), (r) => r.points), 0);
});

test("the score never reorders wallets that are not level", () => {
  const rows = Array.from({ length: 40 }, (_, i) =>
    row(`0x${String(i).padStart(40, "0")}`, 1000 - i)
  );
  const s = scores(rows.map((r, i) => [r.address, i * 13 % 97] as [string, number]));
  assert.deepEqual(order(rows, s), rows.map((r) => r.address));
});
