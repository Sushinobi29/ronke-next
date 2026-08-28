/**
 * Mavis Marketplace reads.
 *
 * Separate from the Ronin RPC on purpose: this is a different service with its
 * own budget, so pricing NFT purchases here costs nothing against the node
 * quota the rest of the board is squeezed by.
 *
 * It answers the two things the chain makes expensive — what a collection's
 * floor is, and what a given wallet actually paid — in one request each. The
 * on-chain alternative was scanning collection transfers and then fetching a
 * transaction per sale to read its value.
 */

import { COLLECTIONS } from "./contracts";

const ENDPOINT = "https://api-gateway.skymavis.com/graphql/mavis-marketplace";

/**
 * The key is currently only published as NEXT_PUBLIC_, which ships it to the
 * browser. Prefer a server-only RONIN_API_KEY when one exists; this reads
 * either so the variable can be renamed without breaking the board.
 */
const apiKey = () => process.env.RONIN_API_KEY ?? process.env.NEXT_PUBLIC_RONIN_API_KEY ?? "";

async function graphql<T>(query: string): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey() },
    body: JSON.stringify({ query }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Marketplace ${res.status}`);

  const json = await res.json();
  if (json.errors?.length) throw new Error(`Marketplace: ${json.errors[0].message}`);
  return json.data as T;
}

const toRon = (wei: string | null | undefined) => (wei ? Number(BigInt(wei)) / 1e18 : 0);

/** Cheapest listing in the collection, in RON. */
export async function fetchFloorRon(collection = COLLECTIONS.ronkeverse): Promise<number> {
  const data = await graphql<{
    erc721Tokens: { results: { minPrice: string | null }[] };
  }>(
    `{ erc721Tokens(tokenAddress: "${collection}", from: 0, size: 1, sort: PriceAsc) {
        results { minPrice }
      } }`
  );
  return toRon(data.erc721Tokens?.results?.[0]?.minPrice);
}

export interface Sale {
  buyer: string;
  ron: number;
  tokenId: string;
  at: number;
}

/**
 * Sales of one collection, newest first. The feed caps at 40 a page, which is
 * several days of Ronkeverse volume — so one request covers a day with room
 * to spare, and paging stops as soon as it runs past the window.
 */
export async function fetchSales(
  since: number,
  collection = COLLECTIONS.ronkeverse,
  maxPages = 3
): Promise<Sale[]> {
  const sales: Sale[] = [];

  for (let page = 0; page < maxPages; page++) {
    const data = await graphql<{
      recentlySolds: {
        results: {
          matcher: string;
          realPrice: string;
          timestamp: number;
          assets: { id: string }[];
        }[];
      };
    }>(
      `{ recentlySolds(from: ${page * 40}, size: 40, tokenAddress: "${collection}") {
          results { matcher realPrice timestamp assets { id } }
        } }`
    );

    const results = data.recentlySolds?.results ?? [];
    for (const sale of results) {
      if (sale.timestamp < since) return sales;
      sales.push({
        buyer: sale.matcher.toLowerCase(),
        ron: toRon(sale.realPrice),
        tokenId: sale.assets?.[0]?.id ?? "",
        at: sale.timestamp,
      });
    }
    if (results.length < 40) break;
  }

  return sales;
}
