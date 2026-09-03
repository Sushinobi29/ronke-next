import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "@/lib/quests/read";
import { hasStore, readPools, writePool } from "@/lib/quests/store";
import { hasAdmins, isAdmin, verifyAdminMessage } from "@/lib/quests/admin";
import { BASE_POOL, dayIndex, secondsUntilReset, type QuestDef } from "@/lib/quests/daily";
import { METRICS } from "@/lib/quests/metrics";
import {
  COSTS,
  GAMES,
  mergeWording,
  poolMessage,
  poolOnDay,
  reportOn,
  sanitizePool,
} from "@/lib/quests/pool";

export const dynamic = "force-dynamic";

/** A change made today runs from tomorrow. There is no other option. */
const nextDay = () => dayIndex() + 1;

/**
 * The pool the panel edits: whatever is in force tomorrow, since that is the
 * earliest day an edit can apply to. Today's is sent alongside so the panel
 * can say what is live right now.
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!isAddress(address) || !isAdmin(address)) {
    return NextResponse.json({ admin: false, configured: hasAdmins() });
  }

  const today = dayIndex();
  const snapshots = await readPools();
  const editing = poolOnDay(nextDay(), snapshots);

  return NextResponse.json({
    admin: true,
    persisted: hasStore(),
    today,
    from: nextDay(),
    secondsUntilReset: secondsUntilReset(),
    pool: editing,
    live: poolOnDay(today, snapshots),
    shipped: BASE_POOL,
    report: reportOn(editing, nextDay()),
    metrics: METRICS,
    games: GAMES,
    costs: COSTS,
    history: snapshots.map(({ from, updatedBy, updatedAt, pool }) => ({
      from,
      updatedBy,
      updatedAt,
      quests: pool.length,
    })),
  });
}

/**
 * Two jobs. Without a signature this is a dry run — the panel asks what a pool
 * would do and gets the report back without writing anything, which is how the
 * fairness numbers stay live while somebody is still editing. With one, it is
 * the write.
 */
export async function POST(request: NextRequest) {
  let body: { address?: string; signature?: string; issuedAt?: string; pool?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a pool." }, { status: 400 });
  }

  const { address, signature, issuedAt, pool } = body;
  if (!isAddress(address ?? null) || !isAdmin(address)) {
    return NextResponse.json({ error: "That wallet cannot edit quests." }, { status: 403 });
  }

  const parsed = sanitizePool(pool);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 422 });
  }

  const from = nextDay();
  const report = reportOn(parsed.pool, from);

  if (!signature) {
    return NextResponse.json({ ok: false, dryRun: true, report });
  }

  // A pool the draw cannot run is not a matter of taste. Warnings are the
  // admin's call; errors are not.
  if (report.errors.length) {
    return NextResponse.json(
      { error: `That pool cannot be drawn from: ${report.errors[0]}`, report },
      { status: 422 }
    );
  }
  if (!issuedAt) {
    return NextResponse.json({ error: "That write was not signed." }, { status: 400 });
  }

  const snapshots = await readPools();
  const check = await verifyAdminMessage({
    address: address!,
    signature,
    issuedAt,
    message: poolMessage(parsed.pool, poolOnDay(from, snapshots), from, address!, issuedAt),
  });
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: check.status });
  }

  // Wording lands today as well: it cannot move a board, and nobody should
  // have to live with a wrong link until midnight. What a quest *is* waits.
  const today = dayIndex();
  const livePool = poolOnDay(today, snapshots);
  const wordingToday = mergeWording(livePool, parsed.pool);
  const wordingChangedToday = JSON.stringify(wordingToday) !== JSON.stringify(livePool);

  if (!(await writePool(from, parsed.pool as QuestDef[], address!))) {
    return NextResponse.json(
      {
        error: hasStore()
          ? "Could not save the pool. Try again in a moment."
          : "No database is configured, so the pool cannot be saved.",
      },
      { status: 503 }
    );
  }

  if (wordingChangedToday) {
    await writePool(today, wordingToday, address!);
  }

  return NextResponse.json({
    ok: true,
    from,
    pool: parsed.pool,
    report,
    wordingLiveNow: wordingChangedToday,
    secondsUntilReset: secondsUntilReset(),
  });
}
