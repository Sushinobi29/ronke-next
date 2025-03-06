import { loadNFTData } from "@/utils/nft-loader";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const sortBy = searchParams.get("sortBy") || "rarity-desc";
  const search = searchParams.get("search") || "";
  const showCommunity = searchParams.get("showCommunity") === "true";

  try {
    // Get pre-sorted NFTs from the loader
    const allNFTs = await loadNFTData(undefined, undefined, sortBy, showCommunity);

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

    // Filter NFTs based on showCommunity
    const nftsWithStats = filteredNFTs.filter((nft) => {
      const communityTrait = nft.attributes.find(
        (attr: Attribute) => attr.trait_type === "Community 1/1"
      );

      // If showCommunity is true, include community NFTs
      // If showCommunity is false, exclude community NFTs
      return showCommunity ? true : !communityTrait;
    });

    // Handle pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedNFTs = nftsWithStats.slice(startIndex, endIndex);

    return NextResponse.json({
      nfts: paginatedNFTs,
      hasMore: endIndex < nftsWithStats.length,
      total: nftsWithStats.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load NFTs, " + error },
      { status: 500 }
    );
  }
}
