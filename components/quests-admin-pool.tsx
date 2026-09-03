"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, Plus, Save, Undo2, X } from "lucide-react";
import type { RoninWallet } from "@/hooks/useRoninWallet";
import {
  COST_LABELS,
  GAME_LABELS,
  pointsForRon,
  type CostTier,
  type QuestDef,
  type QuestGame,
} from "@/lib/quests/daily";
import type { Metric } from "@/lib/quests/metrics";
import { COSTS, GAMES, poolMessage, reportOn, sanitizePool } from "@/lib/quests/pool";

const clock = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
};

const blank = (): QuestDef => ({
  id: "",
  title: "",
  task: "",
  game: "casino",
  tier: "core",
  group: "",
  cost: "tokens",
  metric: "flips",
  target: 1,
  points: 100,
});

/**
 * The quest pool, editable.
 *
 * Two things make that safe enough to hand over. A saved pool runs from the
 * next reset, never today — so no board is redrawn under somebody halfway
 * through it, and no scored day is rewritten after the fact. And the draw is
 * simulated against the pool as it is being edited, thousands of boards of it,
 * because the interesting failures here are emergent rather than obvious: a
 * quest priced above what a board can carry is perfectly valid on its own and
 * simply never appears. That is not a hypothetical — it happened, and it took
 * a fortnight and somebody asking to notice.
 */
