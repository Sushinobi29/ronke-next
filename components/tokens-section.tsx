"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import ContractChip from "./contract-chip";

// Canonical contract addresses (verified against the ronke-analytics config).
const TOKENS = [
  {
    symbol: "RONKE",
    name: "Ronke Token",
    blurb: "The native token of the Blue Monke economy.",
    address: "0xf988F63Bf26c3Ed3fBf39922149E3E7B1e5c27Cb",
    pool: "0x75ae353997242927c701d4d6c2722ebef43fd2d3",
    icon: "/ronke-logo.webp",
  },
  {
    symbol: "RONKESTR",
    name: "NFT Strategy Token",
    blurb: "Trading fees buy floor NFTs, flips burn the supply.",
    address: "0x404533a09bf281199ce6b0ef60b7eff7123ff8dc",
    pool: "0x87b0acb34aa54cb51451050be73e9e31921154c2",
    icon: "/ronkeverse.png",
  },
] as const;

const NFT_MARKET_URL =
  "https://marketplace.roninchain.com/collections/ronkeverse";

const swapUrl = (address: string) =>
  `https://app.roninchain.com/swap?outputCurrency=${address}&inputCurrency=RON`;

export default function TokensSection() {
  const [selected, setSelected] = useState(0);
  const token = TOKENS[selected];

  return (
    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Two tokens, one collection.
      </h2>
      <p className="mt-3 max-w-lg text-muted-1">
        Everything trades on Ronin. Pick a token to see its live chart.
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-[2fr_3fr]">
        <div className="flex flex-col gap-3">
          {TOKENS.map((t, i) => (
            <div
              key={t.symbol}
              onClick={() => setSelected(i)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(i);
                }
              }}
              className={`rv-hover cursor-pointer rounded-2xl border p-5 text-left transition-colors ${
                selected === i
                  ? "border-accent/60 bg-card"
                  : "border-border bg-card-2"
              }`}
              aria-pressed={selected === i}
            >
              <div className="flex items-center gap-4">
                <Image
                  src={t.icon}
                  alt=""
                  width={44}
                  height={44}
                  className="rounded-full"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="mono font-bold">${t.symbol}</span>
                    <span className="truncate text-xs text-muted-2">
                      {t.name}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-1">{t.blurb}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <ContractChip address={t.address} />
                <a
                  href={swapUrl(t.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-soft"
                >
                  Buy <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
                </a>
              </div>
            </div>
          ))}

          <a
            href={NFT_MARKET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rv-hover flex items-center gap-4 rounded-2xl border border-border bg-card-2 p-5"
          >
            <Image
              src="/images/5309.png"
              alt="The base Ronke, Ronkeverse number 5309"
              width={44}
              height={44}
              className="rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-bold">Ronkeverse NFTs</span>
                <span className="mono text-xs text-muted-2">6,969 supply</span>
              </div>
              <p className="mt-1 text-sm text-muted-1">
                Hand-drawn monkes on Ronin Market.
              </p>
            </div>
            <ArrowUpRight
              className="h-5 w-5 shrink-0 text-muted-2"
              strokeWidth={2}
            />
          </a>
        </div>

        <div className="rv-card overflow-hidden">
          <iframe
            key={token.pool}
            src={`https://www.geckoterminal.com/ronin/pools/${token.pool}?embed=1&info=0&swaps=0&trades=0`}
            title={`${token.symbol} live chart`}
            className="h-[420px] w-full lg:h-full lg:min-h-[520px]"
            allow="clipboard-write"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}
