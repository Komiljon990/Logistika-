import { describe, expect, it } from "vitest";
import {
  canManageMember, canonicalTempPassword, canSendCode, codeMatches, generateCode, generateTempPassword, hashCode,
  normalizeEmail, parseIdentifier,
} from "@/lib/auth-core";

const SECRET = "x".repeat(40);

describe("identifiers", () => {
  it("normalizes e-mail and rejects junk", () => {
    expect(normalizeEmail("  Ali.Valiyev@Mail.UZ ")).toBe("ali.valiyev@mail.uz");
    expect(normalizeEmail("ali@")).toBeNull();
    expect(normalizeEmail("ali valiyev@mail.uz")).toBeNull();
  });
  it("tells e-mail from phone", () => {
    expect(parseIdentifier("A@b.uz")).toEqual({ email: "a@b.uz" });
    expect(parseIdentifier("90 123 45 67")).toEqual({ phone: "+998901234567" });
    expect(parseIdentifier("hello")).toBeNull();
  });
});

describe("one-time codes", () => {
  it("are 6 digits and stored only as HMAC", () => {
    const code = generateCode();
    expect(code).toMatch(/^\d{6}$/);
    const h = hashCode(code, SECRET);
    expect(h).not.toContain(code);
    expect(codeMatches(code, h, SECRET)).toBe(true);
    expect(codeMatches(`${code.slice(0, 3)} ${code.slice(3)}`, h, SECRET)).toBe(true);
    expect(codeMatches("000000" === code ? "111111" : "000000", h, SECRET)).toBe(false);
    expect(codeMatches(code, h, "y".repeat(40))).toBe(false);
  });
  it("are rate-limited: 60 s between sends, 5 per hour", () => {
    const now = new Date("2026-11-16T10:00:00Z");
    const ago = (s: number) => new Date(now.getTime() - s * 1000);
    expect(canSendCode([], now)).toBe(true);
    expect(canSendCode([ago(30)], now)).toBe(false);
    expect(canSendCode([ago(90)], now)).toBe(true);
    expect(canSendCode([ago(100), ago(700), ago(1300), ago(1900), ago(2500)], now)).toBe(false);
    expect(canSendCode([ago(100), ago(700), ago(1300), ago(1900), ago(3700)], now)).toBe(true);
  });
});

describe("temporary passwords", () => {
  it("look like XXXX-XXXX-XXXX without ambiguous characters", () => {
    for (let i = 0; i < 50; i++) {
      const p = generateTempPassword();
      expect(p).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    }
  });
  it("accept sloppy typing but nothing else", () => {
    expect(canonicalTempPassword("abcd efgh jkmn")).toBe("ABCD-EFGH-JKMN");
    expect(canonicalTempPassword("ABCDEFGHJKMN")).toBe("ABCD-EFGH-JKMN");
    expect(canonicalTempPassword("ABCD-EFGH-JKM")).toBeNull();
    expect(canonicalTempPassword("ABCD-EFGH-JKM0")).toBeNull();
    expect(canonicalTempPassword("my-normal-password")).toBeNull();
  });
});

describe("who manages whom", () => {
  const dirA = { id: "d", role: "DIRECTOR" as const, orgId: "A" };
  it("director manages staff of own org only", () => {
    expect(canManageMember(dirA, { id: "m", role: "MANAGER", orgId: "A" })).toBe(true);
    expect(canManageMember(dirA, { id: "b", role: "ACCOUNTANT", orgId: "A" })).toBe(true);
    expect(canManageMember(dirA, { id: "v", role: "DEPUTY", orgId: "A" })).toBe(true);
    expect(canManageMember(dirA, { id: "m2", role: "MANAGER", orgId: "B" })).toBe(false);
  });
  it("director cannot manage other directors, himself, or anyone without being director", () => {
    expect(canManageMember(dirA, { id: "d2", role: "DIRECTOR", orgId: "A" })).toBe(false);
    expect(canManageMember(dirA, dirA)).toBe(false);
    expect(canManageMember({ id: "m", role: "MANAGER", orgId: "A" }, { id: "v", role: "DEPUTY", orgId: "A" })).toBe(false);
    expect(canManageMember({ id: "s", role: "SUPER_ADMIN", orgId: null }, { id: "m", role: "MANAGER", orgId: "A" })).toBe(false);
  });
});
