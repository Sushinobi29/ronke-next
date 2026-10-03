import { NextResponse } from "next/server";
import { dayIndex } from "@/lib/quests/daily";
import { getLeaderboard, getToday } from "@/lib/quests/today";

export const dynamic = "force-dynamic";
/**
 * The chain half of a pass, plus scoring sixty wallets. It is allowed to take
 * its time — nobody is waiting on it, and the alternative is a visitor waiting
 * on it instead.
 */
export const maxDuration = 120;

/**
 * The one job that reads the chain.
 *
 * Every instance used to keep its own copy of the day and walk the chain
 * forward itself, which meant the same reads happening over and over behind
 * identical answers. A month of that came to 787,000 invocations and 2,560
 * GB-hours, and all but a dollar of the bill was that duplicated time.
 *
 * Now the walking happens here, once a minute, and requests serve what this
 * leaves behind. Two things follow that are worth more than the money:
 *
 *   - A quest finished at 23:47 on a quiet night is still scored before the
 *     day closes. It used to depend on somebody loading the board in those
 *     last minutes, and when nobody did, the day rolled and took the sweep
 *     with it — a player lost a twenty-day streak that way.
 *   - The day's history is walked back steadily rather than restarting from
 *     one slice every time a fresh instance picks it up.
 *
 * Vercel sends its own header on scheduled runs. CRON_SECRET, when set, is
 * checked as well, so the job cannot be triggered by anyone who finds the URL.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const fromVercel = request.headers.get("x-vercel-cron") !== null;

  if (secret && !fromVercel && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "not yours to run" }, { status: 401 });
  }

  const started = Date.now();
  try {
    // `work` is this job saying it is its turn: read the chain, move the day
    // forward, and let the scoring pass run.
    const today = await getToday(false, true);
    const leaderboard = getLeaderboard(today, true);

    return NextResponse.json(
      {
        day: dayIndex(),
        ok: !today.error,
        error: today.error ?? null,
        rounds: today.rounds.length,
        logCoverage: today.logCoverage,
        logsMissing: today.logsMissing,
        scored: leaderboard.length,
        tookMs: Date.now() - started,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        tookMs: Date.now() - started,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
