"use client";

import Image from "next/image";
import { ArrowUpRight, Eye, Loader2, LogOut, Wallet } from "lucide-react";
import { RONIN_CHAIN_ID, RONIN_WALLET_URL, type RoninWallet } from "@/hooks/useRoninWallet";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * The connect control. Read-only by design: connecting hands over an address
 * and nothing else, which is worth saying on the button itself — in this
 * ecosystem people are right to be wary of a wallet prompt.
 */
export default function WalletConnect({
  wallet,
  viewing,
  onViewSelf,
}: {
  wallet: RoninWallet;
  viewing: string | null;
  onViewSelf: () => void;
}) {
  const { status, address, chainId, error, connect, disconnect, switchToRonin } = wallet;
  const viewingOther =
    !!viewing && !!address && viewing.toLowerCase() !== address.toLowerCase();
  const wrongChain = status === "connected" && chainId !== null && chainId !== RONIN_CHAIN_ID;

  return (
    <div className="rv-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border bg-card-2">
            <Image src="/ronke-logo.webp" alt="" fill sizes="40px" className="object-cover" />
          </span>

          <div className="min-w-0">
            {status === "connected" ? (
              <>
                <div className="mono text-[10px] uppercase tracking-[0.14em] text-muted-3">
                  {viewingOther ? "Your wallet" : "Connected"}
                </div>
                <div className="mono truncate text-sm text-foreground">{short(address!)}</div>
              </>
            ) : status === "unavailable" ? (
              <>
                <div className="text-sm font-semibold">Ronin Wallet not detected</div>
                <p className="text-[13px] text-muted-2">
                  Install the extension, or open this page in the Ronin app browser.
                </p>
              </>
            ) : (
              <>
                <div className="text-sm font-semibold">Connect your Ronin wallet</div>
                <p className="text-[13px] text-muted-2">
                  Read-only — no signature, no transaction, no gas.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {viewingOther && (
            <button
              onClick={onViewSelf}
              className="inline-flex items-center gap-2 rounded-xl border border-border-strong px-4 py-2.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
            >
              <Eye className="h-3.5 w-3.5" />
              Back to mine
            </button>
          )}

          {status === "connected" ? (
            <button
              onClick={disconnect}
              className="inline-flex items-center gap-2 rounded-xl border border-border-strong px-4 py-2.5 text-sm font-medium text-muted-1 transition-colors hover:border-burn/50 hover:text-burn"
            >
              <LogOut className="h-3.5 w-3.5" />
              Disconnect
            </button>
          ) : status === "unavailable" ? (
            <a
              href={RONIN_WALLET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-[#06121a] transition-opacity hover:opacity-90"
            >
              Get Ronin Wallet
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </a>
          ) : (
            <button
              onClick={connect}
              disabled={status === "connecting" || status === "loading"}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-[#06121a] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {status === "connecting" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wallet className="h-4 w-4" />
              )}
              {status === "connecting" ? "Check your wallet" : "Connect wallet"}
            </button>
          )}
        </div>
      </div>

      {wrongChain && (
        <button
          onClick={switchToRonin}
          className="mono mt-3 text-[12px] text-paper underline-offset-4 hover:underline"
        >
          Wrong network — switch to Ronin mainnet
        </button>
      )}

      {error && <p className="mono mt-3 text-[12px] text-burn">{error}</p>}
    </div>
  );
}
