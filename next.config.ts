import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Hujjat fayllari (5 MB gacha) server action orqali yuklanadi.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
