import type { Metadata } from "next";
import { OfferText } from "@/components/OfferText";
import { getProvider } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ommaviy oferta" };

export default async function SiteOfferPage() {
  return <div className="card mx-auto max-w-3xl p-6 sm:p-8"><OfferText provider={await getProvider()} /></div>;
}
