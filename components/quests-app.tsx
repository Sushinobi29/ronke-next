"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import QuestCard from "@/components/quest-card";
import SeasonBanner from "@/components/season-banner";
import WalletConnect from "@/components/wallet-connect";
import { useRoninWallet } from "@/hooks/useRoninWallet";
import { GAME_ART, GAME_LABELS, QUESTS, type QuestGame, type WalletScore } from "@/lib/quests/scoring";
import type { Season } from "@/lib/quests/season";
import { EXPLORER, FORTUNE_SPIN } from "@/lib/quests/contracts";

/* --------------------------------------------------------------- types */

interface BoardEntry {
  address: string;
  rounds: number;
  cashouts: number;
  wagered: number;
  best: number;
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
  season: {
    season: Season;
    startBlock: number;
    minesLifetime: number;
    minesThisSeason: number;
    minesByTable: { label: string; lifetime: number }[];
    voteSeason: number;
    voteTotal: number;
    votePlayers: number;
    votePool: number;
    spinPot: number;
    topVoters: { address: string; votes: number }[];
  };
  board: BoardEntry[];
  feed: Round[];
  roundsScanned: number;
  updatedAt: number;
}

/* ----------------------------------------------------------- formatting */

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  return Math.round(n).toLocaleString();
}

function ago(seconds: number): string {
  const delta = Math.max(0, Math.floor(Date.now() / 1000) - seconds);
  if (delta < 60) return `${delta}s`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h`;
  return `${Math.floor(delta / 86400)}d`;
}

/** Ronin wallets show addresses as `ronin:abc…`; accept either form. */
function normalize(input: string): string {
  const trimmed = input.trim();
  return trimmed.startsWith("ronin:") ? `0x${trimmed.slice(6)}` : trimmed;
}

const GAME_ORDER: QuestGame[] = ["casino", "vote", "ronkeverse", "age-of-ronke"];

/* ------------------------------------------------------------ sub-views */

function Stat({ value, label, tone }: { value: string; label: string; tone?: "diamond" }) {
  return (
    <div className="rv-card p-4 sm:p-5">
      <div
        className={`mono text-2xl font-bold tracking-tight sm:text-[1.75rem] ${
          tone === "diamond" ? "text-diamond" : "text-accent"
        }`}
      >
        {value}
      </div>
      <div className="mono mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-3">{label}</div>
    </div>
  );
}

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rv-card flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold tracking-wide">{title}</h3>
        {note && <span className="mono text-[10px] uppercase tracking-[0.12em] text-muted-3">{note}</span>}
      </div>
      <div className="rv-scroll flex-1 overflow-x-auto">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ app */

export default function QuestsApp() {
  const reduced = useReducedMotion();

  const [board, setBoard] = useState<BoardPayload | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);

  const wallet = useRoninWallet();
  const [score, setScore] = useState<WalletScore | null>(null);
  const [scored, setScored] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const walletRef = useRef<HTMLDivElement>(null);
  /** The last address auto-loaded from the connection, so a manual pick sticks. */
  const autoLoaded = useRef<string | null>(null);

  /* board -------------------------------------------------------------- */

  const loadBoard = useCallback(async () => {
    try {
      const res = await fetch("/api/quests/board");
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

  const view = useCallback(
    async (raw: string, scroll = true) => {
      const address = normalize(raw);
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        setWalletError("That is not a Ronin address.");
        return;
      }

      setChecking(true);
      setWalletError(null);
      try {
        const res = await fetch(`/api/quests/wallet?address=${address}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Ronin did not answer");
        setScore(json.score);
        setScored(json.address);
        const url = new URL(window.location.href);
        url.searchParams.set("address", address);
        window.history.replaceState({}, "", url);
        if (scroll) {
          requestAnimationFrame(() =>
            walletRef.current?.scrollIntoView({
              behavior: reduced ? "auto" : "smooth",
              block: "start",
            })
          );
        }
      } catch (error) {
        setScore(null);
        setWalletError(error instanceof Error ? error.message : "Ronin did not answer");
      } finally {
        setChecking(false);
      }
    },
    [reduced]
  );

  // A shared ?address= link wins on first paint; after that the connected
  // wallet takes over whenever it changes.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("address");
    if (fromUrl) {
      autoLoaded.current = fromUrl.toLowerCase();
      view(fromUrl, false);
    }
  }, [view]);

  useEffect(() => {
    const connected = wallet.address?.toLowerCase() ?? null;
    if (!connected || autoLoaded.current === connected) return;
    autoLoaded.current = connected;
    view(connected, false);
  }, [wallet.address, view]);

  const grouped = useMemo(() => {
    if (!score) return [];
    return GAME_ORDER.map((game) => ({
      game,
      quests: score.quests.filter((q) => q.game === game),
    })).filter((group) => group.quests.length > 0);
  }, [score]);

  const season = board?.season;
  const fade = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.15 },
        transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const },
      };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-28 sm:px-6">
      {/* ---------------------------------------------------------- hero */}
      <header>
        <div className="mono text-[11px] font-bold uppercase tracking-[0.18em] text-muted-2">
          Live from Ronin
        </div>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">
          Ronke Quests<span className="text-muted-3">.</span>
        </h1>
        <p className="mt-4 max-w-xl text-muted-1">
          {QUESTS.length} quests across the Ronkeverse, all scored inside the season and all read
          straight off the chain. When the clock runs out the board resets and everyone starts
          level. No sign-up, no signature, no transaction.
        </p>
      </header>

      <div className="mt-8">
        {season ? (
          <SeasonBanner season={season.season} />
        ) : (
          <div className="rv-card h-[268px] animate-pulse" />
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          value={season ? season.minesThisSeason.toLocaleString() : "—"}
          label="Mines rounds this season"
        />
        <Stat value={season ? `${compact(season.spinPot)} RON` : "—"} label="In the spin machine" />
        <Stat value={season ? compact(season.minesLifetime) : "—"} label="Mines rounds all time" />
        <Stat
          value={season ? season.votePlayers.toLocaleString() : "—"}
          label="Voters on chain"
          tone="diamond"
        />
      </div>

      {/* -------------------------------------------------------- wallet */}
      <div ref={walletRef} className="scroll-mt-24 pt-16">
        <WalletConnect
          wallet={wallet}
          viewing={scored}
          onViewSelf={() => wallet.address && view(wallet.address)}
        />

        {walletError && <p className="mono mt-3 text-[12px] text-burn">{walletError}</p>}

        {checking && !score && (
          <p className="mono mt-4 inline-flex items-center gap-2 text-[12px] text-muted-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Reading the chain…
          </p>
        )}

        {score && scored && (
          <div className="mt-6">
            <div className="rv-card flex flex-wrap items-end justify-between gap-6 p-6 sm:p-8">
              <div>
                <div className="mono text-[10px] uppercase tracking-[0.14em] text-muted-3">
                  Ronke points · this season
                </div>
                <div className="mono mt-1 text-5xl font-bold tracking-tight text-accent sm:text-6xl">
                  {score.total.toLocaleString()}
                </div>
                <a
                  href={`${EXPLORER}/address/${scored}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono mt-2 inline-block text-[12px] text-muted-2 transition-colors hover:text-accent"
                >
                  {short(scored)}
                </a>
              </div>
              <div className="min-w-[200px] flex-1">
                <div className="mono mb-2 flex items-baseline justify-between text-[11px] text-muted-3">
                  <span>
                    {score.quests.filter((q) => q.complete).length} of {QUESTS.length} maxed
                  </span>
                  <span>{score.maxTotal.toLocaleString()} possible</span>
                </div>
                <div className="rv-meter rv-meter--burn">
                  <span
                    style={{
                      width: `${Math.min(100, (score.total / score.maxTotal) * 100)}%`,
                      background: "linear-gradient(90deg, var(--accent-2), var(--accent), var(--diamond))",
                      transition: "width 900ms cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                  />
                </div>
              </div>
            </div>

            {grouped.map((group) => (
              <div key={group.game} className="mt-8">
                <h2 className="flex items-center gap-3">
                  <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-border bg-card-2">
                    <Image
                      src={GAME_ART[group.game].src}
                      alt={GAME_ART[group.game].alt}
                      fill
                      sizes="36px"
                      className="object-cover"
                    />
                  </span>
                  <span className="mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-1">
                    {GAME_LABELS[group.game]}
                  </span>
                </h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.quests.map((quest) => (
                    <QuestCard key={quest.id} quest={quest} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!score && !checking && (
          <p className="mt-4 text-sm text-muted-2">
            Not on Ronin yet? Tap any wallet on the boards below to see the season through their
            eyes.
          </p>
        )}
      </div>

      {/* -------------------------------------------------------- boards */}
      <motion.div {...fade} className="mt-20 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Live tables"
          note={board ? `${board.roundsScanned} rounds this season` : "loading"}
        >
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="mono text-[10px] uppercase tracking-[0.12em] text-muted-3">
                <th className="px-5 py-2 text-left font-bold">#</th>
                <th className="px-3 py-2 text-left font-bold">Wallet</th>
                <th className="px-3 py-2 text-right font-bold">Rounds</th>
                <th className="px-3 py-2 text-right font-bold">Cashed</th>
                <th className="px-5 py-2 text-right font-bold">Best hit</th>
              </tr>
            </thead>
            <tbody>
              {(board?.board ?? []).slice(0, 12).map((entry, index) => (
                <tr
                  key={entry.address}
                  onClick={() => view(entry.address)}
                  className="cursor-pointer border-t border-border-soft transition-colors hover:bg-card-2"
                >
                  <td className="mono px-5 py-2.5 text-muted-3">{index + 1}</td>
                  <td className="mono px-3 py-2.5 text-accent">{short(entry.address)}</td>
                  <td className="mono px-3 py-2.5 text-right">{entry.rounds}</td>
                  <td className="mono px-3 py-2.5 text-right text-diamond">{entry.cashouts}</td>
                  <td className="mono px-5 py-2.5 text-right text-muted-1">{compact(entry.best)}</td>
                </tr>
              ))}
              {!board && !boardError && (
                <tr>
                  <td colSpan={5} className="mono px-5 py-10 text-center text-xs text-muted-3">
                    Reading Ronin…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>

        <Panel title="Ronke Vote — top 20" note="on-chain, all seasons">
          <table className="w-full min-w-[360px] text-sm">
            <thead>
              <tr className="mono text-[10px] uppercase tracking-[0.12em] text-muted-3">
                <th className="px-5 py-2 text-left font-bold">#</th>
                <th className="px-3 py-2 text-left font-bold">Wallet</th>
                <th className="px-5 py-2 text-right font-bold">Votes</th>
              </tr>
            </thead>
            <tbody>
              {(season?.topVoters ?? []).slice(0, 12).map((voter, index) => (
                <tr
                  key={voter.address}
                  onClick={() => view(voter.address)}
                  className="cursor-pointer border-t border-border-soft transition-colors hover:bg-card-2"
                >
                  <td className="mono px-5 py-2.5 text-muted-3">{index + 1}</td>
                  <td className="mono px-3 py-2.5 text-accent">{short(voter.address)}</td>
                  <td className="mono px-5 py-2.5 text-right">{compact(voter.votes)}</td>
                </tr>
              ))}
              {!board && !boardError && (
                <tr>
                  <td colSpan={3} className="mono px-5 py-10 text-center text-xs text-muted-3">
                    Reading Ronin…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
      </motion.div>

      {/* ------------------------------------------------------- activity */}
      <motion.div {...fade} className="mt-4">
        <Panel
          title="Latest rounds"
          note={board ? `updated ${ago(Math.floor(board.updatedAt / 1000))} ago` : "loading"}
        >
          <ul className="divide-y divide-border-soft">
            {(board?.feed ?? []).map((round) => (
              <li
                key={`${round.table}-${round.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm"
              >
                <span className="mono w-10 shrink-0 text-[11px] text-muted-3">{ago(round.at)}</span>
                <button
                  onClick={() => view(round.player)}
                  className="mono text-accent transition-colors hover:text-accent-soft"
                >
                  {short(round.player)}
                </button>
                <span className="text-muted-2">
                  staked <span className="mono text-foreground">{compact(round.bet)}</span>{" "}
                  {round.table}
                </span>
                <span
                  className={`mono ml-auto text-[12px] ${
                    round.status === 1 ? "text-diamond" : round.status === 2 ? "text-burn" : "text-muted-3"
                  }`}
                >
                  {round.status === 1
                    ? `+${compact(round.payout)}`
                    : round.status === 2
                      ? "boom"
                      : "in play"}
                </span>
              </li>
            ))}
            {!board && !boardError && (
              <li className="mono px-5 py-10 text-center text-xs text-muted-3">Reading Ronin…</li>
            )}
          </ul>
        </Panel>
      </motion.div>

      {boardError && (
        <div className="rv-card mt-4 flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="text-sm text-muted-1">
            Ronin did not answer: <span className="mono text-burn">{boardError}</span>
          </p>
          <button
            onClick={loadBoard}
            className="inline-flex items-center gap-2 rounded-lg border border-border-strong px-4 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      )}

      {/* ---------------------------------------------------------- note */}
      <div className="rv-card mt-16 p-6 sm:p-8">
        <h2 className="text-lg font-semibold">How the points work</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-1">
          Every quest is read straight from a Ronin contract — the Coinflip and Mines tables at
          Ronke Casino, Ronke Vote&apos;s citizens and ballots, and the monkes, barracks and trophies
          in your wallet. Nothing is stored on our side, so the board is exactly as honest as the
          chain is. Staking quests are scored on the square root of the amount, which means size
          helps but never decides, and every quest has a hard ceiling.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-2">
          A quest marked <span className="mono text-muted-1">this season</span> counts only what
          you have done since the clock started — measured by reading the very same contract at the
          block the season opened and subtracting. One marked{" "}
          <span className="mono text-muted-1">standing</span> is about where you are right now, so
          it carries between seasons.{" "}
          <a
            href={FORTUNE_SPIN.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-accent-soft"
          >
            The Fortune Spin machine
          </a>{" "}
          pays out in barracks, so spinning shows up under Age of Ronke.
        </p>
      </div>
    </div>
  );
}
