import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "@/lib/quests/read";
import { hasStore, readOverrides, writeOverrides } from "@/lib/quests/store";
import { hasAdmins, isAdmin, verifyAdminMessage } from "@/lib/quests/admin";
import { POOL } from "@/lib/quests/daily";
import { overridesMessage, sanitizeOverrides } from "@/lib/quests/overrides";

export const dynamic = "force-dynamic";

/**
 * Every quest as the code defines it, plus whatever has been written over it.
 * The panel needs both: the base to show what resetting means, the patch to
 * show what is currently live.
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!isAddress(address) || !isAdmin(address)) {
    return NextResponse.json({ admin: false, configured: hasAdmins() });
  }

  return NextResponse.json({
    admin: true,
    persisted: hasStore(),
    overrides: await readOverrides(),
    quests: POOL.map((quest) => ({
      id: quest.id,
      game: quest.game,
      cost: quest.cost,
      points: quest.points,
      base: {
        title: quest.title,
        task: quest.task,
        note: quest.note ?? "",
        link: quest.link ?? "",
        copy: quest.copy ?? "",
        copyLabel: quest.copyLabel ?? "",
        ask: quest.ask ?? null,
      },
    })),
  });
}

export async function POST(request: NextRequest) {
  let body: { address?: string; signature?: string; issuedAt?: string; overrides?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send signed quest edits." }, { status: 400 });
  }

  const { address, signature, issuedAt, overrides } = body;
  if (!isAddress(address ?? null)) {
    return NextResponse.json({ error: "Connect the admin wallet." }, { status: 400 });
  }
  if (!signature || !issuedAt) {
    return NextResponse.json({ error: "That write was not signed." }, { status: 400 });
  }

  const parsed = sanitizeOverrides(overrides);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 422 });
  }
  const cleaned = parsed.overrides;

  // Only ids the code actually defines, so a typo cannot plant a dead row.
  const known = new Set(POOL.map((quest) => quest.id));
  const unknown = Object.keys(cleaned).filter((id) => !known.has(id));
  if (unknown.length) {
    return NextResponse.json(
      { error: `No such quest: ${unknown.join(", ")}.` },
      { status: 422 }
    );
  }

  const check = await verifyAdminMessage({
    address: address!,
    signature,
    issuedAt,
    message: overridesMessage(cleaned, address!, issuedAt),
  });
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: check.status });
  }

  if (!(await writeOverrides(cleaned, address!))) {
    return NextResponse.json(
      {
        error: hasStore()
          ? "Could not save the edits. Try again in a moment."
          : "No database is configured, so quest wording cannot be saved.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, overrides: cleaned, updatedAt: new Date().toISOString() });
}