export default function QuestsAdminPool({ wallet }: { wallet: RoninWallet }) {
  const address = wallet.address?.toLowerCase() ?? null;

  const [pool, setPool] = useState<QuestDef[] | null>(null);
  const [shipped, setShipped] = useState<QuestDef[]>([]);
  const [saved, setSavedPool] = useState<QuestDef[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [from, setFrom] = useState<number | null>(null);
  const [resetIn, setResetIn] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let live = true;
    fetch(`/api/quests/admin/pool?address=${address}`)
      .then((res) => res.json())
      .then((json) => {
        if (!live || !json.admin) return;
        setPool(json.pool);
        setSavedPool(json.pool);
        setShipped(json.shipped ?? []);
        setMetrics(json.metrics ?? []);
        setFrom(json.from ?? null);
        setResetIn(json.secondsUntilReset ?? null);
      })
      .catch(() => live && setError("Could not load the pool."));
    return () => {
      live = false;
    };
  }, [address]);

  const counting = resetIn !== null;
  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(
      () => setResetIn((left) => (left === null ? null : Math.max(0, left - 1))),
      1000
    );
    return () => clearInterval(timer);
  }, [counting]);

  // Run in the browser rather than on the server: it is a pure simulation of a
  // pure draw, so the numbers can move with every keystroke instead of behind
  // a round trip.
  const report = useMemo(
    () => (pool && from !== null ? reportOn(pool, from) : null),
    [pool, from]
  );

  const dirty = useMemo(
    () => JSON.stringify(pool) !== JSON.stringify(saved),
    [pool, saved]
  );

  const patch = (index: number, change: Partial<QuestDef>) =>
    setPool((current) =>
      current ? current.map((quest, i) => (i === index ? { ...quest, ...change } : quest)) : current
    );

  const save = useCallback(async () => {
    if (!pool || !address) return;
    setError(null);
    setDone(null);

    const parsed = sanitizePool(pool);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setBusy(true);
    try {
      const issuedAt = new Date().toISOString();
      const signature = await wallet.sign(
        poolMessage(parsed.pool, saved, from ?? 0, address, issuedAt)
      );
      const res = await fetch("/api/quests/admin/pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature, issuedAt, pool: parsed.pool }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Could not save the pool.");
        return;
      }
      setPool(json.pool);
      setSavedPool(json.pool);
      setDone(`Live from tomorrow — ${resetIn !== null ? clock(resetIn) : "the next reset"} away.`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(/reject|denied|cancel/i.test(message) ? "Signature cancelled." : message);
    } finally {
      setBusy(false);
    }
  }, [pool, address, saved, from, wallet, resetIn]);

  if (!pool || !report) {
    return <div className="mono py-16 text-center text-sm text-muted-2">Loading the pool…</div>;
  }

  const liveCount = pool.filter((quest) => !quest.retired).length;
  const shares = new Map(report.draws.map((drawn) => [drawn.id, drawn.share]));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quest pool</h1>
          <p className="mono mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-3">
            {liveCount} live of {pool.length} · in force from the next reset
            {resetIn !== null && `, ${clock(resetIn)} away`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {dirty && (
            <button
              onClick={() => setPool(saved)}
              className="mono inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-muted-3 transition-colors hover:text-burn"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Discard
            </button>
          )}
          <button
            onClick={save}
            disabled={busy || !dirty || report.errors.length > 0}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-[13px] font-bold text-[#1a1204] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {busy ? "Signing…" : "Sign and save"}
          </button>
        </div>
      </div>

      {error && <p className="mono mt-3 text-[12px] text-burn">{error}</p>}
      {done && <p className="mono mt-3 text-[12px] text-gold">{done}</p>}

      {/* ------------------------------------------------ the fairness read */}
      <section className="rv-card mt-6 p-5">
        <div className="mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted-3">
          What this pool would do · {report.boards.toLocaleString()} boards simulated
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Stat
            label="A day is worth"
            value={`${report.worth.min}–${report.worth.max}`}
            note={`mean ${report.worth.mean}`}
          />
          <Stat
            label="Season spread"
            value={`${report.seasonSpread}%`}
            note="two wallets clearing every board"
            bad={report.seasonSpread > 4}
          />
          <Stat
            label="Rarest quest"
            value={report.draws[0] ? `${report.draws[0].share}%` : "—"}
            note={report.draws[0]?.title ?? ""}
            bad={report.draws[0]?.share === 0}
          />
        </div>

        {report.errors.map((message) => (
          <p key={message} className="mono mt-3 flex gap-2 text-[12px] text-burn">
            <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {message}
          </p>
        ))}
        {report.warnings.map((message) => (
          <p key={message} className="mono mt-3 flex gap-2 text-[12px] text-paper">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {message}
          </p>
        ))}
        {!report.errors.length && !report.warnings.length && (
          <p className="mono mt-3 flex gap-2 text-[12px] text-diamond">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Every quest is reachable and every board is worth about the same.
          </p>
        )}
      </section>

      {/* ------------------------------------------------------- the quests */}
      <div className="mt-6 space-y-2">
        {pool.map((quest, index) => {
          const isOpen = open === quest.id || (!quest.id && open === `new-${index}`);
          const share = shares.get(quest.id);
          const base = shipped.find((s) => s.id === quest.id);
          const changed = base && JSON.stringify(base) !== JSON.stringify(quest);
          const kind = metrics.find((m) => m.key === quest.metric)?.kind;

          return (
            <div
              key={quest.id || `new-${index}`}
              className={`rv-card overflow-hidden ${quest.retired ? "opacity-50" : ""} ${
                !base ? "border-diamond/40" : changed ? "border-gold/40" : ""
              }`}
            >
              <button
                onClick={() => setOpen(isOpen ? null : quest.id || `new-${index}`)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="mono block text-[10px] uppercase tracking-[0.12em] text-muted-3">
                    {quest.id || "new quest"} · {GAME_LABELS[quest.game]} ·{" "}
                    {COST_LABELS[quest.cost]}
                    {!base && <span className="ml-2 text-diamond">added</span>}
                    {changed && <span className="ml-2 text-gold">changed</span>}
                    {quest.retired && <span className="ml-2 text-burn">retired</span>}
                  </span>
                  <span className="mt-0.5 block truncate font-semibold">
                    {quest.title || "Untitled"}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-muted-1">
                    {quest.task || "No task yet"}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="mono block text-[15px] font-bold text-muted-2">
                    {quest.points}
                  </span>
                  <span
                    className={`mono block text-[10px] uppercase tracking-[0.1em] ${
                      share === 0 ? "text-burn" : "text-muted-3"
                    }`}
                  >
                    {quest.retired ? "—" : share === undefined ? "dark" : `${share}%`}
                  </span>
                </span>
              </button>

              {isOpen && (
                <div className="space-y-3 border-t border-border-soft p-4">
                  <Field label="Id">
                    <input
                      value={quest.id}
                      onChange={(e) => patch(index, { id: e.target.value })}
                      placeholder="game.thing"
                      disabled={!!base}
                      className="mono w-full rounded-xl border border-border bg-card-2 px-3 py-2 text-[13px] outline-none focus:border-accent/60 disabled:opacity-60"
                    />
                  </Field>

                  <Field label="Title">
                    <input
                      value={quest.title}
                      onChange={(e) => patch(index, { title: e.target.value })}
                      className="w-full rounded-xl border border-border bg-card-2 px-3 py-2 text-[13px] font-semibold outline-none focus:border-accent/60"
                    />
                  </Field>
                  <Field label="What it asks">
                    <input
                      value={quest.task}
                      onChange={(e) => patch(index, { task: e.target.value })}
                      className="w-full rounded-xl border border-border bg-card-2 px-3 py-2 text-[13px] outline-none focus:border-accent/60"
                    />
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Game">
                      <Select
                        value={quest.game}
                        options={GAMES.map((g) => [g, GAME_LABELS[g as QuestGame]])}
                        onChange={(v) => patch(index, { game: v as QuestGame })}
                      />
                    </Field>
                    <Field label="Costs">
                      <Select
                        value={quest.cost}
                        options={COSTS.map((c) => [c, COST_LABELS[c as CostTier]])}
                        onChange={(v) => patch(index, { cost: v as CostTier })}
                      />
                    </Field>
                    <Field label="Slot">
                      <Select
                        value={quest.tier}
                        options={[
                          ["core", "Core — cheap slot"],
                          ["bonus", "Bonus — paid slot"],
                        ]}
                        onChange={(v) => patch(index, { tier: v as "core" | "bonus" })}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Measured by">
                      <Select
                        value={quest.metric}
                        options={metrics.map((m) => [m.key as string, m.label])}
                        onChange={(v) => patch(index, { metric: v })}
                      />
                    </Field>
                    <Field label={kind === "ron" ? "RON needed" : "How many"}>
                      <input
                        type="number"
                        min={1}
                        value={quest.target}
                        onChange={(e) => patch(index, { target: Number(e.target.value) })}
                        className="mono w-full rounded-xl border border-border bg-card-2 px-3 py-2 text-[13px] outline-none focus:border-accent/60"
                      />
                    </Field>
                    <Field label="Points">
                      <input
                        type="number"
                        min={25}
                        step={25}
                        value={quest.points}
                        onChange={(e) => patch(index, { points: Number(e.target.value) })}
                        className="mono w-full rounded-xl border border-border bg-card-2 px-3 py-2 text-[13px] outline-none focus:border-accent/60"
                      />
                    </Field>
                  </div>

                  {kind === "ron" && (
                    <LadderHint
                      ron={quest.target}
                      points={quest.points}
                      onApply={(points) => patch(index, { points })}
                    />
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Group — one per board">
                      <input
                        value={quest.group}
                        onChange={(e) => patch(index, { group: e.target.value })}
                        placeholder={quest.id}
                        className="mono w-full rounded-xl border border-border bg-card-2 px-3 py-2 text-[13px] outline-none focus:border-accent/60"
                      />
                    </Field>
                    <Field label="Note under it">
                      <input
                        value={quest.note ?? ""}
                        onChange={(e) => patch(index, { note: e.target.value })}
                        className="w-full rounded-xl border border-border bg-card-2 px-3 py-2 text-[13px] outline-none focus:border-accent/60"
                      />
                    </Field>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Where it sends people">
                      <input
                        value={quest.link ?? ""}
                        onChange={(e) => patch(index, { link: e.target.value })}
                        placeholder="the game's own page"
                        className="mono w-full rounded-xl border border-border bg-card-2 px-3 py-2 text-[13px] outline-none focus:border-accent/60"
                      />
                    </Field>
                    <Field label="Address to copy">
                      <input
                        value={quest.copy ?? ""}
                        onChange={(e) => patch(index, { copy: e.target.value })}
                        placeholder="none"
                        className="mono w-full rounded-xl border border-border bg-card-2 px-3 py-2 text-[13px] outline-none focus:border-accent/60"
                      />
                    </Field>
                  </div>

                  {quest.game === "social" && (
                    <AskEditor
                      value={quest.ask ?? { all: [], any: [] }}
                      onChange={(ask) => patch(index, { ask })}
                    />
                  )}

                  <div className="flex flex-wrap gap-4 pt-1">
                    <Toggle
                      on={!!quest.floorLinked}
                      onChange={(v) => patch(index, { floorLinked: v })}
                      label="Price it off the monke floor"
                    />
                    <Toggle
                      on={!!quest.retired}
                      onChange={(v) => patch(index, { retired: v })}
                      label="Retire it"
                      danger
                    />
                  </div>
                  {quest.retired && (
                    <p className="mono text-[11px] text-muted-3">
                      Kept in the pool so days it ran on still score. Never drawn again.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => {
          setPool((current) => (current ? [...current, blank()] : current));
          setOpen(`new-${pool.length}`);
        }}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border-strong px-4 py-2.5 text-[13px] font-medium text-muted-1 transition-colors hover:border-accent hover:text-accent"
      >
        <Plus className="h-4 w-4" />
        Add a quest
      </button>

      <p className="mt-6 max-w-[66ch] text-[13px] text-muted-2">
        A quest is answered by one of the readings the site already takes off Ronin — pick one
        under &ldquo;measured by&rdquo;. A genuinely new kind of check means reading a new
        contract, which is a code change, not a form.
      </p>
    </>
  );
}

/* -------------------------------------------------------------- pieces */

function Stat({ label, value, note, bad }: { label: string; value: string; note: string; bad?: boolean }) {
  return (
    <div>
      <div className="mono text-[10px] uppercase tracking-[0.12em] text-muted-3">{label}</div>
      <div className={`mono mt-1 text-xl font-bold ${bad ? "text-burn" : "text-gold"}`}>{value}</div>
      <div className="mt-0.5 text-[12px] text-muted-2">{note}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mono block text-[10px] uppercase tracking-[0.12em] text-muted-3">
        {label}
      </span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-border bg-card-2 px-3 py-2 text-[13px] outline-none focus:border-accent/60"
    >
      {options.map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  on,
  onChange,
  label,
  danger,
}: {
  on: boolean;
  onChange: (value: boolean) => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-1">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className={`h-4 w-4 ${danger ? "accent-[#ff4d5e]" : "accent-[#27b9fc]"}`}
      />
      {label}
    </label>
  );
}

/**
 * The board is priced on one rule. Showing what it says next to the field is
 * the difference between a number chosen and a number guessed.
 */
function LadderHint({
  ron,
  points,
  onApply,
}: {
  ron: number;
  points: number;
  onApply: (points: number) => void;
}) {
  const suggested = pointsForRon(ron);
  if (suggested === points) {
    return (
      <p className="mono text-[11px] text-diamond">
        On the ladder — {ron} RON is worth {suggested}.
      </p>
    );
  }
  return (
    <p className="mono flex flex-wrap items-center gap-2 text-[11px] text-paper">
      The ladder prices {ron} RON at {suggested}, not {points}.
      <button
        onClick={() => onApply(suggested)}
        className="rounded-md border border-paper/40 px-2 py-0.5 transition-colors hover:border-paper hover:text-foreground"
      >
        Use {suggested}
      </button>
    </p>
  );
}

function AskEditor({
  value,
  onChange,
}: {
  value: { all: string[]; any: string[] };
  onChange: (ask: { all: string[]; any: string[] }) => void;
}) {
  const parse = (text: string) => text.split(",").map((w) => w.trim()).filter(Boolean);
  return (
    <div className="rounded-xl border border-border bg-card-2 p-3">
      <div className="mono text-[10px] uppercase tracking-[0.12em] text-muted-3">
        Words the post must contain
      </div>
      <label className="mt-2 block">
        <span className="text-[12px] text-muted-1">All of these, comma separated</span>
        <input
          value={value.all.join(", ")}
          onChange={(e) => onChange({ all: parse(e.target.value), any: value.any })}
          className="mono mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-accent/60"
        />
      </label>
      <label className="mt-2 block">
        <span className="text-[12px] text-muted-1">And at least one of these</span>
        <input
          value={value.any.join(", ")}
          onChange={(e) => onChange({ all: value.all, any: parse(e.target.value) })}
          className="mono mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-accent/60"
        />
      </label>
      <p className="mt-2 text-[11px] text-muted-3">
        Shown to players word for word, because these are the strings the checker matches.
      </p>
    </div>
  );
}
