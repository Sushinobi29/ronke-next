import { loadNFTData } from "@/utils/nft-loader";
import { NextRequest, NextResponse } from "next/server";

type Attribute = {
  trait_type: string;
  value: string;
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "40");
  const sortBy = searchParams.get("sortBy") || "rarity-desc";
  const search = searchParams.get("search") || "";
  const showCommunity = searchParams.get("showCommunity") === "true";

  try {
    // Load all NFTs without initial sorting
    const allNFTs = await loadNFTData();

    // Add relevance scoring
    const scoredNFTs = search
      ? allNFTs.map(nft => {
          const cleanName = nft.name.toLowerCase();
          const searchTerm = search.toLowerCase();
          const exactNumberMatch = nft.name.match(/#(\d+)$/);
          const searchNumber = parseInt(search);
          
          let relevanceScore = 0;
          
          // Exact ID match (e.g. #13)
          if (exactNumberMatch && parseInt(exactNumberMatch[1]) === searchNumber) {
            relevanceScore = 100;
          }
          // Name contains exact search term
          else if (cleanName.includes(searchTerm)) {
            relevanceScore = 50;
          }
          
          // Attribute matches
          const attributeMatches = nft.attributes.filter(attr => 
            attr.value.toLowerCase().includes(searchTerm)
          ).length;
          
          // Partial number matches (e.g. 1337 contains 13)
          const idNumber = parseInt(nft.name.split("#")[1]) || 0;
          if (!isNaN(searchNumber) && idNumber.toString().includes(search)) {
            relevanceScore += 10;
          }

          return {
            ...nft,
            relevanceScore: relevanceScore + attributeMatches
          };
        })
      : allNFTs.map(nft => ({...nft, relevanceScore: 0}));

    // Filter NFTs based on showCommunity
    const nftsWithStats = scoredNFTs.filter((nft) => {
      const communityTrait = nft.attributes.find(
        (attr: Attribute) => attr.trait_type === "Community 1/1"
      );
      return showCommunity ? communityTrait : !communityTrait;
    });

    // Sort logic
    let sortedNFTs = [...nftsWithStats];
    if (search && sortBy === "relevance") {
      sortedNFTs = sortedNFTs.sort((a, b) => 
        b.relevanceScore - a.relevanceScore || // First by relevance
        b.stats.rarityScore - a.stats.rarityScore // Then by rarity
      );
    } else {
      switch (sortBy) {
        case "relevance": // Fallback if no search
        case "rarity-desc":
          sortedNFTs.sort((a, b) => b.stats.rarityScore - a.stats.rarityScore);
          break;
        case "rarity-asc":
          sortedNFTs.sort((a, b) => a.stats.rarityScore - b.stats.rarityScore);
          break;
        case "id-asc":
          sortedNFTs.sort((a, b) => 
            parseInt(a.name.split("#")[1]) - parseInt(b.name.split("#")[1])
          );
          break;
        case "id-desc":
          sortedNFTs.sort((a, b) => 
            parseInt(b.name.split("#")[1]) - parseInt(a.name.split("#")[1])
          );
          break;
        default:
          break;
      }
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedNFTs = sortedNFTs.slice(startIndex, endIndex);

    return NextResponse.json({
      nfts: paginatedNFTs,
      hasMore: endIndex < sortedNFTs.length,
      total: sortedNFTs.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load NFTs: " + (error instanceof Error ? error.message : "Unknown error") },
      { status: 500 }
    );
  }
}