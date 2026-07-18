"use client";

import { useState } from "react";
import { ArrowRight, ArrowUpRight, RotateCw } from "lucide-react";
import ContractChip from "./contract-chip";

const RONKESTR_ADDRESS = "0x404533a09bf281199ce6b0ef60b7eff7123ff8dc";

const STEPS = [
  {
    title: "Trade",
    text: "Every $RONKESTR swap pays a flat 10% fee into the machine.",
  },
  {
    title: "Buy the floor",
    text: "Collected fees automatically buy Ronkeverse NFTs off the floor.",
  },
  {
    title: "Sell for profit",
    text: "The machine lists its NFTs and flips them at a profit, on its own.",
  },
  {
    title: "Buy and burn",
    text: "Profits buy back $RONKESTR and burn it. Supply shrinks, loop restarts.",
  },
];

// Of the flat 10% trading fee:
const FACTS = [
  { label: "NFT buy pool", value: "8%", sub: "buys Ronkeverse NFTs" },
  { label: "$RONKE buyback", value: "1%", sub: "bought and burned" },
  { label: "Dev fees", value: "1%", sub: "to the platform devs" },
];

export default function RoninStrategySection() {
  const [showVideo, setShowVideo] = useState(false);

  return (
    <div className="border-y border-border bg-card-2">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              <span className="mono text-accent">$RONKESTR</span>, the perpetual
              machine.
            </h2>
            <p className="mt-3 max-w-xl text-muted-1">
              The Ronkeverse implementation of Ronin Strategy: a machine that
              buys and lists floor Ronkeverse NFTs for profit off $RONKESTR
              trading fees, then burns $RONKESTR with the proceeds.
            </p>
          </div>
          <ContractChip address={RONKESTR_ADDRESS} />
        </div>

        {!showVideo ? (
          <div className="mt-12 grid gap-3 md:grid-cols-4">
            {STEPS.map((step, i) => (
              <div key={step.title} className="relative">
                <div className="rv-card rv-hover h-full p-6">
                  <div className="font-semibold">{step.title}</div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-1">
                    {step.text}
                  </p>
                </div>
                <div
                  aria-hidden
                  className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-muted-3 md:block"
                >
                  {i < STEPS.length - 1 ? (
                    <ArrowRight className="h-5 w-5" strokeWidth={2} />
                  ) : (
                    <RotateCw className="h-5 w-5 text-burn-2" strokeWidth={2} />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rv-card mt-12 overflow-hidden">
            <video
              src="/roninstrategy-explainer.mp4"
              controls
              playsInline
              className="w-full"
            />
          </div>
        )}

        <div className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-3 sm:border-t sm:border-border-soft sm:pt-8">
          {FACTS.map((fact) => (
            <div key={fact.label}>
              <div className="text-xs uppercase tracking-wide text-muted-2">
                {fact.label}
              </div>
              <div className="mono mt-1 text-[26px] font-bold">
                {fact.value}
              </div>
              <div className="text-sm text-muted-1">{fact.sub}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href={`https://app.roninchain.com/swap?outputCurrency=${RONKESTR_ADDRESS}&inputCurrency=RON`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-transform active:scale-[0.98]"
            style={{ boxShadow: "0 8px 30px rgba(39,185,252,0.32)" }}
          >
            Buy $RONKESTR
          </a>
          <a
            href="https://roninstrategy.fun"
            target="_blank"
            rel="noopener noreferrer"
            className="rv-hover inline-flex items-center gap-1.5 rounded-2xl border border-border bg-card px-6 py-3 text-sm font-semibold"
          >
            Open Ronin Strategy
            <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
          </a>
          <button
            onClick={() => setShowVideo((v) => !v)}
            className="rv-hover rounded-2xl border border-border bg-card px-6 py-3 text-sm font-semibold"
          >
            {showVideo ? "Back to the diagram" : "Ronke no read, watch instead"}
          </button>
        </div>
      </div>
    </div>
  );
}
