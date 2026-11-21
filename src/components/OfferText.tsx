import { OFFER_VERSION, offerSections, providerLines } from "@/lib/offer";
import type { Provider } from "@/lib/settings";

/** Ommaviy oferta matni (sayt, ro'yxatdan o'tish va obuna sahifalarida bir xil). */
export function OfferText({ provider }: { provider: Provider }) {
  const lines = providerLines(provider);
  return (
    <article className="grid gap-4 text-sm leading-relaxed">
      <header className="grid gap-1 text-center">
        <h2 className="text-lg font-bold">ReysPro dasturidan foydalanish bo&apos;yicha OMMAVIY OFERTA</h2>
        <span className="text-xs text-muted">Tahrir: {OFFER_VERSION.split("-").reverse().join(".")}</span>
      </header>
      {offerSections(provider).map((s) => (
        <section key={s.title} className="grid gap-1.5">
          <h3 className="font-semibold">{s.title}</h3>
          {s.items.map((it, i) => <p key={i}>{it}</p>)}
        </section>
      ))}
      <section className="grid gap-1.5">
        <h3 className="font-semibold">10. Ijrochi rekvizitlari</h3>
        {lines.length ? (
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[140px_1fr]">
            {lines.map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="tabular-nums">{v}</dd></div>
            ))}
          </dl>
        ) : (
          <p className="text-muted">Rekvizitlar hali kiritilmagan.</p>
        )}
      </section>
    </article>
  );
}
