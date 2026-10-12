import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "@/lib/quests/read";
import { seasonByNumber, seasonDays, seasonAt } from "@/lib/quests/season";
import {
  hasStore,
  markPayoutSent,
  readPayouts,
  readRewards,
  seasonStandings,
  writePayouts,
} from "@/lib/quests/store";
import { hasAdmins, isAdmin, verifyAdminMessage } from "@/lib/quests/admin";
import { previewRewards } from "@/lib/quests/rewards";
import {
  checksumOf,
  freezeMessage,
  freezeRows,
  pendingOf,
  reconcile,
  sentMessage,
  totalsOf,
} from "@/lib/quests/payouts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Enough rows to cover any reach a prize can have. */
const STANDINGS_LIMIT = 500;

async function state(season: number) {
  const rows = await readPayouts(season);
  return {
    season,
    rows,
    totals: totalsOf(rows),
    pending: pendingOf(rows).length,
    checksum: checksumOf(rows),
    frozen: rows.length > 0,
  };
}

/**
 * What this season owes, and what the standings say it would owe if frozen
 * now. Both, so the panel can show the difference before anybody commits.
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!isAddress(address) || !isAdmin(address)) {
    return NextResponse.json({ error: "That wallet cannot read payouts." }, { status: 403 });
  }
  if (!hasStore()) {
    return NextResponse.json({ error: "No database is configured." }, { status: 503 });
  }

  const wanted = Number(request.nextUrl.searchParams.get("season"));
  const number = Number.isFinite(wanted) && wanted > 0 ? wanted : seasonAt().number;
  const season = seasonByNumber(number);
  const { fromDay, toDay } = seasonDays(season);

  const stored = await readRewards(number);
  const config = stored?.config ?? null;
  const standings = await seasonStandings(fromDay, toDay, STANDINGS_LIMIT);
  const fresh = config ? freezeRows(previewRewards(standings, config)) : [];
  const current = await state(number);
  const merged = reconcile(current.rows, fresh);

  return NextResponse.json({
    ...current,
    name: season.name,
    closed: Date.now() / 1000 > season.endsAt,
    fresh: {
      rows: fresh.length,
      checksum: checksumOf(fresh),
      totals: totalsOf(fresh),
    },
    // What freezing again would do, so nothing is a surprise.
    wouldAdd: merged.added,
    wouldOrphan: merged.orphaned,
    conflicts: merged.conflicts,
  });
}

/**
 * Freeze the payout, or record that one row of it has been paid.
 *
 * Freezing takes the standings as they stand and writes them down; paid rows
 * are never rewritten. Recording a payment is one row at a time, each signed,
 * so a run that dies halfway leaves an exact record of how far it got.
 */
export async function POST(request: NextRequest) {
  let body: {
    address?: string;
    signature?: string;
    issuedAt?: string;
    season?: number;
    action?: string;
    checksum?: string;
    payment?: { address?: string; itemId?: string; txHash?: string };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a payout." }, { status: 400 });
  }

  const { address, signature, issuedAt, action } = body;
  if (!hasAdmins()) {
    return NextResponse.json({ error: "No admin wallet is configured." }, { status: 503 });
  }
  if (!isAddress(address ?? null) || !isAdmin(address)) {
    return NextResponse.json({ error: "That wallet cannot pay a season out." }, { status: 403 });
  }
  if (!signature || !issuedAt) {
    return NextResponse.json({ error: "That write was not signed." }, { status: 400 });
  }

  const number = Number(body.season);
  if (!Number.isFinite(number) || number <= 0) {
    return NextResponse.json({ error: "Which season?" }, { status: 400 });
  }

  if (action === "freeze") {
    const season = seasonByNumber(number);
    const { fromDay, toDay } = seasonDays(season);
    const config = (await readRewards(number))?.config ?? null;
    if (!config || !config.items.length) {
      return NextResponse.json({ error: "That season has no rewards configured." }, { status: 422 });
    }

    const standings = await seasonStandings(fromDay, toDay, STANDINGS_LIMIT);
    const fresh = freezeRows(previewRewards(standings, config));
    if (!fresh.length) {
      return NextResponse.json({ error: "That season pays nobody." }, { status: 422 });
    }

    const already = await readPayouts(number);
    const merged = reconcile(already, fresh);

    // The signature covers the list actually being written, recomputed here
    // rather than taken from the body.
    const check = await verifyAdminMessage({
      address: address!,
      signature,
      issuedAt,
      message: freezeMessage(number, checksumOf(merged.rows), merged.rows.length, address!, issuedAt),
    });
    if (!check.ok) {
      return NextResponse.json({ error: check.reason }, { status: check.status });
    }

    if (!(await writePayouts(number, merged.rows))) {
      return NextResponse.json({ error: "Could not write the payout." }, { status: 503 });
    }
    return NextResponse.json({ ok: true, ...(await state(number)), conflicts: merged.conflicts });
  }

  if (action === "sent") {
    const payment = body.payment ?? {};
    const to = payment.address ?? "";
    const itemId = payment.itemId ?? "";
    const txHash = payment.txHash ?? "";
    if (!isAddress(to) || !itemId || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return NextResponse.json({ error: "That payment is not complete." }, { status: 400 });
    }

    const check = await verifyAdminMessage({
      address: address!,
      signature,
      issuedAt,
      message: sentMessage(number, to, itemId, txHash, issuedAt),
    });
    if (!check.ok) {
      return NextResponse.json({ error: check.reason }, { status: check.status });
    }

    const recorded = await markPayoutSent(number, to, itemId, txHash);
    // Not an error: a retry after a timeout lands here, and the first record
    // is the one that counts.
    return NextResponse.json({ ok: true, recorded, ...(await state(number)) });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

