"use client";
import { SearchBar } from "./searchbar";
import { Sort } from "./sort";
import NoSSR from "./no-ssr";
import useStore from "@/stores/general-state";
import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useNFTFetcher } from "@/hooks/useNftFetcher";

export function Controls() {
  const { 
    setSearchQuery, 
    showCommunity, 
    setShowCommunity,
    setSortBy
  } = useStore();
  const [isSearching, setIsSearching] = useState(false);
  const { handleFetch } = useNFTFetcher();

  const handleSearch = async (query: string) => {
    setIsSearching(true);
    setSearchQuery(query);
    setSortBy("relevance");
    
    await handleFetch(
      { page: 1, limit: 40, resetData: true },
      { search: query, sortBy: "relevance" }
    );
    
    setIsSearching(false);
  };

  const handleCommunityToggle = async (checked: boolean) => {
    setIsSearching(true);
    setShowCommunity(checked);
    
    await handleFetch(
      { page: 1, limit: 40, resetData: true },
      { showCommunity: checked }
    );
    
    setIsSearching(false);
  };

  useEffect(() => {
    setShowCommunity(false);
  }, [setShowCommunity]);

  return (
    <NoSSR>
      <div className="flex flex-col md:grid md:grid-cols-12 gap-4 my-8 px-4 md:px-0">
        <div className="w-full md:col-span-4 flex gap-4 items-center">
          <Sort />
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="community" 
              checked={showCommunity}
              onCheckedChange={(checked) => handleCommunityToggle(checked as boolean)}
            />
            <Label 
              htmlFor="community" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Community 1/1s
            </Label>
          </div>
        </div>
        <div className="w-full md:col-span-8">
          <SearchBar onSearch={handleSearch} isLoading={isSearching} />
        </div>
      </div>
    </NoSSR>
  );
}