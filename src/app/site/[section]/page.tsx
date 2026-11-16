import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { categoryByPath, SECTION } from "@/lib/posts";
import { siteBase } from "../site";
import { PostCard } from "../PostCard";

export const dynamic = "force-dynamic";
const PAGE = 24;

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const c = categoryByPath((await params).section);
  return c ? { title: SECTION[c].title, description: SECTION[c].hint } : {};
}

export default async function SectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ p?: string }> }) {
  const { section } = await params;
  const c = categoryByPath(section);
  if (!c) notFound();
  const page = Math.max(1, Number((await searchParams).p) || 1);
  const base = await siteBase();
  const [posts, total] = await Promise.all([
    db.post.findMany({ where: { published: true, category: c }, orderBy: { publishedAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    db.post.count({ where: { published: true, category: c } }),
  ]);
  const pages = Math.ceil(total / PAGE);
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-3xl font-bold">{SECTION[c].title}</h1>
        <p className="text-muted">{SECTION[c].hint}</p>
      </div>
      {posts.length ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => <PostCard key={p.id} post={p} base={base} />)}
        </div>
      ) : (
        <p className="card p-6 text-muted">Tez orada shu bo&apos;limga materiallar qo&apos;shiladi.</p>
      )}
      {pages > 1 && (
        <nav className="flex flex-wrap gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <a key={n} href={`${base}/${section}?p=${n}`} className={n === page ? "btn" : "btn-ghost"}>{n}</a>
          ))}
        </nav>
      )}
    </div>
  );
}
