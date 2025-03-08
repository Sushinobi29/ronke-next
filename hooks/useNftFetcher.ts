// hooks/useNFTFetcher.ts
import { NFTMetadata } from "@/shared/types/Metadata";
import  useStore from "@/stores/general-state";
import { fetchNFTs } from "@/utils/nft-api";
import { useCallback } from "react";

export function useNFTFetcher() {
  const { setNFTs, setHasMore, setCurrentPage } = useStore();

  const handleFetch = useCallback(
    async (
      params: {
        page: number;
        limit: number;
        resetData: boolean;
      },
      filters: {
        sortBy?: string;
        search?: string;
        showCommunity?: boolean;
      }
    ) => {
      try {
        const data = await fetchNFTs({
          ...params,
          ...filters,
        });

        setNFTs(
          params.resetData ? data.nfts : [...useStore.getState().nfts, ...data.nfts]
        );
        setHasMore(data.hasMore);
        setCurrentPage(params.page);
        return true;
      } catch (error) {
        console.error("NFT fetch error:", error);
        return false;
      }
    },
    [setNFTs, setHasMore, setCurrentPage]
  );

  return { handleFetch };
}