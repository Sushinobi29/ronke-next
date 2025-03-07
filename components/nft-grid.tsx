"use client";
import { useEffect, useState, useCallback } from "react";
import NFTCard from "./nft-card";
import useStore from "@/stores/general-state";
import { NFTWithStats } from "@/utils/nft-loader";
import NoSSR from "./no-ssr";

interface NFTGridProps {
  initialData: NFTWithStats[];
}

function NFTGrid({ initialData }: NFTGridProps) {
  const { 
    setNFTs, 
    sortBy, 
    getCurrentNFTs, 
    showCommunity, 
    searchQuery,
    hasMore,
    setHasMore,
    setCurrentPage
  } = useStore();
  const setIsClient = useState(false)[1];
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const loadNFTs = useCallback(
    async (pageNum: number, resetData: boolean = false) => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/nfts?page=${pageNum}&limit=40&sortBy=${sortBy}&showCommunity=${showCommunity}&search=${searchQuery}`
        );
        const data = await response.json();
  
        if (resetData) {
          setNFTs(data.nfts);
        } else {
          setNFTs([...getCurrentNFTs(), ...data.nfts]);
        }
        
        setHasMore(data.hasMore);
        setCurrentPage(pageNum);
      } catch (error) {
        console.error("Error loading NFTs:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [sortBy, showCommunity, searchQuery, setNFTs, getCurrentNFTs, setHasMore, setCurrentPage]
  );

  useEffect(() => {
    setIsClient(true);
    setNFTs(initialData);
  }, [initialData, setIsClient, setNFTs]);

  // Reset and reload when sort or search changes
  useEffect(() => {
    setPage(1); // Reset to the first page
    loadNFTs(1, true); // Load the first page with resetData set to true
  }, [sortBy, showCommunity, searchQuery, loadNFTs]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadNFTs(nextPage, false); // Load the next page without resetting data
  };

  const displayedNfts = getCurrentNFTs();

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
        {displayedNfts.map((nft) => (
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

      {displayedNfts.length === 0 && !isLoading && (
        <div className="text-center p-4">
          No NFTs found matching your search.
        </div>
      )}
    </div>
  );
}

export default function NFTGridWrapper({ initialData }: NFTGridProps) {
  return (
    <NoSSR>
      <NFTGrid initialData={initialData} />
    </NoSSR>
  );
}
