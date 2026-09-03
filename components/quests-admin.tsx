"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  Loader2,
  Lock,
  Plus,
  Save,
  Trash2,
  Wallet,
} from "lucide-react";
import { useRoninWallet } from "@/hooks/useRoninWallet";
import QuestsAdminCopy from "@/components/quests-admin-copy";
import type { Season } from "@/lib/quests/season";
import {
  adminMessage,
  describeItem,
  formatAmount,
  MAX_FALLOFF,
  MAX_ITEMS,
  previewRewards,
  sanitize,
  type RewardItem,
  type RewardsConfig,
  type SeasonRow,
} from "@/lib/quests/rewards";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

interface AdminPayload {
  admin: boolean;
  configured: boolean;
  persisted?: boolean;
  season?: Season;
  config?: RewardsConfig;
  suggested?: RewardItem[];
  updatedBy?: string | null;
  updatedAt?: string | null;
  standings?: SeasonRow[];
}

const blankItem = (): RewardItem => ({
  id: `reward-${Math.random().toString(36).slice(2, 8)}`,
  label: "",
  kind: "token",
  amount: 0,
  precision: 0,
  topN: 25,
  minPoints: 0,
  mode: "rank",
  falloff: 1,
});

/**
 * The rewards panel.
 *
 * The wallet check here is a courtesy — it decides what to render, nothing
 * more. What actually guards the write is the signature the save asks for,
 * which covers the exact numbers being written and is checked server-side
 * against the configured admin wallet.
 */
