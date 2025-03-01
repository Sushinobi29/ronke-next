import { create } from "zustand";
import { persist } from "zustand/middleware";
import { NFTWithStats } from "@/utils/nft-loader";

interface GeneralState {
  sortBy: string;
  nfts: NFTWithStats[];
  setSortBy: (sort: string) => void;
  setNFTs: (nfts: NFTWithStats[]) => void;
  getSortedNFTs: () => NFTWithStats[];
}

const useStore = create<GeneralState>()(
  persist(
    (set, get) => ({
      sortBy: "rarity-desc",
      nfts: [],
      setSortBy: (sort) => set({ sortBy: sort }),
      setNFTs: (nfts) => set({ nfts }),
      getSortedNFTs: () => {
        const { nfts, sortBy } = get();
        switch (sortBy) {
          case "rarity-desc":
            return [...nfts].sort(
              (a, b) => b.stats.rarityScore - a.stats.rarityScore
            );
          case "rarity-asc":
            return [...nfts].sort(
              (a, b) => a.stats.rarityScore - b.stats.rarityScore
            );
          case "id-asc":
            return [...nfts].sort(
              (a, b) =>
                parseInt(a.name.split("#")[1]) - parseInt(b.name.split("#")[1])
            );
          case "id-desc":
            return [...nfts].sort(
              (a, b) =>
                parseInt(b.name.split("#")[1]) - parseInt(a.name.split("#")[1])
            );
          default:
            return nfts;
        }
      },
    }),
    {
      name: "general-storage",
    }
  )
);

export default useStore;
