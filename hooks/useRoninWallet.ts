"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectorEvent,
  requestRoninWalletConnector,
  type RoninWalletConnector,
} from "@sky-mavis/tanto-connect";

/**
 * Ronin wallet connection, on the same connector kit the casino front-end uses
 * (@sky-mavis/tanto-connect). Connecting is a read-only handshake — the quest
 * board never asks for a signature and never builds a transaction.
 */

export const RONIN_CHAIN_ID = 2020;
export const RONIN_WALLET_URL = "https://wallet.roninchain.com";

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
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchToRonin: () => Promise<void>;
}

export function useRoninWallet(): RoninWallet {
  const connectorRef = useRef<RoninWalletConnector | null>(null);
  const [status, setStatus] = useState<WalletStatus>("loading");
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            setChainId(await connector.getChainId().catch(() => RONIN_CHAIN_ID));
            setStatus("connected");
            return;
          }
        }
        setStatus("disconnected");
      } catch {
        if (live) setStatus("unavailable");
      }
    })();

    return () => {
      live = false;
      connectorRef.current?.removeAllListeners?.();
    };
  }, [getConnector]);

  const connect = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    try {
      const connector = await getConnector();
      const result = await connector.connect(RONIN_CHAIN_ID);
      setAddress(result.account);
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
      await connectorRef.current?.disconnect();
    } finally {
      setAddress(null);
      setStatus("disconnected");
    }
  }, []);

  const switchToRonin = useCallback(async () => {
    try {
      await connectorRef.current?.switchChain(RONIN_CHAIN_ID);
      setChainId(RONIN_CHAIN_ID);
    } catch {
      setError("Switch the wallet to Ronin mainnet to see live quests.");
    }
  }, []);

  return { status, address, chainId, error, connect, disconnect, switchToRonin };
}
