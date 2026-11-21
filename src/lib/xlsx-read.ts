import "server-only";
import { inflateRawSync } from "node:zlib";

/**
 * Excel (.xlsx) va CSV faylidan jadval o'qish (18.11.2026, import uchun). Kutubxonasiz: ZIP markaziy katalogi,
 * deflate — Node zlib, birinchi varaq. Natija — satrlar (har katak matn).
 */

function unzip(buf: Buffer): Map<string, () => Buffer> {
  // End of central directory: oxirgi 64 KB ichida qidiramiz.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("zip");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map<string, () => Buffer>();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("zip");
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    files.set(name, () => {
      const lNameLen = buf.readUInt16LE(local + 26);
      const lExtraLen = buf.readUInt16LE(local + 28);
      const start = local + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(start, start + csize);
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data, { maxOutputLength: 50 * 1024 * 1024 });
      throw new Error("zip-method");
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const decode = (s: string) =>
  s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, e: string) => {
    const k = e.toLowerCase();
    if (k === "lt") return "<";
    if (k === "gt") return ">";
    if (k === "amp") return "&";
    if (k === "quot") return '"';
    if (k === "apos") return "'";
    return String.fromCodePoint(k.startsWith("#x") ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
  });

/** <si> yoki <is> ichidagi barcha <t> matnlari (boy matn bo'laklari bilan). */
const texts = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join("");

function colIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function readXlsx(buf: Buffer): string[][] {
  const files = unzip(buf);
  const shared = files.get("xl/sharedStrings.xml");
  const strings = shared ? [...shared().toString("utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1])) : [];
  // Birinchi varaq: workbook.xml dagi birinchi <sheet> → rels → fayl; topilmasa sheet1.xml.
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = files.get("xl/workbook.xml")?.().toString("utf8");
  const rels = files.get("xl/_rels/workbook.xml.rels")?.().toString("utf8");
  const rid = wb?.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  if (rid && rels) {
    const target = rels.match(new RegExp(`<Relationship\\b[^>]*\\bId="${rid}"[^>]*\\bTarget="([^"]+)"`))?.[1]
      ?? rels.match(new RegExp(`<Relationship\\b[^>]*\\bTarget="([^"]+)"[^>]*\\bId="${rid}"`))?.[1];
    if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  }
  const sheet = files.get(sheetPath) ?? [...files.entries()].find(([k]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))?.[1];
  if (!sheet) throw new Error("sheet");
  const xml = sheet().toString("utf8");
  const rows: string[][] = [];
  for (const rm of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const row: string[] = [];
    let next = 0;
    for (const cm of (rm[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const idx = ref ? colIndex(ref) : next;
      next = idx + 1;
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const body = cm[2] ?? "";
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let val = "";
      if (type === "s") val = strings[Number(v)] ?? "";
      else if (type === "inlineStr") val = texts(body);
      else if (v !== undefined) val = decode(v);
      row[idx] = val.trim();
    }
    rows.push(Array.from(row, (x) => x ?? ""));
  }
  return rows;
}

/** CSV: UTF-8 (BOM bo'lsa ham), ajratuvchi — ";" yoki "," (birinchi satrga qarab), qo'shtirnoqli maydonlar. */
export function readCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, "");
  const first = s.split(/\r?\n/, 1)[0] ?? "";
  const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : first.includes("\t") && !first.includes(",") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell.trim()); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell.trim()); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows;
}

export function readTable(name: string, buf: Buffer): string[][] {
  const rows = /\.csv$/i.test(name) || buf.subarray(0, 2).toString("latin1") !== "PK" ? readCsv(buf.toString("utf8")) : readXlsx(buf);
  return rows.filter((r) => r.some((c) => c !== ""));
}
