"use client";

import Image from "next/image";
import { ArrowUpRight, Check } from "lucide-react";
import { COST_LABELS, type ScoredQuest } from "@/lib/quests/daily";

/**
 * One of the day's five. Built as a wide row rather than a grid tile: five
 * items read faster in a list, and the row leaves space for the task to be a
 * plain instruction instead of a paragraph.
 */
export default function QuestCard({
  quest,
  onMarkDone,
}: {
  quest: ScoredQuest;
  onMarkDone?: () => void;
}) {
  const pct = Math.min(100, (quest.value / quest.target) * 100);
  const multi = quest.target > 1;
  const honour = quest.verify === "honour";

  return (
    <a
      href={quest.href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={honour && !quest.done ? onMarkDone : undefined}
      className={`rv-card rv-hover group flex items-center gap-4 p-4 transition-colors sm:gap-5 sm:p-5 ${
        quest.done ? "border-gold/40" : ""
      }`}
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
          <span className={quest.cost === "free" ? "text-diamond" : quest.cost === "big" ? "text-gold" : ""}>
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
        {honour && (
          <p className="mono mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-3">
            {quest.done ? "marked done · on your honour" : "tap to open · counts on your honour"}
          </p>
        )}

        {multi && !quest.done && (
          <div className="mt-2.5 flex items-center gap-2.5">
            <div className="rv-meter w-full max-w-[180px]">
              <span style={{ width: `${pct}%`, transition: "width 600ms cubic-bezier(0.16,1,0.3,1)" }} />
            </div>
            <span className="mono text-[11px] text-muted-2">
              {quest.value} / {quest.target}
            </span>
          </div>
        )}
      </div>

      <div className="shrink-0 text-right">
        <div
          className={`mono text-lg font-bold leading-none sm:text-xl ${
            quest.done ? "text-gold" : "text-muted-2"
          }`}
        >
          +{quest.points}
        </div>
        <div className="mono mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-3">
          {quest.done ? "done" : "points"}
        </div>
      </div>
    </a>
  );
}
