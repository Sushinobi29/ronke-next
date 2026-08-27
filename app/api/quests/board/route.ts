import { NextResponse } from "next/server";
import { readMinesWindow } from "@/lib/quests/read";
import { dayIndex, dayStart, questsForDay, secondsUntilReset } from "@/lib/quests/daily";
import { seasonAt } from "@/lib/quests/season";

export const dynamic = "force-dynamic";

/**
 * The public half of the board: today's five quests and what the tables have
 * seen since midnight. Read from Ronin on a cold cache and held for a minute,
 * so one scan serves every visitor.
 */
const TTL_MS = 60_000;
let cache: { at: number; day: number; body: unknown } | null = null;
let inflight: Promise<unknown> | null = null;

async function build(day: number) {
  const rounds = await readMinesWindow(dayStart());
  const players = new Set(rounds.map((r) => r.player.toLowerCase()));

  return {
    day,
    season: seasonAt(),
    quests: questsForDay(day).map(({ id, title, task, game, points, target, verify }) => ({
      id,
      title,
      task,
      game,
      points,
      target,
      verify,
    })),
    roundsToday: rounds.length,
    playersToday: players.size,
    stakedToday: rounds
      .filter((r) => r.table === "RON")
      .reduce((sum, r) => sum + r.bet, 0),
    feed: rounds.slice(0, 8),
    resetsIn: secondsUntilReset(),
    updatedAt: Date.now(),
  };
}

export async function GET() {
  const day = dayIndex();
  if (cache && cache.day === day && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.body);
  }

  try {
    inflight = inflight ?? build(day);
    const body = await inflight;
    cache = { at: Date.now(), day, body };
    return NextResponse.json(body);
  } catch (error) {
    if (cache?.day === day) return NextResponse.json(cache.body);
    return NextResponse.json(
      { error: `Could not reach Ronin: ${error instanceof Error ? error.message : error}` },
      { status: 502 }
    );
  } finally {
    inflight = null;
  }
}
