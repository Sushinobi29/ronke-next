import { Metadata } from "next";
import { Suspense } from "react";
import PageNavbar from "@/components/page-navbar";
import QuestsApp from "@/components/quests-app";

export const metadata: Metadata = {
  title: "Ronke Quests | Ronkeverse - a PoD season of on-chain quests",
  description:
    "Thirteen quests, one PoD season, a live countdown. Coinflips and mines rounds at Ronke Casino, citizens and ballots on Ronke Vote, monkes, barracks and trophies - all scored inside the season and read straight off Ronin. No sign-up, no signature, no transaction.",
  keywords: [
    "ronke quests",
    "ronkeverse quests",
    "ronke points",
    "pod season ronkeverse",
    "ronin quest leaderboard",
    "ronke casino mines leaderboard",
    "ronke vote citizens",
    "age of ronke barracks",
    "fortune spin ronin",
  ],
  openGraph: {
    title: "Ronke Quests - a PoD season of on-chain quests",
    description:
      "Thirteen quests, one season, one countdown. Every quest read straight off a Ronin contract. Paste a wallet and climb the live tables before the clock runs out.",
    url: "https://ronkeverse.com/quests",
    siteName: "Ronkeverse",
    images: [
      {
        url: "https://ronkeverse.com/ronkeverse-banner.png",
        width: 1200,
        height: 630,
        alt: "Ronke Quests - the Ronkeverse quest board",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ronke Quests - a PoD season of on-chain quests",
    description:
      "One season, one countdown, thirteen quests. Coinflips, mines, citizens, monkes, barracks, trophies. 🐵",
    images: ["https://ronkeverse.com/ronkeverse-banner.png"],
  },
  alternates: {
    canonical: "https://ronkeverse.com/quests",
  },
};

export default function QuestsPage() {
  return (
    <main className="min-h-screen">
      <PageNavbar />
      <Suspense
        fallback={
          <div className="mono px-6 pt-40 text-center text-sm text-muted-2">Loading quests…</div>
        }
      >
        <QuestsApp />
      </Suspense>
    </main>
  );
}
