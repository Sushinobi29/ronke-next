import { NextResponse } from "next/server";
import { buildBoard, readMinesWindow, readSeason, seasonStartBlock } from "@/lib/quests/read";
import { seasonAt } from "@/lib/quests/season";

export const dynamic = "force-dynamic";

/**
 * The public half of the quest board: the live season, its table ranking and
 * the activity feed. Read from Ronin on a cold cache and then held for a
 * minute — one scan serves every visitor, so the node sees about one read per
 * minute however many people are on the page.
 */
const TTL_MS = 60_000;
let cache: { at: number; body: unknown } | null = null;
let inflight: Promise<unknown> | null = null;

async function build() {
  const season = seasonAt();
  const startBlock = await seasonStartBlock(season);
  const rounds = await readMinesWindow(season.startsAt);
  const snapshot = await readSeason(rounds, startBlock);

  return {
    season: snapshot,
    board: buildBoard(rounds),
    feed: rounds.slice(0, 12),
    roundsScanned: rounds.length,
    updatedAt: Date.now(),
  };
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.body);
  }

  try {
    // Collapse simultaneous cold-cache requests into a single chain read.
    inflight = inflight ?? build();
    const body = await inflight;
    cache = { at: Date.now(), body };
    return NextResponse.json(body);
  } catch (error) {
    if (cache) return NextResponse.json(cache.body);
    return NextResponse.json(
      { error: `Could not reach Ronin: ${error instanceof Error ? error.message : error}` },
      { status: 502 }
    );
  } finally {
    inflight = null;
  }
}
