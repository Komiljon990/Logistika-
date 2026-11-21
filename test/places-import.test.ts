import { describe, expect, it, vi } from "vitest";
import { deflateRawSync } from "node:zlib";

vi.mock("server-only", () => ({}));

import { formatPlace, hasCountry, knownPlaces, placeKey } from "@/lib/places-core";
import { driverCategory, mapHeaders, ownership, pick, vehicleType } from "@/lib/import-core";
import { readCsv, readTable, readXlsx } from "@/lib/xlsx-read";
import { buildXlsx } from "@/lib/xlsx";

describe("places: City (Country)", () => {
  it("adds the country to a known city, in any spelling", () => {
    expect(formatPlace("Toshkent")).toBe("Toshkent (Uzbekistan)");
    expect(formatPlace("tashkent")).toBe("Toshkent (Uzbekistan)");
    expect(formatPlace("Ташкент")).toBe("Toshkent (Uzbekistan)");
    expect(formatPlace("  Moskva ")).toBe("Moskva (Russia)");
    expect(formatPlace("Варшава")).toBe("Varshava (Poland)");
    expect(formatPlace("Urumqi")).toBe("Urumchi (China)");
    expect(formatPlace("Farg'ona")).toBe("Farg'ona (Uzbekistan)");
    expect(formatPlace("Fargʻona")).toBe("Farg'ona (Uzbekistan)");
  });
  it("keeps a user-written country and tidies spacing", () => {
    expect(formatPlace("Kichik qishloq (Kazakhstan)")).toBe("Kichik qishloq (Kazakhstan)");
    expect(formatPlace("Toshkent(Uzbekistan)")).toBe("Toshkent (Uzbekistan)");
    expect(formatPlace("tashkent (uzbekistan)")).toBe("Toshkent (Uzbekistan)");
  });
  it("leaves unknown places unchanged and is idempotent", () => {
    expect(formatPlace("Noma'lum joy")).toBe("Noma'lum joy");
    expect(hasCountry("Noma'lum joy")).toBe(false);
    expect(hasCountry("Samarqand")).toBe(true);
    for (const p of knownPlaces().slice(0, 50)) expect(formatPlace(formatPlace(p.city))).toBe(`${p.city} (${p.country})`);
  });
  it("canonical names never contain brackets (would break the format)", () => {
    for (const p of knownPlaces()) expect(p.city).not.toMatch(/[()]/);
    expect(placeKey("Ёшкар-Ола")).toBe(placeKey("Ешкар Ола"));
  });
});

describe("import: headers and values", () => {
  it("recognises Uzbek, Russian and English headers", () => {
    expect(mapHeaders("clients", ["Nomi", "STIR", "Telefon"])).toEqual({ name: 0, inn: 1, phone: 2 });
    expect(mapHeaders("clients", ["Наименование", "ИНН", "Адрес"])).toEqual({ name: 0, inn: 1, address: 2 });
    expect(mapHeaders("vehicles", ["Davlat raqami", "Turi", "Model"])).toEqual({ plate: 0, type: 1, model: 2 });
    expect(mapHeaders("drivers", ["F.I.Sh.", "Telefon", "Toifa"])).toEqual({ fullName: 0, phone: 1, category: 2 });
    expect(mapHeaders("drivers", ["ФИО", "Телефон"])).toEqual({ fullName: 0, phone: 1 });
    expect(mapHeaders("vehicles", ["Model", "Izoh"])).toBeNull();
  });
  it("parses vehicle type, ownership and driver category", () => {
    expect(vehicleType("Tyagach")).toBe("TRACTOR");
    expect(vehicleType("Тягач")).toBe("TRACTOR");
    expect(vehicleType("Prisep")).toBe("TRAILER");
    expect(vehicleType("Полуприцеп")).toBe("TRAILER");
    expect(vehicleType("Avtobus")).toBe("OTHER");
    expect(ownership("Ijara")).toBe("LEASED");
    expect(ownership("O'z")).toBe("OWNED");
    expect(driverCategory("O'z transportida")).toBe("OWNER_OPERATOR");
    expect(driverCategory("Xodim")).toBe("EMPLOYEE");
    expect(driverCategory("")).toBe("EMPLOYEE");
    expect(pick(["A", " B "], { x: 0, y: 1, z: 5 })).toEqual({ x: "A", y: "B", z: "" });
  });
});

describe("reading .xlsx and .csv", () => {
  it("reads back what the app's own Excel export writes", () => {
    const buf = Buffer.from(buildXlsx([["Nomi", "Summa"], ["Toshkent & Co", 1200.5], ["Ali", null]], "Test"));
    expect(readXlsx(buf)).toEqual([["Nomi", "Summa"], ["Toshkent & Co", "1200.5"], ["Ali"]]);
  });
  it("reads a deflated workbook with shared strings and gaps", () => {
    const files: Record<string, string> = {
      "xl/workbook.xml": '<workbook xmlns:r="r"><sheets><sheet name="A" sheetId="1" r:id="rId1"/></sheets></workbook>',
      "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/></Relationships>',
      "xl/sharedStrings.xml": "<sst><si><t>Nomi</t></si><si><r><t>Ali</t></r><r><t>ev</t></r></si></sst>",
      "xl/worksheets/sheet1.xml": '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="C2"><v>5</v></c></row></sheetData></worksheet>',
    };
    expect(readXlsx(zip(files))).toEqual([["Nomi"], ["Aliev", "", "5"]]);
  });
  it("reads CSV with ; or , and quotes", () => {
    expect(readCsv('﻿Nomi;STIR\n"A; B";123\n')).toEqual([["Nomi", "STIR"], ["A; B", "123"]]);
    expect(readCsv('a,b\r\n"x ""y""",2')).toEqual([["a", "b"], ['x "y"', "2"]]);
    expect(readTable("f.csv", Buffer.from("a,b\n\n1,2\n"))).toEqual([["a", "b"], ["1", "2"]]);
  });
});

/** Sinov uchun kichik ZIP (deflate) yozuvchi. */
function zip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBuf = Buffer.from(name);
    const data = deflateRawSync(Buffer.from(text));
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt16LE(nameBuf.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, nameBuf, data);
    central.push(ch, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}
