import { Metadata } from "next";
import ScrollCinema from "@/components/scroll-cinema";
import TokensSection from "@/components/tokens-section";
import RoninStrategySection from "@/components/ronin-strategy-section";
import BurnonomicsSection from "@/components/burnonomics-section";
import ScoreSection from "@/components/score-section";
import PlaySection from "@/components/play-section";
import SocialLinks from "@/components/social-links";

export const metadata: Metadata = {
  title: "Home | Ronkeverse - Welcome to Ronke the Monke's Blue Monke Empire",
  description: "Discover the Ronkeverse - home of Ronke the Monke, the legendary Blue Monke on Ronin Network. Explore $RONKE and $RONKESTR, live burn stats, the Ronke Score, Ronke Casino, and the ultimate crypto gaming ecosystem.",
  keywords: [
    "Ronkeverse home",
    "ronke the monke official",
    "blue monke ronin network",
    "ronke on ron homepage",
    "$RONKE token buy",
    "$RONKESTR NFT strategy",
    "ronke casino games",
    "ronke burn tracker",
    "defi gaming ecosystem"
  ],
  openGraph: {
    title: "Ronkeverse - Home of Ronke the Monke | Blue Monke on Ronin",
    description: "Welcome to the official Ronkeverse! Join Ronke the Monke in the ultimate Blue Monke gaming and DeFi ecosystem on Ronin Network.",
    url: "https://ronkeverse.com",
    siteName: "Ronkeverse",
    images: [
      {
        url: "https://ronkeverse.com/ronkeverse-banner.png",
        width: 1200,
        height: 630,
        alt: "Ronkeverse Homepage - Ronke the Monke Blue Monke Empire",
      },
      {
        url: "https://ronkeverse.com/ronke-logo.webp",
        width: 512,
        height: 512,
        alt: "Ronke the Monke Logo",
      }
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ronkeverse - Home of Ronke the Monke | Blue Monke on Ronin",
    description: "Welcome to the official Ronkeverse! Beauty standards redefined where luxury meets Blue Monke. 🐵✨",
    images: ["https://ronkeverse.com/ronkeverse-banner.png"],
  },
  alternates: {
    canonical: "https://ronkeverse.com",
  }
};

export default function Home() {
  return (
    <>
      {/* Page-specific structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "Ronkeverse - Home of Ronke the Monke",
            "description": "Welcome to the Ronkeverse! Discover Ronke the Monke, the legendary Blue Monke on Ronin Network. Explore gaming, burns, and DeFi in our comprehensive ecosystem.",
            "url": "https://ronkeverse.com",
            "mainEntity": {
              "@type": "Organization",
              "name": "Ronkeverse",
              "alternateName": ["Ronke the Monke", "Blue Monke on Ronin", "Ronke on Ron"],
              "description": "The ultimate Blue Monke gaming and DeFi ecosystem on Ronin Network featuring the $RONKE token, the $RONKESTR NFT strategy, and Ronke Casino.",
              "url": "https://ronkeverse.com",
              "logo": "https://ronkeverse.com/ronke-logo.webp",
              "image": "https://ronkeverse.com/ronkebase.png",
              "sameAs": [
                "https://x.com/RonkeOnRon",
                "https://www.youtube.com/@RonkeBlueMonke",
                "https://www.tiktok.com/@ronkeonron",
                "https://www.instagram.com/ronkeonron",
                "https://www.facebook.com/RonkeonRonin",
                "https://discord.com/invite/roninnetwork"
              ],
              "foundingDate": "2024",
              "knowsAbout": [
                "Blockchain Gaming",
                "DeFi",
                "Ronin Network",
                "Cryptocurrency",
                "Gaming Tokens"
              ],
              "makesOffer": [
                {
                  "@type": "Offer",
                  "name": "RONKE Token",
                  "description": "The native utility token of the Ronkeverse ecosystem"
                },
                {
                  "@type": "Offer",
                  "name": "RONKESTR Token",
                  "description": "The NFT strategy token whose trading fees buy Ronkeverse NFTs and burn supply"
                },
                {
                  "@type": "Offer",
                  "name": "Ronke Casino",
                  "description": "Gaming platform featuring various casino games and crypto rewards"
                }
              ]
            },
            "breadcrumb": {
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "Home",
                  "item": "https://ronkeverse.com"
                }
              ]
            }
          })
        }}
      />

      <main id="top" className="min-h-screen">
        {/* The film is the hero: renders its own <section id="film"> with
            capability tiers and the RONKEVERSE title as the opening overlay. */}
        <ScrollCinema />

        <section id="score" aria-label="The Ronke Score and badges">
          <ScoreSection />
        </section>

        <section id="charts" aria-label="Tokens and live charts">
          <TokensSection />
        </section>

        <section
          id="ronin-strategy"
          aria-label="RONKESTR - the NFT perpetual machine"
        >
          <RoninStrategySection />
        </section>

        <section id="burnonomics" aria-label="Live burn statistics">
          <BurnonomicsSection />
        </section>

        <section id="ronke-casino" aria-label="Games, farming and voting">
          <PlaySection />
        </section>

        <SocialLinks />
      </main>
    </>
  );
}