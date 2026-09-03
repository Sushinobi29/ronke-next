"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";
import type { RoninWallet } from "@/hooks/useRoninWallet";
import {
  EDITABLE,
  overridesMessage,
  sanitizeOverrides,
  type QuestOverrides,
  type QuestPatch,
} from "@/lib/quests/overrides";
import type { SocialAsk } from "@/lib/quests/daily";

interface QuestRow {
  id: string;
  game: string;
  cost: string;
  points: number;
  base: {
    title: string;
    task: string;
    note: string;
    link: string;
    copy: string;
    copyLabel: string;
    ask: SocialAsk | null;
  };
}

const LABELS: Record<string, string> = {
  title: "Title",
  task: "What it asks",
  note: "Note under it",
  link: "Where it sends people",
  copy: "Address to copy",
  copyLabel: "Label above it",
};

/**
 * Quest wording, editable without a deploy.
 *
 * Only wording. Points, targets and cost tiers stay in code, because the daily
 * draw budgets against them and the client draws its own board from the same
 * pure function — a number the client could not know would reshuffle somebody
 * mid-quest. Copy is safe precisely because it changes nothing about which
 * five you get or what they pay.
 */
export default function QuestsAdminCopy({ wallet }: { wallet: RoninWallet }) {
  const address = wallet.address?.toLowerCase() ?? null;

  const [rows, setRows] = useState<QuestRow[]>([]);
  const [overrides, setOverrides] = useState<QuestOverrides>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let live = true;
    setLoading(true);
    fetch(`/api/quests/admin/quests?address=${address}`)
      .then((res) => res.json())
      .then((json) => {
        if (!live || !json.admin) return;
        setRows(json.quests ?? []);
        setOverrides(json.overrides ?? {});
      })
      .catch(() => live && setError("Could not load the quests."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [address]);

  const edited = useMemo(() => Object.keys(overrides).length, [overrides]);

  const patch = (id: string, change: Partial<QuestPatch>) =>
    setOverrides((current) => {
      const next = { ...current, [id]: { ...current[id], ...change } };
      // A patch equal to nothing is not a patch — drop it so the row goes too.
      const entry = next[id];
      const empty =
        !entry.ask &&
        EDITABLE.every((key) => entry[key] === undefined || entry[key] === "");
      if (empty) delete next[id];
      return next;
    });

  const reset = (id: string) =>
    setOverrides((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });

  const save = useCallback(async () => {
    setError(null);
    setSaved(null);
    const parsed = sanitizeOverrides(overrides);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const cleaned = parsed.overrides;
    if (!address) return;

    setSaving(true);
    try {
      const issuedAt = new Date().toISOString();
      const signature = await wallet.sign(overridesMessage(cleaned, address, issuedAt));
      const res = await fetch("/api/quests/admin/quests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature, issuedAt, overrides: cleaned }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Could not save the edits.");
        return;
      }
      setOverrides(json.overrides ?? {});
      const count = Object.keys(json.overrides ?? {}).length;
      setSaved(count ? `Live on ${count} quest${count === 1 ? "" : "s"}.` : "All back to the code.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(/reject|denied|cancel/i.test(message) ? "Signature cancelled." : message);
    } finally {
      setSaving(false);
    }
  }, [address, overrides, wallet]);

  if (loading) {
    return <div className="mono py-16 text-center text-sm text-muted-2">Loading the quests…</div>;
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quest wording</h1>
          <p className="mono mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-3">
            {rows.length} quests · {edited} edited
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-[13px] font-bold text-[#1a1204] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Signing…" : "Sign and save"}
          </button>
          {error && <span className="mono text-[12px] text-burn">{error}</span>}
          {saved && <span className="mono text-[12px] text-gold">{saved}</span>}
        </div>
      </div>

      <p className="mt-4 text-[13px] text-muted-1">
        Wording only. Points and thresholds stay in the code — the daily draw budgets against
        them, and a number the browser could not know would reshuffle a board somebody is halfway
        through. Empty a box and that field goes back to what the code says.
      </p>

      <div className="mt-6 space-y-2">
        {rows.map((row) => {
          const patched = overrides[row.id];
          const isOpen = open === row.id;
          const live = (key: keyof QuestPatch) =>
            (patched?.[key] as string | undefined) ?? "";

          return (
            <div
              key={row.id}
              className={`rv-card overflow-hidden ${patched ? "border-gold/40" : ""}`}
            >
              <button
                onClick={() => setOpen(isOpen ? null : row.id)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="mono block text-[10px] uppercase tracking-[0.12em] text-muted-3">
                    {row.id} · {row.game} · {row.points} pts
                    {patched && <span className="ml-2 text-gold">edited</span>}
                  </span>
                  <span className="mt-0.5 block truncate font-semibold">
                    {live("title") || row.base.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-muted-1">
                    {live("task") || row.base.task}
                  </span>
                </span>
                <span className="mono shrink-0 text-[11px] text-muted-3">
                  {isOpen ? "close" : "edit"}
                </span>
              </button>

              {isOpen && (
                <div className="space-y-3 border-t border-border-soft p-4">
                  {EDITABLE.filter(
                    (key) =>
                      !["copy", "copyLabel"].includes(key) ||
                      row.base.copy ||
                      row.base.copyLabel ||
                      live(key)
                  ).map((key) => (
                    <label key={key} className="block">
                      <span className="mono block text-[10px] uppercase tracking-[0.12em] text-muted-3">
                        {LABELS[key]}
                      </span>
                      <input
                        value={live(key)}
                        onChange={(e) => patch(row.id, { [key]: e.target.value })}
                        placeholder={row.base[key as keyof QuestRow["base"]] as string}
                        spellCheck={key !== "link" && key !== "copy"}
                        className="mono mt-1 w-full rounded-xl border border-border bg-card-2 px-3 py-2 text-[13px] outline-none placeholder:text-muted-3 focus:border-accent/60"
                      />
                    </label>
                  ))}

                  {row.base.ask && (
                    <AskEditor
                      base={row.base.ask}
                      value={patched?.ask ?? null}
                      onChange={(ask) => patch(row.id, { ask })}
                    />
                  )}

                  {patched && (
                    <button
                      onClick={() => reset(row.id)}
                      className="mono inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-muted-3 transition-colors hover:text-burn"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Back to the code
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/**
 * The words a social post is checked against. Players are shown these exactly
 * as they are matched, so what is typed here is what people read.
 */
function AskEditor({
  base,
  value,
  onChange,
}: {
  base: SocialAsk;
  value: SocialAsk | null;
  onChange: (ask: SocialAsk) => void;
}) {
  const current = value ?? base;
  const line = (list: string[]) => list.join(", ");
  const parse = (text: string) =>
    text
      .split(",")
      .map((word) => word.trim())
      .filter(Boolean);

  return (
    <div className="rounded-xl border border-border bg-card-2 p-3">
      <div className="mono text-[10px] uppercase tracking-[0.12em] text-muted-3">
        Words the post must contain
      </div>
      <label className="mt-2 block">
        <span className="text-[12px] text-muted-1">All of these, comma separated</span>
        <input
          value={line(current.all)}
          onChange={(e) => onChange({ all: parse(e.target.value), any: current.any })}
          className="mono mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-accent/60"
        />
      </label>
      <label className="mt-2 block">
        <span className="text-[12px] text-muted-1">And at least one of these</span>
        <input
          value={line(current.any)}
          onChange={(e) => onChange({ all: current.all, any: parse(e.target.value) })}
          className="mono mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-accent/60"
        />
      </label>
      <p className="mt-2 text-[11px] text-muted-3">
        Matched case-insensitively, whitespace loosened, nothing else — a rule nobody can predict
        is worse than a strict one.
      </p>
    </div>
  );
}
