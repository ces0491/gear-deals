import { describe, expect, it } from "vitest";

import { secondHandLinks, secondHandQuery } from "@/lib/second-hand";

describe("secondHandQuery", () => {
  it("puts the brand in front when the name doesn't have it", () => {
    expect(secondHandQuery({ title: "Premium Bull Bar", brand: "Ironman 4x4" })).toBe("Ironman 4x4 Premium Bull Bar");
    expect(secondHandQuery({ title: "Tentco Senior Safari Bow Deluxe Tent", brand: "Tentco" })).toBe(
      "Tentco Senior Safari Bow Deluxe Tent",
    );
  });

  it("drops variant details after a dash or comma, and anything in brackets", () => {
    expect(secondHandQuery({ title: "Electric Power Board – Ford Ranger 4 Door 2014-23", brand: "T-Max" })).toBe(
      "T-Max Electric Power Board",
    );
    expect(secondHandQuery({ title: "Tentco Kudu Braai Grid ( Fixed Handle )", brand: "Tentco" })).toBe("Tentco Kudu Braai Grid");
    expect(secondHandQuery({ title: "Opposite Lock Premium Bull Bar, Toyota Hilux 2016", brand: "Opposite Lock" })).toBe(
      "Opposite Lock Premium Bull Bar",
    );
  });

  it("leaves out a store's house label, which sellers don't use", () => {
    expect(secondHandQuery({ title: "Roof Rack – Base – 1400mm x 1160mm", brand: "Desert Products" })).toBe("Roof Rack");
  });

  it("keeps the query to six words", () => {
    expect(secondHandQuery({ title: "NL 72 Legacy Smart Dual Double-Door Refrigerator & Freezer", brand: "National Luna" })).toBe(
      "National Luna NL 72 Legacy Smart",
    );
  });

  it("works without a brand", () => {
    expect(secondHandQuery({ title: "Folding Shovel", brand: null })).toBe("Folding Shovel");
  });
});

describe("secondHandLinks", () => {
  it("opens each site's own search, encoded", () => {
    expect(secondHandLinks("Ironman 4x4 Side Steps & Rails")).toEqual([
      { site: "Facebook Marketplace", url: "https://www.facebook.com/marketplace/search/?query=Ironman+4x4+Side+Steps+%26+Rails" },
      { site: "Gumtree", url: "https://www.gumtree.co.za/search?q=Ironman+4x4+Side+Steps+%26+Rails" },
    ]);
  });
});
