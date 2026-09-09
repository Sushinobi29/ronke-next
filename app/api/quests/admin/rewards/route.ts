import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "@/lib/quests/read";
import { seasonAt, seasonByNumber, seasonDays, secondsLeft } from "@/lib/quests/season";
import { hasStore, readRewards, seasonStandings, writeRewards } from "@/lib/quests/store";
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
function seasonWindow(wanted?: number | null) {
  const now = seasonAt();
  const number =
    wanted && wanted >= now.number && wanted <= now.number + 1 ? wanted : now.number;
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
  const [stored, standings, next] = await Promise.all([
    readRewards(season.number),
    seasonStandings(fromDay, toDay, STANDINGS_LIMIT),
    readRewards(current + 1),
  ]);

  const config = stored?.config ?? EMPTY_REWARDS;

  return NextResponse.json({
    admin: true,
    configured: true,
    persisted: hasStore(),
    season,
    // Which seasons can be written, and whether the next one is set up yet.
    seasons: [
      { ...seasonByNumber(current), running: true, secondsLeft: secondsLeft(seasonByNumber(current)) },
      { ...seasonByNumber(current + 1), running: false, secondsLeft: 0 },
    ],
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

  const standings = await seasonStandings(fromDay, toDay, STANDINGS_LIMIT);
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
