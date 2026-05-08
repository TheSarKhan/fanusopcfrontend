import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "*.localhost", "fanus.lvh.me", "*.lvh.me"],
  images: {
    remotePatterns: [
      // Backend uploads (any host — covers prod + dev + staging)
      { protocol: "http",  hostname: "**" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
