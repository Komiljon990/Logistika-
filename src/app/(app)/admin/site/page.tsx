import Link from "next/link";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { formatDate } from "@/lib/dates";
import { POST_CATEGORIES, SECTION } from "@/lib/posts";
import { PostForm } from "./PostForm";
import { savePost } from "./actions";

/** Super Admin: reyspro.uz sayti maqolalari (yangiliklar, qonun va qarorlar, foydali ma'lumotlar). */
export default async function SiteAdminPage() {
  await requirePermission("org.manage");
  const [t, d] = [await getT(), await getDict()];
  const posts = await db.post.findMany({ orderBy: [{ published: "asc" }, { updatedAt: "desc" }], take: 300 });
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t("site.admin")}</h1>
        <span className="flex-1" />
        <Link href="/site" target="_blank" className="btn-ghost">{t("site.open")} ↗</Link>
      </div>
      <p className="text-sm text-muted">{t("site.adminHint")}</p>
      <div className="card divide-y divide-line">
        {posts.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <span className="min-w-0 flex-1">
              <Link href={`/admin/site/${p.id}`} className="font-semibold text-accent hover:underline">{p.title}</Link>
              <span className="block text-muted">{SECTION[p.category].title} · {p.published ? `${t("site.published")} ${formatDate(p.publishedAt)}` : t("site.draft")}</span>
            </span>
          </div>
        ))}
        {posts.length === 0 && <p className="px-4 py-6 text-sm text-muted">{t("common.none")}</p>}
      </div>
      <section className="card grid gap-4 p-5">
        <h2 className="text-lg font-semibold">{t("site.new")}</h2>
        <PostForm d={d} action={savePost.bind(null, null)} categories={POST_CATEGORIES.map((c) => ({ id: c, label: SECTION[c].title }))} />
      </section>
    </div>
  );
}
