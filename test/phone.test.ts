import { describe, expect, it } from "vitest";
import { normalizePhone, formatPhone } from "@/lib/phone";

describe("phone", () => {
  it("normalizes common inputs", () => {
    expect(normalizePhone("+998 90 123-45-67")).toBe("+998901234567");
    expect(normalizePhone("901234567")).toBe("+998901234567");
    expect(normalizePhone("12345")).toBeNull();
  });
  it("formats for display", () => {
    expect(formatPhone("+998901234567")).toBe("+998 90 123 45 67");
  });
});
