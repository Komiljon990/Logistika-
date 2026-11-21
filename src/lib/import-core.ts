/**
 * Exceldan import (18.11.2026): ustun sarlavhalarini tanish (o'zbekcha, ruscha, inglizcha) va qatorlarni o'qish.
 * Sof funksiyalar — sinovlar uchun.
 */
export const IMPORT_KINDS = ["clients", "vehicles", "drivers"] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

const norm = (s: string) => s.toLowerCase().replace(/[ʻʼ'’`‘."«»()*:№#]/g, "").replace(/\s+/g, " ").trim();

/** Har maydon uchun mumkin bo'lgan sarlavhalar (kichik harf, tinish belgilarisiz). */
const HEADERS: Record<ImportKind, Record<string, string[]>> = {
  clients: {
    name: ["nomi", "mijoz", "mijoz nomi", "tashkilot", "kompaniya", "name", "client", "company", "наименование", "название", "клиент", "компания", "организация"],
    inn: ["stir", "inn", "tin", "инн", "стир"],
    phone: ["telefon", "tel", "phone", "телефон", "тел"],
    address: ["manzil", "address", "адрес"],
    note: ["izoh", "note", "comment", "примечание", "комментарий"],
  },
  vehicles: {
    plate: ["davlat raqami", "raqam", "raqami", "dav raqami", "gos nomer", "plate", "number", "госномер", "гос номер", "номер", "гос знак"],
    type: ["turi", "tur", "type", "тип", "вид"],
    model: ["model", "marka", "rusumi", "brand", "модель", "марка"],
    ownership: ["egalik", "mulk", "ownership", "собственность", "владение"],
    note: ["izoh", "note", "примечание", "комментарий"],
  },
  drivers: {
    fullName: ["fish", "f i sh", "fio", "ism", "ismi", "haydovchi", "full name", "name", "driver", "фио", "имя", "водитель"],
    phone: ["telefon", "tel", "phone", "телефон", "тел"],
    category: ["toifa", "turi", "category", "type", "категория", "тип"],
    note: ["izoh", "note", "примечание", "комментарий"],
  },
};

export const REQUIRED: Record<ImportKind, string> = { clients: "name", vehicles: "plate", drivers: "fullName" };

/** Shablon sarlavhalari (birinchi variantlar, o'zbekcha). */
export const TEMPLATE: Record<ImportKind, string[][]> = {
  clients: [["Nomi", "STIR", "Telefon", "Manzil", "Izoh"], ["\"Namuna Trans\" MChJ", "301234567", "+998901234567", "Toshkent sh.", ""]],
  vehicles: [["Davlat raqami", "Turi", "Model", "Egalik", "Izoh"], ["01A123BC", "Tyagach", "Volvo FH", "O'z", ""], ["01XA1234", "Prisep", "Schmitz", "O'z", ""]],
  drivers: [["F.I.Sh.", "Telefon", "Toifa", "Izoh"], ["Aliyev Vali", "+998901234567", "Xodim", ""], ["Karimov Anvar", "+998931112233", "O'z transportida", ""]],
};

/** Sarlavha qatori → maydon: ustun raqami. Kamida majburiy maydon topilishi kerak. */
export function mapHeaders(kind: ImportKind, header: string[]): Record<string, number> | null {
  const out: Record<string, number> = {};
  header.forEach((h, i) => {
    const n = norm(h);
    if (!n) return;
    for (const [field, names] of Object.entries(HEADERS[kind])) {
      if (out[field] === undefined && names.some((x) => n === x || n.startsWith(`${x} `))) { out[field] = i; break; }
    }
  });
  return out[REQUIRED[kind]] === undefined ? null : out;
}

export function vehicleType(v: string): "TRACTOR" | "TRAILER" | "OTHER" {
  const n = norm(v);
  if (/^(tyagach|тягач|tractor|truck|седельн)/.test(n) || n.includes("tyagach") || n.includes("тягач")) return "TRACTOR";
  if (/^(pri[ts]?[ce]?p|pritsep|prisep|трейлер|прицеп|полуприцеп|trailer|semi)/.test(n) || n.includes("prisep") || n.includes("прицеп")) return "TRAILER";
  return "OTHER";
}

export function ownership(v: string): "OWNED" | "LEASED" {
  const n = norm(v);
  return /(ijara|lizing|leas|аренд|лизинг)/.test(n) ? "LEASED" : "OWNED";
}

export function driverCategory(v: string): "EMPLOYEE" | "OWNER_OPERATOR" {
  const n = norm(v);
  return /(o?z transport|ijarachi|owner|своем|своём|собственн|арендатор)/.test(n) ? "OWNER_OPERATOR" : "EMPLOYEE";
}

/** Qatordan maydonlar (bo'sh kataklar — bo'sh satr). */
export function pick(row: string[], map: Record<string, number>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, i] of Object.entries(map)) out[field] = (row[i] ?? "").trim();
  return out;
}
