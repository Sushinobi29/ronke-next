"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Snowflake, Wallet } from "lucide-react";
import { encodeFunctionData, erc20Abi, parseUnits } from "viem";
import type { RoninWallet } from "@/hooks/useRoninWallet";
import { TOKENS } from "@/lib/quests/contracts";
import { freezeMessage, sentMessage, type PayoutRow, type Totals } from "@/lib/quests/payouts";

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
  const [confirm, setConfirm] = useState("");

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

  const run = async () => {
    if (!address || !state) return;
    setBusy("send");
    setFailed([]);
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
        setFailed((was) => [...was, `${key}: ${error instanceof Error ? error.message : "failed"}`]);
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
      {failed.length > 0 && (
        <ul className="space-y-1 text-sm text-red-400">
          {failed.map((line) => <li key={line} className="mono">{line}</li>)}
        </ul>
      )}
    </section>
  );
}
