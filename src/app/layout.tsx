import type { Metadata, Viewport } from "next";
import { getLocale } from "@/i18n";
import "./globals.css";

export const metadata: Metadata = { title: "Logistika" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="min-h-dvh font-sans text-[15px] antialiased">{children}</body>
    </html>
  );
}
