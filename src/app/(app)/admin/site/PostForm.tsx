"use client";

import { useActionState } from "react";
import type { Dict } from "@/i18n";
import type { FormState } from "@/lib/form";

type Post = { title: string; slug: string; category: string; summary: string; body: string; sourceName: string; sourceUrl: string; published: boolean };

export function PostForm({ d, action, post, categories }: {
  d: Dict;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  post?: Post;
  categories: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const v = (state.values ?? post ?? {}) as Partial<Record<keyof Post, string | boolean>>;
  return (
    <form key={JSON.stringify(state.values ?? null)} action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="p-title" className="label">{d["site.f.title"]} *</label>
        <input id="p-title" name="title" required maxLength={300} defaultValue={v.title as string} className="input" />
      </div>
      <div>
        <label htmlFor="p-cat" className="label">{d["site.f.category"]} *</label>
        <select id="p-cat" name="category" defaultValue={(v.category as string) ?? "NEWS"} className="input">
          {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="p-slug" className="label">{d["site.f.slug"]}</label>
        <input id="p-slug" name="slug" maxLength={80} defaultValue={v.slug as string} placeholder={d["site.f.slugHint"]} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="p-sum" className="label">{d["site.f.summary"]}</label>
        <textarea id="p-sum" name="summary" rows={2} maxLength={600} defaultValue={v.summary as string} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="p-body" className="label">{d["site.f.body"]} *</label>
        <textarea id="p-body" name="body" required rows={16} defaultValue={v.body as string} className="input font-mono text-sm" />
        <p className="mt-1 text-xs text-muted">{d["site.f.bodyHint"]}</p>
      </div>
      <div>
        <label htmlFor="p-sname" className="label">{d["site.f.sourceName"]}</label>
        <input id="p-sname" name="sourceName" maxLength={200} defaultValue={v.sourceName as string} placeholder="lex.uz" className="input" />
      </div>
      <div>
        <label htmlFor="p-surl" className="label">{d["site.f.sourceUrl"]}</label>
        <input id="p-surl" name="sourceUrl" type="url" maxLength={500} defaultValue={v.sourceUrl as string} placeholder="https://lex.uz/docs/..." className="input" />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="published" defaultChecked={v.published === true || v.published === "on"} /> {d["site.f.published"]}
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className="btn" disabled={pending}>{d["common.save"]}</button>
        {state.error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{d[state.error]}</p>}
        {state.ok && <p className="text-sm text-accent">{d["common.saved"]}</p>}
      </div>
    </form>
  );
}
