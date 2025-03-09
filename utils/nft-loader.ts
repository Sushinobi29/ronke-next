import fs from "fs";
import path from "path";
import { NFTMetadata } from "@/shared/types/Metadata";

type Attribute = {
  trait_type: string;
  value: string;
};

export interface NFTWithStats extends NFTMetadata {
  stats: {
    rank: number;
    rarityScore: number;
  };
  relevanceScore?: number;
  priceInfo?: {
    minPrice: string;
    order?: {
      basePrice: string;
      currentPrice: string;
    };
    highestOffer?: {
      currentPrice: string;
      basePrice: string;
      suggestedPrice: string;
    };
  };
}

type LoadOptions = {
  limit?: number;
  page?: number;
  sortBy?: string;
  showCommunity?: boolean;
  search?: string;
};

const MAX_LIMIT = 100;
const CACHE = new Map<string, any>();
const CACHE_TTL = 320000; // 320 seconds

function getCacheKey(options: LoadOptions) {
  return JSON.stringify({
    ...options,
    timestamp: Math.floor(Date.now() / CACHE_TTL) // New cache key every 320s
  });
}

export async function loadNFTData(options: LoadOptions = {}): Promise<{
  nfts: NFTWithStats[];
  total: number;
  hasMore: boolean;
}> {

  const cacheKey = getCacheKey(options);
  
  if (CACHE.has(cacheKey)) {
    return CACHE.get(cacheKey);
  }

  options.limit = Math.min(options.limit || 40, MAX_LIMIT);

  
  try {
    const statsPath = path.join(process.cwd(), "nft-statistics.json");
    const statsData = JSON.parse(fs.readFileSync(statsPath, "utf-8"));

    // Load base data
    let nfts = await Promise.all(
      statsData.nftRankings.map(async (ranking: any) => {
        const nftPath = path.join(process.cwd(), "data", `${ranking.id}.json`);
        const nftData: NFTMetadata = JSON.parse(fs.readFileSync(nftPath, "utf-8"));
        return {
          ...nftData,
          stats: {
            rank: ranking.rank,
            rarityScore: ranking.rarityScore,
          },
        };
      })
    );

    // Apply community filter
    nfts = nfts.filter(nft => {
      const hasCommunity = nft.attributes.some(
        (attr:Attribute) => attr.trait_type === "Community 1/1"
      );
      return options.showCommunity ? hasCommunity : !hasCommunity;
    });

    // Calculate relevance scores if searching
    if (options.search) {
      const searchTerm = options.search.toLowerCase();
      nfts = nfts.map(nft => {
        let relevance = 0;
        const cleanName = nft.name.toLowerCase();
        
        // Exact ID match
        const idMatch = nft.name.match(/#(\d+)$/);
        if (idMatch && idMatch[1] === options.search) relevance += 100;
        
        // Name contains search term
        if (cleanName.includes(searchTerm)) relevance += 50;
        
        // Attribute matches
        relevance += nft.attributes.filter((attr:Attribute) => 
          attr.value.toLowerCase().includes(searchTerm)
        ).length;

        return { ...nft, relevanceScore: relevance };
      }).filter(nft => nft.relevanceScore > 0);
    }

    // Sorting
    nfts.sort((a, b) => {
      if (options.search && options.sortBy === "relevance") {
        return (b.relevanceScore || 0) - (a.relevanceScore || 0) || 
               b.stats.rarityScore - a.stats.rarityScore;
      }
      
      switch (options.sortBy) {
        case "rarity-desc": return b.stats.rarityScore - a.stats.rarityScore;
        case "rarity-asc": return a.stats.rarityScore - b.stats.rarityScore;
        case "id-asc": return parseInt(a.name.split("#")[1]) - parseInt(b.name.split("#")[1]);
        case "id-desc": return parseInt(b.name.split("#")[1]) - parseInt(a.name.split("#")[1]);
        default: return 0;
      }
    });

    // Pagination
    const total = nfts.length;
    const startIndex = ((options.page || 1) - 1) * (options.limit || 40);
    const endIndex = startIndex + (options.limit || 40);
    
    const result = {
      nfts: nfts.slice(startIndex, endIndex),
      total,
      hasMore: endIndex < total
    };

    CACHE.set(cacheKey, result);
    return result;

  } catch (error) {
    console.error("Error loading NFT data:", error);
    return { nfts: [], total: 0, hasMore: false };
  }
}