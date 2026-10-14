/**
 * Reading back what a transaction actually did.
 *
 * Used when a payout went out through a batch tool rather than one transfer
 * at a time. The panel never saw those sends, so rather than take anyone's
 * word for who got paid, the transaction's own logs are read off the chain
 * and matched against what was owed.
 */

import type { Transfer } from "@/lib/quests/payouts";

const RPC = "https://api.roninchain.com/rpc";
/** keccak256("Transfer(address,address,uint256)") */
const TRANSFER =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export type ReceiptRead =
  | { ok: true; transfers: Transfer[] }
  | { ok: false; reason: string };

/**
 * Every transfer of one token made by one transaction.
 *
 * A transaction that reverted, is not mined yet, or moved a different token
 * returns no transfers rather than an empty success, because "nothing was
 * found" and "nothing happened" must not be answered the same way when the
 * answer marks people paid.
 */
export async function transfersOf(txHash: string, token: string): Promise<ReceiptRead> {
  let body: {
    result?: {
      status?: string;
      logs?: { address?: string; topics?: string[]; data?: string }[];
    } | null;
  };
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [txHash],
      }),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, reason: `The chain answered ${res.status}.` };
    body = await res.json();
  } catch {
    return { ok: false, reason: "Could not reach the chain to check that transaction." };
  }

  const receipt = body.result;
  if (!receipt) {
    return { ok: false, reason: "That transaction is not on chain yet. Wait for it to confirm." };
  }
  if (receipt.status !== "0x1") {
    return { ok: false, reason: "That transaction failed on chain, so it paid nobody." };
  }

  const wanted = token.toLowerCase();
  const transfers: Transfer[] = [];
  for (const log of receipt.logs ?? []) {
    if ((log.address ?? "").toLowerCase() !== wanted) continue;
    const topics = log.topics ?? [];
    // Three topics: the signature, the sender, the recipient. A Transfer with
    // fewer is some other event that happens to share a name.
    if (topics[0] !== TRANSFER || topics.length < 3) continue;
    const to = `0x${topics[2].slice(-40)}`.toLowerCase();
    try {
      transfers.push({ to, value: BigInt(log.data ?? "0x0") });
    } catch {
      // A log we cannot read is a log we do not count.
    }
  }

  return { ok: true, transfers };
}
