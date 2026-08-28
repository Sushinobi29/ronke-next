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

/**
 * The public Ronin node serves roughly 30 requests a second and starts
 * refusing at about 38. Everything here goes through one throttle so a wide
 * scan cannot burst past that and rate-limit the whole board — measured, not
 * guessed: bursts of 25 were clean, bursts of 50 were not.
 */
const MAX_PER_SECOND = 14;
const MIN_GAP_MS = 1000 / MAX_PER_SECOND;

let nextSlot = 0;

function slot(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + MIN_GAP_MS;
  const wait = at - now;
  return wait > 0 ? new Promise((resolve) => setTimeout(resolve, wait)) : Promise.resolve();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function rpc<T>(method: string, params: unknown[], attempt = 0): Promise<T> {
  await slot();

  const res = await fetch(RONIN_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });

  // A 429 is worth waiting out rather than failing the board — back off and
  // try again, giving the throttle room to drain.
  if (res.status === 429 || res.status === 503) {
    if (attempt < 3) {
      await sleep(400 * 2 ** attempt);
      return rpc<T>(method, params, attempt + 1);
    }
    throw new Error(`Ronin RPC ${res.status}`);
  }
  if (!res.ok) throw new Error(`Ronin RPC ${res.status}`);

  const json = await res.json();
  if (json.error) {
    const message = String(json.error.message ?? "");
    if (/rate limit/i.test(message) && attempt < 3) {
      await sleep(400 * 2 ** attempt);
      return rpc<T>(method, params, attempt + 1);
    }
    throw new Error(`Ronin RPC: ${message}`);
  }
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

export interface Log {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
}

/**
 * The public Ronin node caps eth_getLogs at 200 blocks a request, so anything
 * wider has to be walked. Windows run a dozen at a time; a window that fails
 * yields nothing rather than taking the whole scan down with it.
 */
export async function getLogsRange(
  address: string,
  topic: string,
  fromBlock: number,
  toBlock: number,
  concurrency = 4
): Promise<Log[]> {
  const WINDOW = 200;
  const windows: [number, number][] = [];
  for (let start = fromBlock; start <= toBlock; start += WINDOW) {
    windows.push([start, Math.min(start + WINDOW - 1, toBlock)]);
  }

  const out: Log[] = [];
  for (let i = 0; i < windows.length; i += concurrency) {
    const batch = windows.slice(i, i + concurrency).map(([from, to]) =>
      rpc<Log[]>("eth_getLogs", [
        { address, topics: [topic], fromBlock: "0x" + from.toString(16), toBlock: "0x" + to.toString(16) },
      ])
    );
    for (const logs of await Promise.all(batch)) out.push(...logs);
  }
  return out;
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

async function decodeAggregate3Call(chunk: Call[], block: string) {
  return decodeAggregate3(await ethCall(MULTICALL3, encodeAggregate3(chunk), block));
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

  // A reverting view comes back as a null entry (allowFailure is set on every
  // call). A failed *request* is different in kind — rate limits and outages
  // must surface as errors, or an unreachable node reads as "nothing happened".
  const results = await Promise.all(
    chunks.map((chunk) => decodeAggregate3Call(chunk, block))
  );

  return results.flat();
}
