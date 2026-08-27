import { NextRequest, NextResponse } from "next/server";
import {
  blockAtSecond,
  isAddress,
  readDaily,
  readAorToday,
  readMinesWindow,
  readSpinsToday,
} from "@/lib/quests/read";
import { dayIndex, dayStart, scoreDay, secondsUntilReset } from "@/lib/quests/daily";

export const dynamic = "force-dynamic";

/**
 * One wallet's day. Nothing is stored — the address is scored from chain reads
 * on every request, so there is no account to create and nothing to sign.
 */
const TTL_MS = 60_000;
type Rounds = Awaited<ReturnType<typeof readMinesWindow>>;
type Spins = Awaited<ReturnType<typeof readSpinsToday>>;
type Aor = Awaited<ReturnType<typeof readAorToday>>;

let cache: { at: number; day: number; rounds: Rounds; spins: Spins; aor: Aor } | null = null;
let inflight: Promise<{ rounds: Rounds; spins: Spins; aor: Aor }> | null = null;

/**
 * The table history and the day's spins are the same for everyone, so they are
 * read once a minute and shared rather than re-scanned per visitor.
 */
async function sharedToday(day: number, since: number, startBlock: number) {
  if (cache && cache.day === day && Date.now() - cache.at < TTL_MS) return cache;

  inflight =
    inflight ??
    (async () => {
      const [rounds, spins, aor] = await Promise.all([
        readMinesWindow(since),
        readSpinsToday(startBlock),
        readAorToday(startBlock),
      ]);
      return { rounds, spins, aor };
    })();

  try {
    const fresh = await inflight;
    cache = { at: Date.now(), day, ...fresh };
    return cache;
  } finally {
    inflight = null;
  }
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");

  if (!isAddress(address)) {
    return NextResponse.json({ error: "That is not a Ronin address." }, { status: 400 });
  }

  try {
    const day = dayIndex();
    const since = dayStart();
    const startBlock = await blockAtSecond(since);
    const { rounds, spins, aor } = await sharedToday(day, since, startBlock);
    const stats = await readDaily(address.trim(), rounds, startBlock, spins, aor);

    return NextResponse.json({
      address: address.trim().toLowerCase(),
      stats,
      score: scoreDay(stats, day),
      resetsIn: secondsUntilReset(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Could not reach Ronin: ${error instanceof Error ? error.message : error}` },
      { status: 502 }
    );
  }
}
