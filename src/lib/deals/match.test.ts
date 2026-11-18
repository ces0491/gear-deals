import { describe, expect, it } from "vitest";

import { findMatches, type Matchable } from "@/lib/deals/match";

const m = (id: string, matchKey: string | null, priceZar = 100, brand: string | null = null): Matchable => ({
  id,
  storeId: id.split(":")[0] as Matchable["storeId"],
  brand,
  matchKey,
  priceZar,
});

describe("findMatches", () => {
  it("joins the same code at different stores", () => {
    const matches = findMatches([m("tentco:1", "TEN061", 1150, "Tentco"), m("campandclimb:2", "TEN061", 1095, "Tentco"), m("megaworld:3", "TEN061", 1069.99)]);
    expect(matches.get("megaworld:3")).toEqual(["tentco:1", "campandclimb:2"]);
    expect(matches.get("tentco:1")).toHaveLength(2);
  });

  it("ignores a code shared only within one store", () => {
    expect(findMatches([m("tentco:1", "TEN061"), m("tentco:2", "TEN061")]).size).toBe(0);
  });

  it("sets aside a code a store uses on more than one product", () => {
    const matches = findMatches([m("tentco:1", "BG003"), m("campandclimb:2", "BG003"), m("campandclimb:3", "BG003")]);
    expect(matches.size).toBe(0);
  });

  it("sets aside codes whose products name different brands", () => {
    expect(findMatches([m("tentco:1", "AB12345", 100, "Tentco"), m("megaworld:2", "AB12345", 100, "ARB")]).size).toBe(0);
  });

  it("doesn't let a house default brand block a match", () => {
    const matches = findMatches([
      m("megaworld:1", "RC70AB", 10284.46, "Desert Products"),
      m("oppositelock:2", "RC70AB", 7795, "4WD Interiors"),
    ]);
    expect(matches.get("oppositelock:2")).toEqual(["megaworld:1"]);
  });

  it("sets aside codes whose prices are too far apart to be one item", () => {
    expect(findMatches([m("tentco:1", "TC010", 45), m("campandclimb:2", "TC010", 200)]).size).toBe(0);
  });
});
