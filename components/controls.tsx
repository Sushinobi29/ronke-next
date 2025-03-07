"use client";
import { SearchBar } from "./searchbar";
import { Sort } from "./sort";
import NoSSR from "./no-ssr";
import useStore from "@/stores/general-state";
import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function Controls() {
  const { 
    setSearchQuery, 
    setNFTs, 
    showCommunity, 
    setShowCommunity,
    setHasMore,
    setCurrentPage,
    setSortBy
  } = useStore();
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (query: string) => {
    setIsSearching(true);
    try {
      setSearchQuery(query);
      setCurrentPage(1);
      setSortBy("relevance"); // Set default sort to relevance when searching
      
      const response = await fetch(
        `/api/nfts?page=1&limit=20&search=${encodeURIComponent(query)}&showCommunity=${showCommunity}&sortBy=relevance`
      );
      const data = await response.json();
      
      setNFTs(data.nfts);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error("Error searching NFTs:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCommunityToggle = async (checked: boolean) => {
    setShowCommunity(checked);
    setCurrentPage(1);
    setIsSearching(true);
    
    try {
      const response = await fetch(
        `/api/nfts?page=1&limit=20&showCommunity=${checked}`
      );
      const data = await response.json();
      
      setNFTs(data.nfts);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error("Error fetching NFTs:", error);
    } finally {
      setIsSearching(false);
    }
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