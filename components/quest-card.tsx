"use client";

import Image from "next/image";
import { ArrowUpRight, Check, RefreshCw } from "lucide-react";
import { COST_LABELS, type ScoredQuest } from "@/lib/quests/daily";

/**
 * One of the day's five.
 *
 * The card is a link, but the right-hand column sits outside it — a button
 * inside an anchor is invalid markup, and putting the refresh there lets it
 * share the column with the points rather than float over the card.
 */
export default function QuestCard({
  quest,
  catchingUp,
  onRefresh,
  refreshing,
}: {
  quest: ScoredQuest;
  /** 0-1 while this quest's log history is still being walked back. */
  catchingUp?: number;
  /** Chain reads are shared, so one quest's check refreshes them all — but
   *  people want to press the thing they just did. */
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const pct = Math.min(100, (quest.value / quest.target) * 100);
  const multi = quest.target > 1;

  return (
    <div
      className={`rv-card rv-hover group flex items-stretch transition-colors ${
        quest.done ? "border-gold/40" : ""
      }`}
    >
      <a
        href={quest.href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-4 p-4 sm:gap-5 sm:p-5"
      >
        <span
          className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border sm:h-16 sm:w-16 ${
            quest.done ? "border-gold/50" : "border-border"
          }`}
        >
          <Image src={quest.art} alt="" fill sizes="64px" className="object-cover" />
          {quest.done && (
            <span className="absolute inset-0 flex items-center justify-center bg-[#07080c]/70">
              <Check className="h-7 w-7 text-gold" strokeWidth={3} />
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="mono flex flex-wrap items-center gap-x-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-3">
            <span>{quest.gameLabel}</span>
            <span aria-hidden>·</span>
            <span
              className={
                quest.cost === "free"
                  ? "text-diamond"
                  : quest.cost === "big"
                    ? "text-gold"
                    : ""
              }
            >
              {COST_LABELS[quest.cost]}
            </span>
          </div>

          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="truncate font-semibold">{quest.title}</span>
            <ArrowUpRight
              className="h-3.5 w-3.5 shrink-0 text-muted-3 opacity-0 transition-opacity group-hover:opacity-100"
              strokeWidth={2}
            />
          </div>

          <p className="mt-0.5 truncate text-[13px] text-muted-1">{quest.task}</p>

          {quest.note && !quest.done && (
            <p className="mt-1 text-[11px] leading-snug text-paper">{quest.note}</p>
          )}

          {catchingUp !== undefined && !quest.done && (
            <p className="mono mt-1 text-[10px] uppercase tracking-[0.12em] text-paper">
              reading today&apos;s history · {Math.round(catchingUp * 100)}%
            </p>
          )}

          {multi && !quest.done && (
            <div className="mt-2.5 flex items-center gap-2.5">
              <div className="rv-meter w-full max-w-[180px]">
                <span
                  style={{
                    width: `${pct}%`,
                    transition: "width 600ms cubic-bezier(0.16,1,0.3,1)",
                  }}
                />
              </div>
              <span className="mono text-[11px] text-muted-2">
                {quest.value} / {quest.target}
                {quest.unit ? ` ${quest.unit}` : ""}
              </span>
            </div>
          )}
        </div>
      </a>

      <div className="flex shrink-0 flex-col items-end justify-center gap-1.5 py-4 pr-4 sm:py-5 sm:pr-5">
        <div
          className={`mono text-lg font-bold leading-none sm:text-xl ${
            quest.done ? "text-gold" : "text-muted-2"
          }`}
        >
          +{quest.points}
        </div>
        <div className="mono text-[10px] uppercase tracking-[0.12em] text-muted-3">
          {quest.done ? "done" : "points"}
        </div>

        {onRefresh && !quest.done && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            aria-label={`Check ${quest.title} again`}
            title="Check again"
            className="mt-1 rounded-lg p-1.5 text-muted-3 transition-colors hover:bg-card-2 hover:text-accent disabled:cursor-default"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-accent" : ""}`}
              strokeWidth={2.5}
            />
          </button>
        )}
      </div>
    </div>
  );
}
