"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import type { RoninWallet } from "@/hooks/useRoninWallet";
import { quotaMessage } from "@/lib/quests/quota";

/**
 * How many times a season hands out Adopt a Monke.
 *
 * Only seasons that have not started can be set. Raising the number adds rota
 * days drawn from anywhere in the season, so changing a season already under
 * way would land new ones on days people have played and redraw those boards.
 */

interface Row {
  number: number;
  name: string;
  quota: number;
  locked: boolean;
  running: boolean;
}

export default function QuestsAdminQuota({ wallet }: { wallet: RoninWallet }) {
  const address = wallet.address?.toLowerCase() ?? null;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [bounds, setBounds] = useState({ min: 0, max: 10 });
  const [draft, setDraft] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    const res = await fetch(`/api/quests/admin/quota?address=${address}`);
    const body = await res.json();
    if (!res.ok) return setNote(body.error ?? "Could not read it.");
    setRows(body.seasons);
    setBounds({ min: body.min, max: body.max });
    setDraft(
      Object.fromEntries((body.seasons as Row[]).map((row) => [row.number, row.quota]))
    );
  }, [address]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (season: number) => {
    if (!address) return;
    setBusy(season);
    setNote(null);
    try {
      const quota = draft[season];
      const issuedAt = new Date().toISOString();
      const signature = await wallet.sign(quotaMessage(season, quota, address, issuedAt));
      const res = await fetch("/api/quests/admin/quota", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, signature, issuedAt, season, quota }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Refused.");
      setNote(`Season ${season} will hand out ${quota}.`);
      await load();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not save it.");
    } finally {
      setBusy(null);
    }
  };

  if (!rows) return null;

  return (
    <section className="rv-card space-y-3 p-5">
      <header>
        <h3 className="font-semibold">Adopt a Monke per season</h3>
        <p className="mt-1 text-[13px] text-muted-1">
          How many days a season gives each wallet the adopt quest. Everyone gets the same
          number, so the points even out whatever this is set to — it changes NFT volume,
          not the balance.
        </p>
      </header>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.number} className="flex flex-wrap items-center gap-3">
            <span className="mono w-28 text-[13px]">{row.name}</span>
            {row.locked ? (
              <span className="mono inline-flex items-center gap-1.5 text-[13px] text-muted-2">
                <Lock className="h-3.5 w-3.5" />
                {row.quota} · {row.running ? "running" : "finished"}
              </span>
            ) : (
              <>
                <input
                  type="number"
                  min={bounds.min}
                  max={bounds.max}
                  value={draft[row.number] ?? row.quota}
                  onChange={(event) =>
                    setDraft((was) => ({ ...was, [row.number]: Number(event.target.value) }))
                  }
                  className="mono w-20 rounded-lg border border-border bg-card-2 px-3 py-1.5 text-[13px]"
                />
                <button
                  onClick={() => void save(row.number)}
                  disabled={busy !== null || draft[row.number] === row.quota}
                  className="rv-hover inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[13px] font-semibold disabled:opacity-40"
                >
                  {busy === row.number ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Save
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <p className="text-[12px] text-muted-2">
        A season that has started is fixed. Changing it would move which days hand out the
        quest, including days people have already played.
      </p>
      {note && <p className="mono text-[12px] text-accent">{note}</p>}
    </section>
  );
}
