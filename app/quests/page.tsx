import { Metadata } from "next";
import { Suspense } from "react";
import PageNavbar from "@/components/page-navbar";
import QuestsApp from "@/components/quests-app";
import QuestMusic from "@/components/quest-music";

export const metadata: Metadata = {
  title: "Ronke Quest | Ronkeverse - five new quests every day",
  description:
    "Five quests a day, the same five for everyone, drawn fresh at midnight. Flip a coin, clear a Mines field, spin the Fortune machine, back a vote, adopt a monke - progress read live off Ronin. Clear all five for a bonus. No sign-up, no signature, no transaction.",
  keywords: [
    "ronke quests",
    "ronkeverse quests",
    "ronke points",
    "daily quests ronin",
    "ronke fortune spin",
    "ronin quest leaderboard",
    "ronke casino mines leaderboard",
    "ronke vote citizens",
    "age of ronke barracks",
    "fortune spin ronin",
  ],
  openGraph: {
    title: "Ronke Quest - five new quests every day",
    description:
      "A fresh set of five at midnight, the same five for everyone. Play them anywhere in the Ronkeverse; the chain does the rest. Clear all five for a bonus.",
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
    title: "Ronke Quest - five new quests every day",
    description:
      "Five quests. New set every midnight. Flips, mines, spins, votes, monkes. Clear all five for a bonus. 🐵",
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
      <QuestMusic />
    </main>
  );
}
