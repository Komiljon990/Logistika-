import { describe, expect, it } from "vitest";
import { uz } from "@/i18n/uz";
import { uzCyrl } from "@/i18n/uzCyrl";
import { ru } from "@/i18n/ru";

describe("dictionaries", () => {
  it("have no empty strings in any language", () => {
    for (const dict of [uz, uzCyrl, ru]) {
      for (const [k, v] of Object.entries(dict)) expect(v, k).not.toBe("");
    }
  });
});
