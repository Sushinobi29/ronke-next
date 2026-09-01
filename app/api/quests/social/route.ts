import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "@/lib/quests/read";
import { dailyCode, verifyPost } from "@/lib/quests/social";
import { dayIndex } from "@/lib/quests/daily";
import { hasStore, recordSocial, socialVerifiedOn } from "@/lib/quests/store";

export const dynamic = "force-dynamic";

/** The code a wallet has to put in its post today. */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!isAddress(address)) {
    return NextResponse.json({ error: "That is not a Ronin address." }, { status: 400 });
  }

  const day = dayIndex();
  const verified = await socialVerifiedOn(day);

  return NextResponse.json({
    code: dailyCode(day, address.trim()),
    verified: verified.has(address.trim().toLowerCase()),
    canRecord: hasStore(),
  });
}

/**
 * Checks a post against X and records it. Verification is free and keyless —
 * publish.x.com/oembed gives the author, the text and the date — and the daily
 * code is what stops a wallet claiming somebody else's post.
 */
export async function POST(request: NextRequest) {
  let body: { address?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send an address and a link." }, { status: 400 });
  }

  const { address, url } = body;
  if (!isAddress(address ?? null)) {
    return NextResponse.json({ error: "Connect a wallet first." }, { status: 400 });
  }
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Paste the link to your post." }, { status: 400 });
  }

  const day = dayIndex();
  const wallet = address!.trim().toLowerCase();

  const check = await verifyPost(url, day, wallet);
  if (!check.ok) {
    return NextResponse.json({ ok: false, error: check.reason }, { status: 422 });
  }

  await recordSocial(day, wallet, url.trim(), check.handle);

  return NextResponse.json({
    ok: true,
    handle: check.handle,
    // Without a store the check still passed, but it will not survive a reload.
    persisted: hasStore(),
  });
}
