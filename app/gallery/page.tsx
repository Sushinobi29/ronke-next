import { Controls } from "@/components/controls";
import Header from "@/components/header";
import PageNavbar from "@/components/page-navbar";
import NFTGridWrapper from "@/components/nft-grid";
import { loadNFTData } from "@/utils/nft-loader";

export default async function Home() {

  // Fetch data for the main grid
  const initialNFTDataPromise = loadNFTData({
    limit: 20,
    page: 1,
    sortBy: "rarity-desc",
    showCommunity: false,
  });

  // Wait for all data fetching promises to resolve
  const [
    initialNFTData
  ] = await Promise.all([
    initialNFTDataPromise
  ]);

  return (
    <div>
      <PageNavbar />
      <Header />
      <main className="min-w-screen min-h-screen md:px-8 mt-12">
        <Controls />
        <NFTGridWrapper initialData={initialNFTData.nfts} />
      </main>
    </div>
  );
}