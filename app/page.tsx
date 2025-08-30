import { Metadata } from "next";
import HeroBanner from "@/components/hero-banner";
import NextSection from "@/components/next-section";
import TokensSection from "@/components/tokens-section";
import RRFSection from "@/components/rrf-section";
import CasinoSection from "@/components/casino-section";
import StakingSection from "@/components/staking-section";
import BurnonomicsSection from "@/components/burnonomics-section";
import SocialLinks from "@/components/social-links";

export const metadata: Metadata = {
  title: "Home | Ronkeverse - Welcome to Ronke the Monke's Blue Monke Empire",
  description: "Discover the Ronkeverse - home of Ronke the Monke, the legendary Blue Monke on Ronin Network. Explore $RONKE and $RICE tokens, NFT staking, Ronke Casino, and join the ultimate crypto gaming ecosystem where beauty standards are redefined.",
  keywords: [
    "Ronkeverse home",
    "ronke the monke official",
    "blue monke ronin network", 
    "ronke on ron homepage",
    "$RONKE token buy",
    "$RICE staking rewards",
    "ronke casino games",
    "NFT staking platform",
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
            "description": "Welcome to the Ronkeverse! Discover Ronke the Monke, the legendary Blue Monke on Ronin Network. Explore gaming, staking, and DeFi in our comprehensive ecosystem.",
            "url": "https://ronkeverse.com",
            "mainEntity": {
              "@type": "Organization",
              "name": "Ronkeverse",
              "alternateName": ["Ronke the Monke", "Blue Monke on Ronin", "Ronke on Ron"],
              "description": "The ultimate Blue Monke gaming and DeFi ecosystem on Ronin Network featuring $RONKE token, $RICE rewards, NFT staking, and Ronke Casino.",
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
                "NFT Staking", 
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
                  "name": "RICE Token",
                  "description": "Reward token for staking and gaming activities in the Ronkeverse"
                },
                {
                  "@type": "Offer",
                  "name": "NFT Staking",
                  "description": "Stake your NFTs to earn RICE tokens and participate in the ecosystem"
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

      <main className="min-h-screen">
        {/* Main content with semantic HTML structure for better SEO */}
        <section aria-label="Hero Banner - Welcome to Ronkeverse">
          <HeroBanner />
        </section>
        
        <section id="about" aria-label="About Ronkeverse and Ronke the Monke">
          <NextSection />
        </section>
        
        <section id="charts" aria-label="RONKE and RICE Token Information">
          <TokensSection />
        </section>
        
        <section id="rrf" aria-label="RRF - Ronke Revenue Framework">
          <RRFSection />
        </section>
        
        <section id="ronke-casino" aria-label="Ronke Casino - Gaming Platform">
          <CasinoSection />
        </section>
        
        <section id="ronke-staking" aria-label="NFT Staking Platform">
          <StakingSection />
        </section>
        
        <section id="burnonomics" aria-label="Tokenomics and Burn Mechanics">
          <BurnonomicsSection />
        </section>
        
        <section aria-label="Social Media Links and Community">
          <SocialLinks />
        </section>
      </main>
    </>
  );
}