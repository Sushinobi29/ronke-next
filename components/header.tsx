import { ArrowUpRightFromSquare } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { TraitStats } from "./trait-stats";
import traitData from "@/nft-statistics.json";
import { ThemeToggle } from "./theme-toggle";

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
        <div className="absolute right-4 top-4 z-10">
              <ThemeToggle/>
            </div>
      </div>
      <div className="p-8">
        <div className="flex flex-col md:flex-row gap-4 md:gap-0">
          <div className="md:w-42 w-full border-2 border-black -mt-20 relative rounded-xl aspect-square overflow-hidden">
            <Image
              alt=""
              src="https://cdn.roninchain.com/ronin/2020/erc721/0x810b6d1374ac7ba0e83612e7d49f49a13f1de019/logo.png"
              width={1080}
              height={320}
              className="h-full w-full object-cover aspect-square"
            />
            
          </div>
          <div className="ml-8">
            <h1 className="text-3xl font-bold">Ronkeverse</h1>
            <p className="opacity-50">Rarity & Ranking</p>
            <Link href="https://marketplace.roninchain.com/collections/ronkeverse?sort=PriceDesc">
              <p className="bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 duration-200 flex gap-4 justify-around items-center rounded-full text-center mt-2 px-4 py-2">
                <span>View Marketplace</span>{" "}
                <ArrowUpRightFromSquare className="mt-1 hidden md:block" size={16} />
              </p>
            </Link>
          </div>
          <div className="ml-12">
            <TraitStats traitDistribution={traitData.traitDistribution} />
          </div>
          {/* <div className="ml-auto flex items-center">
            <Link href="passport" className="relative px-6 py-3 font-bold text-white rounded-full overflow-hidden group hover:cursor-pointer">
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-purple-600 via-pink-500 to-red-500 animate-gradient-x"></span>
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-500 via-green-400 to-yellow-500 animate-gradient-y opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
              <span className="relative flex items-center justify-center gap-2">
                Generate Ronke Passport
                <ArrowUpRightFromSquare size={16} />
              </span>
            </Link>
          </div> */}
        </div>
      </div>
    </div>
  );
}
