"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Loader2,
  Snowflake,
  Wallet,
} from "lucide-react";
import { encodeFunctionData, erc20Abi, parseUnits } from "viem";
import type { RoninWallet } from "@/hooks/useRoninWallet";
import { TOKENS } from "@/lib/quests/contracts";
import {
  batchMessage,
  freezeMessage,
  sentMessage,
  type PayoutRow,
  type Totals,
} from "@/lib/quests/payouts";

/**
 * Paying a season out, one transaction at a time.
 *
 * The server froze the list and holds the record of what has gone out; this
 * screen only walks the rows still owed and asks the wallet to send each one.
 * Nothing here decides an amount. If the tab is closed halfway through, the
 * next run picks up exactly where it stopped, because "what is left" is a
 * question only the server answers.
 */

/** Where each prize actually lives. A prize this cannot resolve is not sent. */
const CONTRACTS: Record<string, { address: string; decimals: number }> = {
  RONKE: { address: TOKENS.RONKE, decimals: 18 },
  RONKESTR: { address: TOKENS.RONKESTR, decimals: 18 },
  RONKA: { address: TOKENS.RONKA, decimals: 18 },
  RICE: { address: TOKENS.RICE, decimals: 18 },
};

const resolve = (label: string) =>
  CONTRACTS[label.replace(/^\$/, "").trim().toUpperCase()] ?? null;

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const EXPLORER = "https://app.roninchain.com/tx/";
const SCATTER = "https://scatter.roninchain.com";

interface BatchCheck {
  ok: boolean;
  error?: string;
  pays?: number;
  stillOwed?: number;
  spare?: number;
}

/** One line of what actually happened, kept rather than overwritten. */
interface LogLine {
  key: string;
  address: string;
  label: string;
  amount: number;
  txHash?: string;
  error?: string;
}

interface State {
  season: number;
  name: string;
  closed: boolean;
  frozen: boolean;
  rows: PayoutRow[];
  totals: Totals[];
  pending: number;
  checksum: string;
  fresh: { rows: number; checksum: string; totals: Totals[] };
  scoredTiebreak: boolean;
  scoresAsOf: string | null;
  tied: number;
  unbroken: number;
  standing: Record<string, { rank: number; points: number; score: number | null }>;
  wouldAdd: number;
  wouldOrphan: number;
  conflicts: { address: string; itemId: string; paid: number; wanted: number }[];
}

