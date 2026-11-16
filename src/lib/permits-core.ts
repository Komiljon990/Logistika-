/**
 * TIR karnetlar va dazvollar (17.11.2026, sof qoidalar):
 * kirim (yuqori tashkilotdan) → tashkilotda → haydovchiga beriladi (transport + haydovchi) → tashkilotga qaytariladi
 * (ishlatilgan bo'lsa — "ishlatilgan", ishlatilmagan bo'lsa — yana tashkilotda) → yuqori tashkilotga topshiriladi.
 */
export type PermitStatus = "STOCK" | "ISSUED" | "USED" | "RETURNED" | "SURRENDERED" | "LOST" | "DEFECT";
export type PermitAction = "ISSUE" | "RETURN" | "SURRENDER" | "LOST" | "DEFECT";

/** Holat tugmalari tartibi (17.11.2026): Yangi, Haydovchida, Ishlatilgan, Qaytarilgan, Topshirilgan, Yo'qolgan, Brak. */
export const PERMIT_STATUSES: readonly PermitStatus[] = ["STOCK", "ISSUED", "USED", "RETURNED", "SURRENDERED", "LOST", "DEFECT"];

/** Tashkilot qo'lida turgan (yopilmagan) holatlar. */
export const OPEN_STATUSES: readonly PermitStatus[] = ["STOCK", "ISSUED", "USED", "RETURNED", "DEFECT"];

const ALLOWED: Record<PermitAction, readonly PermitStatus[]> = {
  // Yangi yoki ishlatilmay qaytgan blanka beriladi.
  ISSUE: ["STOCK", "RETURNED"],
  RETURN: ["ISSUED"],
  // Ishlatilgan, ishlatilmagan (masalan muddati o'tgan) yoki brak blanka yuqori tashkilotga topshiriladi.
  SURRENDER: ["USED", "STOCK", "RETURNED", "DEFECT"],
  LOST: ["STOCK", "ISSUED", "USED", "RETURNED"],
  DEFECT: ["STOCK", "ISSUED", "RETURNED"],
};

export function canDo(action: PermitAction, status: PermitStatus): boolean {
  return ALLOWED[action].includes(status);
}

export function nextStatus(action: PermitAction, used = false): PermitStatus {
  switch (action) {
    case "ISSUE": return "ISSUED";
    case "RETURN": return used ? "USED" : "RETURNED";
    case "SURRENDER": return "SURRENDERED";
    case "LOST": return "LOST";
    case "DEFECT": return "DEFECT";
  }
}

/** Bir nechta raqam: vergul, probel yoki yangi qator bilan; "AB100-AB105" — oraliq (oxirgi raqamlar bo'yicha, 200 tagacha). */
export function parseNumbers(input: string): string[] | null {
  const out: string[] = [];
  for (const raw of input.split(/[\s,;]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)) {
    // Oraliq: "AB100-AB105", "E2E100-E2E102", "1001-1010" (prefiks — raqamdan oldingi qism, ikkinchi tomonda ixtiyoriy).
    const m = /^(.*\D)?(\d+)-(.*\D)?(\d+)$/.exec(raw);
    const range = m && (m[3] === undefined || m[3] === m[1]) ? [m[0], m[1] ?? "", m[2], m[3] ?? "", m[4]] : null;
    if (range) {
      const [from, to] = [Number(range[2]), Number(range[4])];
      if (to < from || to - from > 199) return null;
      // Oldidagi nollar saqlanadi (XA0098-XA0101 → XA0098 … XA0101).
      const width = range[2].length === range[4].length ? range[2].length : 0;
      for (let n = from; n <= to; n++) out.push(`${range[1]}${String(n).padStart(width, "0")}`);
    } else {
      if (raw.length > 40 || !/^[A-Z0-9/-]+$/.test(raw)) return null;
      out.push(raw);
    }
  }
  const uniq = [...new Set(out)];
  return uniq.length && uniq.length <= 200 ? uniq : null;
}

/** Muddati tugashiga necha kun qoldi (null — muddatsiz). */
export function daysTo(validUntil: string | null, today: string): number | null {
  if (!validUntil) return null;
  return Math.round((Date.parse(`${validUntil}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** Huquq bo'limi: TIR va dazvol alohida (Mutaxassisga birini berib, ikkinchisini bermaslik mumkin). */
export function permitSection(type: "TIR" | "DAZVOL"): "tir" | "dazvol" {
  return type === "TIR" ? "tir" : "dazvol";
}
