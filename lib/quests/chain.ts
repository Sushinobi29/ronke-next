/**
 * Minimal Ronin read layer for the quest board.
 *
 * Deliberately dependency-free: every call the board makes is either a plain
 * view function with one word of arguments, or a Multicall3 batch of them, so
 * hand-rolled ABI coding costs less than pulling in a full client. Selectors
 * live in contracts.ts, precomputed, so there is no keccak at runtime.
 *
 * Server-only — the public Ronin RPC is called without a key, and the results
 * are cached by the route handlers rather than fetched from the browser.
 */

import { MULTICALL3, RONIN_RPC, SELECTORS } from "./contracts";

type Call = { target: string; data: string };

const WORD = 64;

/* ---------------------------------------------------------------- encoding */

export function padAddress(address: string): string {
  return address.toLowerCase().replace(/^0x/, "").padStart(WORD, "0");
}

export function padUint(value: number | bigint): string {
  return value.toString(16).padStart(WORD, "0");
}

export function callData(selector: string, ...args: string[]): string {
  return selector + args.join("");
}

/* ---------------------------------------------------------------- decoding */

/** Splits ABI-encoded return data into 32-byte words. */
export function words(hex: string): string[] {
  const body = hex.replace(/^0x/, "");
  const out: string[] = [];
  for (let i = 0; i + WORD <= body.length; i += WORD) out.push(body.slice(i, i + WORD));
  return out;
}

export function toBigInt(word: string | undefined): bigint {
  if (!word) return BigInt(0);
  return BigInt("0x" + word);
}

export function toNumber(word: string | undefined): number {
  return Number(toBigInt(word));
}

export function toAddress(word: string | undefined): string {
  if (!word) return "0x0000000000000000000000000000000000000000";
  return "0x" + word.slice(24);
}

/** 18-decimal fixed point to a float. Fine for display; never for accounting. */
export function fromWei(value: bigint, decimals = 18): number {
  return Number(value) / 10 ** decimals;
}

/* -------------------------------------------------------------------- rpc */

async function rpc<T>(method: string, params: unknown[], signal?: AbortSignal): Promise<T> {
  const res = await fetch(RONIN_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(`Ronin RPC ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Ronin RPC: ${json.error.message}`);
  return json.result as T;
}

/** `block` accepts "latest" or a hex block number — historical reads are how
 *  season deltas are taken, so it is a first-class argument here. */
export function ethCall(target: string, data: string, block = "latest"): Promise<string> {
  return rpc<string>("eth_call", [{ to: target, data }, block]);
}

export async function blockTimestamp(block: string): Promise<number> {
  const header = await rpc<{ timestamp: string } | null>("eth_getBlockByNumber", [block, false]);
  return header ? Number(toBigInt(header.timestamp.replace(/^0x/, ""))) : 0;
}

/**
 * Finds the block closest to a wall-clock time. Ronin blocks are ~3s and very
 * regular, so an estimate plus a few corrections lands within a handful of
 * blocks — far cheaper than a full binary search, and close enough for a
 * season boundary.
 */
export async function blockAtTimestamp(target: number): Promise<number> {
  const head = Number(toBigInt((await blockNumber()).replace(/^0x/, "")));
  const headTime = await blockTimestamp("latest");
  if (target >= headTime) return head;

  let guess = Math.max(1, head - Math.floor((headTime - target) / 3));
  for (let i = 0; i < 4; i++) {
    const at = await blockTimestamp("0x" + guess.toString(16));
    if (!at) break;
    const drift = target - at;
    if (Math.abs(drift) <= 60) break;
    guess = Math.min(head, Math.max(1, guess + Math.round(drift / 3)));
  }
  return guess;
}

export function blockNumber(): Promise<string> {
  return rpc<string>("eth_blockNumber", []);
}

export function getBalance(address: string): Promise<string> {
  return rpc<string>("eth_getBalance", [address, "latest"]);
}

/* -------------------------------------------------------------- multicall */

/**
 * Encodes `aggregate3((address,bool,bytes)[])`. Every call is marked
 * allowFailure so one reverting view can't take the whole board down — a
 * failed entry comes back as `null` rather than throwing.
 */
function encodeAggregate3(calls: Call[]): string {
  const head = padUint(32);
  const length = padUint(calls.length);

  const tuples = calls.map((call) => {
    const body = call.data.replace(/^0x/, "");
    const byteLength = body.length / 2;
    const padded = body.padEnd(Math.ceil(byteLength / 32) * WORD, "0");
    return padAddress(call.target) + padUint(1) + padUint(96) + padUint(byteLength) + padded;
  });

  // Offsets are relative to the start of the array's element region (after length).
  let cursor = calls.length * 32;
  const offsets = tuples.map((tuple) => {
    const offset = padUint(cursor);
    cursor += tuple.length / 2;
    return offset;
  });

  return SELECTORS.aggregate3 + head + length + offsets.join("") + tuples.join("");
}

/** Decodes `(bool success, bytes returnData)[]` into hex strings or null. */
function decodeAggregate3(result: string): (string | null)[] {
  const body = result.replace(/^0x/, "");
  const at = (index: number) => body.slice(index * WORD, (index + 1) * WORD);

  const arrayStart = Number(toBigInt(at(0))) / 32;
  const count = Number(toBigInt(at(arrayStart)));
  const base = arrayStart + 1;

  const out: (string | null)[] = [];
  for (let i = 0; i < count; i++) {
    const offset = Number(toBigInt(at(base + i))) / 32;
    const tuple = base + offset;
    const success = toBigInt(at(tuple)) === BigInt(1);
    const dataLength = Number(toBigInt(at(tuple + 2)));
    if (!success || dataLength === 0) {
      out.push(null);
      continue;
    }
    const start = (tuple + 3) * WORD;
    out.push("0x" + body.slice(start, start + dataLength * 2));
  }
  return out;
}

/**
 * Batches view calls into a single eth_call. Ronin's public node handles a few
 * hundred comfortably; larger sets are split so one oversized request can't
 * fail the whole board.
 */
export async function multicall(
  calls: Call[],
  chunkSize = 200,
  block = "latest"
): Promise<(string | null)[]> {
  if (calls.length === 0) return [];

  const chunks: Call[][] = [];
  for (let i = 0; i < calls.length; i += chunkSize) chunks.push(calls.slice(i, i + chunkSize));

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        return decodeAggregate3(await ethCall(MULTICALL3, encodeAggregate3(chunk), block));
      } catch {
        return chunk.map(() => null);
      }
    })
  );

  return results.flat();
}
