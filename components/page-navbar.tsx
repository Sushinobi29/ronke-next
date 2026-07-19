"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { SCORE_TABS, isScoreTabId } from "./score-embed-tabs";

const NAV_ITEMS = [
  { href: "/", label: "HOME" },
  { href: "/passport", label: "PASSPORT" },
];

function ScoreMenu() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab");
  const activeTab =
    pathname === "/score" ? (isScoreTabId(requested) ? requested : "score") : null;

  return (
    <div className="group relative">
      <Link
        href="/score"
        className={`inline-flex items-center gap-1 py-5 text-[13px] font-medium tracking-wide transition-colors ${
          pathname === "/score"
            ? "text-accent"
            : "text-muted-1 hover:text-foreground"
        }`}
      >
        SCORE
        <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
      </Link>
      <div className="invisible absolute left-1/2 top-full z-50 w-44 -translate-x-1/2 pt-1 opacity-0 transition-all duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        <div className="rv-card overflow-hidden py-2">
          {SCORE_TABS.map((tab) => (
            <Link
              key={tab.id}
              href={tab.id === "score" ? "/score" : `/score?tab=${tab.id}`}
              className={`block px-4 py-2 text-[13px] font-medium tracking-wide transition-colors ${
                activeTab === tab.id
                  ? "text-accent"
                  : "text-muted-1 hover:bg-card-2 hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PageNavbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div
        className="border-b border-border"
        style={{
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          background: "rgba(7,8,12,0.72)",
        }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/ronke-logo.webp"
                alt=""
                width={36}
                height={36}
                className="rounded-full"
              />
              <span className="hidden text-sm font-semibold tracking-[0.14em] sm:inline">
                RONKE<span className="text-accent">VERSE</span>
              </span>
            </Link>

            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="text-[13px] font-medium tracking-wide text-muted-1 transition-colors hover:text-foreground"
              >
                HOME
              </Link>
              <Suspense
                fallback={
                  <Link
                    href="/score"
                    className="text-[13px] font-medium tracking-wide text-muted-1"
                  >
                    SCORE
                  </Link>
                }
              >
                <ScoreMenu />
              </Suspense>
              {NAV_ITEMS.slice(1).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-[13px] font-medium tracking-wide text-muted-1 transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
