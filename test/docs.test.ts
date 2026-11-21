import { describe, expect, it } from "vitest";
import { daysLeft, expiryLevel, normalizePlate, tashkentToday, missingDocs, DOC_TYPES, RECOMMENDED } from "@/lib/docs";
import { checkFile, isInlineMime, MAX_FILE_BYTES } from "@/lib/files";
import { groupAlerts, type AlertItem } from "@/lib/alerts-core";
import { can } from "@/lib/roles";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("expiry", () => {
  it("counts whole days", () => {
    expect(daysLeft(d("2026-11-01"), d("2026-10-23"))).toBe(9);
    expect(daysLeft(d("2026-10-22"), d("2026-10-23"))).toBe(-1);
    expect(daysLeft(null)).toBeNull();
  });
  it("uses the 30/15/7 day thresholds", () => {
    expect(expiryLevel(31)).toBe("ok");
    expect(expiryLevel(30)).toBe("d30");
    expect(expiryLevel(15)).toBe("d15");
    expect(expiryLevel(7)).toBe("d7");
    expect(expiryLevel(0)).toBe("d7");
    expect(expiryLevel(-1)).toBe("expired");
  });
  it("uses the Tashkent date after 19:00 UTC", () => {
    expect(tashkentToday(new Date("2026-10-23T20:00:00Z")).toISOString().slice(0, 10)).toBe("2026-10-24");
  });
});

describe("plates", () => {
  it("normalizes spacing and case", () => {
    expect(normalizePlate("01 a 777-aa")).toBe("01A777AA");
  });
});

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const text = (s: string) => new TextEncoder().encode(s.padEnd(16, "\0"));
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

describe("files", () => {
  it("accepts images and pdf by content, shown in the browser", () => {
    expect(checkFile(bytes(0x25, 0x50, 0x44, 0x46))).toEqual({ ok: true, mime: "application/pdf", inline: true });
    expect(checkFile(bytes(0xff, 0xd8, 0xff, 0xe0))).toEqual({ ok: true, mime: "image/jpeg", inline: true });
    expect(checkFile(bytes(0x89, 0x50, 0x4e, 0x47))).toEqual({ ok: true, mime: "image/png", inline: true });
    expect(checkFile(text("RIFF\0\0\0\0WEBP"))).toMatchObject({ ok: true, mime: "image/webp" });
    expect(checkFile(text("\0\0\0\x18ftypheic"), "IMG_1.HEIC")).toMatchObject({ ok: true, mime: "image/heic", inline: false });
  });
  it("accepts office files and archives, downloaded not shown", () => {
    expect(checkFile(bytes(...ZIP), "shartnoma.docx")).toMatchObject({ ok: true, inline: false, mime: expect.stringContaining("wordprocessingml") });
    expect(checkFile(bytes(...ZIP), "hisob.XLSX")).toMatchObject({ ok: true, mime: expect.stringContaining("spreadsheetml") });
    expect(checkFile(bytes(...ZIP), "skanlar.zip")).toMatchObject({ ok: true, mime: "application/zip" });
    expect(checkFile(bytes(...OLE), "eski.doc")).toMatchObject({ ok: true, mime: "application/msword" });
    expect(checkFile(bytes(...OLE), "eski.xls")).toMatchObject({ ok: true, mime: "application/vnd.ms-excel" });
    expect(checkFile(text("Rar!\x1a\x07\0"), "a.rar")).toMatchObject({ ok: true, mime: "application/vnd.rar" });
    expect(checkFile(bytes(0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c), "a.7z")).toMatchObject({ ok: true, mime: "application/x-7z-compressed" });
  });
  it("rejects zip/ole containers with a foreign extension (apk, jar, msi)", () => {
    expect(checkFile(bytes(...ZIP), "ilova.apk")).toEqual({ ok: false, error: "type" });
    expect(checkFile(bytes(...ZIP), "x.jar")).toEqual({ ok: false, error: "type" });
    expect(checkFile(bytes(...OLE), "setup.msi")).toEqual({ ok: false, error: "type" });
  });
  it("rejects other types and files over 10 MB", () => {
    expect(MAX_FILE_BYTES).toBe(10 * 1024 * 1024);
    expect(checkFile(text("<html><script>"), "a.pdf")).toEqual({ ok: false, error: "type" });
    expect(checkFile(text("MZ\x90\0"), "a.exe")).toEqual({ ok: false, error: "type" });
    expect(checkFile(new Uint8Array(MAX_FILE_BYTES + 1), "big.pdf")).toEqual({ ok: false, error: "size" });
  });
  it("shows only images and pdf inline", () => {
    expect(isInlineMime("application/pdf")).toBe(true);
    expect(isInlineMime("image/png")).toBe(true);
    expect(isInlineMime("application/zip")).toBe(false);
    expect(isInlineMime("image/heic")).toBe(false);
  });
});

