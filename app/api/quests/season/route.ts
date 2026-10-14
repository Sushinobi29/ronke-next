import { NextResponse } from "next/server";
import { previewRewards } from "@/lib/quests/rewards";
import {
  QUEST_SEASON_ONE,
  seasonAt,
  seasonByNumber,
  seasonDays,
} from "@/lib/quests/season";
import { hasStore, readRewards } from "@/lib/quests/store";
import { rankedStandings } from "@/lib/quests/standings";

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

  const now = seasonAt();
  const requested = Number(new URL(request.url).searchParams.get("season"));
  // A season that never ran has no table to show, and a season past the
  // current one has not happened yet.
  const wanted =
    Number.isFinite(requested) && requested >= QUEST_SEASON_ONE && requested <= now.number
      ? requested
      : now.number;
  const season = seasonByNumber(wanted);
  const { fromDay, toDay } = seasonDays(season);

  try {
    const [table, rewards] = await Promise.all([
      rankedStandings(fromDay, toDay, HARD_CAP),
      readRewards(season.number),
    ]);
    const standings = table.rows;

    const config = rewards?.config.published ? rewards.config : null;

    return NextResponse.json({
      season,
      // Every season that has run, so the page can offer them. Finished ones
      // are final; the running one still moves.
      seasons: Array.from({ length: now.number - QUEST_SEASON_ONE + 1 }, (_, i) => {
        const entry = seasonByNumber(QUEST_SEASON_ONE + i);
        return {
          number: entry.number,
          name: entry.name,
          running: entry.number === now.number,
        };
      }),
      players: standings.length,
      // Capped so a runaway season cannot hand the browser an unbounded list;
      // say so rather than quietly truncating.
      capped: standings.length >= HARD_CAP,
      standings,
      scoredTiebreak: table.scored,
      // Finished seasons never change, so they can sit in a cache far longer
      // than a running one — but the header below is shared, so the running
      // season's window is the one that has to be safe.
      closed: wanted < now.number,
      // Same shares the board shows, worked out over the same full table, so
      // an expanded row says exactly what the paged one did.
      shares:
        config?.showShares
          ? previewRewards(standings, config).filter((row) => row.shares.length)
          : null,
    }, {
      // The whole table, identical for everyone, and it only moves when a
      // scoring pass writes — eighty kilobytes of it. The page polls this
      // every sixty seconds, so a sixty second window expired in step with
      // the poll and served almost nothing from cache.
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
