"use client";

import { useState } from "react";

const ANALYTICS_URL = "https://ronke-analytics.vercel.app";

// Height of the embedded site's sticky top bar (measured live: 59px). The
// iframe is shifted up by exactly this much inside an overflow-hidden frame,
// so their navbar lives permanently in the cropped zone and our tab strip
// takes over navigation. Their non-sticky sub-nav (Overview/Holders/... and
// asset toggles) stays visible and useful.
const NAV_CROP = 59;

const TABS = [
  { id: "score", label: "SCORE", path: "/#ronke-score" },
  { id: "analytics", label: "ANALYTICS", path: "/overview" },
  { id: "leaderboard", label: "LEADERBOARD", path: "/leaderboard" },
  { id: "rarity", label: "RARITY", path: "/rarity" },
  { id: "resources", label: "RESOURCES", path: "/resources" },
] as const;

export default function ScoreEmbedTabs() {
  const [active, setActive] = useState<(typeof TABS)[number]["id"]>("score");
  const [loaded, setLoaded] = useState(false);
  const tab = TABS.find((t) => t.id === active)!;

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col" style={{ marginTop: "4rem" }}>
      <div
        className="border-b border-border"
        style={{
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          background: "rgba(7,8,12,0.72)",
        }}
      >
        <nav
          className="rv-scroll mx-auto flex max-w-6xl gap-6 overflow-x-auto px-4 sm:px-6"
          aria-label="Analytics sections"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                if (t.id === active) return;
                setLoaded(false);
                setActive(t.id);
              }}
              className={`whitespace-nowrap border-b-2 py-3 text-[13px] font-medium tracking-wide transition-colors ${
                active === t.id
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-1 hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="mono animate-pulse text-sm text-muted-2">
              Loading {tab.label.toLowerCase()}…
            </span>
          </div>
        )}
        <iframe
          key={tab.id}
          src={`${ANALYTICS_URL}${tab.path}`}
          title={`Ronke Analytics - ${tab.label.toLowerCase()}`}
          onLoad={() => setLoaded(true)}
          allow="clipboard-write"
          className={`absolute inset-x-0 w-full border-0 transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          style={{
            top: -NAV_CROP,
            height: `calc(100% + ${NAV_CROP}px)`,
          }}
        />
      </div>
    </div>
  );
}
