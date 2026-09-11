import { NextRequest, NextResponse } from "next/server";
import { poolOnDay } from "@/lib/quests/pool";
import { isAddress, readDaily } from "@/lib/quests/read";
import { getToday } from "@/lib/quests/today";
import { dayIndex, scoreDay, secondsUntilReset } from "@/lib/quests/daily";
import { seasonAt, seasonDays } from "@/lib/quests/season";
import {
  priorSweepStreak,
  readFeatured,
  readPools,
  recordDay,
  seasonPlace,
  socialVerifiedOn,
  walletSeason,
} from "@/lib/quests/store";

export const dynamic = "force-dynamic";
/**
 * The chain half of a pass — a walk back over the Mines tables plus the log
 * slices — does not fit in the platform default of fifteen seconds under
 * load, and a pass killed mid-read is how rounds went missing. Long enough to
 * finish, short enough that a wedged node still fails rather than hangs.
 */
export const maxDuration = 60;

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
      social,
      today.buys
    );

    const day = dayIndex();
    const wallet = address.trim().toLowerCase();
    const [priorStreak, snapshots, featured] = await Promise.all([
      priorSweepStreak(wallet, day),
      readPools(),
      readFeatured(day),
    ]);
    const score = scoreDay(
      stats,
      day,
      { floorRon: today.floorRon, priorStreak },
      wallet,
      poolOnDay(day, snapshots),
      featured
    );

    const season = seasonAt();
    const { fromDay, toDay } = seasonDays(season);
    // Record first, then place: a wallet that just earned its first points
    // of the season should read its own rank off a table it is already on,
    // rather than being told it is nowhere until the next visit.
    await recordDay(day, {
      address: wallet,
      points: score.total,
      done: score.done,
      bonus: score.bonus,
    });
    const [seasonTotal, place] = await Promise.all([
      walletSeason(wallet, fromDay, toDay),
      seasonPlace(wallet, fromDay, toDay),
    ]);

    return NextResponse.json({
      address: wallet,
      stats,
      seasonTotal,
      seasonRank: place.rank,
      seasonPlayers: place.players,
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
