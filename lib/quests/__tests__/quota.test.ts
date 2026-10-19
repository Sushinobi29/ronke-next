/**
 * Changing how often a season hands out the big quest.
 *
 * The property that matters is that a change cannot reach backwards: every
 * day already played keeps whatever it had, whichever way the number moved.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { questsForDay, type QuotaStep } from "@/lib/quests/daily";
import { quotaOn } from "@/lib/quests/quota";
import { createHash } from "crypto";

const SEASON_FROM = 20767;
const SEASON_TO = 20796;
const WALLETS = Array.from({ length: 60 }, (_, i) =>
  "0x" + createHash("sha1").update("k" + i).digest("hex").slice(0, 40)
);

const bigDays = (wallet: string, schedule?: QuotaStep[]) => {
  const days: number[] = [];
  for (let d = SEASON_FROM; d <= SEASON_TO; d++) {
    if (questsForDay(d, wallet, undefined, schedule).some((q) => q.cost === "big")) days.push(d);
  }
  return days;
};

const boards = (wallet: string, to: number, schedule?: QuotaStep[]) => {
  const out: string[] = [];
  for (let d = SEASON_FROM; d <= to; d++) {
    out.push(questsForDay(d, wallet, undefined, schedule).map((q) => q.id).join(","));
  }
  return out;
};

test("with no change, the season hands out the built-in six", () => {
  for (const wallet of WALLETS) assert.equal(bigDays(wallet).length, 6);
});

test("raising it mid-season cannot change a day already played", () => {
  const CHANGE = SEASON_FROM + 10;
  const raised: QuotaStep[] = [{ from: CHANGE, quota: 9 }];
  for (const wallet of WALLETS) {
    assert.deepEqual(
      boards(wallet, CHANGE - 1, raised),
      boards(wallet, CHANGE - 1),
      `${wallet} had a played board redrawn`
    );
  }
});

test("lowering it mid-season cannot change a day already played", () => {
  const CHANGE = SEASON_FROM + 10;
  const cut: QuotaStep[] = [{ from: CHANGE, quota: 2 }];
  for (const wallet of WALLETS) {
    assert.deepEqual(boards(wallet, CHANGE - 1, cut), boards(wallet, CHANGE - 1));
  }
});

test("raising it adds the difference across the days that are left", () => {
  const CHANGE = SEASON_FROM + 10;
  for (const wallet of WALLETS) {
    const after = bigDays(wallet, [{ from: CHANGE, quota: 9 }]);
    assert.equal(after.length, 9, `${wallet} did not reach the new number`);
    // Everything it gained is in the future.
    const before = bigDays(wallet).filter((d) => d < CHANGE);
    assert.deepEqual(after.filter((d) => d < CHANGE), before);
  }
});

test("lowering it never claws back days already handed out", () => {
  const CHANGE = SEASON_FROM + 25;
  for (const wallet of WALLETS) {
    const spent = bigDays(wallet).filter((d) => d < CHANGE).length;
    const after = bigDays(wallet, [{ from: CHANGE, quota: 1 }]);
    // Never fewer than were already played, never more than was asked for.
    assert.equal(after.length, Math.max(spent, Math.min(1, after.length)) || spent);
    assert.ok(after.length >= spent);
  }
});

test("two changes in one season both hold", () => {
  const a = SEASON_FROM + 5;
  const b = SEASON_FROM + 15;
  for (const wallet of WALLETS.slice(0, 20)) {
    const schedule: QuotaStep[] = [{ from: a, quota: 8 }, { from: b, quota: 10 }];
    assert.deepEqual(boards(wallet, a - 1, schedule), boards(wallet, a - 1));
    assert.deepEqual(
      boards(wallet, b - 1, schedule),
      boards(wallet, b - 1, [{ from: a, quota: 8 }])
    );
    assert.equal(bigDays(wallet, schedule).length, 10);
  }
});

test("everyone still gets the same number, which is what keeps it fair", () => {
  const schedule: QuotaStep[] = [{ from: SEASON_FROM + 10, quota: 8 }];
  const counts = new Set(WALLETS.map((w) => bigDays(w, schedule).length));
  assert.deepEqual([...counts], [8]);
});

test("quotaOn reads the number in force on a day", () => {
  const schedule: QuotaStep[] = [{ from: 100, quota: 8 }, { from: 200, quota: 3 }];
  assert.equal(quotaOn(schedule, 99, 6), 6);
  assert.equal(quotaOn(schedule, 100, 6), 8);
  assert.equal(quotaOn(schedule, 199, 6), 8);
  assert.equal(quotaOn(schedule, 500, 6), 3);
  assert.equal(quotaOn([], 500, 6), 6);
});

/**
 * Season two opened before the rota did, so some wallets drew the quest by
 * luck on those first four days and the season hands them that many fewer
 * afterwards. A change has to carry that discount too, or the lucky wallets
 * would end three ahead of everyone else the moment the number moved.
 */
test("a change keeps season two's head start discounted", () => {
  const S2_FROM = 20737;
  const S2_TO = 20766;
  const adopts = (wallet: string, schedule?: QuotaStep[]) => {
    let n = 0;
    for (let d = S2_FROM; d <= S2_TO; d++) {
      if (questsForDay(d, wallet, undefined, schedule).some((q) => q.cost === "big")) n++;
    }
    return n;
  };
  const RAISE = 4;
  for (const wallet of WALLETS.slice(0, 25)) {
    const before = adopts(wallet);
    const after = adopts(wallet, [{ from: 20750, quota: 6 + RAISE }]);
    assert.equal(after, before + RAISE, `${wallet} moved by ${after - before}, not ${RAISE}`);
  }
});
