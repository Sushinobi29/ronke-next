import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "amaranth-casual-coral-990.mypinata.cloud",
      },
      {
        protocol: "https",
        hostname: "cdn.roninchain.com",
      },
    ],
  },
};

export default nextConfig;
