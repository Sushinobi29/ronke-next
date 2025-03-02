import { loadNFTData } from "@/utils/nft-loader";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const sortBy = searchParams.get("sortBy") || "rarity-desc";
  const search = searchParams.get("search") || "";

  try {
    const allNFTs = await loadNFTData();

    // Filter NFTs by search query
    const filteredNFTs = search
      ? allNFTs.filter(
          (nft) =>
            nft.name.toLowerCase().includes(search.toLowerCase()) ||
            nft.attributes.some((attr) =>
              attr.value.toLowerCase().includes(search.toLowerCase())
            )
        )
      : allNFTs;

    // Sort filtered NFTs
    const sortedNFTs = [...filteredNFTs].sort((a, b) => {
      switch (sortBy) {
        case "rarity-desc":
          return b.stats.rarityScore - a.stats.rarityScore;
        case "rarity-asc":
          return a.stats.rarityScore - b.stats.rarityScore;
        case "id-asc":
          return (
            parseInt(a.name.split("#")[1]) - parseInt(b.name.split("#")[1])
          );
        case "id-desc":
          return (
            parseInt(b.name.split("#")[1]) - parseInt(a.name.split("#")[1])
          );
        default:
          return 0;
      }
    });

    // Handle pagination
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
      { error: "Failed to load NFTs, " + error },
      { status: 500 }
    );
  }
}
