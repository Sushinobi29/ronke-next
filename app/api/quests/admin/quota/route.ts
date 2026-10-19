import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "@/lib/quests/read";
import {
  QUEST_SEASON_ONE,
  seasonAt,
  seasonByNumber,
  seasonDays,
} from "@/lib/quests/season";
import { hasStore, QUOTA_MAX, QUOTA_MIN, readQuotas, writeQuota } from "@/lib/quests/store";
import { hasAdmins, isAdmin, verifyAdminMessage } from "@/lib/quests/admin";
import { BIG_QUOTA, dayIndex } from "@/lib/quests/daily";
import { quotaMessage, quotaOn } from "@/lib/quests/quota";

export const dynamic = "force-dynamic";

/** What each season is set to, and which of them can still be changed. */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!isAddress(address) || !isAdmin(address)) {
    return NextResponse.json({ error: "That wallet cannot read this." }, { status: 403 });
  }

  const today = dayIndex();
  const now = seasonAt().number;
  const set = await readQuotas();
  const seasons = Array.from({ length: now + 2 - QUEST_SEASON_ONE }, (_, i) => {
    const number = QUEST_SEASON_ONE + i;
    const schedule = set[number] ?? [];
    const { fromDay } = seasonDays(seasonByNumber(number));
    return {
      number,
      name: seasonByNumber(number).name,
      /** In force today. */
      quota: quotaOn(schedule, today, BIG_QUOTA),
      schedule,
      /** The day a change saved now would start from. */
      startsOn: number === now ? today + 1 : Math.max(fromDay, today + 1),
      /** A finished season is history and cannot be rewritten. */
      locked: number < now,
      running: number === now,
    };
  });

  return NextResponse.json({
    seasons,
    today,
    fallback: BIG_QUOTA,
    min: QUOTA_MIN,
    max: QUOTA_MAX,
  });
}

export async function POST(request: NextRequest) {
  let body: {
    address?: string;
    signature?: string;
    issuedAt?: string;
    season?: number;
    quota?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a season and a number." }, { status: 400 });
  }

  const { address, signature, issuedAt } = body;
  if (!hasAdmins()) {
    return NextResponse.json({ error: "No admin wallet is configured." }, { status: 503 });
  }
  if (!isAddress(address ?? null) || !isAdmin(address)) {
    return NextResponse.json({ error: "That wallet cannot change this." }, { status: 403 });
  }
  if (!signature || !issuedAt) {
    return NextResponse.json({ error: "That write was not signed." }, { status: 400 });
  }
  if (!hasStore()) {
    return NextResponse.json({ error: "No database is configured." }, { status: 503 });
  }

  const season = Number(body.season);
  const quota = Number(body.quota);
  if (!Number.isInteger(season) || season < QUEST_SEASON_ONE) {
    return NextResponse.json({ error: "Which season?" }, { status: 400 });
  }
  if (!Number.isInteger(quota) || quota < QUOTA_MIN || quota > QUOTA_MAX) {
    return NextResponse.json(
      { error: `A season hands out between ${QUOTA_MIN} and ${QUOTA_MAX} of them.` },
      { status: 422 }
    );
  }

  /**
   * A change starts tomorrow, never today and never behind it.
   *
   * This is the whole guard. The rota keeps every day handed out before the
   * start day and re-picks only from it onward, so nothing already played can
   * move — but only if the start day is in the future. Today is excluded as
   * well as the past: a board changing under somebody at four in the
   * afternoon is the same bug as one changing last Tuesday.
   */
  const now = seasonAt().number;
  if (season < now) {
    return NextResponse.json(
      { error: "That season is over. Its boards are history." },
      { status: 409 }
    );
  }
  const { fromDay } = seasonDays(seasonByNumber(season));
  const startsOn = season === now ? dayIndex() + 1 : Math.max(fromDay, dayIndex() + 1);

  const check = await verifyAdminMessage({
    address: address!,
    signature,
    issuedAt,
    message: quotaMessage(season, startsOn, quota, address!, issuedAt),
  });
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: check.status });
  }

  if (!(await writeQuota(season, startsOn, quota, address!))) {
    return NextResponse.json({ error: "Could not save it. Try again." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, season, quota, startsOn });
}
