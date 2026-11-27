import { describe, expect, it } from "vitest";

import type { CatalogueFile, Product } from "@/lib/catalogue/types";
import { carryForward, MAX_CARRY_DAYS } from "@/lib/scrape/carry-forward";
import { sanityFailures } from "@/lib/scrape/sanity";

import { makeProduct } from "../../../test/helpers";

const many = (n: number, overrides: (i: number) => Partial<Product> = () => ({})) =>
  Array.from({ length: n }, (_, i) => makeProduct({ title: `Item ${i}`, storeId: "tentco", externalId: String(i), ...overrides(i) }));

const previousOf = (products: Product[], ranAt = "2026-11-17T03:00:00Z"): CatalogueFile => ({
  version: 1,
  generatedAt: ranAt,
  pricedOn: "2026-11-17",
  stores: { tentco: { ok: true, count: products.length, rawCount: products.length, ranAt } },
  products,
});

describe("sanityFailures", () => {
  it("passes a normal run", () => {
    expect(sanityFailures("tentco", many(100), 100, many(98))).toEqual([]);
  });

  it("fails when most of a store's catalogue stopped parsing", () => {
    expect(sanityFailures("tentco", many(10), 100, [])[0]).toMatch(/^10 of 100 catalogue products survived/);
  });

  it("allows a store's own lower yield floor", () => {
    expect(sanityFailures("nationalluna", many(30), 175, [])).toEqual([]);
  });

  it("fails when a store's product count collapses", () => {
    expect(sanityFailures("tentco", many(50), 50, many(100))[0]).toMatch(/fell from 100 to 50/);
  });

  it("judges a store with no earlier products only on how much of its catalogue parsed", () => {
    expect(sanityFailures("tentco", many(100, () => ({ priceZar: 1, wasZar: 200 })), 100, [])).toEqual([]);
  });

  it("fails when most products gain a was-price the last run doesn't back", () => {
    const failures = sanityFailures("tentco", many(100, () => ({ wasZar: 200 })), 100, many(100));
    expect(failures[0]).toMatch(/^100% of products show a was-price that is neither the price nor the was-price recorded last run/);
    expect(failures[0]).toMatch(/"Item 0" was R200, R100 last run/);
  });

  it("passes a store-wide sale whose was-prices are the prices recorded last run", () => {
    const onSale = many(100, () => ({ priceZar: 95, wasZar: 100 }));
    expect(sanityFailures("tentco", onSale, 100, many(100))).toEqual([]);
  });

  it("passes was-prices the store already showed last run", () => {
    const onSale = many(100, () => ({ priceZar: 80, wasZar: 120 }));
    const cheaperStill = many(100, () => ({ priceZar: 70, wasZar: 120 }));
    expect(sanityFailures("tentco", cheaperStill, 100, onSale)).toEqual([]);
  });

  it("doesn't count a was-price on a product the last run didn't have as backed", () => {
    const failures = sanityFailures("tentco", many(100, () => ({ priceZar: 95, wasZar: 100 })), 100, many(40));
    expect(failures[0]).toMatch(/^60% of products show a was-price/);
    expect(failures[0]).toMatch(/"Item 40" was R100, not seen last run/);
  });

  it("fails when many prices collapse at once, as a unit change would cause", () => {
    const failures = sanityFailures("tentco", many(100, () => ({ priceZar: 1 })), 100, many(100));
    expect(failures[0]).toMatch(/^100 products fell 70% or more/);
  });
});

describe("carryForward", () => {
  it("keeps a failed store's last products while its last good read is recent", () => {
    const previous = previousOf(many(3));
    const out = carryForward("tentco", "HTTP 500", "2026-11-18T03:00:00Z", previous);
    expect(out.products).toHaveLength(3);
    expect(out.status).toEqual({ ok: false, count: 3, error: "HTTP 500", ranAt: "2026-11-18T03:00:00Z", lastOkAt: "2026-11-17T03:00:00Z" });
  });

  it("drops them once the last good read is too old", () => {
    const previous = previousOf(many(3));
    const late = new Date(Date.parse("2026-11-17T03:00:00Z") + (MAX_CARRY_DAYS + 1) * 86_400_000).toISOString();
    expect(carryForward("tentco", "HTTP 500", late, previous).products).toEqual([]);
  });

  it("keeps the last good date through repeated failures", () => {
    const first = carryForward("tentco", "e", "2026-11-18T03:00:00Z", previousOf(many(2)));
    const after: CatalogueFile = { ...previousOf(first.products), stores: { tentco: first.status } };
    expect(carryForward("tentco", "e", "2026-11-19T03:00:00Z", after).status.lastOkAt).toBe("2026-11-17T03:00:00Z");
  });
});
