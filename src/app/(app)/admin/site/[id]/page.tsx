import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { POST_CATEGORIES, SECTION } from "@/lib/posts";
import { PostForm } from "../PostForm";
import { deletePost, savePost } from "../actions";

export default async function EditPostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requirePermission("org.manage");
  const { id } = await params;
  const { saved } = await searchParams;
  const [t, d] = [await getT(), await getDict()];
  const p = await db.post.findUnique({ where: { id } });
  if (!p) notFound();
  return (
    <div className="grid gap-6">
      <Link href="/admin/site" className="text-sm text-accent hover:underline">← {t("site.admin")}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{p.title}</h1>
        <span className="flex-1" />
        {p.published && <Link href={`/site/${SECTION[p.category].path}/${p.slug}`} target="_blank" className="btn-ghost">{t("site.open")} ↗</Link>}
      </div>
      {saved && <p className="card border-accent p-4 text-sm">{t("common.saved")}</p>}
      <section className="card p-5">
        <PostForm
          d={d}
          action={savePost.bind(null, p.id)}
          categories={POST_CATEGORIES.map((c) => ({ id: c, label: SECTION[c].title }))}
          post={{ title: p.title, slug: p.slug, category: p.category, summary: p.summary ?? "", body: p.body, sourceName: p.sourceName ?? "", sourceUrl: p.sourceUrl ?? "", published: p.published }}
        />
      </section>
      <form action={deletePost.bind(null, p.id)}><button className="btn-danger">{t("common.delete")}</button></form>
    </div>
  );
}
