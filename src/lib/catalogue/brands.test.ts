import { describe, expect, it } from "vitest";

import { brandFromTitle, canonicalBrand } from "@/lib/catalogue/brands";

describe("canonicalBrand", () => {
  it("maps the spellings stores use to one name", () => {
    expect(canonicalBrand("Coghlan's")).toBe("Coghlans");
    expect(canonicalBrand("TMax")).toBe("T-Max");
    expect(canonicalBrand("HardKorr")).toBe("Hardkorr");
    expect(canonicalBrand("OME")).toBe("Old Man Emu");
    expect(canonicalBrand("Securetech")).toBe("SecureTech");
  });

  it("keeps an unknown brand as given, tidied", () => {
    expect(canonicalBrand("  Some   New Brand ")).toBe("Some New Brand");
  });
});

describe("brandFromTitle", () => {
  it("finds a known brand at the start of a name", () => {
    expect(brandFromTitle("Petzl Tikka Headlamp")).toBe("Petzl");
    expect(brandFromTitle("Coghlan's Bungee Cord")).toBe("Coghlans");
    expect(brandFromTitle("LKs 55cm Long Braai Tongs")).toBe("LK's");
  });

  it("treats curly and straight apostrophes alike", () => {
    expect(brandFromTitle("Coghlan’s Bungee Cord")).toBe("Coghlans");
    expect(brandFromTitle("LK’s Braai Mitten")).toBe("LK's");
  });

  it("prefers the longest spelling", () => {
    expect(brandFromTitle("Front Runner Expedition Rail")).toBe("Front Runner");
    expect(brandFromTitle("Ironman 4x4 Foam Cell Shock")).toBe("Ironman 4x4");
  });

  it("needs a whole word", () => {
    expect(brandFromTitle("Petzlish Thing")).toBeNull();
  });

  it("doesn't read ordinary words as brands", () => {
    expect(brandFromTitle("Ring Pegs 10pk")).toBeNull();
  });

  it("returns null when no known brand leads", () => {
    expect(brandFromTitle("Braai Grid 430x340x20mm Stainless Steel")).toBeNull();
  });
});
