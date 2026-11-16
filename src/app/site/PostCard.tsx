import Link from "next/link";
import type { Post } from "@prisma/client";
import { formatDate } from "@/lib/dates";
import { SECTION } from "@/lib/posts";

export function PostCard({ post, base, showSection }: { post: Pick<Post, "slug" | "title" | "summary" | "category" | "publishedAt">; base: string; showSection?: boolean }) {
  const s = SECTION[post.category];
  return (
    <Link href={`${base}/${s.path}/${post.slug}`} className="card grid content-start gap-2 p-5 hover:border-accent">
      <span className="text-xs text-muted">{showSection ? `${s.title} · ` : ""}{formatDate(post.publishedAt)}</span>
      <span className="text-base font-semibold leading-snug">{post.title}</span>
      {post.summary && <span className="line-clamp-3 text-sm text-muted">{post.summary}</span>}
    </Link>
  );
}
