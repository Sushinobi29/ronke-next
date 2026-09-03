/**
 * Who may write the season's rewards.
 *
 * The gate is a signature, not a connected address. An address in a request
 * body is a claim anyone can type; a signature over the exact payout being
 * written is proof, and it is proof of the one thing that matters — that the
 * holder of the admin wallet saw these numbers and agreed to them.
 *
 * There is no session and no nonce table. The signed message carries its own
 * timestamp and the full config, so a stale signature expires on its own and a
 * replayed one can only rewrite the same numbers it already authorised.
 */

import { recoverMessageAddress } from "viem";
import { ethCall } from "@/lib/quests/chain";
import { adminMessage, type RewardsConfig } from "@/lib/quests/rewards";

/** Comma-separated, so a second wallet can be added without a code change. */
export const ADMIN_WALLETS: string[] = (process.env.QUEST_ADMIN_WALLETS ?? "")
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter((entry) => /^0x[0-9a-f]{40}$/.test(entry));

export const hasAdmins = () => ADMIN_WALLETS.length > 0;

export const isAdmin = (address: string | null | undefined): boolean =>
  Boolean(address) && ADMIN_WALLETS.includes(address!.trim().toLowerCase());

/** How long a signature stays good for. Long enough to read the prompt. */
export const MAX_AGE_SECONDS = 300;

const ERC1271_MAGIC = "0x1626ba7e";
/** isValidSignature(bytes32,bytes) */
const IS_VALID_SIGNATURE = "0x1626ba7e";

export type AdminCheck = { ok: true } | { ok: false; reason: string; status: number };

/**
 * The gate itself, over any signed line. Callers build the message from what
 * they are about to write — never from what arrived in the body — so a
 * signature only ever authorises the numbers or words actually being stored.
 */
export async function verifyAdminMessage(params: {
  address: string;
  signature: string;
  issuedAt: string;
  message: string;
}): Promise<AdminCheck> {
  const { address, signature, issuedAt, message } = params;

  if (!hasAdmins()) {
    return {
      ok: false,
      status: 503,
      reason: "No admin wallet is configured for this deployment.",
    };
  }
  if (!isAdmin(address)) {
    return { ok: false, status: 403, reason: "That wallet cannot write rewards." };
  }
  if (!/^0x[0-9a-fA-F]+$/.test(signature) || signature.length < 132) {
    return { ok: false, status: 400, reason: "That is not a signature." };
  }

  const issued = Date.parse(issuedAt);
  if (!Number.isFinite(issued)) {
    return { ok: false, status: 400, reason: "The request is not dated." };
  }
  if (Math.abs(Date.now() - issued) > MAX_AGE_SECONDS * 1000) {
    return { ok: false, status: 400, reason: "That signature has expired. Sign again." };
  }

  try {
    const signer = await recoverMessageAddress({ message, signature: signature as `0x${string}` });
    if (signer.toLowerCase() === address.trim().toLowerCase()) return { ok: true };
  } catch {
    // Falls through to the contract-wallet check below.
  }

  if (await validForContract(address, message, signature)) return { ok: true };

  return { ok: false, status: 403, reason: "That signature does not match the wallet." };
}

/** Season rewards. The message is the payout, in words. */
export function verifyAdminWrite(params: {
  address: string;
  signature: string;
  issuedAt: string;
  season: number;
  config: RewardsConfig;
}): Promise<AdminCheck> {
  const { address, signature, issuedAt, season, config } = params;
  return verifyAdminMessage({
    address,
    signature,
    issuedAt,
    message: adminMessage(config, season, address, issuedAt),
  });
}

/**
 * Contract wallets cannot be recovered from — they answer for themselves.
 * A Ronin browser wallet is a plain key and never reaches this, but a smart
 * account would be locked out of its own panel without it.
 */
async function validForContract(
  address: string,
  message: string,
  signature: string
): Promise<boolean> {
  try {
    const { hashMessage } = await import("viem");
    const digest = hashMessage(message).slice(2);
    const sig = signature.slice(2);
    const bytes = sig.length / 2;

    const data =
      IS_VALID_SIGNATURE +
      digest +
      // offset to the bytes argument, then its length and body
      (64).toString(16).padStart(64, "0") +
      bytes.toString(16).padStart(64, "0") +
      sig.padEnd(Math.ceil(bytes / 32) * 64, "0");

    const result = await ethCall(address, data);
    return result.slice(0, 10).toLowerCase() === ERC1271_MAGIC;
  } catch {
    return false;
  }
}
