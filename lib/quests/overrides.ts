/**
 * Editable quest copy.
 *
 * The wording of a quest changes far more often than its design — a link
 * moves, a note turns out to confuse people, a social ask needs a different
 * word. None of that should need a deploy, so it lives in the database and is
 * laid over the quest at read time.
 *
 * What is NOT here is deliberate: points, targets, cost tiers and groups stay
 * in code. They are the currency the daily draw budgets against, and
 * questsForDay has to stay a pure function of the day and the wallet — the
 * client draws its own board from it, so anything the client cannot know
 * would reshuffle the board underneath somebody mid-quest. Copy is safe
 * precisely because it changes nothing about which five you get or what they
 * are worth.
 */

import type { QuestDef, SocialAsk } from "@/lib/quests/daily";

export interface QuestPatch {
  title?: string;
  task?: string;
  note?: string;
  link?: string;
  copy?: string;
  copyLabel?: string;
  ask?: SocialAsk;
}

export type QuestOverrides = Record<string, QuestPatch>;

/** The plain-text fields. `ask` is handled on its own, being a list. */
type TextField = "title" | "task" | "note" | "link" | "copy" | "copyLabel";

export const EDITABLE: TextField[] = [
  "title",
  "task",
  "note",
  "link",
  "copy",
  "copyLabel",
];

const LIMITS: Record<TextField, number> = {
  title: 40,
  task: 120,
  note: 140,
  link: 400,
  copy: 100,
  copyLabel: 40,
};

/**
 * One rule: an empty box is not an override, it is the absence of one, so the
 * field goes back to what the code says. The alternative — empty meaning
 * "blank it" — puts a quest with no title on the live board the moment
 * somebody clears a box to retype it.
 */
export function applyPatch<T extends QuestDef>(quest: T, patch: QuestPatch | undefined): T {
  if (!patch) return quest;
  const next = { ...quest };
  for (const key of EDITABLE) {
    const value = patch[key];
    if (typeof value === "string" && value.trim()) {
      (next as Record<string, unknown>)[key] = value.trim();
    }
  }
  // Only a quest that already asks for something can have what it asks edited.
  if (patch.ask && quest.ask) next.ask = patch.ask;
  return next;
}

export function applyAll<T extends QuestDef>(quests: T[], overrides: QuestOverrides): T[] {
  return quests.map((quest) => applyPatch(quest, overrides[quest.id]));
}

/** Only http(s), and nothing that could run script from a quest card. */
function safeLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export type SanitizedOverrides =
  | { ok: true; overrides: QuestOverrides }
  | { ok: false; error: string };

export function sanitizeOverrides(input: unknown): SanitizedOverrides {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "No quest edits were sent." };
  }

  const out: QuestOverrides = {};
  for (const [id, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!/^[a-z0-9.]{1,40}$/.test(id)) return { ok: false, error: `"${id}" is not a quest id.` };
    if (!raw || typeof raw !== "object") continue;

    const patch: QuestPatch = {};
    const entry = raw as Record<string, unknown>;

    for (const key of EDITABLE) {
      const value = entry[key];
      if (value === undefined || value === null) continue;
      if (typeof value !== "string") return { ok: false, error: `${id}: ${key} has to be text.` };
      const trimmed = value.trim();
      if (trimmed.length > LIMITS[key]) {
        return { ok: false, error: `${id}: ${key} is longer than ${LIMITS[key]} characters.` };
      }
      if (!trimmed) continue; // cleared: no override, so the code shows through
      if (key === "link" && !safeLink(trimmed)) {
        return { ok: false, error: `${id}: that link is not an http address.` };
      }
      patch[key] = trimmed;
    }

    if (entry.ask && typeof entry.ask === "object") {
      const ask = entry.ask as { all?: unknown; any?: unknown };
      const words = (list: unknown): string[] | null => {
        if (!Array.isArray(list)) return null;
        const cleaned = list
          .map((word) => String(word ?? "").trim())
          .filter(Boolean)
          .slice(0, 12);
        return cleaned.every((word) => word.length <= 40) ? cleaned : null;
      };
      const all = words(ask.all);
      const any = words(ask.any);
      if (!all || !any) {
        return { ok: false, error: `${id}: the required words are not a list of short words.` };
      }
      if (!all.length && !any.length) {
        return { ok: false, error: `${id}: a social quest needs at least one required word.` };
      }
      patch.ask = { all, any };
    }

    if (Object.keys(patch).length) out[id] = patch;
  }

  return { ok: true, overrides: out };
}

/** The line the admin signs. Same rule as the rewards: sign what is written. */
export function overridesMessage(
  overrides: QuestOverrides,
  address: string,
  issuedAt: string
): string {
  const ids = Object.keys(overrides).sort();
  const lines = ids.map((id) => {
    const patch = overrides[id];
    const fields = [
      ...EDITABLE.filter((key) => patch[key] !== undefined).map(
        (key) => `${key}=${patch[key] || "(cleared)"}`
      ),
      ...(patch.ask ? [`ask=[${patch.ask.all.join("|")}]+[${patch.ask.any.join("|")}]`] : []),
    ];
    return `- ${id}: ${fields.join("; ")}`;
  });

  return [
    "Ronke Quest — quest wording",
    "",
    `Wallet: ${address.toLowerCase()}`,
    `Issued: ${issuedAt}`,
    `Edited: ${ids.length} quest${ids.length === 1 ? "" : "s"}`,
    "",
    lines.length ? lines.join("\n") : "- nothing edited",
  ].join("\n");
}
