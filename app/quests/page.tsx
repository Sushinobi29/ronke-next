import { Metadata } from "next";
import { Suspense } from "react";
import PageNavbar from "@/components/page-navbar";
import QuestsApp from "@/components/quests-app";
import QuestMusic from "@/components/quest-music";
import QuestsTeaser from "@/components/quests-teaser";
import { QUEST_SEASON_ONE, seasonAt, seasonByNumber } from "@/lib/quests/season";
import { readRewards } from "@/lib/quests/store";

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

/**
 * The board, or the teaser that stands in for it until the first season opens.
 *
 * The prizes are read here rather than through the board endpoint: a
 * countdown has no business waiting on a chain read, and the teaser needs
 * nothing else the board knows.
 */
export default async function QuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const now = Math.floor(Date.now() / 1000);
  const first = seasonByNumber(QUEST_SEASON_ONE);
  // ?board is the way past it, for anyone checking the real thing works.
  const teasing = now < first.startsAt && !(await searchParams).board;

  if (teasing) {
    const running = seasonAt(now);
    const [current, next] = await Promise.all([
      readRewards(running.number),
      readRewards(running.number + 1),
    ]);
    const pool = current?.config.published
      ? { config: current.config, season: running }
      : next?.config.published
        ? { config: next.config, season: seasonByNumber(running.number + 1) }
        : null;

    return (
      <main className="min-h-screen">
        <PageNavbar />
        <QuestsTeaser
          startsAt={first.startsAt}
          seasonName={first.name}
          items={pool?.config.items ?? []}
        />
        <QuestMusic />
      </main>
    );
  }

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
