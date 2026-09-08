/**
 * Verifying the social quest.
 *
 * X's paid API starts at a couple of hundred a month, which is absurd for
 * checking that someone posted. But publish.x.com/oembed is free, needs no
 * key, and returns the author handle, the post text and its date — enough to
 * check a post is real, is about the Ronkeverse, and went up today.
 *
 * The hole in that is obvious: anyone could paste someone else's post. That is
 * settled once, at sign-up: the wallet posts a line carrying a code only it
 * was shown, which binds its X handle. Every day after, a post just has to
 * come from that handle — so the code never has to appear in a normal post.
 */

const OEMBED = "https://publish.x.com/oembed";

/**
 * Whether a post says what the day's quest asked for.
 *
 * Whitespace is loosened and case ignored, but nothing else: the words are
 * shown to the player exactly as they are checked, so "post about X" and "we
 * looked for X" can never drift apart. Anything cleverer — stemming, fuzzy
 * matching — would make the check unexplainable, and a rule nobody can
 * predict is worse than a strict one.
 */
function says(text: string, phrase: string): boolean {
  const loosen = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
  return loosen(text).includes(loosen(phrase));
}

export function missingFrom(text: string, ask: SocialAsk): string[] {
  const missing = ask.all.filter((phrase) => !says(text, phrase));
  if (ask.any.length && !ask.any.some((phrase) => says(text, phrase))) {
    missing.push(ask.any.join(" or "));
  }
  return missing;
}

/** Short, unambiguous alphabet — no O/0, I/1 to mistype. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * The code a wallet must include in its post today. Derived, not stored, so it
 * survives a restart and needs no table of its own.
 */
export function dailyCode(day: number, address: string): string {
  let h = 0x811c9dc5;
  const seed = `${day}:${address.toLowerCase()}`;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let out = "";
  let n = h >>> 0;
  for (let i = 0; i < 4; i++) {
    out += ALPHABET[n % ALPHABET.length];
    n = Math.floor(n / ALPHABET.length);
  }
  return `RQ-${out}`;
}

import type { SocialAsk } from "@/lib/quests/daily";

export interface PostCheck {
  ok: boolean;
  reason?: string;
  handle?: string;
  postedAt?: string;
  /** The post's own id, so the same post cannot be claimed twice. */
  postId?: string;
}

export const QUEST_URL = "https://ronkeverse.com/quests";

/** The post that binds an X account to a wallet. */
export function signupText(code: string): string {
  return `I'm signing up for Ronke Quest — join me at ${QUEST_URL}\n\n${code}`;
}

/** Opens X with the sign-up post already written. */
export function signupIntent(code: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(signupText(code))}`;
}

/** Accepts x.com and twitter.com status links, rejects anything else. */
/** The status id out of a post link, which is the post's identity. */
export function postIdOf(raw: string): string | null {
  const url = normalize(raw);
  return url ? (url.split("/").pop() ?? null) : null;
}

/**
 * When a post was written, from its own id.
 *
 * X ids are snowflakes: the top 41 bits are milliseconds since November 2010.
 * That is exact, comes free with the link, and cannot be edited — where the
 * oEmbed blockquote gives only a date with no time and no timezone, which is
 * why "is this from today" used to need a day of slack in both directions and
 * accepted yesterday's post.
 *
 * Ids from before snowflakes are small and would decode to 2010; anything
 * outside the plausible range falls back to the blockquote date.
 */
const SNOWFLAKE_EPOCH_MS = 1_288_834_974_657;

export function postedAtFromId(id: string): Date | null {
  if (!/^\d{1,25}$/.test(id)) return null;
  try {
    const ms = Number(BigInt(id) >> BigInt(22)) + SNOWFLAKE_EPOCH_MS;
    // Ids minted before snowflakes are small and all decode into the first day
    // after the epoch, so anything landing there is not a real timestamp and
    // the blockquote date is the better answer. Nor can a post be from the
    // future, allowing an hour for a clock that disagrees.
    if (ms < SNOWFLAKE_EPOCH_MS + 86_400_000 || ms > Date.now() + 3_600_000) return null;
    return new Date(ms);
  } catch {
    return null;
  }
}

function normalize(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (!/^(www\.)?(x|twitter)\.com$/i.test(url.hostname)) return null;
    if (!/^\/[A-Za-z0-9_]{1,15}\/status\/\d{1,25}\/?$/.test(url.pathname)) return null;
    return `https://x.com${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

