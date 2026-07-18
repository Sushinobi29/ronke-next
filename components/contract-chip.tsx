"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function ContractChip({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <button
      onClick={copy}
      title={address}
      className="rv-hover mono inline-flex items-center gap-2 rounded-full border border-border bg-card-2 px-3 py-1.5 text-xs text-muted-1 hover:text-foreground"
      aria-label={`Copy contract address ${address}`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-diamond" strokeWidth={2} />
          <span className="text-diamond">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" strokeWidth={2} />
          {truncateAddress(address)}
        </>
      )}
    </button>
  );
}
