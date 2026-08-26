"use client";

import { ArrowUpRight, Check } from "lucide-react";
import { SCOPE_LABELS, type ScoredQuest } from "@/lib/quests/scoring";

/**
 * One quest. The meter tracks progress toward a comfortable target rather than
 * the points cap, so a card reads as "how am I doing" instead of "how close am
 * I to a ceiling" — the ceiling is printed next to the points instead.
 */
export default function QuestCard({ quest }: { quest: ScoredQuest }) {
  const pct = Math.min(100, (quest.value / quest.target) * 100);
  const done = quest.complete;

  return (
    <a
      href={quest.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`rv-card rv-hover group flex flex-col p-5 transition-colors ${
        done ? "border-diamond/35" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted-3">
          {SCOPE_LABELS[quest.scope]}
        </span>
        <span
          className={`mono shrink-0 text-lg font-bold leading-none ${
            done ? "text-diamond" : quest.points > 0 ? "text-accent" : "text-muted-3"
          }`}
        >
          {quest.points}
          <span className="ml-0.5 text-[10px] font-medium text-muted-3">/{quest.cap}</span>
        </span>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <span className="font-semibold leading-tight">{quest.title}</span>
        {done && <Check className="h-3.5 w-3.5 shrink-0 text-diamond" strokeWidth={3} />}
        <ArrowUpRight
          className="h-3.5 w-3.5 shrink-0 text-muted-3 opacity-0 transition-opacity group-hover:opacity-100"
          strokeWidth={2}
        />
      </div>

      <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-muted-2">{quest.blurb}</p>

      <div className="mt-4">
        <div className="rv-meter">
          <span
            style={{
              width: `${pct}%`,
              background: done ? "var(--diamond)" : undefined,
              transition: "width 700ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </div>
        <div className="mono mt-2 flex items-baseline justify-between text-[11px] text-muted-3">
          <span className={quest.value > 0 ? "text-muted-1" : ""}>
            {quest.value.toLocaleString()} {quest.unit}
          </span>
          <span>{done ? "maxed" : `${quest.target.toLocaleString()} to max`}</span>
        </div>
      </div>
    </a>
  );
}
