import { Metadata } from "next";
import PageNavbar from "@/components/page-navbar";
import ScoreEmbedTabs from "@/components/score-embed-tabs";

export const metadata: Metadata = {
  title: "Ronke Score | Ronkeverse - Check your wallet's monke commitment",
  description:
    "Look up any wallet's Ronke Score, browse the leaderboard, holder analytics, NFT rarity and resources. One number for holdings, holding time, diamond hands and collector bonuses across $RONKE, $RONKESTR and Ronkeverse NFTs.",
  alternates: {
    canonical: "https://ronkeverse.com/score",
  },
  openGraph: {
    title: "Ronke Score - how strong are your hands?",
    description:
      "One number for your monke commitment, computed from on-chain history alone. Search any wallet, earn badges, climb the leaderboard.",
    url: "https://ronkeverse.com/score",
    siteName: "Ronkeverse",
  },
};

export default function ScorePage() {
  return (
    <main className="h-[100dvh] overflow-hidden">
      <PageNavbar />
      <ScoreEmbedTabs />
    </main>
  );
}
