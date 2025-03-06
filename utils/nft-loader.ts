import fs from "fs";
import path from "path";
import { NFTMetadata } from "@/shared/types/Metadata";

export interface NFTWithStats extends NFTMetadata {
  stats: {
    rank: number;
    rarityScore: number;
  };
}


type Attribute = {
  trait_type: string,
  value: string
}

export async function loadNFTData(
  limit?: number,
  page: number = 1,
  sortBy: string = "rarity-desc",
  showCommunity: boolean = false
): Promise<NFTWithStats[]> {
  try {
    const statsPath = path.join(process.cwd(), "nft-statistics.json");
    const statsData = JSON.parse(fs.readFileSync(statsPath, "utf-8"));

    let nftsWithStats = await Promise.all(
      statsData.nftRankings.map(async (ranking: any) => {
        const nftPath = path.join(process.cwd(), "data", `${ranking.id}.json`);
        const nftData: NFTMetadata = JSON.parse(
          fs.readFileSync(nftPath, "utf-8")
        );
        return {
          ...nftData,
          stats: {
            rank: ranking.rank,
            rarityScore: ranking.rarityScore,
          },
        };
      })
    );

    // Filter NFTs based on showCommunity
    nftsWithStats = nftsWithStats.filter((nft) => {
      const communityTrait = nft.attributes.find(
        (attr: Attribute) => attr.trait_type === "Community 1/1"
      );

      // If showCommunity is true, include community NFTs
      // If showCommunity is false, exclude community NFTs
      return showCommunity ? true : !communityTrait;
    });

    // Sort the NFTs
    nftsWithStats = nftsWithStats.sort((a, b) => {
      switch (sortBy) {
        case "rarity-desc":
          return b.stats.rarityScore - a.stats.rarityScore;
        case "rarity-asc":
          return a.stats.rarityScore - b.stats.rarityScore;
        case "id-asc":
          return parseInt(a.name.split("#")[1]) - parseInt(b.name.split("#")[1]);
        case "id-desc":
          return parseInt(b.name.split("#")[1]) - parseInt(a.name.split("#")[1]);
        default:
          return 0;
      }
    });

    // Handle pagination
    if (limit) {
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      return nftsWithStats.slice(startIndex, endIndex);
    }

    return nftsWithStats;
  } catch (error) {
    console.error("Error loading NFT data:", error);
    return [];
  }
}
