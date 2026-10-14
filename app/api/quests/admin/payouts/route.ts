import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "@/lib/quests/read";
import { seasonByNumber, seasonDays, seasonAt } from "@/lib/quests/season";
import {
  hasStore,
  markPayoutSent,
  readPayouts,
  readRewards,
  writePayouts,
} from "@/lib/quests/store";
import { rankedStandings } from "@/lib/quests/standings";
import { hasAdmins, isAdmin, verifyAdminMessage } from "@/lib/quests/admin";
import { previewRewards } from "@/lib/quests/rewards";
import { parseUnits } from "viem";
import { tokenFor } from "@/lib/quests/contracts";
import { transfersOf } from "@/lib/quests/receipt";
import {
  batchMessage,
  checksumOf,
  freezeMessage,
  matchBatch,
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
 * What one batch transaction proves it paid, against what is owed.
 *
 * Shared by the preview and the write so the number an admin is shown before
 * signing is produced by the same code that acts on the signature.
 */
async function batchRead(season: number, itemId: string, txHash: string) {
  const owed = pendingOf(await readPayouts(season)).filter((row) => row.itemId === itemId);
  if (!owed.length) return { error: "Nothing is owed for that prize.", status: 422 } as const;

  const token = tokenFor(owed[0].label);
  if (!token) {
    return { error: `No contract is known for ${owed[0].label}.`, status: 422 } as const;
  }

  const read = await transfersOf(txHash, token.address);
  if (!read.ok) return { error: read.reason, status: 422 } as const;

  return {
    matched: matchBatch(owed, read.transfers, (row) =>
      parseUnits(String(row.amount), token.decimals)
    ),
  } as const;
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
  const table = await rankedStandings(fromDay, toDay, STANDINGS_LIMIT);
  const fresh = config ? freezeRows(previewRewards(table.rows, config)) : [];
  const current = await state(number);
  const merged = reconcile(current.rows, fresh);

  // A batch transaction can be checked against the chain before it is
  // recorded, so the count that gets signed is one the admin has already
  // seen. Read-only: nothing is written on this path.
  const tx = request.nextUrl.searchParams.get("tx");
  const item = request.nextUrl.searchParams.get("item");
  let batch: unknown = null;
  if (tx && item && /^0x[0-9a-fA-F]{64}$/.test(tx)) {
    const read = await batchRead(number, item, tx);
    batch =
      "error" in read
        ? { ok: false, error: read.error }
        : {
            ok: true,
            pays: read.matched.paid.length,
            stillOwed: read.matched.missed.length,
            spare: read.matched.spare.length,
            wallets: read.matched.paid.map((row) => row.address),
          };
  }

  return NextResponse.json({
    ...current,
    name: season.name,
    closed: Date.now() / 1000 > season.endsAt,
    fresh: {
      rows: fresh.length,
      checksum: checksumOf(fresh),
      totals: totalsOf(fresh),
    },
    // Ties are the normal result now that a season is worth the same to
    // everyone, and the order among equals is what the payout pays on. So the
    // panel is told whether the score that broke them could actually be read.
    scoredTiebreak: table.scored,
    scoresAsOf: table.asOf,
    tied: table.tied,
    unbroken: table.unbroken,
    // What put each wallet where it is, so the panel can show the reason next
    // to the amount rather than asking anyone to take the order on faith.
    standing: Object.fromEntries(
      table.rows.map((row, index) => [
        row.address,
        { rank: index + 1, points: row.points, score: row.score },
      ])
    ),
    batch,
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

    const table = await rankedStandings(fromDay, toDay, STANDINGS_LIMIT);
    const fresh = freezeRows(previewRewards(table.rows, config));
    if (!fresh.length) {
      return NextResponse.json({ error: "That season pays nobody." }, { status: 422 });
    }

    // Rank is money here — a harmonic falloff pays rank six half again what
    // it pays rank nine — so freezing a table full of ties while the score
    // that separates them cannot be read would pay people in address order
    // and call it a leaderboard. Refused rather than guessed at.
    if (!table.scored && table.tied > 0) {
      return NextResponse.json(
        {
          error: `${table.tied} wallets are level on points and Ronke Score could not be read, so their order would be arbitrary. Try again when the score API answers.`,
        },
        { status: 503 }
      );
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

  /**
   * Record one batch transaction as having paid many rows.
   *
   * Sending a hundred transfers by hand is a hundred signatures, and Ronin's
   * own Scatter tool does the same job in one transaction. The cost of that
   * is that the panel never sees the individual sends — so nothing here is
   * taken on trust. The transaction's Transfer logs are read back off the
   * chain and matched against what is owed, and only rows a log actually
   * proves get marked paid. The rest stay owed.
   */
  if (action === "batch") {
    const itemId = body.payment?.itemId ?? "";
    const txHash = body.payment?.txHash ?? "";
    if (!itemId || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return NextResponse.json({ error: "Which prize, and which transaction?" }, { status: 400 });
    }

    const read = await batchRead(number, itemId, txHash);
    if ("error" in read) {
      return NextResponse.json({ error: read.error }, { status: read.status });
    }
    const { matched } = read;
    if (!matched.paid.length) {
      return NextResponse.json(
        {
          error:
            "That transaction paid none of the wallets that are owed — check it is the right one, and for the right token.",
        },
        { status: 422 }
      );
    }

    const check = await verifyAdminMessage({
      address: address!,
      signature,
      issuedAt,
      message: batchMessage(number, itemId, txHash, matched.paid.length, issuedAt),
    });
    if (!check.ok) {
      return NextResponse.json({ error: check.reason }, { status: check.status });
    }

    for (const row of matched.paid) {
      await markPayoutSent(number, row.address, row.itemId, txHash);
    }

    return NextResponse.json({
      ok: true,
      recorded: matched.paid.length,
      stillOwed: matched.missed.length,
      spare: matched.spare.length,
      ...(await state(number)),
    });
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

