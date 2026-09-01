"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Loader2, RefreshCw, Trophy } from "lucide-react";
import QuestCard from "@/components/quest-card";
import SocialQuestCard from "@/components/social-quest-card";
import WalletConnect from "@/components/wallet-connect";
import { useRoninWallet } from "@/hooks/useRoninWallet";
import { useSounds } from "@/hooks/useSounds";
import {
  ALL_DONE_BONUS,
  STREAK_CAP,
  type CostTier,
  GAME_ART,
  GAME_LABELS,
  GAME_LINKS,
  QUESTS_PER_DAY,
  type QuestGame,
  type ScoredQuest,
} from "@/lib/quests/daily";
import { secondsLeft, type Season } from "@/lib/quests/season";

/* --------------------------------------------------------------- types */

interface BoardQuest {
  id: string;
  title: string;
  task: string;
  game: QuestGame;
  points: number;
  target: number;
  cost: CostTier;
  unit?: string;
  link?: string;
  needsLogs?: boolean;
  note?: string;
}

interface LeaderEntry {
  address: string;
  points: number;
  done: number;
  bonus: number;
  streak: number;
}

interface SeasonRow {
  address: string;
  points: number;
  days: number;
  sweeps: number;
}

interface BoardPayload {
  day: number;
  season: Season;
  quests: BoardQuest[];
  leaderboard: LeaderEntry[];
  seasonStandings: SeasonRow[];
  seasonPersisted: boolean;
  roundsToday: number;
  playersToday: number;
  stakedToday: number;
  resetsIn: number;
}

interface DailyScore {
  quests: ScoredQuest[];
  done: number;
  points: number;
  bonus: number;
  streak: number;
  multiplier: number;
  total: number;
  maxPoints: number;
}

/* ----------------------------------------------------------- formatting */

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const clock = (total: number) => {
  const s = Math.max(0, total);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};

function ago(seconds: number, now: number): string {
  const d = Math.max(0, now - seconds);
  if (d < 60) return `${d}s`;
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  return `${Math.floor(d / 3600)}h`;
}

/** Turns a public board quest into a card with no progress on it yet. */
const asPreview = (q: BoardQuest): ScoredQuest => ({
  ...q,
  tier: "core",
  group: q.id,
  progress: () => 0,
  value: 0,
  done: false,
  href: q.link ?? GAME_LINKS[q.game],
  art: GAME_ART[q.game],
  gameLabel: GAME_LABELS[q.game],
});

/* ------------------------------------------------------------------ app */

