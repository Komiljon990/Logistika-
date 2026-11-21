import type { Metadata } from "next";
import Link from "next/link";
import { OfferText } from "@/components/OfferText";
import { Logo } from "@/components/Logo";
import { getProvider } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ommaviy oferta · ReysPro" };

/** CRM domenidagi oferta (obuna sahifasidan va ro'yxatdan o'tishdan havola). */
export default async function OfferPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="card grid w-full max-w-3xl gap-5 p-6 shadow-lg sm:p-8">
        <Link href="/login"><Logo name="ReysPro" /></Link>
        <OfferText provider={await getProvider()} />
      </div>
    </main>
  );
}
