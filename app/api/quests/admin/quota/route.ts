import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "@/lib/quests/read";
import { QUEST_SEASON_ONE, seasonAt, seasonByNumber } from "@/lib/quests/season";
import { hasStore, QUOTA_MAX, QUOTA_MIN, readQuotas, writeQuota } from "@/lib/quests/store";
import { hasAdmins, isAdmin, verifyAdminMessage } from "@/lib/quests/admin";
import { BIG_QUOTA } from "@/lib/quests/daily";
import { quotaMessage } from "@/lib/quests/quota";

export const dynamic = "force-dynamic";

/** What each season is set to, and which of them can still be changed. */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!isAddress(address) || !isAdmin(address)) {
    return NextResponse.json({ error: "That wallet cannot read this." }, { status: 403 });
  }

  const now = seasonAt().number;
  const set = await readQuotas();
  const seasons = Array.from({ length: now + 2 - QUEST_SEASON_ONE }, (_, i) => {
    const number = QUEST_SEASON_ONE + i;
    return {
      number,
      name: seasonByNumber(number).name,
      quota: set[number] ?? BIG_QUOTA,
      /** A season that has started cannot change: its days are already drawn. */
      locked: number <= now,
      running: number === now,
    };
  });

  return NextResponse.json({ seasons, fallback: BIG_QUOTA, min: QUOTA_MIN, max: QUOTA_MAX });
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
   * The guard this endpoint exists around.
   *
   * Raising the number adds rota days drawn from anywhere in the season, so a
   * change made on day nine can land on day three — a board somebody already
   * played, redrawn underneath them. Lowering it takes days away the same way.
   * A season that has started is therefore fixed, and the change goes to one
   * that has not.
   */
  if (season <= seasonAt().number) {
    return NextResponse.json(
      {
        error:
          "That season has started, and changing it now would redraw days people have already played. Set it on a season that has not begun.",
      },
      { status: 409 }
    );
  }

  const check = await verifyAdminMessage({
    address: address!,
    signature,
    issuedAt,
    message: quotaMessage(season, quota, address!, issuedAt),
  });
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: check.status });
  }

  if (!(await writeQuota(season, quota, address!))) {
    return NextResponse.json({ error: "Could not save it. Try again." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, season, quota });
}
