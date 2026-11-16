import { NextResponse, type NextRequest } from "next/server";

/**
 * O'zgartiruvchi so'rovlar faqat server action orqali (Next-Action sarlavhasi bilan) qabul qilinadi.
 *
 * Sabab (xavfsizlik auditi, 13.11.2026): Next.js 16.4.2 da JavaScript'siz yuborilgan, bog'langan (.bind) server action
 * formasi serverni javobsiz qoldirib, protsessorni 100% band qiladi — bitta so'rov bilan xizmatni to'xtatish mumkin edi.
 * Oddiy brauzer har doim Next-Action sarlavhasini yuboradi, shuning uchun foydalanuvchilarga ta'siri yo'q.
 *
 * Sayt (17.11.2026): reyspro.uz (SITE_HOSTS) ga kelgan so'rovlar /site bo'limiga yo'naltiriladi — dastur sahifalari
 * u domenda ochilmaydi. crm.reyspro.uz (va lokal tarmoq manzili) — dasturning o'zi.
 */
const SITE_HOSTS = (process.env.SITE_HOSTS || "reyspro.uz,www.reyspro.uz").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);

export function proxy(request: NextRequest) {
  const m = request.method;
  if ((m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE") && !request.headers.get("next-action")) {
    return new NextResponse("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").split(":")[0].toLowerCase();
  if (SITE_HOSTS.includes(host)) {
    const url = request.nextUrl.clone();
    const path = url.pathname;
    if (!path.startsWith("/_next/")) {
      url.pathname = path.startsWith("/site") ? path : `/site${path === "/" ? "" : path}`;
      const headers = new Headers(request.headers);
      headers.set("x-site-root", "1");
      return NextResponse.rewrite(url, { request: { headers } });
    }
  }
  const headers = new Headers(request.headers);
  headers.delete("x-site-root");
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg).*)"],
};
