"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import type { RoninWallet } from "@/hooks/useRoninWallet";
import { quotaMessage } from "@/lib/quests/quota";

/**
 * How many times a season hands out Adopt a Monke.
 *
 * A season already under way can be changed; a season that has finished
 * cannot. The change is stored against the day it starts, always the next
 * reset, so the rota re-picks only from there and every board already played
 * stands exactly as it was.
 */

interface Row {
  number: number;
  name: string;
  quota: number;
  schedule: { from: number; quota: number }[];
  startsOn: number;
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
      const row = rows?.find((r) => r.number === season);
      const signature = await wallet.sign(
        quotaMessage(season, row!.startsOn, quota, address, issuedAt)
      );
      const res = await fetch("/api/quests/admin/quota", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, signature, issuedAt, season, quota }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Refused.");
      setNote(
        `Season ${season} hands out ${quota} from tomorrow. Days already played keep theirs.`
      );
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
          How many days a season gives each wallet the adopt quest. A change starts at the
          next reset, leaves every day already played exactly as it was, and deals out the
          days that are left so that everybody finishes the season on the number — which
          is why saving the number it is already on is worth doing on a season that has
          drifted. It changes NFT volume, not the balance: the points even out whatever
          this is set to.
        </p>
      </header>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.number} className="flex flex-wrap items-center gap-3">
            <span className="mono w-28 text-[13px]">{row.name}</span>
            {row.locked ? (
              <span className="mono inline-flex items-center gap-1.5 text-[13px] text-muted-2">
                <Lock className="h-3.5 w-3.5" />
                {row.quota} · finished
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
                  // Saving the same number is the point, not a no-op: a season
                  // under way is levelled by the change, so everyone finishes
                  // on it whatever the draw has handed out so far.
                  disabled={busy !== null || (draft[row.number] === row.quota && !row.running)}
                  className="rv-hover inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[13px] font-semibold disabled:opacity-40"
                >
                  {busy === row.number ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Save
                </button>
                <span className="mono text-[11px] text-muted-3">
                  {row.running ? "now " : ""}
                  {row.quota}
                  {draft[row.number] !== row.quota
                    ? " · starts at the next reset"
                    : row.running
                      ? " · save to level the season on it"
                      : ""}
                  {row.schedule.length > 1 ? ` · changed ${row.schedule.length - 1}×` : ""}
                </span>
              </>
            )}
          </div>
        ))}
      </div>

      <p className="text-[12px] text-muted-2">
        Lowering it below what a wallet has already been given takes nothing back — those
        days were played. That season just ends on the higher number.
      </p>
      {note && <p className="mono text-[12px] text-accent">{note}</p>}
    </section>
  );
}
