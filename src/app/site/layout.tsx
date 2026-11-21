import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getProvider } from "@/lib/settings";
import { SECTION } from "@/lib/posts";
import { crmUrl, siteBase } from "./site";

export const metadata: Metadata = {
  title: { default: "ReysPro — logistika boshqaruv tizimi", template: "%s · ReysPro" },
  description: "Yuk tashish kompaniyalari uchun dastur: reyslar, transport, haydovchilar, hujjatlar, hisob-kitob. Logistika yangiliklari, qonun va qarorlar.",
};

/** reyspro.uz ommaviy sayti: kirish talab qilinmaydi. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const base = await siteBase();
  const p = await getProvider();
  const nav = [
    { href: `${base}/${SECTION.NEWS.path}`, label: SECTION.NEWS.title },
    { href: `${base}/${SECTION.LAW.path}`, label: SECTION.LAW.title },
    { href: `${base}/${SECTION.INFO.path}`, label: SECTION.INFO.title },
    { href: `${base || "/"}#narxlar`, label: "Narxlar" },
  ];
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr_auto]">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href={base || "/site"} aria-label="ReysPro"><Logo name="ReysPro" /></Link>
          <nav className="order-3 flex w-full flex-wrap gap-x-5 gap-y-1 text-sm md:order-none md:w-auto">
            {nav.map((n) => <Link key={n.href} href={n.href} className="text-muted hover:text-accent">{n.label}</Link>)}
          </nav>
          <span className="flex-1" />
          <a href={crmUrl("/register")} className="btn-ghost hidden sm:inline-flex">Ro&apos;yxatdan o&apos;tish</a>
          <a href={crmUrl()} className="btn">Kirish</a>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
      <footer className="border-t border-line bg-paper">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-3">
          <div className="grid content-start gap-2">
            <Logo name="ReysPro" />
            <p className="text-muted">Yuk tashish kompaniyalari uchun boshqaruv tizimi.</p>
          </div>
          <div className="grid content-start gap-1">
            <span className="font-semibold">Bo&apos;limlar</span>
            {nav.slice(0, 3).map((n) => <Link key={n.href} href={n.href} className="text-muted hover:text-accent">{n.label}</Link>)}
            <Link href={`${base}/oferta`} className="text-muted hover:text-accent">Ommaviy oferta</Link>
          </div>
          <div className="grid content-start gap-1">
            <span className="font-semibold">Aloqa</span>
            {p.phone && <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} className="text-muted hover:text-accent">{p.phone}</a>}
            {p.email && <a href={`mailto:${p.email}`} className="text-muted hover:text-accent">{p.email}</a>}
            {p.address && <span className="text-muted">{p.address}</span>}
            {p.name && <span className="text-muted">{p.name}</span>}
          </div>
        </div>
        <p className="pb-6 text-center text-xs text-muted">© {new Date().getFullYear()} ReysPro</p>
      </footer>
    </div>
  );
}
