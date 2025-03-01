"use client";
import { useEffect, useState } from "react";
import NFTCard from "./nft-card";
import useStore from "@/stores/general-state";
import { NFTWithStats } from "@/utils/nft-loader";

interface NFTGridProps {
  initialData: NFTWithStats[];
}

export default function NFTGrid({ initialData }: NFTGridProps) {
  const { setNFTs, sortBy } = useStore();
  const [isClient, setIsClient] = useState(false);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [nfts, setNfts] = useState<NFTWithStats[]>(initialData);
  const [hasMore, setHasMore] = useState(true);

  const loadNFTs = async (pageNum: number, resetData: boolean = false) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/nfts?page=${pageNum}&limit=20&sortBy=${sortBy}`
      );
      const data = await response.json();

      if (data.nfts.length > 0) {
        setNfts(resetData ? data.nfts : [...nfts, ...data.nfts]);
        setHasMore(data.hasMore);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error loading NFTs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset and reload when sort changes
  useEffect(() => {
    if (isClient) {
      setPage(1);
      loadNFTs(1, true);
    }
  }, [sortBy, isClient, loadNFTs]);

  // Initial client-side setup
  useEffect(() => {
    setIsClient(true);
    setNFTs(initialData);
  }, [initialData, setNFTs]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadNFTs(nextPage, false);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
        {nfts.map((nft) => (
          <NFTCard key={nft.name} metadata={nft} stats={nft.stats} />
        ))}
      </div>

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={isLoading}
          className="px-6 py-2 bg-black/10 hover:bg-black/20 rounded-full backdrop-blur-sm transition-all duration-300 mb-8 disabled:opacity-50"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-white/50 border-t-white rounded-full" />
              Loading...
            </div>
          ) : (
            "Load More"
          )}
        </button>
      )}
    </div>
  );
}
