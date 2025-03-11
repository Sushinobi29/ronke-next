import { NFTMetadata } from "@/shared/types/Metadata";
import Image from "next/image";
import Link from "next/link";
import { Tag, HandCoins } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatPrice } from "@/utils/format-price";
import useStore from "@/stores/general-state";

interface NFTCardProps {
  metadata: NFTMetadata;
  stats: { rank: number; rarityScore: number };
  priceInfo?: {
    minPrice: string;
    order?: {
      basePrice: string;
      currentPrice: string;
    };
    highestOffer?: {
      currentPrice: string;
      basePrice: string;
      suggestedPrice: string;
    };
  };
}

export default function NFTCard({ metadata, stats, priceInfo }: NFTCardProps) {
  const { onlyListed } = useStore();
  const isLoading = !priceInfo; // Add loading state check

  const priceData = (() => {
    if (isLoading) {
      return {
        value: null,
        origin: "loading",
        icon: null,
      };
    }
    if (priceInfo?.order?.currentPrice) {
      return {
        value: priceInfo.order.currentPrice,
        origin: "listing",
        icon: <Tag className="w-4 h-4" />,
      };
    }
    if (priceInfo?.highestOffer?.currentPrice) {
      return {
        value: priceInfo.highestOffer.currentPrice,
        origin: "offer",
        icon: <HandCoins className="w-4 h-4" />,
      };
    }
    return {
      value: null,
      origin: "none",
      icon: null,
    };
  })();

  if (onlyListed && priceData.origin !== "listing") {
    return null;
  }

  // Convert price from wei to RON
  const formattedPrice = formatPrice(priceData.value);

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
          Rank #{stats.rank > 107 ? stats.rank - 107 : stats.rank}
        </div>
      </div>
      <div className="p-4 relative">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="absolute top-2 backdrop-blur right-2 bg-black/40 rounded-full px-3 py-1 text-xs text-white flex items-center gap-1">
              {priceData.icon}
              <Image
                src="/images/ron.png"
                alt="RON"
                width={16}
                height={16}
                className="w-4 h-5"
                unoptimized
              />
              {isLoading ? (
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <span>{formattedPrice}</span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent className="p-4">
            {isLoading && "Loading price..."}
            {!isLoading && (
              <>
                {priceData.origin === "listing" && "Listing Price"}
                {priceData.origin === "offer" && "Highest Offer"}
                {priceData.origin === "none" && "No price"}
              </>
            )}
          </TooltipContent>
        </Tooltip>
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
