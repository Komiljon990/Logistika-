import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { categoryByPath, parseBody, SECTION } from "@/lib/posts";
import { crmUrl, siteBase } from "../../site";

export const dynamic = "force-dynamic";

const load = cache(async (section: string, slug: string) => {
  const c = categoryByPath(section);
  if (!c) return null;
  return db.post.findFirst({ where: { slug, category: c, published: true } });
});

export async function generateMetadata({ params }: { params: Promise<{ section: string; slug: string }> }): Promise<Metadata> {
  const { section, slug } = await params;
  const p = await load(section, slug);
  return p ? { title: p.title, description: p.summary ?? undefined } : {};
}

/** Matndagi havolalar bosiladigan bo'ladi (faqat http/https). */
function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])/g);
  return <>{parts.map((s, i) => (i % 2 ? <a key={i} href={s} target="_blank" rel="noopener nofollow" className="break-all text-accent hover:underline">{s}</a> : s))}</>;
}

export default async function PostPage({ params }: { params: Promise<{ section: string; slug: string }> }) {
  const { section, slug } = await params;
  const post = await load(section, slug);
  if (!post) notFound();
  const base = await siteBase();
  const s = SECTION[post.category];
  return (
    <article className="mx-auto grid max-w-3xl gap-5">
      <Link href={`${base}/${s.path}`} className="text-sm text-accent hover:underline">← {s.title}</Link>
      <header className="grid gap-2">
        <h1 className="text-3xl font-bold leading-tight">{post.title}</h1>
        <span className="text-sm text-muted">{formatDate(post.publishedAt)}</span>
        {post.summary && <p className="text-lg text-muted">{post.summary}</p>}
      </header>
      <div className="grid gap-4 leading-relaxed">
        {parseBody(post.body).map((b, i) =>
          b.type === "h" ? <h2 key={i} className="mt-2 text-xl font-semibold">{b.text}</h2>
          : b.type === "ul" ? <ul key={i} className="grid list-disc gap-1 pl-6">{b.items.map((it, j) => <li key={j}><Linkify text={it} /></li>)}</ul>
          : <p key={i} className="whitespace-pre-line"><Linkify text={b.text} /></p>,
        )}
      </div>
      {post.sourceUrl && (
        <p className="text-sm text-muted">
          Manba: <a href={post.sourceUrl} target="_blank" rel="noopener nofollow" className="text-accent hover:underline">{post.sourceName || post.sourceUrl}</a>
        </p>
      )}
      <aside className="card mt-4 grid gap-2 p-5 sm:flex sm:items-center sm:gap-4">
        <p className="flex-1 text-sm">Reyslar, transport, hujjat muddatlari va hisob-kitobni ReysPro&apos;da yuriting.</p>
        <a href={crmUrl("/register")} className="btn">Ro&apos;yxatdan o&apos;tish</a>
      </aside>
    </article>
  );
}
