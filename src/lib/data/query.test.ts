import { describe, expect, it } from "vitest";

import type { Deal, Product } from "@/lib/catalogue/types";
import { activeFilterCount, DEFAULT_QUERY, PAGE_SIZE, parseQuery, queryHref, runQuery, toSearchParams } from "@/lib/data/query";

import { makeProduct } from "../../../test/helpers";

const NAMES = { campandclimb: "Camp and Climb", tentco: "Tentco", megaworld: "4x4 Mega World" };

const was = (pct: number, zar: number): Deal => ({
  reasons: [{ kind: "was-price", wasZar: 100, savingZar: zar, savingPct: pct, since: "2026-11-18", sinceTrackingBegan: true }],
  savingPct: pct,
  savingZar: zar,
});
const clearance: Deal = { reasons: [{ kind: "clearance", section: "Clearance" }], savingPct: null, savingZar: null };

const products: Product[] = [
  makeProduct({ title: "Tentco Senior Safari Bow Tent", storeId: "tentco", category: "tents", brand: "Tentco", priceZar: 8150, deal: was(0.1, 900) }),
  makeProduct({ title: "Oztrail Tasman 2 Dome Tent", category: "tents", brand: "Oztrail", priceZar: 1299, deal: was(0.3, 500) }),
  makeProduct({ title: "Engel 40L Fridge", storeId: "megaworld", category: "fridges", brand: "Engel", priceZar: 12299, deal: clearance }),
  makeProduct({ title: "Patent Leather Wallet", category: "other", priceZar: 200, deal: was(0.5, 200), inStock: false }),
  makeProduct({ title: "Coghlans Camp Stove", category: "kitchen", brand: "Coghlans", priceZar: 450, deal: null }),
];

const run = (params: Record<string, string | string[]>) => runQuery(products, parseQuery(params), NAMES);

describe("parseQuery", () => {
  it("reads repeated and single parameters, dropping unknown values", () => {
    const q = parseQuery({ category: ["tents", "spaceships", "tents"], store: ["tentco", "amazon"], reason: "clearance", min: "20", sort: "saving", page: "3" });
    expect(q).toMatchObject({ categories: ["tents"], stores: ["tentco"], reasons: ["clearance"], minPct: 20, sort: "saving", page: 3 });
  });

  it("falls back to defaults for nonsense", () => {
    expect(parseQuery({ min: "17", sort: "random", page: "-2" })).toEqual(DEFAULT_QUERY);
  });

  it("round-trips through the URL, leaving defaults out", () => {
    const q = parseQuery({ q: "tent", category: ["tents", "fridges"], all: "1", stock: "any" });
    expect(parseQuery(Object.fromEntries([...new Set(toSearchParams(q).keys())].map((k) => [k, toSearchParams(q).getAll(k)])))).toEqual(q);
    expect(queryHref(DEFAULT_QUERY)).toBe("/");
    expect(queryHref(DEFAULT_QUERY, { page: 2 })).toBe("/?page=2");
  });

  it("counts active filters", () => {
    expect(activeFilterCount(parseQuery({ category: ["tents", "fridges"], min: "10" }))).toBe(3);
  });
});

describe("runQuery", () => {
  it("shows in-stock deals by default, biggest rand saving first, clearance after measured deals", () => {
    expect(run({}).items.map((p) => p.title)).toEqual(["Tentco Senior Safari Bow Tent", "Oztrail Tasman 2 Dome Tent", "Engel 40L Fridge"]);
  });

  it("sorts by percentage when asked", () => {
    expect(run({ sort: "saving" }).items.map((p) => p.title)).toEqual(["Oztrail Tasman 2 Dome Tent", "Tentco Senior Safari Bow Tent", "Engel 40L Fridge"]);
  });

  it("includes non-deals and out-of-stock products when asked", () => {
    expect(run({ all: "1", stock: "any" }).total).toBe(5);
  });

  it("searches name, brand and store by word starts", () => {
    expect(run({ q: "tent" }).items.map((p) => p.title).sort()).toEqual(["Oztrail Tasman 2 Dome Tent", "Tentco Senior Safari Bow Tent"]);
    expect(run({ q: "mega world" }).items.map((p) => p.title)).toEqual(["Engel 40L Fridge"]);
    expect(run({ q: "ent", stock: "any" }).total).toBe(0); // not "patent" or "tent"
  });

  it("applies a minimum saving, which leaves out clearance listings without a figure", () => {
    expect(run({ min: "20" }).items.map((p) => p.title)).toEqual(["Oztrail Tasman 2 Dome Tent"]);
  });

  it("filters by reason, store, brand and category", () => {
    expect(run({ reason: "clearance" }).items.map((p) => p.title)).toEqual(["Engel 40L Fridge"]);
    expect(run({ store: "tentco" }).total).toBe(1);
    expect(run({ brand: "Oztrail" }).total).toBe(1);
    expect(run({ category: ["tents", "fridges"] }).total).toBe(3);
  });

  it("counts each facet over the other filters only", () => {
    const { facets } = run({ category: "tents" });
    expect(facets.categories).toEqual({ tents: 2, fridges: 1 });
    expect(facets.stores).toEqual({ tentco: 1, campandclimb: 1 });
    expect(facets.brands).toEqual([
      ["Oztrail", 1],
      ["Tentco", 1],
    ]);
    expect(facets.reasons).toEqual({ "was-price": 2 });
  });

  it("sorts by price", () => {
    expect(run({ sort: "price-asc" }).items[0].title).toBe("Oztrail Tasman 2 Dome Tent");
    expect(run({ sort: "price-desc" }).items[0].title).toBe("Engel 40L Fridge");
  });

  it("pages, and clamps a page past the end", () => {
    const many = Array.from({ length: PAGE_SIZE + 5 }, (_, i) => makeProduct({ title: `Item ${String(i).padStart(2, "0")}`, deal: was(0.1, 10) }));
    const second = runQuery(many, parseQuery({ page: "9" }), NAMES);
    expect(second).toMatchObject({ total: PAGE_SIZE + 5, page: 2, pageCount: 2 });
    expect(second.items).toHaveLength(5);
  });
});
