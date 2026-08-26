"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { seasonProgress, secondsLeft, type Season } from "@/lib/quests/season";

/**
 * The season clock. Every quest on the board resets when this hits zero, so it
 * is the loudest thing on the page — and it turns from Ronke blue to burn red
 * inside the last day, which is when it starts mattering.
 */

const UNITS = [
  { label: "days", size: 86_400 },
  { label: "hrs", size: 3_600 },
  { label: "min", size: 60 },
  { label: "sec", size: 1 },
] as const;

function split(total: number) {
  let rest = total;
  return UNITS.map((unit) => {
    const value = Math.floor(rest / unit.size);
    rest -= value * unit.size;
    return { label: unit.label, value };
  });
}

export default function SeasonBanner({ season }: { season: Season }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = secondsLeft(season, now);
  const parts = split(left);
  const progress = seasonProgress(season, now) * 100;
  const finalDay = left > 0 && left < 86_400;
  const over = left === 0;

  const ends = new Date(season.endsAt * 1000).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section
      aria-label={`${season.name} countdown`}
      className="rv-card relative overflow-hidden"
    >
      {/* Ronke himself, holding down the right edge of the clock. */}
      <div aria-hidden className="pointer-events-none absolute -bottom-6 right-0 top-0 w-1/2 max-w-sm">
        <Image
          src="/ronkebase.png"
          alt=""
          fill
          sizes="(min-width: 1024px) 24rem, 50vw"
          className="scale-110 object-contain object-right-bottom opacity-[0.28]"
          priority={false}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(90deg, var(--card) 8%, rgba(15,18,25,0.35) 60%, transparent)",
          }}
        />
      </div>

      <div className="relative p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={`mono rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${
              over
                ? "border-muted-3/40 text-muted-2"
                : finalDay
                  ? "border-burn/45 text-burn"
                  : "border-accent/45 text-accent"
            }`}
          >
            {over ? "Season closed" : finalDay ? "Final day" : "Live now"}
          </span>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{season.name}</h2>
        </div>

        <p className="mono mt-2 text-[11px] uppercase tracking-[0.14em] text-muted-3">
          {over ? `Closed ${ends}` : `Closes ${ends}`}
        </p>

        <div className="mt-6 flex flex-wrap gap-2 sm:gap-3">
          {parts.map((part) => (
            <div
              key={part.label}
              className="min-w-[74px] flex-1 rounded-xl border border-border bg-card-2/80 px-3 py-3 text-center sm:min-w-[92px] sm:px-4"
            >
              <div
                className={`mono text-3xl font-bold leading-none tracking-tight sm:text-4xl ${
                  finalDay ? "text-burn" : over ? "text-muted-3" : "text-foreground"
                }`}
              >
                {String(part.value).padStart(2, "0")}
              </div>
              <div className="mono mt-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-3">
                {part.label}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 max-w-xl">
          <div className="rv-meter">
            <span
              style={{
                width: `${progress}%`,
                background: finalDay
                  ? "linear-gradient(90deg, var(--burn-2), var(--burn))"
                  : "linear-gradient(90deg, var(--accent-2), var(--accent))",
                transition: "width 1s linear",
              }}
            />
          </div>
          <p className="mono mt-2 text-[11px] text-muted-3">
            {Math.round(progress)}% of the season gone · every quest below resets at zero
          </p>
        </div>
      </div>
    </section>
  );
}
