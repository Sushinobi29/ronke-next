"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Loader2, RefreshCw, Trophy } from "lucide-react";
import QuestCard from "@/components/quest-card";
import WalletConnect from "@/components/wallet-connect";
import { useRoninWallet } from "@/hooks/useRoninWallet";
import {
  ALL_DONE_BONUS,
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
  verify?: "chain" | "honour";
  cost: CostTier;
  unit?: string;
  link?: string;
}

interface Round {
  table: string;
  id: number;
  at: number;
  player: string;
  bet: number;
  status: number;
  payout: number;
}

interface BoardPayload {
  day: number;
  season: Season;
  quests: BoardQuest[];
  roundsToday: number;
  playersToday: number;
  stakedToday: number;
  feed: Round[];
  resetsIn: number;
}

interface DailyScore {
  quests: ScoredQuest[];
  done: number;
  points: number;
  bonus: number;
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

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  return Math.round(n).toLocaleString();
}

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
  // Null until mounted: a clock rendered on the server is already stale by the
  // time the client hydrates, which React counts as a mismatch.
  const [now, setNow] = useState<number | null>(null);
  const [honour, setHonour] = useState<string[]>([]);
  const autoLoaded = useRef<string | null>(null);

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

  // The social slot is the player's own word, remembered per day on this
  // device only. It never reaches the server.
  const honourKey = board ? `ronke-quests-honour-${board.day}` : null;

  useEffect(() => {
    if (!honourKey) return;
    try {
      setHonour(JSON.parse(window.localStorage.getItem(honourKey) ?? "[]"));
    } catch {
      setHonour([]);
    }
  }, [honourKey]);

  const markHonour = useCallback(
    (id: string) => {
      if (!honourKey) return;
      setHonour((current) => {
        if (current.includes(id)) return current;
        const next = [...current, id];
        try {
          window.localStorage.setItem(honourKey, JSON.stringify(next));
        } catch {
          // A browser refusing storage just means it will not stick.
        }
        return next;
      });
    },
    [honourKey]
  );

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
  }, []);

  /** The button, and the safety net for anyone who never presses it. */
  const refresh = useCallback(() => {
    loadBoard(true);
    if (wallet.address) view(wallet.address, true);
  }, [loadBoard, view, wallet.address]);

  useEffect(() => {
    if (!wallet.address) return;
    const timer = setInterval(() => view(wallet.address!), 45_000);
    return () => clearInterval(timer);
  }, [wallet.address, view]);

  useEffect(() => {
    const connected = wallet.address?.toLowerCase() ?? null;
    if (!connected) {
      autoLoaded.current = null;
      setScore(null);
      setScored(null);
      return;
    }
    if (autoLoaded.current === connected) return;
    autoLoaded.current = connected;
    view(connected);
  }, [wallet.address, view]);

  /* ------------------------------------------------------------ render */

  const secondsToReset = now === null ? null : 86_400 - (now % 86_400);

  /** Folds the on-your-honour slot into whatever the chain reported. */
  const applyHonour = useCallback(
    (quests: ScoredQuest[]) =>
      quests.map((q) =>
        q.verify === "honour" && honour.includes(q.id)
          ? { ...q, value: q.target, done: true }
          : q
      ),
    [honour]
  );

  // Named apart from the fetcher so the memo below reads as data, not action.
  const view_ = score;
  const effective = useMemo(() => {
    if (!view_) return null;
    const quests = applyHonour(view_.quests);
    const done = quests.filter((q) => q.done).length;
    const points = quests.filter((q) => q.done).reduce((sum, q) => sum + q.points, 0);
    const bonus = done === QUESTS_PER_DAY ? ALL_DONE_BONUS : 0;
    return { ...view_, quests, done, points, bonus, total: points + bonus };
  }, [view_, applyHonour]);

  const cards = effective?.quests ?? applyHonour(board?.quests.map(asPreview) ?? []);
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
              onClick={refresh}
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
          {cards.map((quest) => (
            <QuestCard
              key={quest.id}
              quest={quest}
              catchingUp={
                logsMissing && (quest.game === "gacha" || quest.game === "age-of-ronke")
                  ? logCoverage
                  : undefined
              }
              onMarkDone={() => markHonour(quest.id)}
            />
          ))}
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
              <div className="mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted-3">
                Clean sweep
              </div>
              <div className="mt-0.5 font-semibold">All five in a day</div>
              <p className="mt-0.5 text-[13px] text-muted-1">
                {effective?.bonus
                  ? "Bonus banked. Come back tomorrow for five more."
                  : `Finish every quest today for a bonus ${ALL_DONE_BONUS} points.`}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div
                className={`mono text-lg font-bold leading-none sm:text-xl ${
                  effective?.bonus ? "text-gold" : "text-muted-2"
                }`}
              >
                +{ALL_DONE_BONUS}
              </div>
              <div className="mono mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-3">
                {effective?.bonus ? "earned" : "bonus"}
              </div>
            </div>
          </div>
        )}

        {!wallet.address && cards.length > 0 && (
          <p className="mt-4 text-center text-sm text-muted-2">
            Connect above to see how far along you already are.
          </p>
        )}
      </div>

      {/* ------------------------------------------------- today's tables */}
      <div className="rv-card mt-10 overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold tracking-wide">Today at the tables</h2>
          <span className="mono text-[10px] uppercase tracking-[0.12em] text-muted-3">
            {board
              ? `${board.playersToday} playing · ${board.roundsToday} rounds`
              : "loading"}
          </span>
        </div>

        <ul className="divide-y divide-border-soft">
          {board?.feed.map((round) => (
            <li
              key={`${round.table}-${round.id}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm"
            >
              <span className="mono w-9 shrink-0 text-[11px] text-muted-3">
                {now === null ? "·" : ago(round.at, now)}
              </span>
              <span className="mono text-accent">{short(round.player)}</span>
              <span className="text-muted-2">
                <span className="mono text-foreground">{compact(round.bet)}</span> {round.table}
              </span>
              <span
                className={`mono ml-auto text-[12px] ${
                  round.status === 1 ? "text-gold" : round.status === 2 ? "text-burn" : "text-muted-3"
                }`}
              >
                {round.status === 1 ? `+${compact(round.payout)}` : round.status === 2 ? "boom" : "in play"}
              </span>
            </li>
          ))}
          {board && board.feed.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-muted-2">
              Nothing yet today. The tables are open — go be first.
            </li>
          )}
          {!board && !boardError && (
            <li className="mono px-5 py-10 text-center text-xs text-muted-3">Reading Ronin…</li>
          )}
        </ul>
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
        Everyone gets the same five quests each day, drawn from the date itself — so nobody can
        reroll for an easier set. Progress is read live from Ronin: no sign-up, no signature, no
        transaction.
      </p>
    </div>
  );
}
