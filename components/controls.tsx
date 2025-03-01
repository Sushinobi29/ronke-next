"use client";
import { Filters } from "./filters";
import { SearchBar } from "./searchbar";
import { Sort } from "./sort";
import NoSSR from "./no-ssr";
import useStore from "@/stores/general-state";

export function Controls() {
  return (
    <NoSSR>
      <div className="grid grid-cols-12">
        <div className="col-span-4 flex gap-2">
          <Filters />
          <Sort />
        </div>
        <div className="col-span-8">
          <SearchBar />
        </div>
      </div>
    </NoSSR>
  );
}
