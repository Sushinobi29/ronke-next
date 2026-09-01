/**
 * Verifying the social quest.
 *
 * X's paid API starts at a couple of hundred a month, which is absurd for
 * checking that someone posted. But publish.x.com/oembed is free, needs no
 * key, and returns the author handle, the post text and its date — enough to
 * check a post is real, is about the Ronkeverse, and went up today.
 *
 * The hole in that is obvious: anyone could paste someone else's post. So each
 * wallet is shown a short code for the day, derived from its address, and the
 * post has to contain it. Only that wallet is told that code, so only that
 * wallet can produce a qualifying post.
 */

const OEMBED = "https://publish.x.com/oembed";

/** What a post has to be about to count. */
const MENTIONS = [/ronkeverse/i, /ronke\s*quest/i, /\$ronke\b/i, /@ronkeonron/i];

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

export interface PostCheck {
  ok: boolean;
  reason?: string;
  handle?: string;
  postedAt?: string;
}

/** Accepts x.com and twitter.com status links, rejects anything else. */
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

export async function verifyPost(
  rawUrl: string,
  day: number,
  address: string
): Promise<PostCheck> {
  const url = normalize(rawUrl);
  if (!url) return { ok: false, reason: "That is not a link to a post on X." };

  let data: { author_name?: string; author_url?: string; html?: string };
  try {
    const res = await fetch(
      `${OEMBED}?url=${encodeURIComponent(url)}&omit_script=1&dnt=1`,
      { headers: { "User-Agent": "RonkeQuest/1.0" }, cache: "no-store" }
    );
    if (!res.ok) {
      return {
        ok: false,
        reason:
          res.status === 404
            ? "X could not find that post. Is it public?"
            : "X did not answer. Try again in a moment.",
      };
    }
    data = await res.json();
  } catch {
    return { ok: false, reason: "Could not reach X. Try again in a moment." };
  }

  const html = data.html ?? "";
  const text = textOf(html);
  const handle = data.author_url?.split("/").pop() ?? data.author_name ?? "";

  const code = dailyCode(day, address);
  if (!text.toUpperCase().includes(code)) {
    return { ok: false, reason: `The post has to include your code, ${code}.`, handle };
  }

  if (!MENTIONS.some((pattern) => pattern.test(text))) {
    return { ok: false, reason: "Say something about the Ronkeverse in it.", handle };
  }

  // Posts are dated to the day in oEmbed, so compare days rather than instants.
  const posted = dateOf(html);
  if (posted) {
    const postedDay = Math.floor(posted.getTime() / 1000 / 86_400);
    if (postedDay < day - 1 || postedDay > day + 1) {
      return { ok: false, reason: "That post is not from today.", handle };
    }
  }

  return { ok: true, handle, postedAt: posted?.toISOString() };
}