describe("recommended documents", () => {
  it("vehicle: tech passport, license, inspection, insurance", () => {
    expect(missingDocs("vehicle", [])).toEqual(["TECH_PASSPORT", "LICENSE", "INSPECTION", "INSURANCE"]);
    expect(missingDocs("vehicle", ["LICENSE", "INSURANCE", "OTHER"])).toEqual(["TECH_PASSPORT", "INSPECTION"]);
  });
  it("driver: driving licence, passport, foreign passport, certificate", () => {
    expect(missingDocs("driver", ["PASSPORT"])).toEqual(["DRIVING_LICENSE", "FOREIGN_PASSPORT", "CERTIFICATE"]);
  });
  it("org documents use their own types", () => {
    expect(missingDocs("org", ["CHARTER", "BANK_DETAILS"])).toEqual(["ORG_CERTIFICATE", "LICENSE"]);
    expect(DOC_TYPES.org).not.toContain("TECH_PASSPORT");
    for (const t of RECOMMENDED.vehicle) expect(DOC_TYPES.vehicle).toContain(t);
    for (const t of RECOMMENDED.driver) expect(DOC_TYPES.driver).toContain(t);
  });
});

describe("alerts", () => {
  const item = (key: string, date: string): AlertItem => ({
    key, kind: "vehicle", href: "/", owner: key, orgName: "A", docType: "INSURANCE", number: null, expiresAt: d(date),
  });
  it("groups by expired / 7 / 15 / 30 days and drops later ones", () => {
    const today = d("2026-11-13");
    const g = groupAlerts(
      [item("old", "2026-11-01"), item("today", "2026-11-13"), item("d10", "2026-11-23"), item("d30", "2026-12-13"), item("d31", "2026-12-14")],
      today,
    );
    expect(g.expired.map((x) => x.key)).toEqual(["old"]);
    expect(g.d7.map((x) => x.key)).toEqual(["today"]);
    expect(g.d15.map((x) => x.key)).toEqual(["d10"]);
    expect(g.d30.map((x) => x.key)).toEqual(["d30"]);
  });
});

describe("document permissions", () => {
  it("org documents: manager, director, accountant", () => {
    for (const r of ["MANAGER", "DIRECTOR", "ACCOUNTANT"] as const) expect(can(r, "orgdoc.edit")).toBe(true);
    for (const r of ["DEPUTY", "SUPER_ADMIN"] as const) expect(can(r, "orgdoc.edit")).toBe(false);
  });
  it("vehicle and driver documents: manager only", () => {
    for (const r of ["DIRECTOR", "ACCOUNTANT", "DEPUTY", "SUPER_ADMIN"] as const) expect(can(r, "data.edit")).toBe(false);
  });
  it("alert counter in the menu: manager and director", () => {
    expect(can("MANAGER", "alerts.badge")).toBe(true);
    expect(can("DIRECTOR", "alerts.badge")).toBe(true);
    expect(can("ACCOUNTANT", "alerts.badge")).toBe(false);
  });
});
