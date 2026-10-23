export const MAX_FILE_BYTES = 5 * 1024 * 1024;

const SIGNATURES: { mime: string; bytes: number[] }[] = [
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
];

export type FileCheck = { ok: true; mime: string } | { ok: false; error: "type" | "size" };

/** Faqat PDF, JPG, PNG; turi kengaytmadan emas, fayl boshidagi baytlardan aniqlanadi. */
export function checkFile(data: Uint8Array): FileCheck {
  if (data.byteLength > MAX_FILE_BYTES) return { ok: false, error: "size" };
  const sig = SIGNATURES.find((s) => s.bytes.every((b, i) => data[i] === b));
  return sig ? { ok: true, mime: sig.mime } : { ok: false, error: "type" };
}
