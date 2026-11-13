export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Brauzerdagi fayl tanlash oynasi uchun (telefonda kamera ham taklif qilinadi). */
export const FILE_ACCEPT = [
  "image/*", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip", ".rar", ".7z",
].join(",");

export type FileCheck = { ok: true; mime: string; inline: boolean } | { ok: false; error: "type" | "size" };

const MIME = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  zip: "application/zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  xls: "application/vnd.ms-excel",
  ppt: "application/vnd.ms-powerpoint",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
} as const;

function starts(data: Uint8Array, bytes: number[], offset = 0) {
  return bytes.every((b, i) => data[offset + i] === b);
}

function ascii(data: Uint8Array, from: number, to: number) {
  return String.fromCharCode(...data.subarray(from, to));
}

function ext(name: string) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : "";
}

/**
 * Ruxsat etilgan turlar: rasm, PDF, Office, arxiv; 10 MB gacha.
 * Tur fayl boshidagi baytlardan aniqlanadi. Zip va eski Office konteynerlari bir xil boshlanadi,
 * shuning uchun ular uchun kengaytma ham mos kelishi shart (masalan .exe yoki .apk o'tmaydi).
 * `inline` — brauzerda ochiladigan turlar (rasm va PDF); qolganlari yuklab olinadi.
 */
export function checkFile(data: Uint8Array, name = ""): FileCheck {
  if (data.byteLength > MAX_FILE_BYTES) return { ok: false, error: "size" };
  const e = ext(name);
  if (starts(data, [0x25, 0x50, 0x44, 0x46])) return { ok: true, mime: MIME.pdf, inline: true };
  if (starts(data, [0xff, 0xd8, 0xff])) return { ok: true, mime: MIME.jpg, inline: true };
  if (starts(data, [0x89, 0x50, 0x4e, 0x47])) return { ok: true, mime: MIME.png, inline: true };
  if (ascii(data, 0, 4) === "RIFF" && ascii(data, 8, 12) === "WEBP") return { ok: true, mime: MIME.webp, inline: true };
  if (ascii(data, 4, 8) === "ftyp" && /^(heic|heix|hevc|mif1|msf1|heif)$/.test(ascii(data, 8, 12))) {
    return { ok: true, mime: MIME.heic, inline: false };
  }
  if (starts(data, [0x50, 0x4b, 0x03, 0x04]) || starts(data, [0x50, 0x4b, 0x05, 0x06])) {
    if (e === "docx" || e === "xlsx" || e === "pptx" || e === "zip") return { ok: true, mime: MIME[e], inline: false };
    return { ok: false, error: "type" };
  }
  if (starts(data, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    if (e === "doc" || e === "xls" || e === "ppt") return { ok: true, mime: MIME[e], inline: false };
    return { ok: false, error: "type" };
  }
  if (ascii(data, 0, 6) === "Rar!\x1a\x07") return { ok: true, mime: MIME.rar, inline: false };
  if (starts(data, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return { ok: true, mime: MIME["7z"], inline: false };
  return { ok: false, error: "type" };
}

/** Saqlangan fayl brauzerda ochiladimi yoki yuklab olinadimi. */
export function isInlineMime(mime: string) {
  return mime === MIME.pdf || mime === MIME.jpg || mime === MIME.png || mime === MIME.webp;
}
