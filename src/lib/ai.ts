/**
 * Sun'iy intellekt xizmati (21.11.2026): Cloudflare Workers AI (bepul kunlik limit bor).
 * - Ovozni matnga: Whisper (CF_STT_MODEL, standart @cf/openai/whisper-large-v3-turbo).
 * - Matndan maydonlarni ajratish: Llama (CF_LLM_MODEL, standart @cf/meta/llama-3.3-70b-instruct-fp8-fast).
 * Sozlash (.env): CF_ACCOUNT_ID va CF_AI_TOKEN (Cloudflare → AI → Workers AI → «Use REST API» tokeni). Maxfiy.
 * "server-only" import qilinmaydi: Telegram bot instrumentation.ts dan ishga tushadi.
 */

export function aiConfigured(): boolean {
  return !!(process.env.CF_ACCOUNT_ID?.trim() && process.env.CF_AI_TOKEN?.trim());
}

function aiBase(): string {
  return (process.env.CF_AI_API_URL || "https://api.cloudflare.com/client/v4").replace(/\/+$/, "");
}

export const STT_MODEL = () => process.env.CF_STT_MODEL?.trim() || "@cf/openai/whisper-large-v3-turbo";
export const LLM_MODEL = () => process.env.CF_LLM_MODEL?.trim() || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export class AiError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

async function run<T>(model: string, body: unknown, timeoutMs: number): Promise<T> {
  if (!aiConfigured()) throw new AiError("AI sozlanmagan (CF_ACCOUNT_ID, CF_AI_TOKEN)");
  const res = await fetch(`${aiBase()}/accounts/${process.env.CF_ACCOUNT_ID!.trim()}/ai/run/${model}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CF_AI_TOKEN!.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = (await res.json().catch(() => null)) as { success?: boolean; result?: T; errors?: { message?: string }[] } | null;
  if (!res.ok || !json?.success) {
    throw new AiError(json?.errors?.map((e) => e.message).filter(Boolean).join("; ") || `Workers AI xatosi ${res.status}`, res.status);
  }
  return json.result as T;
}

export type Transcript = { text: string; language: string | null };

/**
 * Ovozni matnga. Avval tilni o'zi aniqlaydi; o'zbek yoki rus deb topmasa (Whisper o'zbekchani ko'pincha
 * turk/qozoq deb o'ylaydi) — o'zbek tili majburan qo'yib qayta urinadi.
 * `hint` — ism va so'zlar (mijoz nomlari), Whisper ularni to'g'ri yozishiga yordam beradi.
 */
export async function transcribe(audio: Buffer, hint?: string): Promise<Transcript> {
  type R = { text?: string; transcription_info?: { language?: string } };
  const base = { audio: audio.toString("base64"), vad_filter: true, ...(hint ? { initial_prompt: hint.slice(0, 400) } : {}) };
  const first = await run<R>(STT_MODEL(), base, 90_000);
  const lang = first.transcription_info?.language ?? null;
  if (lang === "uz" || lang === "ru") return { text: (first.text ?? "").trim(), language: lang };
  const second = await run<R>(STT_MODEL(), { ...base, language: "uz" }, 90_000);
  return { text: (second.text ?? "").trim(), language: "uz" };
}

/**
 * Matndan JSON. Model JSON rejimini qo'llamasa (xato qaytarsa) — oddiy so'rov bilan qayta urinadi,
 * javob ichidan JSON ajratib olinadi (voice-core.ts: parseLlmJson).
 */
export async function extractJson(system: string, user: string, schema: object): Promise<unknown> {
  type R = { response?: unknown };
  const messages = [{ role: "system", content: system }, { role: "user", content: user }];
  try {
    const r = await run<R>(LLM_MODEL(), { messages, response_format: { type: "json_schema", json_schema: schema }, max_tokens: 500, temperature: 0 }, 60_000);
    return r.response;
  } catch (e) {
    if (!(e instanceof AiError) || !e.status || e.status >= 500 || e.status === 401 || e.status === 403 || e.status === 429) throw e;
    const r = await run<R>(LLM_MODEL(), { messages, max_tokens: 500, temperature: 0 }, 60_000);
    return r.response;
  }
}
