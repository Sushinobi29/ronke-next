import { create } from "zustand";
import { persist } from "zustand/middleware";
import { NFTWithStats } from "@/utils/nft-loader";

interface GeneralState {
  sortBy: string;
  nfts: NFTWithStats[];
  searchResults: NFTWithStats[] | null;
  searchQuery: string;
  setSortBy: (sort: string) => void;
  setNFTs: (nfts: NFTWithStats[]) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: NFTWithStats[] | null) => void;
  getSortedNFTs: () => NFTWithStats[];
  getCurrentNFTs: () => NFTWithStats[];
}

const useStore = create<GeneralState>()(
  persist(
    (set, get) => ({
      sortBy: "rarity-desc",
      nfts: [],
      searchResults: null,
      searchQuery: "",
      setSortBy: (sort) => set({ sortBy: sort }),
      setNFTs: (nfts) => set({ nfts }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSearchResults: (results) => set({ searchResults: results }),
      getSortedNFTs: () => {
        const { nfts, sortBy, searchQuery } = get();

        // First filter by search query
        const filteredNFTs = searchQuery
          ? nfts.filter(
              (nft) =>
                nft.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                nft.attributes.some((attr) =>
                  attr.value.toLowerCase().includes(searchQuery.toLowerCase())
                )
            )
          : nfts;

        // Then sort the filtered results
        switch (sortBy) {
          case "rarity-desc":
            return [...filteredNFTs].sort(
              (a, b) => b.stats.rarityScore - a.stats.rarityScore
            );
          case "rarity-asc":
            return [...filteredNFTs].sort(
              (a, b) => a.stats.rarityScore - b.stats.rarityScore
            );
          case "id-asc":
            return [...filteredNFTs].sort(
              (a, b) =>
                parseInt(a.name.split("#")[1]) - parseInt(b.name.split("#")[1])
            );
          case "id-desc":
            return [...filteredNFTs].sort(
              (a, b) =>
                parseInt(b.name.split("#")[1]) - parseInt(a.name.split("#")[1])
            );
          default:
            return filteredNFTs;
        }
      },
      getCurrentNFTs: () => {
        const { searchResults, nfts } = get();
        return searchResults !== null ? searchResults : nfts;
      },
    }),
    {
      name: "general-storage",
    }
  )
);

export default useStore;
