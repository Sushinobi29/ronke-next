import { NextResponse } from "next/server";
import { getLeaderboard, getToday } from "@/lib/quests/today";
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
  hasStore,
  readFeatured,
  readPools,
  readRewards,
  seasonStandings,
} from "@/lib/quests/store";

export const dynamic = "force-dynamic";

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

    // The leaderboard returns what it has and refreshes behind the response,
    // so the five quests never wait on a scoring pass.
    const leaderboard = getLeaderboard(today);
    const [standings, rewards, nextRewards, snapshots, featured] = await Promise.all([
      seasonStandings(fromDay, toDay),
      readRewards(season.number),
      readRewards(season.number + 1),
      readPools(),
      readFeatured(day),
    ]);
    const pool = poolOnDay(day, snapshots);

    // The running season's prizes if it has any, otherwise the next season's.
    const prizes = rewards?.config.published
      ? { config: rewards.config, season, upcoming: false }
      : nextRewards?.config.published
        ? { config: nextRewards.config, season: seasonByNumber(season.number + 1), upcoming: true }
        : null;

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
      seasonStandings: standings,
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
            shares: prizes.config.showShares ? previewRewards(standings, prizes.config) : null,
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
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Could not reach Ronin: ${error instanceof Error ? error.message : error}` },
      { status: 502 }
    );
  }
}
