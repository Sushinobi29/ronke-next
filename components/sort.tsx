"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import useStore from "@/stores/general-state";

const options = [
  {
    value: "rarity-desc",
    label: "Rarity: Highest to Lowest",
  },
  {
    value: "rarity-asc",
    label: "Rarity: Lowest to Highest",
  },
  {
    value: "id-asc",
    label: "ID: Lowest to Highest",
  },
  {
    value: "id-desc",
    label: "ID: Highest to Lowest",
  },
];

export function Sort() {
  const [open, setOpen] = React.useState(false);
  const { sortBy, setSortBy } = useStore();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
        >
          {sortBy
            ? options.find((sort) => sort.value === sortBy)?.label
            : "Select sort..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search sort..." />
          <CommandList>
            <CommandEmpty>No sort found.</CommandEmpty>
            <CommandGroup>
              {options.map((sort) => (
                <CommandItem
                  key={sort.value}
                  value={sort.value}
                  onSelect={(currentValue) => {
                    setSortBy(currentValue === sortBy ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      sortBy === sort.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {sort.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