export default function QuestsAdmin() {
  const wallet = useRoninWallet();
  const address = wallet.address?.toLowerCase() ?? null;

  const [state, setState] = useState<AdminPayload | null>(null);
  const [items, setItems] = useState<RewardItem[]>([]);
  const [published, setPublished] = useState(false);
  const [note, setNote] = useState("");
  const [standings, setStandings] = useState<SeasonRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pane, setPane] = useState<"rewards" | "wording">("rewards");

  useEffect(() => {
    if (!address) {
      setState(null);
      return;
    }
    let live = true;
    setLoading(true);
    fetch(`/api/quests/admin/rewards?address=${address}`)
      .then((res) => res.json())
      .then((json: AdminPayload) => {
        if (!live) return;
        setState(json);
        if (json.admin) {
          setItems(json.config?.items ?? []);
          setPublished(json.config?.published ?? false);
          setNote(json.config?.note ?? "");
          setStandings(json.standings ?? []);
        }
      })
      .catch(() => live && setError("Could not load the panel."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [address]);

  const draft: RewardsConfig = useMemo(
    () => ({ items, published, note }),
    [items, published, note]
  );

  // The same preview the players never see: who this pool actually pays, live
  // against the standings as they are right now.
  const preview = useMemo(() => previewRewards(standings, draft), [standings, draft]);
  const winners = useMemo(() => preview.filter((row) => row.shares.length > 0), [preview]);

  const patch = (index: number, change: Partial<RewardItem>) =>
    setItems((current) =>
      current.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...change };
        // Whole things cannot be split, so the form should not pretend.
        if (next.kind === "nft") next.precision = 0;
        return next;
      })
    );

  const save = useCallback(async () => {
    setError(null);
    setSaved(null);

    const cleaned = sanitize(draft);
    if ("error" in cleaned) {
      setError(cleaned.error);
      return;
    }
    if (!address || !state?.season) return;

    setSaving(true);
    try {
      const issuedAt = new Date().toISOString();
      // Signed over the cleaned config, because that is what gets written.
      const signature = await wallet.sign(
        adminMessage(cleaned, state.season.number, address, issuedAt)
      );

      const res = await fetch("/api/quests/admin/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature, issuedAt, config: cleaned }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Could not save the rewards.");
        return;
      }

      setItems(json.config.items);
      setPublished(json.config.published);
      setNote(json.config.note);
      setStandings(json.standings ?? []);
      setState((current) =>
        current ? { ...current, updatedAt: json.updatedAt, updatedBy: json.updatedBy } : current
      );
      setSaved(json.config.published ? "Saved and live." : "Saved as a draft.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(
        /reject|denied|cancel/i.test(message) ? "Signature cancelled." : `Could not save: ${message}`
      );
    } finally {
      setSaving(false);
    }
  }, [address, draft, state?.season, wallet]);

  /** The payout list, in the form it has to be sent in. */
  const copyPayout = () => {
    const header = ["rank", "wallet", "points", ...items.map((item) => item.label)];
    const lines = winners.map((row) =>
      [
        row.rank,
        row.address,
        row.points,
        ...items.map((item) => row.shares.find((s) => s.id === item.id)?.amount ?? 0),
      ].join(",")
    );
    navigator.clipboard?.writeText([header.join(","), ...lines].join("\n")).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      },
      () => {}
    );
  };

  /* ------------------------------------------------------------- gates */

  if (wallet.status !== "connected") {
    return (
      <Shell>
        <div className="rv-card p-8 text-center">
          <Wallet className="mx-auto h-8 w-8 text-muted-3" />
          <h2 className="mt-4 text-lg font-semibold">Connect the admin wallet</h2>
          <p className="mx-auto mt-2 max-w-sm text-[13px] text-muted-1">
            Writing a season&apos;s prizes is signed, so the wallet has to be here.
          </p>
          <button
            onClick={() => wallet.connect()}
            disabled={wallet.status === "connecting"}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[13px] font-semibold text-[#06121a] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {wallet.status === "connecting" && <Loader2 className="h-4 w-4 animate-spin" />}
            {wallet.status === "unavailable" ? "Ronin Wallet not found" : "Connect"}
          </button>
        </div>
      </Shell>
    );
  }

  if (loading || !state) {
    return (
      <Shell>
        <div className="mono py-16 text-center text-sm text-muted-2">Checking the wallet…</div>
      </Shell>
    );
  }

  if (!state.admin) {
    return (
      <Shell>
        <div className="rv-card p-8 text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-3" />
          <h2 className="mt-4 text-lg font-semibold">
            {state.configured ? "Not an admin wallet" : "No admin wallet is set"}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[13px] text-muted-1">
            {state.configured ? (
              <>
                <span className="mono">{short(address ?? "")}</span> cannot write rewards.
              </>
            ) : (
              <>
                Set <span className="mono">QUEST_ADMIN_WALLETS</span> on the deployment to the
                wallet that runs the prizes.
              </>
            )}
          </p>
        </div>
      </Shell>
    );
  }

  /* ------------------------------------------------------------- panel */

  return (
    <Shell>
      <div className="mb-8 flex gap-1 rounded-xl border border-border p-1">
        {(
          [
            ["rewards", "Season rewards"],
            ["wording", "Quest wording"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPane(key)}
            className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
              pane === key ? "bg-card-2 text-foreground" : "text-muted-2 hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {pane === "wording" ? (
        <QuestsAdminCopy wallet={wallet} />
      ) : (
        <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Season rewards</h1>
          <p className="mono mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-3">
            {state.season?.name} · {standings.length} wallets scored
          </p>
        </div>
        <div className="text-right text-[12px] text-muted-2">
          {state.updatedAt ? (
            <>
              <div>Last written {new Date(state.updatedAt).toLocaleString()}</div>
              <div className="mono text-muted-3">by {short(state.updatedBy ?? "")}</div>
            </>
          ) : (
            <div className="text-muted-3">Nothing written for this season yet</div>
          )}
        </div>
      </div>

      {state.persisted === false && (
        <p className="mono mt-4 rounded-xl border border-burn/40 bg-burn/10 p-3 text-[12px] text-burn">
          No database is configured here, so nothing can be saved.
        </p>
      )}

      {/* ------------------------------------------------------- the pool */}
      <section className="mt-8 space-y-3">
        {items.map((item, index) => (
          <div key={item.id} className="rv-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={item.label}
                onChange={(e) => patch(index, { label: e.target.value })}
                placeholder="RONKESTR"
                className="min-w-0 flex-1 rounded-xl border border-border bg-card-2 px-3 py-2 font-semibold outline-none focus:border-accent/60"
              />
              <div className="flex rounded-xl border border-border p-0.5">
                {(["token", "nft"] as const).map((kind) => (
                  <button
                    key={kind}
                    onClick={() => patch(index, { kind })}
                    className={`mono rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${
                      item.kind === kind ? "bg-accent text-[#06121a]" : "text-muted-2"
                    }`}
                  >
                    {kind}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setItems((c) => c.filter((_, i) => i !== index))}
                className="rounded-xl border border-border p-2 text-muted-3 transition-colors hover:border-burn hover:text-burn"
                title="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={item.kind === "nft" ? "How many" : "Total pool"}>
                <input
                  type="number"
                  min={0}
                  value={item.amount || ""}
                  onChange={(e) => patch(index, { amount: Number(e.target.value) })}
                  className="mono w-full rounded-xl border border-border bg-card-2 px-3 py-2 outline-none focus:border-accent/60"
                />
              </Field>
              <Field label="Reaches top">
                <input
                  type="number"
                  min={1}
                  value={item.topN || ""}
                  onChange={(e) => patch(index, { topN: Number(e.target.value) })}
                  className="mono w-full rounded-xl border border-border bg-card-2 px-3 py-2 outline-none focus:border-accent/60"
                />
              </Field>
              <Field label="Min points">
                <input
                  type="number"
                  min={0}
                  value={item.minPoints || ""}
                  onChange={(e) => patch(index, { minPoints: Number(e.target.value) })}
                  placeholder="0"
                  className="mono w-full rounded-xl border border-border bg-card-2 px-3 py-2 outline-none focus:border-accent/60"
                />
              </Field>
              <Field label="Split by">
                <div className="flex rounded-xl border border-border p-0.5">
                  {(
                    [
                      ["rank", "Rank"],
                      ["points", "Points"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => patch(index, { mode })}
                      className={`flex-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold transition-colors ${
                        item.mode === mode ? "bg-accent text-[#06121a]" : "text-muted-2"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            {item.mode === "rank" && (
              <div className="mt-3">
                <div className="mono flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-muted-3">
                  <span>Top-heaviness</span>
                  <span className="text-muted-1">
                    {item.falloff === 0 ? "even split" : `falloff ${item.falloff.toFixed(1)}`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={MAX_FALLOFF}
                  step={0.1}
                  value={item.falloff}
                  onChange={(e) => patch(index, { falloff: Number(e.target.value) })}
                  className="mt-2 w-full accent-[var(--gold,#e5b567)]"
                />
              </div>
            )}

            <p className="mono mt-3 text-[11px] text-muted-3">
              {formatAmount(item.amount, item.precision)} {item.label || "—"} · {describeItem(item)}
            </p>
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setItems((c) => [...c, blankItem()])}
            disabled={items.length >= MAX_ITEMS}
            className="inline-flex items-center gap-2 rounded-xl border border-border-strong px-4 py-2.5 text-[13px] font-medium text-muted-1 transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            Add a reward
          </button>
          {items.length === 0 && state.suggested && (
            <button
              onClick={() => setItems(state.suggested!)}
              className="rounded-xl border border-border-strong px-4 py-2.5 text-[13px] font-medium text-muted-1 transition-colors hover:border-gold hover:text-gold"
            >
              Load the first-season pool
            </button>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------ publishing */}
      <section className="rv-card mt-6 p-4 sm:p-5">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[var(--accent,#5ad1ff)]"
          />
          <span>
            <span className="font-semibold">Show the pool on the quest board</span>
            <span className="mt-0.5 block text-[13px] text-muted-1">
              Players see what is up for the season and how it is split — never their own
              projected cut, which moves every time somebody plays.
            </span>
          </span>
        </label>

        <div className="mt-4">
          <div className="mono text-[10px] uppercase tracking-[0.12em] text-muted-3">
            Note for players
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={280}
            placeholder="Paid out within a week of the season closing."
            className="mt-1.5 w-full rounded-xl border border-border bg-card-2 px-3 py-2 text-[13px] outline-none focus:border-accent/60"
          />
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={saving || state.persisted === false}
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-[13px] font-bold text-[#1a1204] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Signing…" : "Sign and save"}
        </button>
        {winners.length > 0 && (
          <button
            onClick={copyPayout}
            className="inline-flex items-center gap-2 rounded-xl border border-border-strong px-4 py-2.5 text-[13px] font-medium text-muted-1 transition-colors hover:border-accent hover:text-accent"
          >
            <Copy className="h-4 w-4" />
            {copied ? "Copied" : `Copy payout (${winners.length})`}
          </button>
        )}
        {error && <span className="mono text-[12px] text-burn">{error}</span>}
        {saved && <span className="mono text-[12px] text-gold">{saved}</span>}
      </div>

      {/* --------------------------------------------------------- preview */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">What this pays today</h2>
        <p className="mt-1 text-[13px] text-muted-1">
          The standings as they stand. Every number below moves until the season closes — this is
          a check on the split, not a promise to anyone.
        </p>

        {standings.length === 0 ? (
          <p className="mono mt-4 rounded-xl border border-border bg-card-2 p-4 text-[12px] text-muted-2">
            Nobody has scored this season yet, so there is nothing to split.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[520px] text-left text-[13px]">
              <thead className="mono bg-card-2 text-[10px] uppercase tracking-[0.12em] text-muted-3">
                <tr>
                  <th className="px-3 py-2.5">#</th>
                  <th className="px-3 py-2.5">Wallet</th>
                  <th className="px-3 py-2.5 text-right">Points</th>
                  {items.map((item) => (
                    <th key={item.id} className="px-3 py-2.5 text-right">
                      {item.label || "—"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 30).map((row) => (
                  <tr
                    key={row.address}
                    className={`border-t border-border-soft ${
                      row.shares.length === 0 ? "text-muted-3" : ""
                    }`}
                  >
                    <td className="mono px-3 py-2">{row.rank}</td>
                    <td className="mono px-3 py-2">{short(row.address)}</td>
                    <td className="mono px-3 py-2 text-right">{row.points.toLocaleString()}</td>
                    {items.map((item) => {
                      const share = row.shares.find((s) => s.id === item.id);
                      return (
                        <td
                          key={item.id}
                          className={`mono px-3 py-2 text-right ${share ? "text-gold" : ""}`}
                        >
                          {share ? formatAmount(share.amount, item.precision) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {preview.length > 30 && (
          <p className="mono mt-2 text-[11px] text-muted-3">
            Showing 30 of {preview.length}. The payout copy has all {winners.length} winners.
          </p>
        )}
      </section>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-24 sm:px-6">
      <Link
        href="/quests"
        className="mono inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-muted-3 transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Quest board
      </Link>
      <div className="mt-6">{children}</div>
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
