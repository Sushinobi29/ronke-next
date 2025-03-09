"use client";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import NFTCard from "./nft-card";
import useStore from "@/stores/general-state";
import { NFTWithStats } from "@/utils/nft-loader";
import NoSSR from "./no-ssr";
import { useNFTFetcher } from "@/hooks/useNftFetcher";
import { usePriceUpdater } from "@/hooks/usePriceUpdater";
import { useThrottle } from "@/hooks/useThrottle";

interface NFTGridProps {
  initialData: NFTWithStats[];
}

function NFTGrid({ initialData }: NFTGridProps) {
  const renderCount = useRef(0);
  renderCount.current++;

  console.log("🌈 NFTGrid render #", renderCount.current, {
    props: { initialData: initialData.length },
    store: {
      nfts: useStore.getState().nfts.length,
      currentPage: useStore.getState().currentPage,
    },
  });

  const {
    setNFTs,
    sortBy,
    nfts,
    showCommunity,
    searchQuery,
    hasMore,
    currentPage,
    setCurrentPage,
  } = useStore();
  const setIsClient = useState(false)[1];
  const [isLoading, setIsLoading] = useState(false);
  const { handleFetch } = useNFTFetcher();
  const memoizedInitialData = useMemo(() => initialData, []);
  const updatePrices = usePriceUpdater();

  const loadNFTs = useCallback(
    async (pageNum: number, resetData: boolean = false) => {
      setIsLoading(true);
      const success = await handleFetch(
        { page: pageNum, limit: 40, resetData },
        { sortBy, showCommunity, search: searchQuery }
      );
      setIsLoading(false);
      return success;
    },
    [handleFetch, sortBy, showCommunity, searchQuery]
  );

  useEffect(() => {
    setIsClient(true);
    setNFTs(memoizedInitialData);
  }, [memoizedInitialData, setNFTs]);

  const throttledLoadNFTs = useThrottle(loadNFTs, 1000);

  useEffect(() => {
    setCurrentPage(1);
    loadNFTs(1, true);
  }, [sortBy, showCommunity, setCurrentPage, searchQuery, loadNFTs]);

  const loadMore = async () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    const success = await throttledLoadNFTs(nextPage, false);
    if (success) {
      setTimeout(() => {
        updatePrices(true);
      }, 0);
    }
  };

  const displayedNfts = Array.isArray(nfts) ? nfts : [];

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
        {displayedNfts.map((nft) => (
          <NFTCard
            key={nft.name}
            metadata={nft}
            stats={nft.stats}
            priceInfo={nft.priceInfo}
          />
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
