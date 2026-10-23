import { describe, expect, it } from "vitest";
import { daysLeft, expiryLevel, normalizePlate, tashkentToday } from "@/lib/docs";
import { checkFile, MAX_FILE_BYTES } from "@/lib/files";

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

describe("files", () => {
  it("accepts pdf, jpg, png by content", () => {
    expect(checkFile(new Uint8Array([0x25, 0x50, 0x44, 0x46, 1]))).toEqual({ ok: true, mime: "application/pdf" });
    expect(checkFile(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ ok: true, mime: "image/jpeg" });
    expect(checkFile(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toEqual({ ok: true, mime: "image/png" });
  });
  it("rejects other types and big files", () => {
    expect(checkFile(new TextEncoder().encode("<html>"))).toEqual({ ok: false, error: "type" });
    expect(checkFile(new Uint8Array(MAX_FILE_BYTES + 1))).toEqual({ ok: false, error: "size" });
  });
});
