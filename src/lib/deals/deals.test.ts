import { describe, expect, it } from "vitest";

import type { ProductHistory } from "@/lib/catalogue/types";
import { dealFor, type DealInput } from "@/lib/deals/deals";

const item = (overrides: Partial<DealInput> = {}): DealInput => ({
  id: "campandclimb:1",
  storeId: "campandclimb",
  priceZar: 100,
  wasZar: null,
  inStock: true,
  clearance: null,
  ...overrides,
});

const history = (points: [string, number, number | null][]): ProductHistory => ({
  firstSeen: points[0][0],
  lastSeen: points.at(-1)![0],
  points: points.map(([on, priceZar, wasZar]) => ({ on, priceZar, wasZar })),
});

const TODAY = "2026-11-18";

describe("was-price", () => {
  it("counts the store's was-price, with when it was first seen", () => {
    const deal = dealFor(item({ priceZar: 75, wasZar: 100 }), history([["2026-11-01", 75, 100]]), [], TODAY);
    expect(deal?.reasons).toEqual([
      { kind: "was-price", wasZar: 100, savingZar: 25, savingPct: 0.25, since: "2026-11-01", sinceTrackingBegan: true },
    ]);
    expect(deal).toMatchObject({ savingPct: 0.25, savingZar: 25 });
  });

  it("knows a was-price that appeared after tracking began", () => {
    const h = history([
      ["2026-11-01", 100, null],
      ["2026-11-10", 75, 100],
    ]);
    expect(dealFor(item({ priceZar: 75, wasZar: 100 }), h, [], TODAY)?.reasons[0]).toMatchObject({
      since: "2026-11-10",
      sinceTrackingBegan: false,
    });
  });

  it("ignores savings under 5%", () => {
    expect(dealFor(item({ priceZar: 97, wasZar: 100 }), null, [], TODAY)).toBeNull();
  });
});

describe("clearance", () => {
  it("counts a clearance listing, without a saving figure", () => {
    expect(dealFor(item({ clearance: "Clearance - Spring Sale" }), null, [], TODAY)).toEqual({
      reasons: [{ kind: "clearance", section: "Clearance - Spring Sale" }],
      savingPct: null,
      savingZar: null,
    });
  });
});

describe("price-drop", () => {
  it("counts a recent drop from a price that held", () => {
    const h = history([
      ["2026-11-01", 100, null],
      ["2026-11-12", 80, null],
    ]);
    expect(dealFor(item({ priceZar: 80 }), h, [], TODAY)?.reasons).toEqual([
      { kind: "price-drop", fromZar: 100, savingZar: 20, savingPct: 0.2, on: "2026-11-12" },
    ]);
  });

  it("ignores a drop older than the window", () => {
    const h = history([
      ["2026-10-01", 100, null],
      ["2026-10-20", 80, null],
    ]);
    expect(dealFor(item({ priceZar: 80 }), h, [], TODAY)).toBeNull();
  });

  it("ignores a one-day spike coming back down", () => {
    const h = history([
      ["2026-11-01", 80, null],
      ["2026-11-15", 160, null],
      ["2026-11-16", 80, null],
    ]);
    expect(dealFor(item({ priceZar: 80 }), h, [], TODAY)).toBeNull();
  });

  it("ignores a rise", () => {
    const h = history([
      ["2026-11-01", 80, null],
      ["2026-11-12", 100, null],
    ]);
    expect(dealFor(item({ priceZar: 100 }), h, [], TODAY)).toBeNull();
  });
});

describe("cheaper-elsewhere", () => {
  const other = (storeId: DealInput["storeId"], priceZar: number, inStock = true) =>
    item({ id: `${storeId}:9`, storeId, priceZar, inStock });

  it("counts the cheapest in-stock listing against the next cheapest", () => {
    const deal = dealFor(item({ priceZar: 7795 }), null, [other("tentco", 11000), other("megaworld", 10284.46)], TODAY);
    expect(deal?.reasons[0]).toMatchObject({
      kind: "cheaper-elsewhere",
      otherStoreId: "megaworld",
      otherPriceZar: 10284.46,
      savingZar: 2489.46,
    });
  });

  it("needs the same 5% gap as any other saving", () => {
    // 4x4 Mega World's cupboard at R1 069.99 against Camp and Climb's R1 095 is 2.3% cheaper.
    expect(dealFor(item({ priceZar: 1069.99 }), null, [other("tentco", 1150), other("megaworld", 1095)], TODAY)).toBeNull();
  });

  it("doesn't count it when another store is as cheap or cheaper", () => {
    expect(dealFor(item({ priceZar: 100 }), null, [other("tentco", 100)], TODAY)).toBeNull();
    expect(dealFor(item({ priceZar: 100 }), null, [other("tentco", 90), other("megaworld", 200)], TODAY)).toBeNull();
  });

  it("ignores out-of-stock listings on either side", () => {
    expect(dealFor(item({ priceZar: 100 }), null, [other("tentco", 90, false), other("megaworld", 130)], TODAY)?.reasons[0]).toMatchObject({
      otherStoreId: "megaworld",
    });
    expect(dealFor(item({ priceZar: 100, inStock: false }), null, [other("tentco", 130)], TODAY)).toBeNull();
  });
});

describe("the headline saving", () => {
  it("is the biggest among the reasons", () => {
    const h = history([
      ["2026-11-01", 100, null],
      ["2026-11-12", 70, 90],
    ]);
    const deal = dealFor(item({ priceZar: 70, wasZar: 90, clearance: "Sale" }), h, [], TODAY);
    expect(deal?.reasons.map((r) => r.kind)).toEqual(["was-price", "clearance", "price-drop"]);
    expect(deal).toMatchObject({ savingPct: 0.3, savingZar: 30 });
  });
});
