import { NextResponse } from "next/server";
import { previewRewards } from "@/lib/quests/rewards";
import { seasonAt, seasonByNumber, seasonDays } from "@/lib/quests/season";
import { hasStore, readRewards, seasonStandings } from "@/lib/quests/store";

export const dynamic = "force-dynamic";

/**
 * The whole season table.
 *
 * Split out from the board because the board reads Ronin and this does not.
 * The standings live in Postgres and change once a scoring pass; asking the
 * board for them would drag a full chain read along behind a button that only
 * wants more rows, on a page that already polls the board every fifteen
 * seconds. This is one query, fetched when a player asks to see past the page
 * the board gave them.
 */
const HARD_CAP = 1000;

export async function GET(request: Request) {
  if (!hasStore()) {
    return NextResponse.json({ error: "Season totals need a database." }, { status: 503 });
  }

  const requested = Number(new URL(request.url).searchParams.get("season"));
  const season = Number.isFinite(requested) && requested > 0 ? seasonByNumber(requested) : seasonAt();
  const { fromDay, toDay } = seasonDays(season);

  try {
    const [standings, rewards] = await Promise.all([
      seasonStandings(fromDay, toDay, HARD_CAP),
      readRewards(season.number),
    ]);

    const config = rewards?.config.published ? rewards.config : null;

    return NextResponse.json({
      season,
      players: standings.length,
      // Capped so a runaway season cannot hand the browser an unbounded list;
      // say so rather than quietly truncating.
      capped: standings.length >= HARD_CAP,
      standings,
      // Same shares the board shows, worked out over the same full table, so
      // an expanded row says exactly what the paged one did.
      shares:
        config?.showShares
          ? previewRewards(standings, config).filter((row) => row.shares.length)
          : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
