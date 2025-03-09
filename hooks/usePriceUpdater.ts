import { useEffect, useCallback, useRef } from "react";
import useStore from "@/stores/general-state";
import { fetchNFTPrices } from "@/utils/price-fetcher";
import type { NFTWithStats } from "@/utils/nft-loader";

const CHUNK_SIZE = 80;

export function usePriceUpdater() {
  console.log("🏁 usePriceUpdater mounted");

  const { setNFTs } = useStore();
  const isMountedRef = useRef(true);
  const updateIntervalRef = useRef<NodeJS.Timeout>(null);
  const lastUpdateRef = useRef(0);

  const getTokenIds = useCallback(() => {
    console.log("🔑 Getting token IDs");
    return useStore
      .getState()
      .nfts.map((nft) => nft.name.match(/#(\d+)$/)?.[1])
      .filter((id): id is string => !!id);
  }, []);

  const updatePrices = useCallback(
    async (force: boolean = false) => {
      console.log("🔄 Starting price update");

      if (!isMountedRef.current) {
        console.log("🚫 Update cancelled (unmounted)");
        return;
      }

      const now = Date.now();
      if (
        !force &&
        lastUpdateRef.current !== 0 &&
        now - lastUpdateRef.current < 240000
      ) {
        console.log("⏳ Update throttled");
        return;
      }

      try {
        const allTokenIds = getTokenIds();
        const currentNFTs = useStore.getState().nfts;

        // When force=true, only fetch prices for NFTs without priceInfo
        const tokenIdsToFetch = force
          ? allTokenIds.filter((id, index) => !currentNFTs[index].priceInfo)
          : allTokenIds;

        console.log("📋 Token IDs:", tokenIdsToFetch);

        if (tokenIdsToFetch.length === 0) {
          console.log("⏭️ No token IDs, skipping update");
          return;
        }

        // Split into chunks of 80
        const chunks: string[][] = [];
        for (let i = 0; i < tokenIdsToFetch.length; i += CHUNK_SIZE) {
          chunks.push(tokenIdsToFetch.slice(i, i + CHUNK_SIZE));
        }

        console.log("📡 Fetching price data...");
        const priceMap = new Map<string, any>();
        for (const chunk of chunks) {
          const priceData = await fetchNFTPrices(chunk);
          console.log("✅ Price data received:", priceData);
          Object.entries(priceData).forEach(([key, value]) => {
            const index = parseInt(key.replace("token", ""));
            const tokenId = chunk[index];
            if (tokenId && value) {
              priceMap.set(tokenId, value);
              // console.log(`🗺️ Mapped ${tokenId} to`, value);
            }
          });
        }

        console.log("🔄 Updating store...");
        setNFTs((current: NFTWithStats[]) =>
          current.map((nft) => {
            const tokenId = nft.name.match(/#(\d+)$/)?.[1];
            return tokenId && priceMap.has(tokenId)
              ? { ...nft, priceInfo: priceMap.get(tokenId) }
              : nft;
          })
        );

        lastUpdateRef.current = Date.now();
        console.log("🎉 Price update complete");
      } catch (error) {
        console.error("❌ Price update failed:", error);
      }
    },
    [getTokenIds, setNFTs]
  );

  useEffect(() => {
    console.log("🔌 Setting up interval");
    isMountedRef.current = true;

    console.log("⏱️ Initial update triggered");
    updatePrices();

    updateIntervalRef.current = setInterval(() => {
      console.log("⏰ Interval update triggered");
      updatePrices();
    }, 240000);

    return () => {
      console.log("🧹 Cleaning up");
      isMountedRef.current = false;
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [updatePrices]);

  console.log("🏁 usePriceUpdater setup complete");
  return updatePrices;
}
