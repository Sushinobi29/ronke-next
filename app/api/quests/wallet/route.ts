import { NextRequest, NextResponse } from "next/server";
import { isAddress, readMinesWindow, readWallet, seasonStartBlock } from "@/lib/quests/read";
import { scoreWallet } from "@/lib/quests/scoring";
import { seasonAt } from "@/lib/quests/season";

export const dynamic = "force-dynamic";

/**
 * Per-wallet season state. Nothing is stored: the address is scored from chain
 * reads on every request, so there is no account to create and nothing to sign.
 */
const TTL_MS = 60_000;
let roundsCache: { at: number; season: number; rounds: Awaited<ReturnType<typeof readMinesWindow>> } | null =
  null;

async function seasonRounds(seasonNumber: number, since: number) {
  if (roundsCache && roundsCache.season === seasonNumber && Date.now() - roundsCache.at < TTL_MS) {
    return roundsCache.rounds;
  }
  const rounds = await readMinesWindow(since);
  roundsCache = { at: Date.now(), season: seasonNumber, rounds };
  return rounds;
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");

  if (!isAddress(address)) {
    return NextResponse.json(
      { error: "That does not look like a Ronin address. Paste the 0x… form, or a ronin: address." },
      { status: 400 }
    );
  }

  try {
    const season = seasonAt();
    const [rounds, startBlock] = await Promise.all([
      seasonRounds(season.number, season.startsAt),
      seasonStartBlock(season),
    ]);
    const stats = await readWallet(address.trim(), rounds, startBlock);

    return NextResponse.json({
      address: address.trim().toLowerCase(),
      season,
      stats,
      score: scoreWallet(stats),
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Could not reach Ronin: ${error instanceof Error ? error.message : error}` },
      { status: 502 }
    );
  }
}
