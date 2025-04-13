import * as React from "react";
import { loadNFTData, NFTWithStats } from "@/utils/nft-loader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import NftCard from "@/components/nft-card"; // Use default import
import { AlertTriangle, BadgePercent, Diamond } from "lucide-react"; // Example icons

interface NftCarouselSectionProps {
  title: string;
  fetchOptions: Parameters<typeof loadNFTData>[0];
  icon?: React.ReactNode;
  defaultOpen?: boolean; // Allow section to be open by default
}

export async function NftCarouselSection({
  title,
  fetchOptions,
  icon,
  defaultOpen = false,
}: NftCarouselSectionProps) {
  // Ensure a limit is set for carousel display
  // Ensure fetchOptions exists before spreading and provide default limit
  const options = { ...(fetchOptions || {}), limit: fetchOptions?.limit ?? 15 };
  const { nfts, total } = await loadNFTData(options);

  if (!nfts || nfts.length === 0) {
    // Don't render the section if there's no data
    return null;
  }

  const accordionValue = title.toLowerCase().replace(/\s+/g, "-"); // Generate a unique value for the accordion item

  return (
    <Accordion
      type="single"
      collapsible
      className="w-full mb-6"
      defaultValue={defaultOpen ? accordionValue : undefined}
    >
      <AccordionItem value={accordionValue}>
        <AccordionTrigger className="text-xl font-semibold hover:no-underline px-1">
          <div className="flex items-center gap-2">
            {icon}
            {title}
            <span className="text-sm font-normal text-muted-foreground">
              ({total > options.limit! ? `${options.limit}+` : total})
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-1">
          {nfts.length > 0 ? (
            <Carousel
              opts={{
                align: "start",
                loop: nfts.length > 5, // Only loop if enough items
              }}
              className="w-full"
            >
              <CarouselContent className="-ml-4">
                {nfts.map((nft, index) => (
                  <CarouselItem
                    key={nft.name || index} // Use unique name as key
                    className="pl-4 md:basis-1/3 lg:basis-1/4 xl:basis-1/5" // Adjust basis for responsiveness
                  >
                    <div className="p-1">
                      <NftCard
                        metadata={{
                          name: nft.name,
                          description: nft.description,
                          image: nft.image,
                          attributes: nft.attributes,
                          // Add any other fields expected by NFTMetadata if necessary
                        }}
                        stats={nft.stats}
                        priceInfo={nft.priceInfo}
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {nfts.length > 5 && ( // Only show controls if enough items to scroll
                <>
                  <CarouselPrevious className="absolute left-[-15px] top-1/2 -translate-y-1/2 z-10" />
                  <CarouselNext className="absolute right-[-15px] top-1/2 -translate-y-1/2 z-10" />
                </>
              )}
            </Carousel>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              <AlertTriangle className="w-5 h-5 mr-2" />
              No items found matching the criteria.
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

// Example Usage (for reference, will be added to app/page.tsx later)
/*
<NftCarouselSection
  title="Best Deals"
  icon={<BadgePercent className="w-5 h-5" />}
  fetchOptions={{ sortBy: 'price-asc', forSaleOnly: true, limit: 15, showCommunity: false }}
  defaultOpen={true}
/>
<NftCarouselSection
  title="Rarest Items for Sale"
  icon={<Diamond className="w-5 h-5" />}
  fetchOptions={{ sortBy: 'rarity-desc', forSaleOnly: true, limit: 15, showCommunity: false }}
/>
*/