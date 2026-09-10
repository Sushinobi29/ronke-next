"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, Trophy } from "lucide-react";
import { describeItem, formatAmount, type RewardItem } from "@/lib/quests/rewards";

/**
 * What ronkeverse.com/quests shows before the first season opens.
 *
 * A board with no season behind it is a page of empty tables — the quests are
 * real but nothing they earn counts yet, which is a worse first impression
 * than saying plainly that it starts on Friday. So until the clock runs out
 * this is the page, and the board is one query parameter away for anybody
 * checking it works.
 */
export default function QuestsTeaser({
  startsAt,
  seasonName,
  items,
}: {
  startsAt: number;
  seasonName: string;
  items: RewardItem[];
}) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setLeft(Math.max(0, startsAt - Math.floor(Date.now() / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startsAt]);

  const parts = [
    { value: Math.floor((left ?? 0) / 86_400), label: "days" },
    { value: Math.floor(((left ?? 0) % 86_400) / 3_600), label: "hours" },
    { value: Math.floor(((left ?? 0) % 3_600) / 60), label: "minutes" },
    { value: (left ?? 0) % 60, label: "seconds" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-24 sm:px-6">
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
          Five quests. A new set every day. Play them, get points, get rewarded at the end of the
          season based on your score.
        </p>
      </header>

      <div className="rv-card mt-10 overflow-hidden">
        {/* Muted and looping, so it plays everywhere without asking. */}
        <video
          src="/quests/teaser.mp4"
          poster="/quests/teaser-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="block w-full"
        />
      </div>

      <section className="rv-card mt-4 p-6 text-center">
        <div className="mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-3">
          {seasonName} opens
        </div>
        <div className="mt-4 flex justify-center gap-2 sm:gap-4">
          {parts.map((part) => (
            <div key={part.label} className="min-w-[62px] rounded-xl border border-border bg-card-2 px-2 py-3 sm:min-w-[80px]">
              <div className="mono text-2xl font-bold leading-none text-gold sm:text-3xl">
                {left === null ? "--" : String(part.value).padStart(2, "0")}
              </div>
              <div className="mono mt-1.5 text-[9px] uppercase tracking-[0.14em] text-muted-3">
                {part.label}
              </div>
            </div>
          ))}
        </div>
        <p className="mono mt-4 text-[11px] uppercase tracking-[0.12em] text-muted-3">
          {new Date(startsAt * 1000).toUTCString().replace("GMT", "UTC")}
        </p>
      </section>

      {items.length > 0 && (
        <section className="rv-card mt-4 border-gold/40 p-5">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-gold" />
            <h2 className="mono text-[11px] font-bold uppercase tracking-[0.14em] text-gold">
              {seasonName} rewards
            </h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-border bg-card-2 p-4">
                <div className="text-xl font-bold tracking-tight text-gold">
                  {formatAmount(item.amount, item.precision)}{" "}
                  <span className="text-base text-foreground">{item.label}</span>
                </div>
                <div className="mono mt-1 text-[11px] uppercase tracking-[0.1em] text-muted-3">
                  {describeItem(item)}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[13px] text-muted-1">
            Split down the season leaderboard when it closes. Everyone starts level.
          </p>
        </section>
      )}

      <section className="mt-10 grid gap-3 sm:grid-cols-2">
        {[
          ["Five quests a day", "Drawn fresh at midnight, across every game in the Ronkeverse."],
          ["Points follow the effort", "A quest is worth what it costs to do. Every quest pays something."],
          ["Clear all five", "A bonus on top — and it multiplies for every day in a row."],
          ["Nothing to sign up for", "Connect a wallet and the chain answers for you. No transaction, no gas."],
        ].map(([title, line]) => (
          <div key={title} className="rv-card p-4">
            <div className="font-semibold">{title}</div>
            <p className="mt-1 text-[13px] text-muted-1">{line}</p>
          </div>
        ))}
      </section>

      <p className="mono mt-10 text-center text-[11px] uppercase tracking-[0.12em] text-muted-3">
        Ronke no have job. Ronke have quest.
      </p>

      <div className="mt-6 text-center">
        <a
          href="https://games.ronkeverse.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-border-strong px-5 py-2.5 text-[13px] font-medium text-muted-1 transition-colors hover:border-accent hover:text-accent"
        >
          Go and play something in the meantime
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
