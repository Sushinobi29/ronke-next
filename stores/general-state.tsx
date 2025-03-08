import { create } from "zustand";
import { persist } from "zustand/middleware";
import { NFTWithStats } from "@/utils/nft-loader";

interface GeneralState {
  sortBy: string;
  nfts: NFTWithStats[];
  searchQuery: string;
  showCommunity: boolean;
  hasMore: boolean;
  currentPage: number;
  setSortBy: (sort: string) => void;
  setNFTs: (nfts: NFTWithStats[]) => void;
  setSearchQuery: (query: string) => void;
  setShowCommunity: (show: boolean) => void;
  setHasMore: (hasMore: boolean) => void;
  setCurrentPage: (page: number) => void;
}

const useStore = create<GeneralState>()(
  persist(
    (set, get) => ({
      sortBy: "rarity-desc",
      nfts: [],
      searchQuery: "",
      showCommunity: false,
      hasMore: true,
      currentPage: 1,
      
      // setters
      setSortBy: (sort) => set({ sortBy: sort }),
      setNFTs: (nfts) => set({ nfts }),
      setSearchQuery: (query) => set({ 
        searchQuery: query,
        currentPage: 1 
      }),
      setShowCommunity: (show) => set({ 
        showCommunity: show,
        currentPage: 1 
      }),
      setHasMore: (hasMore) => set({ hasMore }),
      setCurrentPage: (page) => set({ currentPage: page }),
    }),
    {
      name: "general-storage",
    }
  )
);

export default useStore;