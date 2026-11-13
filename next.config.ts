import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Hujjat fayllari (10 MB gacha) server action orqali yuklanadi; forma maydonlari uchun ozgina zaxira.
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
};

export default nextConfig;
