import { setLanguage } from "@/app/actions";
import { getLocale, getT, LOCALES } from "@/i18n";

const KEY = { uz: "lang.uz", "uz-Cyrl": "lang.uzCyrl", ru: "lang.ru" } as const;

export async function LangSwitch() {
  const [locale, t] = [await getLocale(), await getT()];
  return (
    <form action={setLanguage} className="flex overflow-hidden rounded-md border border-line text-xs">
      {LOCALES.map((l) => (
        <button
          key={l}
          name="lang"
          value={l}
          className={l === locale ? "bg-accent px-2.5 py-1 text-white" : "px-2.5 py-1 hover:bg-accent-soft"}
        >
          {t(KEY[l])}
        </button>
      ))}
    </form>
  );
}
