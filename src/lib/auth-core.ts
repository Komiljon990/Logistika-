/**
 * Kirish tizimining sof (bazasiz) qoidalari — 16.11.2026 talablari:
 * - shaxs e-mail yoki telefon + parol bilan kiradi; parolni o'zi e-mailga kelgan kod orqali o'rnatadi/tiklaydi;
 * - Super Admin va rahbar boshqa birovning parolini tiklay olmaydi, uning hisobiga kira olmaydi;
 * - foydalanuvchi o'zi vaqtincha parol yaratib, yordamchiga beradi (ko'rish yoki tahrirlash), keyin to'xtatadi.
 */
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { Role } from "@prisma/client";
import { normalizePhone } from "./phone";

export const CODE_TTL_MINUTES = 15;
export const MAX_CODE_ATTEMPTS = 5;
export const CODE_RESEND_SECONDS = 60;
export const MAX_CODES_PER_HOUR = 5;

/** Vaqtincha parol muddatlari (soat). */
export const GRANT_HOURS = [1, 8, 24, 72] as const;
export type GrantHours = (typeof GRANT_HOURS)[number];

/** Rahbar qo'shadigan va boshqaradigan rollar. Rahbarni faqat Super Admin qo'shadi. */
export const MEMBER_ROLES = ["MANAGER", "ACCOUNTANT", "DEPUTY", "SPECIALIST"] as const satisfies readonly Role[];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(input: string): string | null {
  const v = input.trim().toLowerCase();
  if (!v || v.length > 254 || !EMAIL_RE.test(v)) return null;
  return v;
}

/** Login maydoni: e-mail yoki telefon. */
export function parseIdentifier(input: string): { email: string } | { phone: string } | null {
  if (input.includes("@")) {
    const email = normalizeEmail(input);
    return email ? { email } : null;
  }
  const phone = normalizePhone(input);
  return phone ? { phone } : null;
}

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Kod bazada ochiq saqlanmaydi: maxfiy kalit bilan HMAC. */
export function hashCode(code: string, secret: string): string {
  return createHmac("sha256", secret).update(code.replace(/\D/g, "")).digest("hex");
}

export function codeMatches(input: string, hash: string, secret: string): boolean {
  const a = Buffer.from(hashCode(input, secret), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Yangi kod so'rash mumkinmi: oxirgisidan 60 soniya o'tgan va oxirgi soatda 5 tadan kam. */
export function canSendCode(recent: Date[], now: Date): boolean {
  const hourAgo = now.getTime() - 3_600_000;
  const lastHour = recent.filter((d) => d.getTime() > hourAgo);
  if (lastHour.length >= MAX_CODES_PER_HOUR) return false;
  return !lastHour.some((d) => now.getTime() - d.getTime() < CODE_RESEND_SECONDS * 1000);
}

// Chalkash belgilarsiz (0/O, 1/I/L) — telefonda aytib berish oson.
const TEMP_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Vaqtincha parol: XXXX-XXXX-XXXX (≈ 59 bit). */
export function generateTempPassword(): string {
  const chars = Array.from({ length: 12 }, () => TEMP_ALPHABET[randomInt(0, TEMP_ALPHABET.length)]);
  return [0, 4, 8].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

/** Kiritilgan vaqtincha parolni kanonik ko'rinishga keltiradi (kichik harf, probel, chiziqcha farq qilmaydi). */
export function canonicalTempPassword(input: string): string | null {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length !== 12 || [...s].some((c) => !TEMP_ALPHABET.includes(c))) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

type Member = { id: string; role: Role; orgId: string | null };

/** Rahbar o'z tashkilotidagi menejer, buxgalter va ishonchli vakilni boshqaradi (o'zini emas). */
export function canManageMember(actor: Member, target: Member): boolean {
  return (
    actor.role === "DIRECTOR" &&
    !!actor.orgId &&
    actor.id !== target.id &&
    target.orgId === actor.orgId &&
    (MEMBER_ROLES as readonly Role[]).includes(target.role)
  );
}
