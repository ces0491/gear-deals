import { describe, expect, it } from "vitest";

import type { CatalogueFile, Product } from "@/lib/catalogue/types";
import { carryForward, MAX_CARRY_DAYS } from "@/lib/scrape/carry-forward";
import { runSanityChecks } from "@/lib/scrape/sanity";

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

const ok = (count: number, rawCount = count) => ({ tentco: { ok: true, count, rawCount, ranAt: "2026-11-18T03:00:00Z" } });

describe("runSanityChecks", () => {
  it("passes a normal run", () => {
    expect(runSanityChecks(many(100), ok(100), previousOf(many(98)))).toEqual([]);
  });

  it("fails when most of a store's catalogue stopped parsing", () => {
    expect(runSanityChecks(many(10), ok(10, 100), null)[0]).toMatch(/tentco: 10 of 100 catalogue products survived/);
  });

  it("allows a store's own lower yield floor", () => {
    const products = many(30, (i) => ({ storeId: "nationalluna", externalId: String(i) }));
    expect(runSanityChecks(products, { nationalluna: { ok: true, count: 30, rawCount: 175, ranAt: "x" } }, null)).toEqual([]);
  });

  it("fails when a store's product count collapses", () => {
    expect(runSanityChecks(many(50), ok(50), previousOf(many(100)))[0]).toMatch(/fell from 100 to 50/);
  });

  it("checks the count against carried-forward products when the last run failed", () => {
    const carried: CatalogueFile = {
      ...previousOf(many(100)),
      stores: { tentco: { ok: false, count: 100, error: "HTTP 503", ranAt: "2026-11-17T03:00:00Z", lastOkAt: "2026-11-16T03:00:00Z" } },
    };
    expect(runSanityChecks(many(40), ok(40), carried)[0]).toMatch(/fell from 100 to 40/);
  });

  it("fails when was-prices suddenly appear on most products", () => {
    const failures = runSanityChecks(many(100, () => ({ wasZar: 200 })), ok(100), previousOf(many(100)));
    expect(failures[0]).toMatch(/100% of products now show a was-price, up from 0%/);
  });

  it("fails when many prices collapse at once, as a unit change would cause", () => {
    const failures = runSanityChecks(many(100, () => ({ priceZar: 1 })), ok(100), previousOf(many(100)));
    expect(failures[0]).toMatch(/100 products fell 70% or more/);
  });

  it("doesn't judge stores that failed this run", () => {
    expect(runSanityChecks([], { tentco: { ok: false, count: 0, ranAt: "x" } }, previousOf(many(100)))).toEqual([]);
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
