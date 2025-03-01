import { loadNFTData } from "@/utils/nft-loader";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const sortBy = searchParams.get("sortBy") || "rarity-desc";

  try {
    const nfts = await loadNFTData(limit, page, sortBy);
    const totalNFTs = (await loadNFTData()).length;

    return NextResponse.json({
      nfts,
      hasMore: page * limit < totalNFTs,
      total: totalNFTs,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load NFTs" }, { status: 500 });
  }
}
