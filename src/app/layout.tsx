import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { getLocale } from "@/i18n";
import { Inter } from "next/font/google";
import { Background } from "@/components/Background";
import "./globals.css";

// Shrift build paytida yuklab olinadi va serverning o'zidan beriladi (tashqi so'rov yo'q). Lotin va kirill harflari bir xil.
const inter = Inter({ subsets: ["latin", "latin-ext", "cyrillic"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = { title: "ReysPro", description: "Logistika boshqaruv tizimi" };
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eaeeec" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1210" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  // Mavzu serverda qo'yiladi — sahifa ochilganda yorug'/qorong'i miltillab o'tmaydi.
  const theme = (await cookies()).get("theme")?.value;
  return (
    <html lang={locale} className={inter.variable} data-theme={theme === "light" || theme === "dark" ? theme : undefined}>
      <body className="min-h-dvh font-sans text-[15px] antialiased">
        <Background />
        {children}
      </body>
    </html>
  );
}
