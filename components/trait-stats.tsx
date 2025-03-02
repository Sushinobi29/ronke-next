"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus } from "lucide-react";

interface TraitCategory {
  [key: string]: {
    count: number;
    rarity: number;
  };
}

interface TraitDistribution {
  [category: string]: TraitCategory;
}

const formatRarity = (rarity: number) => {
  return (rarity * 100).toFixed(2) + "%";
};

const TraitPreview = ({
  trait,
  value,
  category,
}: {
  trait: string;
  value: { count: number; rarity: number };
  category: string;
}) => (
  <div className="bg-black/5 backdrop-blur-sm rounded-lg p-3">
    <div className="text-sm font-medium">{trait}</div>
    <div className="text-xs opacity-70">{category}</div>
    <div className="text-xs mt-1">
      Count: {value.count} ({formatRarity(value.rarity)})
    </div>
  </div>
);

const TraitCategorySection = ({
  category,
  traits,
}: {
  category: string;
  traits: TraitCategory;
}) => {
  const sortedTraits = Object.entries(traits).sort(
    ([, a], [, b]) => b.rarity - a.rarity
  );

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-2">{category}</h3>
      <div className="grid grid-cols-2 gap-2">
        {sortedTraits.map(([trait, value]) => (
          <div
            key={trait}
            className="bg-black/5 backdrop-blur-sm rounded-lg p-2"
          >
            <div className="text-sm font-medium">{trait}</div>
            <div className="text-xs mt-1">
              Count: {value.count} ({formatRarity(value.rarity)})
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export function TraitStats({
  traitDistribution,
}: {
  traitDistribution: TraitDistribution;
}) {
  // Get the rarest trait from each category for the preview
  const previewTraits = Object.entries(traitDistribution)
    .map(([category, traits]) => {
      const rarestTrait = Object.entries(traits).reduce((prev, curr) =>
        curr[1].rarity < prev[1].rarity ? curr : prev
      );
      return { category, trait: rarestTrait[0], value: rarestTrait[1] };
    })
    .slice(0, 3); // Show only 3 traits in preview

  return (
    <div className="">
      <div className="text-xl font-bold mb-3">Trait Statistics</div>
      <div className="flex gap-3 items-stretch">
        {previewTraits.map(({ category, trait, value }) => (
          <TraitPreview
            key={trait}
            trait={trait}
            value={value}
            category={category}
          />
        ))}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="h-auto aspect-square">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Trait Statistics</DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[600px] pr-4">
              {Object.entries(traitDistribution).map(([category, traits]) => (
                <TraitCategorySection
                  key={category}
                  category={category}
                  traits={traits}
                />
              ))}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
