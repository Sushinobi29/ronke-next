import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageNavbar from "@/components/page-navbar";
import { QUEST_SEASON_ONE, seasonAt, seasonByNumber, seasonDays } from "@/lib/quests/season";
import { hasStore, readCorrections, seasonStandings, seasonStandingsAsScored } from "@/lib/quests/store";
import { orderStandings, type RankedRow } from "@/lib/quests/standings";
import { ronkeScores } from "@/lib/quests/score";

export const dynamic = "force-dynamic";

/** Enough of the table to be worth reading, short of being a database dump. */
const ROWS = 100;
/** Ranked deeper than shown, so a wallet that climbed in from outside has a "was". */
const DEPTH = 2000;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ season: string }>;
}): Promise<Metadata> {
  const season = seasonByNumber(Number((await params).season) + QUEST_SEASON_ONE - 1);
  return {
    title: `${season.name} standings | Ronke Quest`,
    description: `The full ${season.name} table, every scoring correction that was applied to it, and the board as it originally stood.`,
    alternates: { canonical: `https://ronkeverse.com/quests/seasons/${season.number - QUEST_SEASON_ONE + 1}` },
  };
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const when = (day: number) => new Date(day * 86_400_000).toUTCString().slice(5, 11);

export default async function SeasonPage({ params }: { params: Promise<{ season: string }> }) {
  const asked = Number((await params).season);
  const now = seasonAt();
  const number = asked + QUEST_SEASON_ONE - 1;
  if (!Number.isFinite(asked) || asked < 1 || number > now.number) notFound();

  const season = seasonByNumber(number);
  const { fromDay, toDay } = seasonDays(season);
  const running = season.number === now.number;

  if (!hasStore()) notFound();

  const [correctedRaw, scoredRaw, corrections, scores] = await Promise.all([
    seasonStandings(fromDay, toDay, DEPTH),
    seasonStandingsAsScored(fromDay, toDay, DEPTH),
    readCorrections(fromDay, toDay),
    ronkeScores(),
  ]);

  const of = scores?.of ?? null;
  const after = orderStandings(correctedRaw, of);
  const before = orderStandings(scoredRaw, of);
  const rankBefore = new Map(before.map((row, i) => [row.address, i + 1]));
  const pointsBefore = new Map(before.map((row) => [row.address, row.points]));

  const added = corrections.reduce((sum, c) => sum + (c.points - c.was), 0);
  const touched = new Set(corrections.map((c) => c.address));
  const reason = corrections[0]?.reason ?? null;
  const rows = after.slice(0, ROWS);

  const movement = (row: RankedRow, rank: number) => {
    const was = rankBefore.get(row.address);
    if (was === undefined || was === rank) return null;
    return was - rank;
  };

  return (
    <>
      <PageNavbar />
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-24 sm:px-6">
        <header>
          <Link
            href="/quests"
            className="mono text-[11px] uppercase tracking-[0.14em] text-muted-3 transition-colors hover:text-accent"
          >
            ← Ronke Quest
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">{season.name} standings</h1>
          <p className="mono mt-2 text-[11px] uppercase tracking-[0.12em] text-muted-3">
            {when(fromDay)} – {when(toDay)} · {after.length.toLocaleString()} players
            {running && " · still running"}
          </p>
        </header>

        {/* ------------------------------------------------ what was corrected */}
        {corrections.length > 0 && (
          <section className="rv-card mt-8 p-5">
            <h2 className="mono text-[11px] uppercase tracking-[0.14em] text-gold">
              This board was corrected
            </h2>
            {reason && <p className="mt-3 text-[14px] text-muted-1">{reason}</p>}
            <div className="mono mt-4 grid grid-cols-2 gap-4 text-[11px] uppercase tracking-[0.1em] sm:grid-cols-4">
              <div>
                <span className="block text-muted-3">Corrections</span>
                <span className="text-[18px] font-bold text-foreground">{corrections.length}</span>
              </div>
              <div>
                <span className="block text-muted-3">Points added</span>
                <span className="text-[18px] font-bold text-gold">+{added.toLocaleString()}</span>
              </div>
              <div>
                <span className="block text-muted-3">Wallets</span>
                <span className="text-[18px] font-bold text-foreground">{touched.size}</span>
              </div>
              <div>
                <span className="block text-muted-3">Scores overwritten</span>
                <span className="text-[18px] font-bold text-foreground">0</span>
              </div>
            </div>
            <p className="mt-4 text-[13px] text-muted-2">
              Nothing that was scored has been rewritten. Every day still holds the number it
              originally paid; the corrections are kept beside them as their own entries, and the
              table below is the two added together. Both boards are shown so the arithmetic can
              be checked rather than taken on trust.
            </p>
          </section>
        )}

        {/* ------------------------------------------------------- the table */}
        <section className="mt-8">
          <h2 className="mono text-[11px] uppercase tracking-[0.14em] text-muted-3">
            {corrections.length > 0 ? "The corrected board" : "The board"}
          </h2>
          <div className="rv-card mt-3 overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="mono text-[10px] uppercase tracking-[0.12em] text-muted-3">
                <tr className="border-b border-border">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Wallet</th>
                  <th className="px-4 py-3 text-right">Points</th>
                  {corrections.length > 0 && <th className="px-4 py-3 text-right">As scored</th>}
                  <th className="px-4 py-3 text-right">Days</th>
                  <th className="px-4 py-3 text-right">Sweeps</th>
                  {corrections.length > 0 && <th className="px-4 py-3 text-right">Moved</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const rank = i + 1;
                  const moved = movement(row, rank);
                  const was = pointsBefore.get(row.address);
                  const raised = was !== undefined && was !== row.points;
                  return (
                    <tr key={row.address} className="border-b border-border/50 last:border-0">
                      <td className="mono px-4 py-2.5 text-muted-2">{rank}</td>
                      <td className="mono px-4 py-2.5">{short(row.address)}</td>
                      <td className="mono px-4 py-2.5 text-right font-bold">
                        {row.points.toLocaleString()}
                      </td>
                      {corrections.length > 0 && (
                        <td className="mono px-4 py-2.5 text-right text-muted-3">
                          {raised ? was!.toLocaleString() : "—"}
                        </td>
                      )}
                      <td className="mono px-4 py-2.5 text-right text-muted-2">{row.days}</td>
                      <td className="mono px-4 py-2.5 text-right text-muted-2">{row.sweeps}</td>
                      {corrections.length > 0 && (
                        <td className="mono px-4 py-2.5 text-right">
                          {moved === null ? (
                            <span className="text-muted-3">—</span>
                          ) : (
                            <span className={moved > 0 ? "text-gold" : "text-muted-2"}>
                              {moved > 0 ? `▲ ${moved}` : `▼ ${-moved}`}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {after.length > ROWS && (
            <p className="mono mt-3 text-[11px] uppercase tracking-[0.12em] text-muted-3">
              Showing the top {ROWS} of {after.length.toLocaleString()}
            </p>
          )}
        </section>

        {/* --------------------------------------------- the ledger itself */}
        {corrections.length > 0 && (
          <section className="mt-10">
            <h2 className="mono text-[11px] uppercase tracking-[0.14em] text-muted-3">
              Every correction, in full
            </h2>
            <div className="rv-card mt-3 overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="mono text-[10px] uppercase tracking-[0.12em] text-muted-3">
                  <tr className="border-b border-border">
                    <th className="px-4 py-3">Day</th>
                    <th className="px-4 py-3">Wallet</th>
                    <th className="px-4 py-3">Quest</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Should have paid</th>
                    <th className="px-4 py-3 text-right">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {corrections.map((c) => (
                    <tr key={`${c.day}:${c.address}:${c.questId}`} className="border-b border-border/50 last:border-0">
                      <td className="mono px-4 py-2.5 text-muted-2">{when(c.day)}</td>
                      <td className="mono px-4 py-2.5">{short(c.address)}</td>
                      <td className="mono px-4 py-2.5 text-muted-2">{c.questId}</td>
                      <td className="mono px-4 py-2.5 text-right text-muted-3">{c.was.toLocaleString()}</td>
                      <td className="mono px-4 py-2.5 text-right font-bold">{c.points.toLocaleString()}</td>
                      <td className="mono px-4 py-2.5 text-right text-gold">
                        +{(c.points - c.was).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* -------------------------------------------------- other seasons */}
        <nav className="mono mt-10 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.12em]">
          {Array.from({ length: now.number - QUEST_SEASON_ONE + 1 }, (_, i) => {
            const n = i + 1;
            const entry = seasonByNumber(QUEST_SEASON_ONE + i);
            const here = entry.number === season.number;
            return (
              <Link
                key={n}
                href={`/quests/seasons/${n}`}
                className={`rounded-full border px-4 py-2 transition-colors ${
                  here ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-2 hover:border-accent hover:text-accent"
                }`}
              >
                {entry.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
