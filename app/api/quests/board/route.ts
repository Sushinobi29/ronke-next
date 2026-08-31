import { NextResponse } from "next/server";
import { buildLeaderboard, getToday } from "@/lib/quests/today";
import { dayIndex, questsForDay, secondsUntilReset } from "@/lib/quests/daily";
import { seasonAt } from "@/lib/quests/season";

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

    return NextResponse.json({
      day,
      season: seasonAt(),
      quests: questsForDay(day).map(
        ({ id, title, task, game, points, target, verify, cost, unit, link, needsLogs, dynamicTarget }) => ({
          id,
          title,
          task,
          game,
          points,
          // A visitor who has not connected still sees the real threshold.
          target: dynamicTarget?.({ floorRon: today.floorRon }) ?? target,
          verify,
          cost,
          unit,
          link,
          needsLogs,
        })
      ),
      floorRon: today.floorRon,
      leaderboard: buildLeaderboard(today),
      roundsToday: today.rounds.length,
      playersToday: players.size,
      feed: today.rounds.slice(0, 8),
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
