import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "@/lib/quests/read";
import {
  QUEST_SEASON_ONE,
  seasonAt,
  seasonByNumber,
  seasonDays,
  secondsLeft,
} from "@/lib/quests/season";
import { hasStore, readPayouts, readRewards, writeRewards } from "@/lib/quests/store";
import { rankedStandings } from "@/lib/quests/standings";
import { hasAdmins, isAdmin, verifyAdminWrite } from "@/lib/quests/admin";
import {
  EMPTY_REWARDS,
  previewRewards,
  sanitize,
  SUGGESTED_ITEMS,
  type RewardsConfig,
} from "@/lib/quests/rewards";

export const dynamic = "force-dynamic";

const STANDINGS_LIMIT = 200;

/**
 * The season being configured. The one running, or the one after it — no
 * further, because rewards for a season three months out are a guess, and no
 * earlier, because a closed season's prizes are a record rather than a plan.
 */
/**
 * Which season the panel is working on.
 *
 * Finished seasons are reachable, not just the running one and the next. A
 * season is paid out after it closes — that is what paying out means — and
 * until now the only seasons that could be selected were the current one and
 * the one after it, so the payout panel could never be pointed at the season
 * that actually needed paying.
 */
function seasonWindow(wanted?: number | null) {
  const now = seasonAt();
  const number =
    wanted && wanted >= QUEST_SEASON_ONE && wanted <= now.number + 1 ? wanted : now.number;
  const season = seasonByNumber(number);
  return { season, ...seasonDays(season), current: now.number };
}

/**
 * The panel's whole state: what is written for this season, and what it would
 * pay against the standings as they stand right now.
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  const admin = isAddress(address) && isAdmin(address);

  if (!admin) {
    return NextResponse.json(
      { admin: false, configured: hasAdmins() },
      // Not an error: the page uses this to decide whether to render at all.
      { status: 200 }
    );
  }

  const wanted = Number(request.nextUrl.searchParams.get("season"));
  const { season, fromDay, toDay, current } = seasonWindow(Number.isFinite(wanted) ? wanted : null);
  const [stored, table, next] = await Promise.all([
    readRewards(season.number),
    rankedStandings(fromDay, toDay, STANDINGS_LIMIT),
    readRewards(current + 1),
  ]);
  const standings = table.rows;

  const config = stored?.config ?? EMPTY_REWARDS;

  return NextResponse.json({
    admin: true,
    configured: true,
    persisted: hasStore(),
    season,
    // Which seasons can be written, and whether the next one is set up yet.
    // Every season Ronke Quest has run, plus the one being set up.
    seasons: Array.from(
      { length: current + 1 - QUEST_SEASON_ONE + 1 },
      (_, i) => QUEST_SEASON_ONE + i
    ).map((number) => {
      const entry = seasonByNumber(number);
      return {
        ...entry,
        running: number === current,
        finished: number < current,
        secondsLeft: number === current ? secondsLeft(entry) : 0,
      };
    }),
    nextConfigured: Boolean(next?.config.items.length),
    started: season.number <= current,
    config,
    suggested: SUGGESTED_ITEMS,
    updatedBy: stored?.updatedBy ?? null,
    updatedAt: stored?.updatedAt ?? null,
    standings,
    preview: previewRewards(standings, config),
  });
}

/**
 * Writes the season's rewards. The signature is checked against the config
 * after it has been cleaned up, which is the version that gets stored — so
 * what was signed and what is written are the same numbers.
 */
export async function POST(request: NextRequest) {
  let body: {
    address?: string;
    signature?: string;
    issuedAt?: string;
    config?: unknown;
    season?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a signed config." }, { status: 400 });
  }

  const { address, signature, issuedAt, config } = body;
  if (!isAddress(address ?? null)) {
    return NextResponse.json({ error: "Connect the admin wallet." }, { status: 400 });
  }
  if (!signature || !issuedAt) {
    return NextResponse.json({ error: "That write was not signed." }, { status: 400 });
  }

  const cleaned = sanitize(config);
  if ("error" in cleaned) {
    return NextResponse.json({ error: cleaned.error }, { status: 422 });
  }

  const { season, fromDay, toDay } = seasonWindow(
    typeof body.season === "number" ? body.season : null
  );
  const check = await verifyAdminWrite({
    address: address!,
    signature,
    issuedAt,
    season: season.number,
    config: cleaned,
  });
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: check.status });
  }

  // Editing the prizes of a season that is already being paid would leave the
  // frozen list and the config saying different things, and the frozen list is
  // the one with people's money in it.
  if ((await readPayouts(season.number)).length) {
    return NextResponse.json(
      { error: "That season's payout is already frozen, so its prizes cannot be changed." },
      { status: 409 }
    );
  }

  if (!(await writeRewards(season.number, cleaned as RewardsConfig, address!))) {
    return NextResponse.json(
      {
        error: hasStore()
          ? "Could not save the rewards. Try again in a moment."
          : "No database is configured, so rewards cannot be saved.",
      },
      { status: 503 }
    );
  }

  const standings = (await rankedStandings(fromDay, toDay, STANDINGS_LIMIT)).rows;
  return NextResponse.json({
    ok: true,
    season: season.number,
    config: cleaned,
    updatedAt: new Date().toISOString(),
    updatedBy: address!.toLowerCase(),
    standings,
    preview: previewRewards(standings, cleaned),
  });
}
