import { Controls } from "@/components/controls";
import Header from "@/components/header";
import NFTGridWrapper from "@/components/nft-grid";
import { loadNFTData } from "@/utils/nft-loader";
import { NftCarouselAccordion } from "@/components/nft-carousel-accordion"; // Import the client component
import { BadgePercent, Diamond } from "lucide-react"; // Icons for sections

export default async function Home() {
  const carouselLimit = 15; // Define limit for carousel sections

  // Fetch data for the main grid
  const initialNFTDataPromise = loadNFTData({
    limit: 20,
    page: 1,
    sortBy: "rarity-desc",
    showCommunity: false,
  });

  // Fetch data for "Best Deals" carousel
  const bestDealsDataPromise = loadNFTData({
    sortBy: 'price-asc',
    limit: carouselLimit,
    showCommunity: false
  });

  // Fetch data for "Rarest Items for Sale" carousel
  const rarestForSaleDataPromise = loadNFTData({
    sortBy: 'rarity-desc',
    limit: carouselLimit,
    showCommunity: false
  });

  // Wait for all data fetching promises to resolve
  const [
    initialNFTData,
    bestDealsData,
    rarestForSaleData
  ] = await Promise.all([
    initialNFTDataPromise,
    bestDealsDataPromise,
    rarestForSaleDataPromise
  ]);

  console.log("Initial NFT Data:", initialNFTData);
  console.log("Best Deals Data:", bestDealsData);
  console.log("Rarest For Sale Data:", rarestForSaleData);

  return (
    <div>
      <Header />
      <main className="min-w-screen min-h-screen md:px-8 mt-12">
        <Controls />
        {/* Use the client component with fetched data */}
        {/* <NftCarouselAccordion
          title="Best Deals"
          icon={<BadgePercent className="w-5 h-5" />}
          nfts={bestDealsData.nfts}
          total={bestDealsData.total}
          limit={carouselLimit}
          defaultOpen={true} // Open this section by default
        />
        <NftCarouselAccordion
          title="Rarest Items for Sale"
          icon={<Diamond className="w-5 h-5" />}
          nfts={rarestForSaleData.nfts}
          total={rarestForSaleData.total}
          limit={carouselLimit}
        /> */}

        {/* Existing NFT Grid */}
        <NFTGridWrapper initialData={initialNFTData.nfts} />
      </main>
      {/* <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
       
      </footer> */}
    </div>
  );
}
