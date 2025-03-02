import { ArrowUpRightFromSquare } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { TraitStats } from "./trait-stats";
import traitData from "@/nft-statistics.json";

export default function Header() {
  return (
    <div className="w-full">
      <div className="h-80 w-full">
        <Image
          alt=""
          src="https://cdn.roninchain.com/ronin/2020/erc721/0x810b6d1374ac7ba0e83612e7d49f49a13f1de019/banner.png"
          width={1080}
          height={320}
          className="h-full w-full object-cover opacity-50 blur-md"
        />
      </div>
      <div className="p-8">
        <div className="flex">
          <div className="h-42 border-2 border-black -mt-20 relative rounded-xl aspect-square overflow-hidden">
            <Image
              alt=""
              src="https://cdn.roninchain.com/ronin/2020/erc721/0x810b6d1374ac7ba0e83612e7d49f49a13f1de019/logo.png"
              width={1080}
              height={320}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="ml-8">
            <h1 className="text-3xl font-bold">Ronkeverse</h1>
            <p className="opacity-50">Rarity & Ranking</p>
            <Link href="https://marketplace.roninchain.com/collections/ronkeverse?sort=PriceDesc">
              <p className="bg-zinc-700 hover:bg-zinc-600 duration-200 flex gap-4 justify-around items-center rounded-full text-center mt-2 px-4 py-2">
                <span>View Marketplace</span>{" "}
                <ArrowUpRightFromSquare className="mt-1" size={16} />
              </p>
            </Link>
          </div>
          <div className="ml-12">
            <TraitStats traitDistribution={traitData.traitDistribution} />
          </div>
        </div>
      </div>
    </div>
  );
}
