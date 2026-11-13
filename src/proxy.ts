import { NextResponse, type NextRequest } from "next/server";

/**
 * O'zgartiruvchi so'rovlar faqat server action orqali (Next-Action sarlavhasi bilan) qabul qilinadi.
 *
 * Sabab (xavfsizlik auditi, 13.11.2026): Next.js 16.4.2 da JavaScript'siz yuborilgan, bog'langan (.bind) server action
 * formasi serverni javobsiz qoldirib, protsessorni 100% band qiladi — bitta so'rov bilan xizmatni to'xtatish mumkin edi.
 * Oddiy brauzer har doim Next-Action sarlavhasini yuboradi, shuning uchun foydalanuvchilarga ta'siri yo'q.
 */
export function proxy(request: NextRequest) {
  const m = request.method;
  if ((m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE") && !request.headers.get("next-action")) {
    return new NextResponse("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg).*)"],
};
