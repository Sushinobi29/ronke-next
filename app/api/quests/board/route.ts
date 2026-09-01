import { NextResponse } from "next/server";
import { getLeaderboard, getToday } from "@/lib/quests/today";
import { dayIndex, questsForDay, secondsUntilReset } from "@/lib/quests/daily";
import { seasonAt } from "@/lib/quests/season";
import { hasStore, readRewards, seasonStandings } from "@/lib/quests/store";

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
    const fromDay = Math.floor(season.startsAt / 86_400);
    const toDay = Math.floor((season.endsAt - 1) / 86_400);

    // The leaderboard returns what it has and refreshes behind the response,
    // so the five quests never wait on a scoring pass.
    const leaderboard = getLeaderboard(today);
    const [standings, rewards] = await Promise.all([
      seasonStandings(fromDay, toDay),
      readRewards(season.number),
    ]);

    return NextResponse.json({
      day,
      season,
      // No wallet here, so this is the day's shared set — a sample of what a
      // board looks like. Connecting swaps it for the visitor's own five.
      sampleBoard: true,
      quests: questsForDay(day).map(
        ({ id, title, task, game, points, target, cost, unit, link, art, needsLogs, note, dynamicTarget }) => ({
          id,
          title,
          task,
          game,
          points,
          // A visitor who has not connected still sees the real threshold.
          target: dynamicTarget?.({ floorRon: today.floorRon }) ?? target,
          cost,
          unit,
          link,
          art,
          needsLogs,
          note,
        })
      ),
      floorRon: today.floorRon,
      leaderboard,
      seasonStandings: standings,
      // What is up for the season, and nothing about who gets what: a
      // wallet's share moves every time anybody plays, so quoting one would
      // be quoting a number that is wrong by the time it is read.
      rewards: rewards?.config.published
        ? { items: rewards.config.items, note: rewards.config.note }
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
