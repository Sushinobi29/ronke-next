"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Download } from "lucide-react";
import type { RoninWallet } from "@/hooks/useRoninWallet";
import type { PayoutRow } from "@/lib/quests/payouts";

/**
 * Who gets what, and the token list ready to paste into Scatter.
 *
 * Deliberately only that. The payout itself happens in Scatter for the
 * tokens and by hand for the NFTs; this panel's whole job is to show the
 * list and hand over the lines.
 */

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

interface State {
  season: number;
  name: string;
  closed: boolean;
  fresh: { list: PayoutRow[] };
  standing: Record<string, { rank: number; points: number; score: number | null }>;
}

interface Line {
  address: string;
  rank: number;
  points: number;
  tokens: { label: string; amount: number }[];
  nfts: { label: string; amount: number }[];
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
  const [note, setNote] = useState<string | null>(null);

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

  /** One line per wallet, with everything that wallet is owed on it. */
  const lines = useMemo<Line[]>(() => {
    const by = new Map<string, Line>();
    for (const row of state?.fresh.list ?? []) {
      const who = state?.standing[row.address];
      let line = by.get(row.address);
      if (!line) {
        line = {
          address: row.address,
          rank: who?.rank ?? row.rank,
          points: who?.points ?? 0,
          tokens: [],
          nfts: [],
        };
        by.set(row.address, line);
      }
      (row.kind === "nft" ? line.nfts : line.tokens).push({
        label: row.label,
        amount: row.amount,
      });
    }
    return [...by.values()].sort((a, b) => a.rank - b.rank);
  }, [state]);

  /** Every token prize on this payout, each with its own list to copy. */
  const tokenPrizes = useMemo(() => {
    const by = new Map<string, PayoutRow[]>();
    for (const row of state?.fresh.list ?? []) {
      if (row.kind !== "token") continue;
      by.set(row.label, [...(by.get(row.label) ?? []), row]);
    }
    return [...by.entries()];
  }, [state]);

  const nftWinners = lines.filter((line) => line.nfts.length);

  if (!state) return <p className="text-sm text-muted-1">Reading the payout…</p>;

  /**
   * Scatter reads the first line as column titles, so a file that starts
   * with a wallet address is rejected as having invalid ones. The header is
   * part of the file, not decoration.
   */
  const csv = (rows: PayoutRow[]) =>
    ["address,amount", ...rows.map((row) => `${row.address},${row.amount}`)].join("\n");

  const copy = (label: string, rows: PayoutRow[]) => {
    void navigator.clipboard.writeText(csv(rows));
    setNote(`Copied ${rows.length} lines of ${label}.`);
  };

  /** The same thing as a file, since it is a file Scatter wants. */
  const download = (label: string, rows: PayoutRow[]) => {
    const url = URL.createObjectURL(new Blob([csv(rows)], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNote(`Downloaded ${rows.length} lines of ${label}.`);
  };

  return (
    <section className="rv-card space-y-4 p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">{state.name} payout</h3>
        {!state.closed && (
          <span className="mono text-[11px] text-amber-500">
            season still running — these numbers still move
          </span>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {tokenPrizes.map(([label, rows]) => (
          <div key={label} className="flex items-center gap-2">
            <button
              onClick={() => download(label, rows)}
              className="rv-hover inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-black"
            >
              <Download className="h-4 w-4" />
              {label} CSV ({rows.length})
            </button>
            <button
              onClick={() => copy(label, rows)}
              className="rv-hover inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold"
            >
              <Copy className="h-4 w-4" /> Copy
            </button>
          </div>
        ))}
      </div>

      <p className="text-[13px] text-muted-1">
        Paste into{" "}
        <a
          className="text-accent hover:underline"
          href="https://scatter.roninchain.com"
          target="_blank"
          rel="noreferrer"
        >
          Scatter
        </a>{" "}
        and send. The {nftWinners.length} NFT winners below are sent by hand.
      </p>

      {note && <p className="mono text-[12px] text-accent">{note}</p>}

      <div className="max-h-[32rem] overflow-y-auto rounded-lg border border-border">
        <table className="w-full min-w-[520px] text-left text-[13px]">
          <thead className="mono sticky top-0 bg-card-2 text-[10px] uppercase tracking-[0.12em] text-muted-3">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Wallet</th>
              <th className="px-3 py-2 text-right">Points</th>
              <th className="px-3 py-2 text-right">Tokens</th>
              <th className="px-3 py-2">NFT</th>
            </tr>
          </thead>
          <tbody className="mono">
            {lines.map((line) => (
              <tr key={line.address} className="border-t border-border-soft">
                <td className="px-3 py-1.5">{line.rank}</td>
                <td className="px-3 py-1.5">{short(line.address)}</td>
                <td className="px-3 py-1.5 text-right">{line.points.toLocaleString()}</td>
                <td className="px-3 py-1.5 text-right text-gold">
                  {line.tokens
                    .map((t) => `${t.amount.toLocaleString()} ${t.label}`)
                    .join(" + ") || "—"}
                </td>
                <td className="px-3 py-1.5 text-diamond">
                  {line.nfts.map((n) => `${n.amount}× ${n.label}`).join(" + ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
