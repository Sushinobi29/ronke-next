import type { QuotaStep } from "@/lib/quests/daily";

/**
 * The words an admin signs to change how often a season hands out the big
 * quest. The day it starts is in the message, because that is the part that
 * decides whether anybody's played board can move.
 */
export const quotaMessage = (
  season: number,
  fromDay: number,
  quota: number,
  who: string,
  at: string
) =>
  [
    `Ronke Quest — Season ${season} hands out ${quota} adoptions`,
    `from day ${fromDay}`,
    `by ${who.toLowerCase()}`,
    at,
  ].join("\n");

/** What the quota is on a given day, given the changes made to it. */
export function quotaOn(schedule: QuotaStep[], day: number, fallback: number): number {
  let quota = fallback;
  for (const step of [...schedule].sort((a, b) => a.from - b.from)) {
    if (step.from <= day) quota = step.quota;
  }
  return quota;
}
