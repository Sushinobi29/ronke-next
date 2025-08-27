import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Navbar from "@/components/navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ronkeverse - Ronke the Monke | Blue Monke on Ronin Network",
  description: "Welcome to the Ronkeverse! Join Ronke the Monke, the legendary Blue Monke on Ronin Network. Explore $RONKE token, $RICE rewards, NFT staking, and the ultimate gaming experience in the Ronkeverse ecosystem.",
  keywords: [
    "Ronkeverse",
    "ronke the monke", 
    "ronke on ron",
    "blue monke",
    "ronin network",
    "RONKE token",
    "RICE token",
    "NFT staking",
    "ronke casino",
    "ronke gaming",
    "defi",
    "blockchain gaming",
    "crypto monke"
  ],
  authors: [{ name: "Ronkeverse Team" }],
  creator: "Ronkeverse",
  publisher: "Ronkeverse",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://ronkeverse.com",
    siteName: "Ronkeverse",
    title: "Ronkeverse - Ronke the Monke | Blue Monke on Ronin Network",
    description: "Welcome to the Ronkeverse! Join Ronke the Monke, the legendary Blue Monke on Ronin Network. Beauty standards redefined where luxury meets Blue Monke.",
    images: [
      {
        url: "/ronkeverse-banner.png",
        width: 1200,
        height: 630,
        alt: "Ronkeverse - Ronke the Monke Blue Monke on Ronin Network",
        type: "image/png",
      },
      {
        url: "/ronkebase.png", 
        width: 400,
        height: 400,
        alt: "Ronke the Monke - Blue Monke Character",
        type: "image/png",
      }
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@RonkeOnRon",
    creator: "@RonkeOnRon",
    title: "Ronkeverse - Ronke the Monke | Blue Monke on Ronin Network",
    description: "Welcome to the Ronkeverse! Join Ronke the Monke, the legendary Blue Monke on Ronin Network. Beauty standards redefined.",
    images: ["/ronkeverse-banner.png"],
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  verification: {
    google: "your-google-verification-code-here", // Replace with actual verification code
  },
  alternates: {
    canonical: "https://ronkeverse.com",
  },
  category: "Technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Structured Data - JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "Ronkeverse",
              "alternateName": ["Ronke the Monke", "Blue Monke on Ronin"],
              "url": "https://ronkeverse.com",
              "description": "Welcome to the Ronkeverse! Join Ronke the Monke, the legendary Blue Monke on Ronin Network. Explore gaming, staking, and DeFi in the ultimate crypto ecosystem.",
              "publisher": {
                "@type": "Organization",
                "name": "Ronkeverse",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://ronkeverse.com/ronke-logo.webp"
                },
                "sameAs": [
                  "https://x.com/RonkeOnRon",
                  "https://www.youtube.com/@RonkeBlueMonke",
                  "https://www.tiktok.com/@ronkeonron",
                  "https://www.instagram.com/ronkeonron",
                  "https://www.facebook.com/RonkeonRonin"
                ]
              },
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://ronkeverse.com/?q={search_term_string}",
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
        
        {/* Additional Meta Tags */}
        <meta name="theme-color" content="#27B9FC" />
        <meta name="msapplication-TileColor" content="#27B9FC" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        
        {/* Preconnect to external domains */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Favicon and Icons */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable}`}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <Navbar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
