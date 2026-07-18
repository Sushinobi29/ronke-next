"use client";

import { useState } from "react";
import { ArrowRight, ArrowUpRight, RotateCw } from "lucide-react";
import ContractChip from "./contract-chip";

const RONKESTR_ADDRESS = "0x404533a09bf281199ce6b0ef60b7eff7123ff8dc";

const STEPS = [
  {
    title: "Trade",
    text: "Every $RONKESTR swap pays a fee into the machine.",
  },
  {
    title: "Buy the floor",
    text: "Pooled fees buy Ronkeverse NFTs off the market.",
  },
  {
    title: "Relist at 1.2x",
    text: "Every NFT the machine owns goes straight back on sale, higher.",
  },
  {
    title: "Burn",
    text: "When one sells, the $RON proceeds buy and burn. Then it starts again.",
  },
];

const FEE_SPLIT = [
  { label: "NFT buy pool", value: "8%" },
  { label: "Treasury", value: "1%" },
  { label: "Buyback and burn", value: "1%" },
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
              The first Ronin Strategy token: a flywheel that turns trading fees
              into NFT bids and burns, with no end state.
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
          {FEE_SPLIT.map((fee) => (
            <div key={fee.label}>
              <div className="text-xs uppercase tracking-wide text-muted-2">
                {fee.label}
              </div>
              <div className="mono mt-1 text-[26px] font-bold">{fee.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href="https://roninstrategy.fun"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-transform active:scale-[0.98]"
            style={{ boxShadow: "0 8px 30px rgba(39,185,252,0.32)" }}
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
