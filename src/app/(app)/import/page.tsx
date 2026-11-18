import Link from "next/link";
import { getDict, getT } from "@/i18n";
import { requireUser } from "@/lib/session";
import { canEdit } from "@/lib/access";
import { IMPORT_KINDS, TEMPLATE, type ImportKind } from "@/lib/import-core";
import { ImportForm } from "./ImportForm";

/** Exceldan import (18.11.2026): mijozlar, transport, haydovchilar — bir martada. */
export default async function ImportPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const user = await requireUser();
  const [t, d] = [await getT(), await getDict()];
  const kinds = IMPORT_KINDS.filter((k) => canEdit(user, k));
  const sp = await searchParams;
  const kind: ImportKind | undefined = kinds.includes(sp.kind as ImportKind) ? (sp.kind as ImportKind) : kinds[0];
  if (!kind) return <p className="card p-5 text-sm text-muted">{t("common.viewOnly")}</p>;
  const cols = TEMPLATE[kind][0];
  return (
    <div className="grid max-w-3xl gap-6">
      <Link href={`/${kind}`} className="text-sm text-accent hover:underline">← {t(`imp.kind.${kind}`)}</Link>
      <h1 className="text-2xl font-bold">{t("imp.title")}</h1>
      <nav className="card flex gap-1 overflow-x-auto p-1.5 text-sm font-medium">
        {kinds.map((k) => (
          <Link key={k} href={`/import?kind=${k}`} aria-current={k === kind ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3.5 py-2 ${k === kind ? "bg-accent-soft font-semibold text-accent" : "text-ink hover:bg-ground"}`}>
            {t(`imp.kind.${k}`)}
          </Link>
        ))}
      </nav>
      <section className="card grid gap-3 p-5 text-sm">
        <h2 className="text-lg font-semibold">{t("imp.how")}</h2>
        <ol className="grid list-inside list-decimal gap-1">
          <li>{t("imp.step1")} <a href={`/import/template?kind=${kind}`} className="font-semibold text-accent hover:underline">{t("imp.template")}</a></li>
          <li>{t("imp.step2")} <span className="font-medium">{cols.join(", ")}</span>. {t(`imp.cols.${kind}`)}</li>
          <li>{t("imp.step3")}</li>
        </ol>
        <p className="text-xs text-muted">{t("imp.hint")}</p>
      </section>
      <section className="card p-5">
        <ImportForm d={d} kind={kind} back={`/${kind}`} />
      </section>
    </div>
  );
}
