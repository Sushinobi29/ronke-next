import { NFTMetadata } from "@/shared/types/Metadata";
import Image from "next/image";
import Link from "next/link";

interface NFTCardProps {
  metadata: NFTMetadata;
  stats: { rank: number; rarityScore: number };
}

export default function NFTCard({ metadata, stats }: NFTCardProps) {
  return (
    <Link
      href={`https://marketplace.roninchain.com/collections/ronkeverse/${
        metadata.name.split("#")[1]
      }`}
      target="_blank"
      className="rounded-lg overflow-hidden bg-black/10 hover:bg-black/20 dark:bg-zinc-900 hover:scale-105 hover:shadow-lg cursor-pointer transition-all duration-300 backdrop-blur-sm"
    >
      <div className="relative">
        <Image
          src={metadata.image}
          alt={metadata.name}
          width={500}
          height={500}
          className="w-full h-auto aspect-square object-cover"
        />
        <div className="absolute top-2 right-2 bg-black/40 rounded-full px-3 py-1 text-xs text-white">
          Rank #{stats.rank > 107 ? stats.rank - 107 : stats.rank }
        </div>
      </div>
      <div className="p-4">
        <p className="opacity-50 text-xs">{metadata.name.split("#")[0]}</p>
        <p className="font-semibold">{metadata.name}</p>
        <p className="opacity-50 text-xs mt-2">
          Rarity Score: {stats.rarityScore.toFixed(2)}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {metadata.attributes.slice(0, 3).map((attr) => (
            <span
              key={`${attr.trait_type}-${attr.value}`}
              className="text-xs bg-black/20 rounded-full px-2 py-1"
            >
              {attr.value}
            </span>
          ))}
          {metadata.attributes.length > 3 && (
            <span className="text-xs bg-black/20 rounded-full px-2 py-1">
              +{metadata.attributes.length - 3}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
