import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

/**
 * E-mail yuborish (kodlar va taklifnomalar). SMTP sozlangan bo'lsa (masalan Gmail + "ilova paroli"):
 *   SMTP_HOST="smtp.gmail.com" SMTP_PORT="465" SMTP_USER="...@gmail.com" SMTP_PASS="ilova paroli" MAIL_FROM="ReysPro <...@gmail.com>"
 * Sozlanmagan bo'lsa — sinov rejimi: xat serverdagi MAIL_OUTBOX fayliga yoziladi (faqat server egasi o'qiy oladi).
 */
export function mailConfigured(): boolean {
  // SMTP_HOST="off" — sinov serveri uchun: .env'da pochta sozlangan bo'lsa ham xatlar faylga yoziladi.
  return !!(process.env.SMTP_HOST && process.env.SMTP_HOST !== "off" && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transport: nodemailer.Transporter | null = null;

/** Jo'natuvchi manzili (foydalanuvchiga "kontaktlarga qo'shing" deb ko'rsatish uchun). */
export function senderAddress(): string | null {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || "";
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim() || null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Oddiy, spam-filtrlarga "toza" HTML xat: bitta ustun, rasm va tashqi resurslarsiz, matnli nusxasi bilan birga.
 * `code` berilsa katta qilib ko'rsatiladi, `link` — tugma.
 */
export function mailHtml(opts: { title: string; paragraphs: string[]; code?: string; link?: { href: string; label: string } }): string {
  const from = senderAddress();
  const p = (s: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#1f2937">${esc(s).replace(/\n/g, "<br>")}</p>`;
  return `<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f3f6fa;font-family:Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #dbe3ee">
<tr><td style="padding:20px 28px;border-bottom:1px solid #e5ebf3;font-size:20px;font-weight:700;color:#0b5cad">ReysPro</td></tr>
<tr><td style="padding:24px 28px">
<h1 style="margin:0 0 16px;font-size:19px;color:#111827">${esc(opts.title)}</h1>
${opts.code ? `<div style="margin:6px 0 18px;padding:14px;border-radius:10px;background:#eef5ff;text-align:center;font-family:Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#0b5cad">${esc(opts.code)}</div>` : ""}
${opts.paragraphs.map(p).join("")}
${opts.link ? `<p style="margin:6px 0 18px"><a href="${esc(opts.link.href)}" style="display:inline-block;padding:11px 20px;border-radius:8px;background:#0b5cad;color:#ffffff;text-decoration:none;font-weight:600">${esc(opts.link.label)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e5ebf3;font-size:12px;line-height:1.5;color:#6b7280">
${from ? `Xatlarimiz «Spam» papkasiga tushmasligi uchun <b>${esc(from)}</b> manzilini kontaktlaringizga qo'shing. Agar bu xat «Spam»da bo'lsa, «Spam emas» tugmasini bosing.<br><br>` : ""}
Bu xat avtomatik yuborildi, unga javob yozish shart emas.
</td></tr></table></td></tr></table></body></html>`;
}

export async function sendMail(msg: { to: string; subject: string; text: string; html?: string }): Promise<void> {
  if (mailConfigured()) {
    const port = Number(process.env.SMTP_PORT || 465);
    transport ??= nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, ...msg });
    return;
  }
  const line = `\n===== ${new Date().toISOString()} =====\nKimga: ${msg.to}\nMavzu: ${msg.subject}\n\n${msg.text}\n`;
  const file = process.env.MAIL_OUTBOX;
  if (!file) {
    console.log(`[e-mail sinov rejimi]${line}`);
    return;
  }
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, line, "utf8");
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}
