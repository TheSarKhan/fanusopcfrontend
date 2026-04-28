import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "*.localhost", "fanus.lvh.me", "*.lvh.me"],
};

export default nextConfig;
