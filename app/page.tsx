import { Controls } from "@/components/controls";
import NFTGridWrapper from "@/components/nft-grid";
import { loadNFTData } from "@/utils/nft-loader";

export default async function Home() {
  // Instead of using fetch, let's directly use our loadNFTData function
  const initialNFTData = await loadNFTData(20);

  return (
    <div>
      <main className="min-w-screen min-h-screen">
        <Controls />
        <NFTGridWrapper initialData={initialNFTData} />
      </main>
      {/* <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
       
      </footer> */}
    </div>
  );
}
