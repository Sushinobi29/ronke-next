"use client";
// import { Filters } from "./filters";
import { SearchBar } from "./searchbar";
import { Sort } from "./sort";
import NoSSR from "./no-ssr";
import useStore from "@/stores/general-state";
import { useState } from "react";

export function Controls() {
  const { setSearchResults } = useStore();
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (query: string) => {
    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/nfts?page=1&limit=20&search=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      setSearchResults(query ? data.nfts : null);
    } catch (error) {
      console.error("Error searching NFTs:", error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <NoSSR>
      <div className="flex flex-col md:grid md:grid-cols-12 gap-4 my-8 px-4 md:px-0">
        <div className="w-full md:col-span-4 flex gap-2">
          {/* <Filters /> */}
          <Sort />
        </div>
        <div className="w-full md:col-span-8">
          <SearchBar onSearch={handleSearch} isLoading={isSearching} />
        </div>
      </div>
    </NoSSR>
  );
}
