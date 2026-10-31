/**
 * What a purchase pays.
 *
 * The quest says it pays more the more you spend, and that has to be true of
 * purchases people can actually make — which means the ceiling has to sit
 * above the floor rather than on it.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  BASE_POOL,
  SPEND_CEILING,
  earnedPoints,
  pointsFor,
  pointsForRon,
  type QuestDef,
} from "@/lib/quests/daily";

const adopt = BASE_POOL.find((quest) => quest.id === "monke.adopt") as QuestDef;
const FLOOR = 654;
const context = { floorRon: FLOOR };

test("the adopt quest is the scaled one, and it is floor-linked", () => {
  assert.ok(adopt, "monke.adopt is in the pool");
  assert.equal(adopt.scaled, true);
  assert.equal(adopt.floorLinked, true);
});

test("a bigger purchase pays more, all the way up to several times the floor", () => {
  const atFloor = earnedPoints(adopt, FLOOR, context);
  const twice = earnedPoints(adopt, FLOOR * 2, context);
  const triple = earnedPoints(adopt, FLOOR * 3, context);
  assert.ok(twice > atFloor, `twice the floor paid ${twice}, the floor paid ${atFloor}`);
  assert.ok(triple > twice, `three times the floor paid ${triple}, twice paid ${twice}`);
});

test("the ceiling sits above the floor, not on it", () => {
  // The bug: pinned to the quest's fixed number, the ceiling was reached five
  // RON above the floor, so every real purchase paid exactly the same.
  const ceiling = Math.round(pointsFor(adopt, context) * SPEND_CEILING);
  let reached = FLOOR;
  while (pointsForRon(reached) < ceiling && reached < FLOOR * 20) reached += 1;
  assert.ok(
    reached > FLOOR * 2,
    `the ladder stops paying at ${reached} RON, only ${(reached / FLOOR).toFixed(1)}x the floor`
  );
});

test("spending more never pays less", () => {
  let last = 0;
  for (let ron = 50; ron <= FLOOR * 12; ron += 50) {
    const paid = earnedPoints(adopt, ron, context);
    assert.ok(paid >= last, `${ron} RON paid ${paid} after ${last}`);
    last = paid;
  }
});

test("the ceiling moves with the floor rather than standing still", () => {
  const low = earnedPoints(adopt, 100_000, { floorRon: 300 });
  const high = earnedPoints(adopt, 100_000, { floorRon: 1200 });
  assert.ok(high > low, `ceiling ${high} at a 1200 floor, ${low} at a 300 floor`);
});
