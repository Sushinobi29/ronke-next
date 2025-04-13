"use client"; // Mark as a Client Component

import * as React from "react";
import { NFTWithStats } from "@/utils/nft-loader";
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
import NftCard from "@/components/nft-card";
import { AlertTriangle } from "lucide-react";

interface NftCarouselAccordionProps {
  title: string;
  icon?: React.ReactNode;
  nfts: NFTWithStats[];
  total: number; // Total count before limiting for display
  limit: number; // The limit applied for display
  defaultOpen?: boolean;
}

export function NftCarouselAccordion({
  title,
  icon,
  nfts,
  total,
  limit,
  defaultOpen = false,
}: NftCarouselAccordionProps) {
  console.log("NFTs:", nfts);
  if (!nfts || nfts.length === 0) {
    // Don't render the section if there's no data
    // Although data fetching happens upstream, keep this check
    return null;
  }

  const accordionValue = title.toLowerCase().replace(/\s+/g, "-");

  return (
    <Accordion
      type="single"
      collapsible
      className="w-full mb-6"
      defaultValue={defaultOpen ? accordionValue : undefined}
    >
      <AccordionItem value={accordionValue}>
        <AccordionTrigger className="text-xl font-semibold hover:no-underline px-1 py-4"> {/* Added py-4 back for spacing */}
          {/* Restore icon, title, and count within a non-conflicting container */}
          <div className="flex items-center gap-2"> {/* Use flex here for internal alignment */}
            {icon}
            <span>{title}</span> {/* Wrap title */}
            <span className="text-sm font-normal text-muted-foreground">
              ({total > limit ? `${limit}+` : total}) {/* Show limited count */}
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