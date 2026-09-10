/**
 * Ronin Stash — email and social login, no extension.
 *
 * Ported from the casino front-end, but only half of what is there. That app
 * carries two social paths: Ronin Waypoint, and Stash. Waypoint is the one
 * that is switched off, and its own comment says why — Sky Mavis deprecated it
 * in June 2026 and Waypoint wallets lose access to their assets after 16
 * September 2026. Onboarding anybody into one now would hand them a wallet
 * that strands their funds within the week. Stash is the successor and the one
 * the casino actually runs on.
 *
 * Stash is Privy underneath, and Privy's cross-app connect hands back a plain
 * EIP-1193 provider. That is the whole reason this fits: the quest board wants
 * an address, and the admin panel wants a signature, and a provider gives both
 * without dragging wagmi in behind it — which is what this app avoided in the
 * first place, React 19 being what it is.
 */

import { RONIN_CHAIN_ID } from "@/lib/quests/contracts";

/**
 * Ronin Stash's own Privy app id, as used by the casino. Overridable, and
 * setting it empty turns social login off without a code change.
 */
export const STASH_APP_ID =
  process.env.NEXT_PUBLIC_STASH_APP_ID ?? "cmpkwmb7l001c0bjp3sdn6n8e";

export const stashEnabled = () => Boolean(STASH_APP_ID);

const RONIN = {
  id: RONIN_CHAIN_ID,
  name: "Ronin",
  nativeCurrency: { name: "RON", symbol: "RON", decimals: 18 },
  rpcUrls: { default: { http: ["https://api.roninchain.com/rpc"] } },
} as const;

export interface Eip1193 {
  request: <T = unknown>(args: { method: string; params?: unknown }) => Promise<T>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

let provider: Eip1193 | null = null;

/** Built once, in the browser, and only if social login is configured. */
export async function stashProvider(): Promise<Eip1193 | null> {
  if (!stashEnabled() || typeof window === "undefined") return null;
  if (provider) return provider;

  const { toPrivyWalletProvider } = await import("@privy-io/cross-app-connect");
  provider = toPrivyWalletProvider({
    providerAppId: STASH_APP_ID,
    chains: [RONIN],
    chainId: RONIN_CHAIN_ID,
  }) as unknown as Eip1193;
  return provider;
}

/** Opens Stash's own window. Returns the address it comes back with. */
export async function connectStash(): Promise<string> {
  const stash = await stashProvider();
  if (!stash) throw new Error("Social login is not configured.");
  const accounts = await stash.request<string[]>({ method: "eth_requestAccounts" });
  const address = accounts?.[0];
  if (!address) throw new Error("Stash did not return an account.");
  return address;
}

/** Whoever is already signed in, without opening anything. */
export async function stashAccount(): Promise<string | null> {
  try {
    const stash = await stashProvider();
    if (!stash) return null;
    const accounts = await stash.request<string[]>({ method: "eth_accounts" });
    return accounts?.[0] ?? null;
  } catch {
    return null;
  }
}
