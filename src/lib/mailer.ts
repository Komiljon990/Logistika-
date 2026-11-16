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
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transport: nodemailer.Transporter | null = null;

export async function sendMail(msg: { to: string; subject: string; text: string }): Promise<void> {
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
