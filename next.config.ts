import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

/** Xavfsizlik sarlavhalari: boshqa sayt ichiga joylash (clickjacking), tashqi skript va ulanishlar taqiqlanadi. */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js sahifa ichiga kichik skriptlar qo'yadi; dev rejimida eval ham kerak.
      `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Ishlab turgan serverga tegmasdan yangi versiyani alohida papkada yig'ib sinash uchun (NEXT_DIST_DIR=.next-check).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Hujjat fayllari (10 MB gacha) server action orqali yuklanadi; forma maydonlari uchun ozgina zaxira.
  // Proxy ham so'rov tanasini o'qiydi va sukut bo'yicha 10 MB dan keyin kesadi — 10 MB li fayl + forma maydonlari sig'ishi uchun teng chegara.
  experimental: { agentUpgrade: "security", serverActions: { bodySizeLimit: "11mb" }, proxyClientMaxBodySize: "11mb" },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
