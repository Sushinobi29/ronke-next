import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "@/lib/quests/read";
import { seasonAt } from "@/lib/quests/season";
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

function seasonWindow() {
  const season = seasonAt();
  return {
    season,
    fromDay: Math.floor(season.startsAt / 86_400),
    toDay: Math.floor((season.endsAt - 1) / 86_400),
  };
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

  const { season, fromDay, toDay } = seasonWindow();
  const [stored, standings] = await Promise.all([
    readRewards(season.number),
    seasonStandings(fromDay, toDay, STANDINGS_LIMIT),
  ]);

  const config = stored?.config ?? EMPTY_REWARDS;

  return NextResponse.json({
    admin: true,
    configured: true,
    persisted: hasStore(),
    season,
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
  let body: { address?: string; signature?: string; issuedAt?: string; config?: unknown };
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

  const { season, fromDay, toDay } = seasonWindow();
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
    config: cleaned,
    updatedAt: new Date().toISOString(),
    updatedBy: address!.toLowerCase(),
    standings,
    preview: previewRewards(standings, cleaned),
  });
}
