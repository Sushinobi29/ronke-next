import { NextRequest, NextResponse } from "next/server";
import { dayIndex } from "@/lib/quests/daily";
import { bigDaysGiven, givenBefore } from "@/lib/quests/pool";
import { isAddress } from "@/lib/quests/read";
import { readPools, readQuota } from "@/lib/quests/store";
import { seasonAt } from "@/lib/quests/season";

export const dynamic = "force-dynamic";

/**
 * How many big-ticket days this wallet has already been handed this season.
 *
 * Only a season whose quota has been changed needs it, and then only to draw
 * the days that are left: a change aims at what a wallet was really given, so
 * the board cannot be drawn without the count. The page draws its own board
 * rather than waiting on the chain read behind the score, so it asks here —
 * which is a replay of this wallet's own boards and nothing else, no chain,
 * no scoring.
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!isAddress(address)) {
    return NextResponse.json({ error: "That is not a wallet." }, { status: 400 });
  }

  const [snapshots, quota] = await Promise.all([
    readPools(),
    readQuota(seasonAt().number),
  ]);
  const line = givenBefore(quota);

  return NextResponse.json({
    address: address.toLowerCase(),
    day: dayIndex(),
    // Null when the season has never been changed: there is nothing to count
    // against, and the board draws from the season's own number.
    given: line === null ? null : bigDaysGiven(address, line, snapshots),
  });
}
