import { NextResponse } from "next/server";
import { getToday } from "@/lib/quests/today";
import {
  dayIndex,
  needsLogs,
  pointsFor,
  questsForDay,
  secondsUntilReset,
  targetFor,
} from "@/lib/quests/daily";
import { poolOnDay } from "@/lib/quests/pool";
import { previewRewards } from "@/lib/quests/rewards";
import { seasonAt, seasonByNumber, seasonDays } from "@/lib/quests/season";
import {
  dayStandings,
  hasStore,
  readFeaturedShared,
  readPoolsShared,
  readRewards,
  seasonHeadcount,
  seasonStandings,
} from "@/lib/quests/store";

export const dynamic = "force-dynamic";
/**
 * The chain half of a pass — a walk back over the Mines tables plus the log
 * slices — does not fit in the platform default of fifteen seconds under
 * load, and a pass killed mid-read is how rounds went missing. Long enough to
 * finish, short enough that a wedged node still fails rather than hangs.
 */
export const maxDuration = 60;

/** How much of the season table the board draws. */
const LEADERBOARD_ROWS = 50;

/**
 * This answer is the same for everybody.
 *
 * Nothing here depends on who is asking — it is the day's five, the day's
 * standings and the day's chain state — but it was served uncached, so every
 * open page paid for its own walk of Ronin every minute. Forty people on the
 * board meant forty chain reads a minute to produce forty identical replies,
 * and the bill said so: function time was all but the whole of it.
 *
 * A minute costs nothing in freshness: the writer only publishes on that
 * cadence, so a shorter window cannot produce a newer answer, only another
 * bill for the same one. This URL is shared, so other visitors keep it warm
 * between any one page's polls.
 * The refresh button asks for `fresh`, which must never be served from a
 * cache or the button does nothing.
 */
const shared = (fresh: boolean) => ({
  "Cache-Control": fresh
    ? "no-store"
    : "public, s-maxage=60, stale-while-revalidate=240",
});

/**
 * Today's five quests and what the tables have seen since midnight. The chain
 * half is shared with every other visitor, so this costs one incremental read
 * a minute however many people are on the page.
 */
export async function GET(request: Request) {
  const day = dayIndex();
  const force = new URL(request.url).searchParams.get("fresh") === "1";

  try {
    const today = await getToday(force);

    if (today.error && today.at === 0) {
      return NextResponse.json({ error: `Ronin did not answer: ${today.error}` }, { status: 502 });
    }

    const players = new Set(today.rounds.map((r) => r.player.toLowerCase()));
    const season = seasonAt();
    const { fromDay, toDay } = seasonDays(season);

    /**
     * The daily scoring pass. The page no longer draws a "today" table, but
     * this call is not decoration: scoring is what writes the day into
     * quest_days, for everyone the chain saw act and everyone with a streak
     * on the line. Drop it and the season table shrinks to the wallets that
     * happened to open the page. It returns what it has and refreshes behind
     * the response, so the five quests never wait on it, and the rows are
     * still served for anything reading this endpoint directly.
     */
    /**
     * Read, not computed. Scoring belongs to the writer now, and its results
     * live in quest_days — so this comes from there rather than from whatever
     * this particular instance happened to have scored, which for a reader is
     * nothing at all.
     */
    const leaderboard = (await dayStandings(day)).map((row) => ({
      address: row.address,
      points: row.points,
      done: row.done,
      bonus: row.bonus,
      streak: 0,
      actions: row.done,
    }));
    const [rewards, nextRewards, snapshots, featured] = await Promise.all([
      readRewards(season.number),
      readRewards(season.number + 1),
      readPoolsShared(),
      readFeaturedShared(day),
    ]);

    // The running season's prizes if it has any, otherwise the next season's.
    const prizes = rewards?.config.published
      ? { config: rewards.config, season, upcoming: false }
      : nextRewards?.config.published
        ? { config: nextRewards.config, season: seasonByNumber(season.number + 1), upcoming: true }
        : null;

    /**
     * A share is a slice of a pool, so it can only be worked out against
     * everyone the pool reaches. Reading the top fifty and splitting a
     * top-hundred prize between them hands everybody twice what they are
     * owed, and tells the second fifty they are owed nothing.
     */
    const reach = prizes ? Math.max(...prizes.config.items.map((item) => item.topN), 0) : 0;
    const [standings, seasonPlayers] = await Promise.all([
      seasonStandings(fromDay, toDay, Math.max(LEADERBOARD_ROWS, reach)),
      seasonHeadcount(fromDay, toDay),
    ]);
    const pool = poolOnDay(day, snapshots);

    return NextResponse.json({
      day,
      season,
      // No wallet here, so this is the day's shared set — a sample of what a
      // board looks like. Connecting swaps it for the visitor's own five.
      sampleBoard: true,
      quests: questsForDay(day, undefined, pool).map((quest) => {
        const { id, title, task, game, cost, unit, link, art, note, copy, copyLabel } = quest;
        return {
          id,
          title,
          task,
          game,
          // Priced off the day's floor, the same as a connected wallet's board.
          points: pointsFor(quest, { floorRon: today.floorRon }),
          // A visitor who has not connected still sees the real threshold.
          target: targetFor(quest, { floorRon: today.floorRon }),
          cost,
          unit,
          link,
          art,
          needsLogs: needsLogs(quest),
          note,
          copy,
          copyLabel,
        };
      }),
      floorRon: today.floorRon,
      // The client draws its own board from the same pure function, so it
      // needs the same day's pool to draw from, and the same pinned quests.
      pool,
      featured,
      leaderboard,
      // The board shows a page of the table; the split needed all of it.
      seasonStandings: standings.slice(0, LEADERBOARD_ROWS),
      // How many are on the table in total, so the page can say what it is a
      // page of and offer the rest. Counted, not guessed from the rows above:
      // the query stops at the reward reach and the table does not.
      seasonPlayers,
      // What is up for the season. If this one has nothing published, the
      // next one's pool is shown instead rather than nothing at all — that is
      // the whole of the days before a season opens, when there is a pool to
      // announce and no season to announce it on yet.
      rewards: prizes
        ? {
            items: prizes.config.items,
            note: prizes.config.note,
            season: prizes.season.name,
            startsAt: prizes.season.startsAt,
            upcoming: prizes.upcoming,
            shares: prizes.config.showShares
              ? previewRewards(standings, prizes.config).filter((row) => row.shares.length)
              : null,
          }
        : null,
      seasonPersisted: hasStore(),
      roundsToday: today.rounds.length,
      playersToday: players.size,
      readAt: today.at,
      stale: today.error ?? null,
      logsMissing: today.logsMissing,
      logCoverage: today.logCoverage,
      resetsIn: secondsUntilReset(),
      updatedAt: Date.now(),
    }, { headers: shared(force) });
  } catch (error) {
    return NextResponse.json(
      { error: `Could not reach Ronin: ${error instanceof Error ? error.message : error}` },
      { status: 502 }
    );
  }
}
