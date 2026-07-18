"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

const FACTORS = [
  {
    title: "How much you hold",
    text: "$RONKE, $RONKESTR and NFTs all count, with diminishing returns. Rarer monkes are worth more.",
  },
  {
    title: "How long you have held",
    text: "Holding time compounds for up to 24 months. Top-ups dilute the clock; selling resets it.",
  },
  {
    title: "Diamond hands",
    text: "Never selling multiplies your time points. Staking, bridging and game moves never count as selling.",
  },
  {
    title: "Collector bonuses",
    text: "Distinct body types, full sets and 1/1s pay flat kickers. One 1/1 outweighs a pile of commons.",
  },
];

const BUCKETS = [
  {
    label: "Diamond",
    color: "var(--diamond)",
    text: "30+ days held, never sold",
  },
  { label: "Regular", color: "var(--regular)", text: "7+ days held" },
  {
    label: "Paper",
    color: "var(--paper)",
    text: "dumped within a day of buying",
  },
];

const BADGES = [
  { emoji: "🪙", name: "Bag Size", tiers: "Shrimp to Leviathan" },
  { emoji: "💎", name: "Diamond Hands", tiers: "30+ days, never sold" },
  { emoji: "🌱", name: "OG", tiers: "held since before the L2 migration" },
  { emoji: "🐋", name: "Whale", tiers: "top holder by supply share" },
  { emoji: "🏹", name: "Rarity Hunter", tiers: "holds a top-5% monke" },
  { emoji: "🤝", name: "Dual Citizen", tiers: "holds token and NFT" },
];

// Example-wallet numbers for the preview card (illustrative, not live data).
const SAMPLE_BREAKDOWN = [
  { label: "$RONKE", value: 1240, max: 2400 },
  { label: "$RONKESTR", value: 610, max: 2400 },
  { label: "Ronkeverse", value: 2385, max: 2400 },
];

export default function ScoreSection() {
  const reduced = useReducedMotion();

  return (
    <div className="border-y border-border bg-card-2">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="grid items-start gap-12 lg:grid-cols-[3fr_2fr]">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              The Ronke Score.
            </h2>
            <p className="mt-3 max-w-xl text-muted-1">
              One number for how real your monke commitment is. Built so a
              committed mid-sized holder can out-rank a passive whale, and
              behavioral by design: $RONKE has no oracle price, so diamond
              hands means you genuinely never sold.
            </p>

            <div className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
              {FACTORS.map((factor, i) => (
                <motion.div
                  key={factor.title}
                  initial={reduced ? false : { opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{
                    duration: 0.5,
                    delay: i * 0.07,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <div className="font-semibold">{factor.title}</div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-1">
                    {factor.text}
                  </p>
                </motion.div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              {BUCKETS.map((bucket) => (
                <span
                  key={bucket.label}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm"
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ background: bucket.color }}
                  />
                  <span className="font-semibold">{bucket.label}</span>
                  <span className="text-muted-2">{bucket.text}</span>
                </span>
              ))}
            </div>

            <div className="mt-10">
              <Link
                href="/score"
                className="inline-block rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-transform active:scale-[0.98]"
                style={{ boxShadow: "0 8px 30px rgba(39,185,252,0.32)" }}
              >
                Check your score
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            {/* Live component preview of the analytics score card, fed with
                labeled example data. */}
            <div
              className="rounded-[28px] border border-border p-7"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, var(--card)) 0%, var(--card) 45%, color-mix(in srgb, var(--diamond) 12%, var(--card)) 100%)",
              }}
            >
              <div className="flex items-baseline justify-between">
                <div className="text-xs uppercase tracking-wide text-muted-2">
                  Ronke Score
                </div>
                <div className="mono text-xs text-muted-3">example wallet</div>
              </div>
              <div className="mono mt-2 text-5xl font-bold text-accent">
                4,235
              </div>
              <div className="mono mt-1 text-sm text-muted-1">
                Rank #69 of 3,481
              </div>

              <div className="mt-6 space-y-4">
                {SAMPLE_BREAKDOWN.map((row) => (
                  <div key={row.label}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="mono">{row.label}</span>
                      <span className="mono text-muted-1">{row.value}</span>
                    </div>
                    <div className="rv-meter">
                      <span
                        style={{
                          width: `${Math.round((row.value / row.max) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rv-card p-6">
              <div className="text-xs uppercase tracking-wide text-muted-2">
                Badges to earn
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {BADGES.map((badge) => (
                  <span
                    key={badge.name}
                    title={badge.tiers}
                    className="rv-hover inline-flex items-center gap-1.5 rounded-full border border-border bg-card-2 px-3 py-1.5 text-sm"
                  >
                    <span aria-hidden>{badge.emoji}</span>
                    {badge.name}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted-2">
                Earned per wallet, from on-chain history alone.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
