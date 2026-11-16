import type { PostCategory } from "@prisma/client";

export const POST_CATEGORIES: PostCategory[] = ["NEWS", "LAW", "INFO"];

/** Sayt bo'limlari (manzil → turkum). */
export const SECTION: Record<PostCategory, { path: string; title: string; hint: string }> = {
  NEWS: { path: "yangiliklar", title: "Yangiliklar", hint: "Logistika va yuk tashish sohasidagi yangiliklar" },
  LAW: { path: "qonunchilik", title: "Qonun va qarorlar", hint: "Yuk tashishga oid qonunlar, Prezident farmonlari va hukumat qarorlari" },
  INFO: { path: "foydali", title: "Foydali ma'lumotlar", hint: "Hujjatlar, xalqaro tashish qoidalari va amaliy maslahatlar" },
};

export function categoryByPath(path: string): PostCategory | null {
  return POST_CATEGORIES.find((c) => SECTION[c].path === path) ?? null;
}

const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "",
  э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

/** Sarlavhadan manzil: lotin harflari, raqam va chiziqcha. */
export function slugify(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[а-яёўқғҳ]/g, (c) => CYR[c] ?? "")
    .replace(/[ʻʼ'`‘’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return s || "maqola";
}

export type Block = { type: "h"; text: string } | { type: "p"; text: string } | { type: "ul"; items: string[] };

/**
 * Oddiy matn formati (Super Admin uchun): bo'sh qator — yangi xatboshi, "## " — sarlavha, "- " — ro'yxat.
 * HTML qabul qilinmaydi (xavfsiz).
 */
export function parseBody(body: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of body.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const lines = chunk.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
    if (!lines.length) continue;
    if (lines.every((l) => /^\s*[-•*]\s+/.test(l))) {
      blocks.push({ type: "ul", items: lines.map((l) => l.replace(/^\s*[-•*]\s+/, "")) });
    } else if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0])) {
      blocks.push({ type: "h", text: lines[0].replace(/^#{1,3}\s+/, "") });
    } else {
      blocks.push({ type: "p", text: lines.join("\n") });
    }
  }
  return blocks;
}
