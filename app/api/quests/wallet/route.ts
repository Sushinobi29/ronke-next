import { NextRequest, NextResponse } from "next/server";
import { isAddress, readDaily } from "@/lib/quests/read";
import { getToday } from "@/lib/quests/today";
import { dayIndex, scoreDay, secondsUntilReset } from "@/lib/quests/daily";
import { seasonAt } from "@/lib/quests/season";
import { recordDay, socialVerifiedOn, walletSeason } from "@/lib/quests/store";

export const dynamic = "force-dynamic";

/**
 * One wallet's day. Nothing is stored — the address is scored from chain reads
 * on every request, so there is no account to create and nothing to sign.
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");

  if (!isAddress(address)) {
    return NextResponse.json({ error: "That is not a Ronin address." }, { status: 400 });
  }

  try {
    const force = request.nextUrl.searchParams.get("fresh") === "1";
    const today = await getToday(force);

    // A read failure with nothing cached is a real error; with a good copy
    // behind it, serve the copy and say how stale it is.
    if (today.error && today.at === 0) {
      return NextResponse.json({ error: `Ronin did not answer: ${today.error}` }, { status: 502 });
    }

    const social = await socialVerifiedOn(dayIndex());
    const stats = await readDaily(
      address.trim(),
      today.rounds,
      today.startBlock,
      today.spins,
      today.aor,
      today.spinRon,
      today.sales,
      social
    );

    const day = dayIndex();
    const wallet = address.trim().toLowerCase();
    const score = scoreDay(stats, day, { floorRon: today.floorRon }, wallet);

    const season = seasonAt();
    const [seasonTotal] = await Promise.all([
      walletSeason(wallet, Math.floor(season.startsAt / 86_400), Math.floor((season.endsAt - 1) / 86_400)),
      recordDay(day, { address: wallet, points: score.total, done: score.done, bonus: score.bonus }),
    ]);

    return NextResponse.json({
      address: wallet,
      stats,
      seasonTotal,
      score,
      floorRon: today.floorRon,
      readAt: today.at,
      stale: today.error ?? null,
      logsMissing: today.logsMissing,
      logCoverage: today.logCoverage,
      resetsIn: secondsUntilReset(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Could not reach Ronin: ${error instanceof Error ? error.message : error}` },
      { status: 502 }
    );
  }
}
