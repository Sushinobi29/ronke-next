import { loadNFTData } from "@/utils/nft-loader";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const options = {
    page: Number(searchParams.get("page") || 1),
    limit: Number(searchParams.get("limit") || 80),
    sortBy: searchParams.get("sortBy") || "rarity-desc",
    search: searchParams.get("search") || "",
    showCommunity: searchParams.get("showCommunity") === "true",
  };

  try {
    const { nfts, total, hasMore } = await loadNFTData(options);

    return NextResponse.json({
      nfts,
      hasMore,
      total,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to load NFTs ${error}` },
      { status: 500 }
    );
  }
} 