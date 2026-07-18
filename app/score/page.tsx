import { Metadata } from "next";
import PageNavbar from "@/components/page-navbar";

const ANALYTICS_URL = "https://ronke-analytics.vercel.app";

export const metadata: Metadata = {
  title: "Ronke Score | Ronkeverse - Check your wallet's monke commitment",
  description:
    "Look up any wallet's Ronke Score: one number for holdings, holding time, diamond hands and collector bonuses across $RONKE, $RONKESTR and Ronkeverse NFTs. Live from the Ronke Analytics dashboard.",
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
    <main className="h-[100dvh]">
      <PageNavbar />
      {/* Full-bleed embed of the live Ronke Analytics dashboard. */}
      <iframe
        src={ANALYTICS_URL}
        title="Ronke Analytics - Ronke Score"
        className="block h-[calc(100dvh-4rem)] w-full border-0 pt-0"
        style={{ marginTop: "4rem" }}
        allow="clipboard-write"
      />
    </main>
  );
}
