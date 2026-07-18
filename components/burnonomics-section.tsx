"use client";

import { useEffect, useState } from "react";
import { fetchTokenData, formatTokenAmount } from "@/lib/blockchain";

interface TokenBurnData {
  symbol: string;
  name: string;
  totalSupply: number;
  burnedAmount: number;
  burnPercentage: number;
}

// Canonical contract addresses (verified against the ronke-analytics config).
const TOKENS = [
  {
    symbol: "RONKE",
    name: "Ronke Token",
    address: "0xf988F63Bf26c3Ed3fBf39922149E3E7B1e5c27Cb",
  },
  {
    symbol: "RONKESTR",
    name: "NFT Strategy Token",
    address: "0x404533a09bf281199ce6b0ef60b7eff7123ff8dc",
  },
];

const BURN_SOURCES = [
  {
    title: "Casino revenue",
    text: "A share of every Coinflip and Mines wager funds buybacks that go to the dead address.",
  },
  {
    title: "The RONKESTR machine",
    text: "Every NFT the strategy flips at a profit funds a buyback that burns $RONKESTR supply.",
  },
];

function formatCompact(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function BurnCard({ data }: { data: TokenBurnData }) {
  const pct = Math.min(100, Math.max(0, data.burnPercentage));

  return (
    <div className="rv-card rv-hover p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mono text-xl font-bold">${data.symbol}</div>
          <div className="text-sm text-muted-2">{data.name}</div>
        </div>
        <div className="text-right">
          <div className="mono text-4xl font-bold text-burn">
            {pct.toFixed(2)}%
          </div>
          <div className="text-xs uppercase tracking-wide text-muted-2">
            Burned
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
          <span className="mono text-burn">
            Burned: {formatCompact(data.burnedAmount)} {data.symbol}
          </span>
          <span className="mono text-muted-2">
            Total supply: {formatCompact(data.totalSupply)} {data.symbol}
          </span>
        </div>
        <div
          className="rv-meter rv-meter--burn"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${data.symbol} supply burned`}
        >
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-2">
            Circulating
          </div>
          <div className="mono mt-1 text-[22px] font-bold">
            {formatCompact(data.totalSupply - data.burnedAmount)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-2">
            Burned forever
          </div>
          <div className="mono mt-1 text-[22px] font-bold text-burn">
            {formatCompact(data.burnedAmount)}
          </div>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <div className="text-xs uppercase tracking-wide text-muted-2">
            Deflation
          </div>
          <div className="mono mt-1 text-[22px] font-bold text-burn-2">
            {pct.toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
}

function BurnCardSkeleton() {
  return (
    <div className="rv-card animate-pulse p-6 sm:p-8">
      <div className="flex justify-between">
        <div className="space-y-2">
          <div className="h-6 w-28 rounded bg-border-soft" />
          <div className="h-4 w-36 rounded bg-border-soft" />
        </div>
        <div className="h-10 w-24 rounded bg-border-soft" />
      </div>
      <div className="mt-8 h-2.5 rounded-full bg-border-soft" />
      <div className="mt-6 grid grid-cols-3 gap-6">
        <div className="h-12 rounded bg-border-soft" />
        <div className="h-12 rounded bg-border-soft" />
        <div className="h-12 rounded bg-border-soft" />
      </div>
    </div>
  );
}

export default function BurnonomicsSection() {
  const [tokenData, setTokenData] = useState<TokenBurnData[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const results = await Promise.all(
          TOKENS.map(async (token) => {
            const data = await fetchTokenData(token.address);
            const totalSupply = formatTokenAmount(data.totalSupply);
            const burnedAmount = formatTokenAmount(data.burnedAmount);
            return {
              symbol: token.symbol,
              name: token.name,
              totalSupply,
              burnedAmount,
              burnPercentage:
                totalSupply > 0 ? (burnedAmount / totalSupply) * 100 : 0,
            };
          })
        );
        if (!cancelled) setTokenData(results);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Burnonomics, live from the chain.
      </h2>
      <p className="mt-3 max-w-xl text-muted-1">
        Read straight from the Ronin RPC: what sits in the dead address is gone
        for good.
      </p>

      <div className="mt-10 space-y-4">
        {failed ? (
          <div className="rv-card p-8 text-center text-muted-1">
            Burn data temporarily unavailable. The chain is still burning.
          </div>
        ) : tokenData === null ? (
          <>
            <BurnCardSkeleton />
            <BurnCardSkeleton />
            <BurnCardSkeleton />
          </>
        ) : (
          tokenData.map((data) => <BurnCard key={data.symbol} data={data} />)
        )}
      </div>

      <div className="mt-12 grid gap-x-10 gap-y-8 border-t border-border-soft pt-10 md:grid-cols-2">
        {BURN_SOURCES.map((source) => (
          <div key={source.title}>
            <div className="font-semibold text-burn-2">{source.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-1">
              {source.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
