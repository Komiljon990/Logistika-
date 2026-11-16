import Link from "next/link";
import { db } from "@/lib/db";
import { discountFor, PLANS, PROMO_UNTIL, quote } from "@/lib/billing-core";
import { planLabel, som } from "@/lib/offer";
import { todayDate } from "@/lib/billing";
import { POST_CATEGORIES, SECTION } from "@/lib/posts";
import { crmUrl, siteBase } from "./site";
import { PostCard } from "./PostCard";

export const dynamic = "force-dynamic";

const FEATURES = [
  { title: "Reyslar va yuklar", text: "Har reys bo'yicha yuk qismlari, mijozlar, CMR raqamlari va holatlar: yuklandi, chegaradan chiqdi, tushirildi." },
  { title: "Transport va haydovchilar", text: "Tyagach, prisep va haydovchi juftliklari; band va bo'sh transport bir qarashda." },
  { title: "Hujjat muddatlari", text: "Sug'urta, texnik ko'rik, litsenziya, viza va pasport muddati yaqinlashsa — ogohlantirish." },
  { title: "Hisob-kitob", text: "Mijozlar qarzi, avanslar, turli valyutalardagi to'lovlar va Markaziy bank kursi." },
  { title: "Kassa", text: "Bank hisoblari, naqd kassa va kartalar; xarajatlar turkumlar bo'yicha, o'tkazmalar." },
  { title: "Xavfsiz va alohida", text: "Har tashkilot ma'lumoti alohida; xodimlar rollar bo'yicha; kirish — shaxsiy parol bilan." },
];

export default async function SiteHome() {
  const base = await siteBase();
  const today = todayDate();
  const promo = discountFor(today);
  const latest = await Promise.all(
    POST_CATEGORIES.map((c) => db.post.findMany({ where: { published: true, category: c }, orderBy: { publishedAt: "desc" }, take: 3 })),
  );
  return (
    <div className="grid gap-14">
      <section className="grid gap-5 py-6 text-center sm:py-12">
        <h1 className="mx-auto max-w-3xl text-3xl font-bold leading-tight sm:text-5xl">Yuk tashish kompaniyangiz — bitta tizimda</h1>
        <p className="mx-auto max-w-2xl text-base text-muted sm:text-lg">
          ReysPro: reyslar, transport, haydovchilar, hujjatlar va hisob-kitobni tartibli yuritish uchun dastur. Hamma narsa brauzerda, telefon va kompyuterda.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a href={crmUrl("/register")} className="btn px-6 py-3 text-base">Ro&apos;yxatdan o&apos;tish</a>
          <a href={crmUrl()} className="btn-ghost px-6 py-3 text-base">Demo bilan tanishish</a>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="card grid content-start gap-2 p-5">
            <h2 className="text-lg font-semibold">{f.title}</h2>
            <p className="text-sm text-muted">{f.text}</p>
          </div>
        ))}
      </section>

      <section id="narxlar" className="grid scroll-mt-24 gap-4">
        <div className="grid gap-1 text-center">
          <h2 className="text-2xl font-bold">Narxlar</h2>
          <p className="text-sm text-muted">Tarif faol tyagachlar soni bo&apos;yicha. Yillik obuna — 10 oy narxida 12 oy.</p>
          {promo > 0 && (
            <p className="mx-auto mt-2 rounded-full border border-accent bg-accent-soft px-4 py-1 text-sm font-semibold">
              {PROMO_UNTIL.split("-").reverse().join(".")} gacha barcha to&apos;lovlarga {promo}% chegirma
            </p>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => {
            const m = quote(p.id, "MONTHLY", today);
            const y = quote(p.id, "YEARLY", today);
            return (
              <div key={p.id} className="card grid content-start gap-3 p-6">
                <h3 className="text-lg font-semibold">{planLabel(p.id)}</h3>
                <div>
                  <div className="text-2xl font-bold tabular-nums">{som(m.amount)}<span className="text-sm font-normal text-muted"> / oy</span></div>
                  {promo > 0 && <s className="text-sm text-muted tabular-nums">{som(m.baseAmount)}</s>}
                </div>
                <div className="text-sm">
                  yoki <b className="tabular-nums">{som(y.amount)}</b> / yil
                  {promo > 0 && <s className="ml-2 text-muted tabular-nums">{som(y.baseAmount)}</s>}
                </div>
                <a href={crmUrl("/register")} className="btn mt-2 justify-self-start">Tanlash</a>
              </div>
            );
          })}
        </div>
        <p className="text-center text-xs text-muted">
          Obuna orasida transport ko&apos;paysa — qolgan davr uchun farq to&apos;lanadi. Batafsil: <Link href={`${base}/oferta`} className="text-accent hover:underline">ommaviy oferta</Link>.
        </p>
      </section>

      {POST_CATEGORIES.map((c, i) => latest[i].length > 0 && (
        <section key={c} className="grid gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <h2 className="text-2xl font-bold">{SECTION[c].title}</h2>
            <span className="flex-1" />
            <Link href={`${base}/${SECTION[c].path}`} className="text-sm text-accent hover:underline">Barchasi →</Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {latest[i].map((p) => <PostCard key={p.id} post={p} base={base} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