export default function QuestsApp() {
  const wallet = useRoninWallet();
  const play = useSounds();

  const [board, setBoard] = useState<BoardPayload | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [score, setScore] = useState<DailyScore | null>(null);
  const [scored, setScored] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [readAt, setReadAt] = useState<number | null>(null);
  const [stale, setStale] = useState<string | null>(null);
  const [logsMissing, setLogsMissing] = useState(false);
  const [logCoverage, setLogCoverage] = useState(1);
  const [tab, setTab] = useState<"today" | "season">("today");
  /** Which card's refresh is in flight, so only that one spins. */
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  // Null until mounted: a clock rendered on the server is already stale by the
  // time the client hydrates, which React counts as a mismatch.
  const [now, setNow] = useState<number | null>(null);
  const autoLoaded = useRef<string | null>(null);
  /** Last seen completion, so a cue fires on the change and not on every read. */
  const lastDone = useRef<number | null>(null);

  useEffect(() => {
    setNow(Math.floor(Date.now() / 1000));
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  /* board -------------------------------------------------------------- */

  const loadBoard = useCallback(async (fresh = false) => {
    try {
      const res = await fetch(`/api/quests/board${fresh ? "?fresh=1" : ""}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Ronin did not answer");
      setBoard(json);
      setBoardError(null);
    } catch (error) {
      setBoardError(error instanceof Error ? error.message : "Ronin did not answer");
    }
  }, []);

  useEffect(() => {
    loadBoard();
    const timer = setInterval(loadBoard, 60_000);
    return () => clearInterval(timer);
  }, [loadBoard]);

  /* wallet ------------------------------------------------------------- */

  const view = useCallback(async (raw: string, fresh = false) => {
    const address = raw.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return;

    setChecking(true);
    setWalletError(null);
    try {
      const res = await fetch(
        `/api/quests/wallet?address=${address}${fresh ? "&fresh=1" : ""}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Ronin did not answer");
      // Only celebrate a change. The first read of a session is the baseline,
      // or reconnecting would replay every quest already finished today.
      const done: number = json.score?.done ?? 0;
      if (lastDone.current !== null && done > lastDone.current) {
        play(done === QUESTS_PER_DAY ? "sweep" : "questComplete");
      }
      lastDone.current = done;

      setScore(json.score);
      setScored(json.address);
      setReadAt(json.readAt ?? Date.now());
      setStale(json.stale ?? null);
      setLogsMissing(!!json.logsMissing);
      setLogCoverage(typeof json.logCoverage === "number" ? json.logCoverage : 1);
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Ronin did not answer");
    } finally {
      setChecking(false);
    }
  }, [play]);

  /** The button, and the safety net for anyone who never presses it. */
  const refresh = useCallback(async () => {
    await Promise.all([
      loadBoard(true),
      wallet.address ? view(wallet.address, true) : Promise.resolve(),
    ]);
  }, [loadBoard, view, wallet.address]);

  useEffect(() => {
    if (!wallet.address) return;
    const timer = setInterval(() => view(wallet.address!), 45_000);
    return () => clearInterval(timer);
  }, [wallet.address, view, play]);

  useEffect(() => {
    const connected = wallet.address?.toLowerCase() ?? null;
    if (!connected) {
      autoLoaded.current = null;
      lastDone.current = null;
      setScore(null);
      setScored(null);
      return;
    }
    if (autoLoaded.current === connected) return;
    autoLoaded.current = connected;
    lastDone.current = null;
    play("connect");
    view(connected);
  }, [wallet.address, view, play]);

  /* ------------------------------------------------------------ render */

  const secondsToReset = now === null ? null : 86_400 - (now % 86_400);

  const view_ = score;
  const effective = view_;
  const cards = effective?.quests ?? board?.quests.map(asPreview) ?? [];
  const season = board?.season;
  const seasonDays =
    season && now !== null ? Math.ceil(secondsLeft(season, now) / 86_400) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-24 sm:px-6">
      {/* ---------------------------------------------------------- hero */}
      <header className="text-center">
        <Image
          src="/ronke-quest-logo.webp"
          alt="Ronke Quest"
          width={1536}
          height={865}
          priority
          className="mx-auto h-auto w-full max-w-[420px]"
        />
        <p className="mx-auto mt-4 max-w-md text-muted-1">
          Five quests. A new set every day. Play them anywhere in the Ronkeverse — the chain does
          the rest.
        </p>

        <div className="mono mt-6 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-border bg-card-2 px-4 py-2 text-[11px] uppercase tracking-[0.12em]">
          <span className="text-muted-3">New quests in</span>
          <span className="font-bold text-gold">
            {secondsToReset === null ? "--:--:--" : clock(secondsToReset)}
          </span>
          {season && (
            <>
              <span className="text-muted-3">·</span>
              <span className="text-muted-2">
                {season.name}
                {seasonDays !== null && ` · ${seasonDays}d left`}
              </span>
            </>
          )}
        </div>
      </header>

      {/* -------------------------------------------------------- wallet */}
      <div className="mt-10">
        <WalletConnect wallet={wallet} viewing={scored} onViewSelf={() => {}} />
        {walletError && <p className="mono mt-3 text-[12px] text-burn">{walletError}</p>}
      </div>

      {/* --------------------------------------------------- today's run */}
      {effective && (
        <div className="rv-card mt-4 flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <button
              onClick={() => {
                play("click");
                refresh();
              }}
              disabled={checking}
              className="mono group inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-3 transition-colors hover:text-accent disabled:opacity-60"
              title="Re-read the chain"
            >
              Today
              <RefreshCw
                className={`h-3 w-3 ${checking ? "animate-spin text-accent" : ""}`}
                strokeWidth={2.5}
              />
            </button>
            <div className="mt-1 text-2xl font-bold tracking-tight">
              <span
                className={effective.done === QUESTS_PER_DAY ? "text-gold" : "text-foreground"}
              >
                {effective.done}
              </span>
              <span className="text-muted-3"> / {QUESTS_PER_DAY} done</span>
            </div>
          </div>
          <div className="min-w-[180px] flex-1">
            <div className="mono mb-2 flex items-baseline justify-between text-[11px] text-muted-3">
              <span className="text-gold">
                {effective.total.toLocaleString()} points
                {effective.bonus > 0 && <span className="text-muted-3"> (incl. bonus)</span>}
              </span>
              <span>{effective.maxPoints.toLocaleString()} on offer</span>
            </div>
            <div className="rv-meter">
              <span
                style={{
                  width: `${(effective.total / effective.maxPoints) * 100}%`,
                  background: "linear-gradient(90deg, var(--gold-2), var(--gold))",
                  transition: "width 800ms cubic-bezier(0.16,1,0.3,1)",
                }}
              />
            </div>
            <p className={`mono mt-2 text-[10px] ${stale ? "text-paper" : "text-muted-3"}`}>
              {checking
                ? "reading the chain…"
                : stale
                  ? "Ronin is busy — showing the last good read. Tap Today to retry."
                  : readAt && now !== null
                    ? `read ${ago(Math.floor(readAt / 1000), now)} ago · updates on its own, or tap Today`
                    : "updates on its own, or tap Today"}
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------ the five */}
      <div className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-1">
            Today&apos;s quests
          </h2>
          {checking && (
            <span className="mono inline-flex items-center gap-1.5 text-[11px] text-muted-3">
              <Loader2 className="h-3 w-3 animate-spin" />
              reading chain
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-3">
          {cards.map((quest) =>
            quest.game === "social" ? (
              <SocialQuestCard
                key={quest.id}
                quest={quest}
                address={wallet.address ?? null}
                onVerified={() => wallet.address && view(wallet.address, true)}
              />
            ) : (
              <QuestCard
                key={quest.id}
                quest={quest}
                catchingUp={logsMissing && quest.needsLogs ? logCoverage : undefined}
                refreshing={refreshingId === quest.id}
                onRefresh={
                  wallet.address
                    ? async () => {
                        play("click");
                        setRefreshingId(quest.id);
                        try {
                          await refresh();
                        } finally {
                          setRefreshingId(null);
                        }
                      }
                    : undefined
                }
              />
            )
          )}
          {cards.length === 0 &&
            !boardError &&
            Array.from({ length: QUESTS_PER_DAY }).map((_, i) => (
              <div key={i} className="rv-card h-[104px] animate-pulse" />
            ))}
        </div>

        {cards.length > 0 && (
          <div
            className={`rv-card mt-3 flex items-center gap-4 p-4 sm:gap-5 sm:p-5 ${
              effective?.bonus ? "border-gold/40" : "border-dashed"
            }`}
          >
            <span
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border sm:h-16 sm:w-16 ${
                effective?.bonus ? "border-gold/50 bg-gold/10" : "border-border bg-card-2"
              }`}
            >
              <Trophy
                className={`h-7 w-7 ${effective?.bonus ? "text-gold" : "text-muted-3"}`}
                strokeWidth={2}
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="mono flex flex-wrap items-center gap-x-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-3">
                <span>Clean sweep</span>
                {!!effective?.streak && effective.streak > 1 && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="text-gold">
                      {effective.streak} day streak · ×{effective.multiplier}
                    </span>
                  </>
                )}
              </div>
              <div className="mt-0.5 font-semibold">All five in a day</div>
              <p className="mt-0.5 text-[13px] text-muted-1">
                {effective?.bonus
                  ? effective.streak > 1
                    ? `Banked at ×${effective.multiplier}. Miss a day and the run resets.`
                    : "Banked. Come back tomorrow and it starts multiplying."
                  : `Finish all five for ${Math.round(
                      ALL_DONE_BONUS * (effective?.multiplier ?? 1)
                    )} points — each day in a row multiplies it, up to ×${STREAK_CAP}.`}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div
                className={`mono text-lg font-bold leading-none sm:text-xl ${
                  effective?.bonus ? "text-gold" : "text-muted-2"
                }`}
              >
                +{effective?.bonus || Math.round(ALL_DONE_BONUS * (effective?.multiplier ?? 1))}
              </div>
              <div className="mono mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-3">
                {effective?.bonus ? "earned" : "bonus"}
              </div>
            </div>
          </div>
        )}

        {!wallet.address && cards.length > 0 && (
          <p className="mt-4 text-center text-sm text-muted-2">
            That is today&apos;s sample board. Connect to draw your own five — everyone gets a
            different set, all worth the same.
          </p>
        )}
      </div>

      {/* ---------------------------------------------------- leaderboard */}
      <div className="rv-card mt-10 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-5 py-3">
          <div className="flex gap-1">
            {(["today", "season"] as const).map((key) => (
              <button
                key={key}
                onClick={() => {
                  play("click");
                  setTab(key);
                }}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  tab === key
                    ? "bg-card-2 text-foreground"
                    : "text-muted-2 hover:text-foreground"
                }`}
              >
                {key === "today" ? "Today" : season?.name ?? "Season"}
              </button>
            ))}
          </div>
          <span className="mono text-[10px] uppercase tracking-[0.12em] text-muted-3">
            {tab === "today" ? "since midnight UTC" : "points, all days so far"}
          </span>
        </div>

        <div className="rv-scroll overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="mono text-[10px] uppercase tracking-[0.12em] text-muted-3">
                <th className="px-5 py-2 text-left font-bold">#</th>
                <th className="px-3 py-2 text-left font-bold">Wallet</th>
                <th className="px-3 py-2 text-right font-bold">
                  {tab === "today" ? "Done" : "Days"}
                </th>
                <th className="px-3 py-2 text-right font-bold">Streak</th>
                <th className="px-5 py-2 text-right font-bold">Points</th>
              </tr>
            </thead>
            <tbody>
              {tab === "today" &&
                (board?.leaderboard ?? []).map((row, index) => {
                  const you = scored && row.address === scored.toLowerCase();
                  return (
                    <tr
                      key={row.address}
                      className={`border-t border-border-soft ${you ? "bg-accent/10" : ""}`}
                    >
                      <td className="mono px-5 py-2.5 text-muted-3">{index + 1}</td>
                      <td className={`mono px-3 py-2.5 ${you ? "text-gold" : "text-accent"}`}>
                        {short(row.address)}
                        {you && <span className="ml-2 text-[10px] text-gold">you</span>}
                      </td>
                      <td className="mono px-3 py-2.5 text-right">
                        {row.done}/{QUESTS_PER_DAY}
                      </td>
                      <td
                        className={`mono px-3 py-2.5 text-right ${
                          row.streak ? "text-gold" : "text-muted-3"
                        }`}
                      >
                        {row.streak ? `${row.streak}🔥` : "—"}
                      </td>
                      <td className="mono px-5 py-2.5 text-right font-bold text-gold">
                        {row.points.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}

              {tab === "season" &&
                (board?.seasonStandings ?? []).map((row, index) => {
                  const you = scored && row.address === scored.toLowerCase();
                  return (
                    <tr
                      key={row.address}
                      className={`border-t border-border-soft ${you ? "bg-accent/10" : ""}`}
                    >
                      <td className="mono px-5 py-2.5 text-muted-3">{index + 1}</td>
                      <td className={`mono px-3 py-2.5 ${you ? "text-gold" : "text-accent"}`}>
                        {short(row.address)}
                        {you && <span className="ml-2 text-[10px] text-gold">you</span>}
                      </td>
                      <td className="mono px-3 py-2.5 text-right">{row.days}</td>
                      <td
                        className={`mono px-3 py-2.5 text-right ${
                          row.sweeps ? "text-gold" : "text-muted-3"
                        }`}
                      >
                        {row.sweeps || "—"}
                      </td>
                      <td className="mono px-5 py-2.5 text-right font-bold text-gold">
                        {row.points.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}

              {tab === "season" && board && !board.seasonPersisted && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-2">
                    Season totals start once a database is connected. Today&apos;s board works
                    either way.
                  </td>
                </tr>
              )}
              {tab === "season" &&
                board?.seasonPersisted &&
                board.seasonStandings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-2">
                      Nothing banked yet this season.
                    </td>
                  </tr>
                )}
              {tab === "today" && board && board.leaderboard.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-2">
                    Nobody has scored yet today. Be the first name up there.
                  </td>
                </tr>
              )}
              {!board && !boardError && (
                <tr>
                  <td colSpan={5} className="mono px-5 py-10 text-center text-xs text-muted-3">
                    Reading Ronin…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {boardError && (
        <div className="rv-card mt-4 flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="text-sm text-muted-1">
            Ronin did not answer: <span className="mono text-burn">{boardError}</span>
          </p>
          <button
            onClick={() => loadBoard(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border-strong px-4 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      )}

      <p className="mt-10 text-center text-[13px] leading-relaxed text-muted-2">
        Your five are drawn from your wallet and today&apos;s date, so everyone plays a different
        board — and the draw is held to a fixed budget, so every board is worth the same. Nobody
        can reroll for an easier one. Progress is read live from Ronin: no sign-up, no signature,
        no transaction.
      </p>
    </div>
  );
}