/** Strips the oEmbed blockquote to the words the author actually wrote. */
function textOf(html: string): string {
  const paragraph = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? html;
  return paragraph
    .replace(/<[^>]+>/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** The date oEmbed prints after the author, e.g. "March 21, 2006". */
function dateOf(html: string): Date | null {
  const match = html.match(/>([A-Z][a-z]+ \d{1,2}, \d{4})</);
  if (!match) return null;
  const parsed = Date.parse(`${match[1]} UTC`);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

interface Fetched {
  handle: string;
  text: string;
  posted: Date | null;
  id: string | null;
}

async function fetchPost(rawUrl: string): Promise<Fetched | { error: string }> {
  const url = normalize(rawUrl);
  if (!url) return { error: "That is not a link to a post on X." };

  let data: { author_name?: string; author_url?: string; html?: string };
  try {
    const res = await fetch(`${OEMBED}?url=${encodeURIComponent(url)}&omit_script=1&dnt=1`, {
      headers: { "User-Agent": "RonkeQuest/1.0" },
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        error:
          res.status === 404
            ? "X could not find that post. Is it public?"
            : "X did not answer. Try again in a moment.",
      };
    }
    data = await res.json();
  } catch {
    return { error: "Could not reach X. Try again in a moment." };
  }

  const html = data.html ?? "";
  const id = postIdOf(rawUrl);
  return {
    handle: data.author_url?.split("/").pop() ?? data.author_name ?? "",
    text: textOf(html),
    // The id is exact; the blockquote date is a fallback for old posts.
    posted: (id ? postedAtFromId(id) : null) ?? dateOf(html),
    id,
  };
}

/**
 * Whether a post was written on the quest day.
 *
 * Exact, now that the id gives a real timestamp: the day a post belongs to is
 * the UTC day it was written on, which is the same day the board rolls on. An
 * unknown date is refused rather than waved through — the previous reading,
 * that no date means today, let anything oEmbed could not date count.
 */
function isFromDay(posted: Date | null, day: number): boolean {
  if (!posted) return false;
  return Math.floor(posted.getTime() / 1000 / 86_400) === day;
}

/**
 * The one-off link. The post has to carry the wallet's code, which is the only
 * moment that code is ever needed.
 */
export async function verifySignup(
  rawUrl: string,
  day: number,
  address: string
): Promise<PostCheck> {
  const found = await fetchPost(rawUrl);
  if ("error" in found) return { ok: false, reason: found.error };

  const code = dailyCode(day, address);
  if (!found.text.toUpperCase().includes(code)) {
    return {
      ok: false,
      reason: `That post does not carry your code, ${code}.`,
      handle: found.handle,
    };
  }
  if (!found.handle) {
    return { ok: false, reason: "Could not read who posted that." };
  }

  return {
    ok: true,
    handle: found.handle,
    postedAt: found.posted?.toISOString(),
    postId: found.id ?? undefined,
  };
}

/**
 * A daily post. No code needed — the account is already bound to the wallet,
 * so what is left to check is that the post is from that account, from today,
 * and actually says what the quest asked for.
 */
export async function verifyDailyPost(
  rawUrl: string,
  day: number,
  handle: string,
  ask: SocialAsk
): Promise<PostCheck> {
  const found = await fetchPost(rawUrl);
  if ("error" in found) return { ok: false, reason: found.error };

  if (found.handle.toLowerCase() !== handle.toLowerCase()) {
    return {
      ok: false,
      reason: `That post is from @${found.handle}, not your linked @${handle}.`,
      handle: found.handle,
    };
  }
  const missing = missingFrom(found.text, ask);
  if (missing.length) {
    return {
      ok: false,
      reason: `That post is missing ${missing.join(", and ")}.`,
      handle: found.handle,
    };
  }
  if (!isFromDay(found.posted, day)) {
    const when = found.posted
      ? `That post is from ${found.posted.toISOString().slice(0, 10)}, not today.`
      : "Could not tell when that post was written.";
    return { ok: false, reason: `${when} Today's quest wants a post from today.`, handle: found.handle };
  }

  return {
    ok: true,
    handle: found.handle,
    postedAt: found.posted?.toISOString(),
    postId: found.id ?? undefined,
  };
}
