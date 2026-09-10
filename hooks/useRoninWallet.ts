"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectorEvent,
  requestRoninWalletConnector,
  type RoninWalletConnector,
} from "@sky-mavis/tanto-connect";
import { RONIN_CHAIN_ID } from "@/lib/quests/contracts";
import { connectStash, stashAccount, stashEnabled, stashProvider } from "@/lib/quests/stash";

/**
 * Ronin wallet connection, two ways in: the browser extension, on the same
 * connector kit the casino front-end uses (@sky-mavis/tanto-connect), and
 * Ronin Stash for anybody who would rather use an email address.
 *
 * Both end in the same place — an address, and a provider that can sign — so
 * everything downstream is unaware of which was used. Connecting is a
 * read-only handshake either way, and nothing here builds a transaction. The
 * one signature the site asks for is on the admin panel, where writing the
 * season's prizes has to be proved rather than claimed.
 */

export { RONIN_CHAIN_ID };
export const RONIN_WALLET_URL = "https://wallet.roninchain.com";

export type WalletVia = "extension" | "stash";

export type WalletStatus =
  | "loading"
  | "unavailable"
  | "disconnected"
  | "connecting"
  | "connected";

export interface RoninWallet {
  status: WalletStatus;
  address: string | null;
  chainId: number | null;
  error: string | null;
  /** How this address got here, once there is one. */
  via: WalletVia | null;
  /** Whether email login is configured at all. */
  socialReady: boolean;
  connect: (via?: WalletVia) => Promise<void>;
  disconnect: () => Promise<void>;
  switchToRonin: () => Promise<void>;
  /** personal_sign. Costs nothing and moves nothing — it only proves a key. */
  sign: (message: string) => Promise<string>;
}

export function useRoninWallet(): RoninWallet {
  const connectorRef = useRef<RoninWalletConnector | null>(null);
  const [status, setStatus] = useState<WalletStatus>("loading");
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [via, setVia] = useState<WalletVia | null>(null);

  /** Resolves the injected connector once, or reports the wallet as missing. */
  const getConnector = useCallback(async () => {
    if (connectorRef.current) return connectorRef.current;
    const connector = await requestRoninWalletConnector();
    connectorRef.current = connector;
    return connector;
  }, []);

  useEffect(() => {
    let live = true;

    (async () => {
      try {
        const connector = await getConnector();
        if (!live) return;

        connector.on(ConnectorEvent.ACCOUNTS_CHANGED, (accounts) => {
          const next = accounts?.[0] ?? null;
          setAddress(next);
          setStatus(next ? "connected" : "disconnected");
        });
        connector.on(ConnectorEvent.CHAIN_CHANGED, (id) => setChainId(Number(id)));
        connector.on(ConnectorEvent.DISCONNECT, () => {
          setAddress(null);
          setStatus("disconnected");
        });

        // Reconnect silently if this browser already authorised the site.
        if (await connector.isAuthorized()) {
          const [account] = await connector.getAccounts();
          if (!live) return;
          if (account) {
            setAddress(account);
            setVia("extension");
            setChainId(await connector.getChainId().catch(() => RONIN_CHAIN_ID));
            setStatus("connected");
            return;
          }
        }
        // No extension session. Somebody may still be signed in with Stash.
        const social = await stashAccount();
        if (!live) return;
        if (social) {
          setAddress(social);
          setVia("stash");
          setChainId(RONIN_CHAIN_ID);
          setStatus("connected");
          return;
        }
        setStatus("disconnected");
      } catch {
        if (!live) return;
        // A missing extension is not a dead end while Stash is an option.
        const social = await stashAccount().catch(() => null);
        if (social) {
          setAddress(social);
          setVia("stash");
          setChainId(RONIN_CHAIN_ID);
          setStatus("connected");
        } else {
          setStatus(stashEnabled() ? "disconnected" : "unavailable");
        }
      }
    })();

    return () => {
      live = false;
      connectorRef.current?.removeAllListeners?.();
    };
  }, [getConnector]);

  const connect = useCallback(async (how: WalletVia = "extension") => {
    setError(null);
    setStatus("connecting");
    try {
      if (how === "stash") {
        const account = await connectStash();
        setAddress(account);
        setVia("stash");
        setChainId(RONIN_CHAIN_ID);
        setStatus("connected");
        return;
      }
      const connector = await getConnector();
      const result = await connector.connect(RONIN_CHAIN_ID);
      setAddress(result.account);
      setVia("extension");
      setChainId(result.chainId);
      setStatus("connected");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      // A rejected prompt is a choice, not a failure — say nothing about it.
      setError(/reject|denied|cancel/i.test(message) ? null : message);
      setStatus(connectorRef.current ? "disconnected" : "unavailable");
    }
  }, [getConnector]);

  const disconnect = useCallback(async () => {
    try {
      if (via === "stash") {
        const stash = await stashProvider();
        await stash?.request({ method: "wallet_disconnect" }).catch(() => {});
      } else {
        await connectorRef.current?.disconnect();
      }
    } finally {
      setAddress(null);
      setVia(null);
      setStatus("disconnected");
    }
  }, [via]);

  const switchToRonin = useCallback(async () => {
    try {
      await connectorRef.current?.switchChain(RONIN_CHAIN_ID);
      setChainId(RONIN_CHAIN_ID);
    } catch {
      setError("Switch the wallet to Ronin mainnet to see live quests.");
    }
  }, []);

  const sign = useCallback(
    async (message: string) => {
      if (!address) throw new Error("Connect a wallet first.");
      const hex = Array.from(new TextEncoder().encode(message))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      const params = [`0x${hex}`, address];

      if (via === "stash") {
        const stash = await stashProvider();
        if (!stash) throw new Error("Social login is not configured.");
        return stash.request<string>({ method: "personal_sign", params });
      }

      const connector = await getConnector();
      const provider = await connector.requestProvider();
      return provider.request<string>({ method: "personal_sign", params });
    },
    [getConnector, address, via]
  );

  return {
    status,
    address,
    chainId,
    error,
    via,
    socialReady: stashEnabled(),
    connect,
    disconnect,
    switchToRonin,
    sign,
  };
}
