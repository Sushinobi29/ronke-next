import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "@/lib/quests/read";
import { poolOnDay } from "@/lib/quests/pool";
import { dailyCode, signupIntent, verifyDailyPost, verifySignup } from "@/lib/quests/social";
import { dayIndex, questsForDay, type SocialAsk } from "@/lib/quests/daily";
import {
  handleOwner,
  hasStore,
  linkHandle,
  linkedHandle,
  readPools,
  recordSocial,
  socialVerifiedOn,
} from "@/lib/quests/store";

export const dynamic = "force-dynamic";

/** Where the wallet stands: linked account, today's code, and the sign-up post. */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!isAddress(address)) {
    return NextResponse.json({ error: "That is not a Ronin address." }, { status: 400 });
  }

  const day = dayIndex();
  const wallet = address.trim().toLowerCase();
  const [handle, verified] = await Promise.all([
    linkedHandle(wallet),
    socialVerifiedOn(day),
  ]);
  const code = dailyCode(day, wallet);
  const quest = await socialQuestFor(day, wallet);

  return NextResponse.json({
    handle,
    code,
    signupUrl: signupIntent(code),
    verified: verified.has(wallet),
    // The player is shown the words the checker looks for, verbatim.
    ask: quest?.ask ?? null,
    task: quest?.task ?? null,
    canRecord: hasStore(),
  });
}

/** The social quest on this wallet's board today, if it drew one. */
async function socialQuestFor(day: number, wallet: string) {
  const pool = poolOnDay(day, await readPools());
  // The pool carries the ask, so the checker uses the words the player was
  // actually shown on the day they were shown them.
  return questsForDay(day, wallet, pool).find((quest) => quest.game === "social");
}

/**
 * Two jobs, told apart by whether the wallet already has an account linked.
 *
 * Unlinked, the post has to carry the wallet's code — that is what proves the
 * account belongs to whoever holds the wallet, and it is the only time the
 * code is needed. Linked, a post just has to come from that account, so people
 * can write whatever they like.
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
  const existing = await linkedHandle(wallet);

  if (!existing) {
    const check = await verifySignup(url, day, wallet);
    if (!check.ok) {
      return NextResponse.json({ ok: false, error: check.reason }, { status: 422 });
    }

    // One account cannot sign up a second wallet, or the whole link is theatre.
    const owner = await handleOwner(check.handle!);
    if (owner && owner !== wallet) {
      return NextResponse.json(
        { ok: false, error: `@${check.handle} is already linked to another wallet.` },
        { status: 409 }
      );
    }

    const stored = await linkHandle(wallet, check.handle!, url.trim());
    if (!stored) {
      return NextResponse.json(
        {
          ok: false,
          error: hasStore()
            ? "Could not save the link. Try again in a moment."
            : "Social quests are off here — no database is configured.",
        },
        { status: 503 }
      );
    }

    // Linking is not the quest. The sign-up line is written for them, so
    // counting it would pay out for pressing a button — the quest asks for
    // something they actually wrote.
    return NextResponse.json({
      ok: true,
      linked: check.handle,
      handle: check.handle,
      completed: false,
    });
  }

  const quest = await socialQuestFor(day, wallet);
  if (!quest?.ask) {
    return NextResponse.json(
      { ok: false, error: "No social quest on your board today. Come back tomorrow." },
      { status: 409 }
    );
  }

  const check = await verifyDailyPost(url, day, existing, quest.ask as SocialAsk);
  if (!check.ok) {
    return NextResponse.json({ ok: false, error: check.reason }, { status: 422 });
  }

  await recordSocial(day, wallet, url.trim(), check.handle);
  return NextResponse.json({
    ok: true,
    handle: check.handle,
    completed: true,
    persisted: hasStore(),
  });
}