export default function QuestsAdminPayout({
  wallet,
  season,
}: {
  wallet: RoninWallet;
  season: number;
}) {
  const address = wallet.address?.toLowerCase() ?? null;
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [log, setLog] = useState<LogLine[]>([]);
  const [confirm, setConfirm] = useState("");
  const [batchTx, setBatchTx] = useState("");
  const [batchItem, setBatchItem] = useState<string | null>(null);
  const [check, setCheck] = useState<BatchCheck | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    const res = await fetch(`/api/quests/admin/payouts?address=${address}&season=${season}`);
    const body = await res.json();
    if (res.ok) setState(body);
    else setNote(body.error ?? "Could not read the payout.");
  }, [address, season]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = useMemo(
    () => (state?.rows ?? []).filter((row) => row.status === "pending"),
    [state]
  );

  /** Points totals shared by more than one wallet, so the table can mark them. */
  const tiedPoints = useMemo(() => {
    const counts = new Map<number, number>();
    for (const entry of Object.values(state?.standing ?? {})) {
      counts.set(entry.points, (counts.get(entry.points) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([p]) => p));
  }, [state]);

  /** Prizes the sender cannot resolve to a contract — these block the run. */
  const unresolved = useMemo(
    () => [...new Set(pending.filter((r) => r.kind === "token" && !resolve(r.label)).map((r) => r.label))],
    [pending]
  );

  const freeze = async () => {
    if (!address || !state) return;
    setBusy("freeze");
    setNote(null);
    try {
      const issuedAt = new Date().toISOString();
      const res0 = await fetch(`/api/quests/admin/payouts?address=${address}&season=${season}`);
      const latest: State = await res0.json();
      const rows = latest.wouldAdd + latest.rows.length;
      const signature = await wallet.sign(
        freezeMessage(season, latest.fresh.checksum, rows, address, issuedAt)
      );
      const res = await fetch("/api/quests/admin/payouts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, signature, issuedAt, season, action: "freeze" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "The freeze was refused.");
      setNote(`Frozen: ${body.rows.length} payments, fingerprint ${body.checksum}.`);
      await load();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "The freeze failed.");
    } finally {
      setBusy(null);
    }
  };

  /** The pending rows of one prize, as Scatter wants them pasted. */
  const csvFor = (itemId: string) =>
    pending
      .filter((row) => row.itemId === itemId)
      .map((row) => `${row.address},${row.amount}`)
      .join("\n");

  /** Ask the chain what a transaction actually paid, before anything is signed. */
  const checkBatch = async (itemId: string) => {
    if (!address) return;
    setBusy("check");
    setCheck(null);
    try {
      const res = await fetch(
        `/api/quests/admin/payouts?address=${address}&season=${season}` +
          `&item=${encodeURIComponent(itemId)}&tx=${batchTx.trim()}`
      );
      const body = await res.json();
      setCheck(body.batch ?? { ok: false, error: "That transaction could not be checked." });
    } catch {
      setCheck({ ok: false, error: "Could not reach the checker." });
    } finally {
      setBusy(null);
    }
  };

  /** Record it, once the chain has confirmed what it paid. */
  const recordBatch = async (itemId: string) => {
    if (!address || !check?.ok || !check.pays) return;
    setBusy("record");
    try {
      const issuedAt = new Date().toISOString();
      const signature = await wallet.sign(
        batchMessage(season, itemId, batchTx.trim(), check.pays, issuedAt)
      );
      const res = await fetch("/api/quests/admin/payouts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address, signature, issuedAt, season, action: "batch",
          payment: { itemId, txHash: batchTx.trim() },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "That batch was refused.");
      setNote(
        `Recorded ${body.recorded} payments from one transaction.` +
          (body.stillOwed ? ` ${body.stillOwed} are still owed.` : "")
      );
      setBatchTx("");
      setCheck(null);
      setBatchItem(null);
      await load();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "That batch could not be recorded.");
    } finally {
      setBusy(null);
    }
  };

  const run = async () => {
    if (!address || !state) return;
    setBusy("send");
    setFailed([]);
    setLog([]);
    let done = 0;

    for (const row of pending) {
      const key = `${row.address}|${row.itemId}`;
      try {
        let to: string;
        let data: string;
        if (row.kind === "token") {
          const token = resolve(row.label);
          if (!token) throw new Error(`no contract for ${row.label}`);
          to = token.address;
          data = encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [row.address as `0x${string}`, parseUnits(String(row.amount), token.decimals)],
          });
        } else {
          // An NFT prize names a count, not a token id, so the ids to send are
          // chosen by hand. Skipped here rather than guessed at.
          throw new Error("NFT prizes are sent by hand");
        }

        setNote(`Sending ${row.amount} ${row.label} to ${row.address.slice(0, 10)}… (${done + 1} of ${pending.length})`);
        const txHash = await wallet.send({ to, data });
        setLog((was) => [...was, { key, address: row.address, label: row.label, amount: row.amount, txHash }]);

        const issuedAt = new Date().toISOString();
        const signature = await wallet.sign(
          sentMessage(season, row.address, row.itemId, txHash, issuedAt)
        );
        await fetch("/api/quests/admin/payouts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            address, signature, issuedAt, season, action: "sent",
            payment: { address: row.address, itemId: row.itemId, txHash },
          }),
        });
        done += 1;
      } catch (error) {
        // One failure does not stop the run: the rest are still owed, and the
        // server knows exactly which rows were recorded.
        const why = error instanceof Error ? error.message : "failed";
        setFailed((was) => [...was, `${key}: ${why}`]);
        setLog((was) => [...was, { key, address: row.address, label: row.label, amount: row.amount, error: why }]);
      }
    }

    setNote(`Sent ${done} of ${pending.length}.`);
    setBusy(null);
    await load();
  };

  if (!state) {
    return <p className="text-sm text-muted-1">Reading the payout…</p>;
  }

  const ready =
    state.frozen && pending.length > 0 && unresolved.length === 0 && confirm === "SEND";

  return (
    <section className="rv-card space-y-4 p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">Pay out {state.name}</h3>
        <span className="mono text-xs text-muted-2">
          {state.frozen ? `fingerprint ${state.checksum}` : "not frozen"}
        </span>
      </header>

      {!state.closed && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          This season is still running. Freezing now pays out standings that can still move.
        </p>
      )}

      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-muted-2">
          <tr><th className="py-1">Prize</th><th>Wallets</th><th>Total</th><th>Sent</th><th>Left</th></tr>
        </thead>
        <tbody className="mono">
          {(state.frozen ? state.totals : state.fresh.totals).map((t) => (
            <tr key={t.itemId} className="border-t border-border/60">
              <td className="py-1.5">{t.label}</td>
              <td>{t.wallets}</td>
              <td>{t.total.toLocaleString()}</td>
              <td className="text-accent">{t.sent.toLocaleString()}</td>
              <td>{t.pending.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {state.tied > 0 && (
        <p
          className={`rounded-lg border p-3 text-sm ${
            state.scoredTiebreak
              ? "border-border bg-card-2 text-muted-1"
              : "border-red-500/40 bg-red-500/10"
          }`}
        >
          {state.scoredTiebreak ? (
            <>
              {state.tied} wallets are level on points. Ronke Score orders them
              {state.scoresAsOf
                ? ` (scored ${new Date(state.scoresAsOf).toLocaleDateString()})`
                : ""}
              {state.unbroken > 0
                ? `, and ${state.unbroken} are level on the score too — those fall back to wallet address.`
                : "."}
            </>
          ) : (
            <>
              {state.tied} wallets are level on points and Ronke Score could not be read.
              Freezing is refused until it answers, because rank decides the money.
            </>
          )}
        </p>
      )}

      {state.conflicts.length > 0 && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
          {state.conflicts.length} wallet(s) were already paid a different amount than the
          standings now say. Those payments stand; nothing will be sent twice.
        </p>
      )}

      {unresolved.length > 0 && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
          No contract is known for: {unresolved.join(", ")}. Add it before sending.
        </p>
      )}

      {state.rows.some((r) => r.kind === "nft" && r.status === "pending") && (
        <p className="text-sm text-muted-1">
          NFT prizes are listed but not sent from here — a prize names a count, not token ids,
          so those go out by hand.
        </p>
      )}

      {state.rows.length > 0 && (
        <details className="rounded-lg border border-border" open>
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
            Every row this will send ({state.rows.length})
          </summary>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full min-w-[600px] text-left text-[13px]">
              <thead className="mono sticky top-0 bg-card-2 text-[10px] uppercase tracking-[0.12em] text-muted-3">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Wallet</th>
                  <th className="px-3 py-2 text-right">Points</th>
                  <th className="px-3 py-2 text-right">Score</th>
                  <th className="px-3 py-2">Prize</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="mono">
                {state.rows.map((row) => {
                  const who = state.standing[row.address];
                  const tied = who ? tiedPoints.has(who.points) : false;
                  return (
                    <tr key={`${row.address}|${row.itemId}`} className="border-t border-border-soft">
                      <td className="px-3 py-1.5">{row.rank}</td>
                      <td className="px-3 py-1.5">{short(row.address)}</td>
                      <td className="px-3 py-1.5 text-right">
                        {who?.points.toLocaleString() ?? "—"}
                      </td>
                      {/* The score only decided anything where the points were level,
                          so it is only called out there. */}
                      <td className={`px-3 py-1.5 text-right ${tied ? "text-gold" : "text-muted-3"}`}>
                        {who?.score ?? "—"}
                        {tied ? " ↕" : ""}
                      </td>
                      <td className="px-3 py-1.5">{row.label}</td>
                      <td className="px-3 py-1.5 text-right">{row.amount.toLocaleString()}</td>
                      <td className="px-3 py-1.5">
                        {row.status === "sent" ? (
                          row.txHash ? (
                            <a
                              className="inline-flex items-center gap-1 text-accent hover:underline"
                              href={`${EXPLORER}${row.txHash}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              sent <ArrowUpRight className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-accent">sent</span>
                          )
                        ) : row.kind === "nft" ? (
                          <span className="text-muted-3">by hand</span>
                        ) : (
                          <span className="text-muted-2">waiting</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-3 py-2 text-[12px] text-muted-2">
            ↕ marks wallets level on points, where Ronke Score decided the order.
          </p>
        </details>
      )}

      {state.frozen && pending.some((row) => row.kind === "token") && (
        <div className="space-y-3 rounded-lg border border-border bg-card-2 p-3">
          <div>
            <h4 className="text-sm font-semibold">Send them all in one transaction</h4>
            <p className="mt-1 text-[13px] text-muted-1">
              Ronin&apos;s{" "}
              <a className="text-accent hover:underline" href={SCATTER} target="_blank" rel="noreferrer">
                Scatter
              </a>{" "}
              takes a list and pays everyone at once, which beats signing one transfer at a
              time. Copy the list, send it there, then paste the transaction back here — the
              chain is read to confirm who it actually paid before anybody is marked off.
            </p>
          </div>

          {[...new Set(pending.filter((r) => r.kind === "token").map((r) => r.itemId))].map((itemId) => {
            const rows = pending.filter((row) => row.itemId === itemId);
            const label = rows[0]?.label ?? itemId;
            const picked = batchItem === itemId;
            return (
              <div key={itemId} className="space-y-2 border-t border-border-soft pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mono text-[13px]">
                    {label} · {rows.length} wallets
                  </span>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(csvFor(itemId));
                      setNote(`Copied ${rows.length} lines for ${label}.`);
                    }}
                    className="rv-hover inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[13px]"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy list
                  </button>
                  <button
                    onClick={() => {
                      setBatchItem(picked ? null : itemId);
                      setCheck(null);
                    }}
                    className="rv-hover rounded-lg border border-border px-2.5 py-1.5 text-[13px]"
                  >
                    {picked ? "Cancel" : "I sent it"}
                  </button>
                </div>

                {picked && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={batchTx}
                      onChange={(event) => {
                        setBatchTx(event.target.value);
                        setCheck(null);
                      }}
                      placeholder="0x… transaction hash"
                      className="mono min-w-[320px] flex-1 rounded-lg border border-border bg-card px-3 py-2 text-[13px]"
                    />
                    {check?.ok ? (
                      <button
                        onClick={() => void recordBatch(itemId)}
                        disabled={!!busy || !check.pays}
                        className="rv-hover rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-black disabled:opacity-40"
                      >
                        {busy === "record" ? "Recording…" : `Record ${check.pays} payments`}
                      </button>
                    ) : (
                      <button
                        onClick={() => void checkBatch(itemId)}
                        disabled={!!busy || !/^0x[0-9a-fA-F]{64}$/.test(batchTx.trim())}
                        className="rv-hover rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-40"
                      >
                        {busy === "check" ? "Checking the chain…" : "Check it"}
                      </button>
                    )}
                  </div>
                )}

                {picked && check && (
                  <p
                    className={`mono text-[12px] ${
                      check.ok && check.pays ? "text-accent" : "text-burn"
                    }`}
                  >
                    {check.ok
                      ? `The chain shows it paid ${check.pays} of the ${rows.length} wallets owed.` +
                        (check.stillOwed ? ` ${check.stillOwed} still owed.` : "") +
                        (check.spare ? ` ${check.spare} transfers matched no row.` : "")
                      : check.error}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={freeze}
          disabled={!!busy}
          className="rv-hover inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold"
        >
          {busy === "freeze" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Snowflake className="h-4 w-4" />}
          {state.frozen ? `Re-freeze (${state.wouldAdd} new)` : "Freeze the payout"}
        </button>

        {state.frozen && pending.length > 0 && (
          <>
            <input
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="type SEND"
              className="w-32 rounded-lg border border-border bg-card-2 px-3 py-2 text-sm"
            />
            <button
              onClick={run}
              disabled={!ready || !!busy}
              className="rv-hover inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-black disabled:opacity-40"
            >
              {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              Send {pending.length} payment{pending.length === 1 ? "" : "s"}
            </button>
          </>
        )}

        {state.frozen && pending.length === 0 && (
          <span className="inline-flex items-center gap-2 text-sm text-accent">
            <CheckCircle2 className="h-4 w-4" /> Everything has been paid.
          </span>
        )}
      </div>

      {note && <p className="text-sm text-muted-1">{note}</p>}

      {log.length > 0 && (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
          <ul className="mono divide-y divide-border-soft text-[12px]">
            {log.map((line) => (
              <li key={line.key} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
                <span className={line.error ? "text-red-400" : "text-accent"}>
                  {line.error ? "failed" : "sent"}
                </span>
                <span>{line.amount.toLocaleString()} {line.label}</span>
                <span className="text-muted-2">to {short(line.address)}</span>
                {line.txHash ? (
                  <a
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                    href={`${EXPLORER}${line.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {short(line.txHash)} <ArrowUpRight className="h-3 w-3" />
                  </a>
                ) : null}
                {line.error ? <span className="text-red-400">{line.error}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {failed.length > 0 && (
        <p className="text-sm text-red-400">
          {failed.length} row{failed.length === 1 ? "" : "s"} did not send and are still owed.
          Running again sends only those.
        </p>
      )}
    </section>
  );
}
