/** Shared test helpers: fixture loading, a scripted fetch, and product builders. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Product, ScrapedProduct } from "@/lib/catalogue/types";
import type { HttpOptions } from "@/lib/scrape/http";

const FIXTURES = join(__dirname, "fixtures");

export function fixture<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(join(FIXTURES, path), "utf8")) as T;
}

type Reply = Response | (() => Response | Promise<Response>) | Error;

/**
 * An HttpOptions whose fetch answers in order from `replies` and records each URL. Sleep
 * resolves at once and records the delay asked for.
 */
export function scriptedHttp(replies: Reply[]) {
  const urls: string[] = [];
  const sleeps: number[] = [];
  let next = 0;
  const http: HttpOptions = {
    fetch: async (input) => {
      urls.push(String(input));
      const reply = replies[next++];
      if (reply === undefined) throw new Error(`Unexpected request ${String(input)}`);
      if (reply instanceof Error) throw reply;
      return typeof reply === "function" ? reply() : reply;
    },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  };
  return { http, urls, sleeps };
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" }, ...init });
}

export function makeScraped(overrides: Partial<ScrapedProduct> & { title: string }): ScrapedProduct {
  return {
    storeId: "campandclimb",
    externalId: overrides.title.toLowerCase().replace(/\W+/g, "-"),
    url: "https://campandclimb.co.za/product/x",
    image: null,
    brand: null,
    sku: null,
    storeCategories: [],
    priceZar: 100,
    maxPriceZar: null,
    wasZar: null,
    inStock: true,
    ...overrides,
  };
}

export function makeProduct(overrides: Partial<Product> & { title: string }): Product {
  const externalId = overrides.externalId ?? overrides.title.toLowerCase().replace(/\W+/g, "-");
  const storeId = overrides.storeId ?? "campandclimb";
  return {
    id: `${storeId}:${externalId}`,
    storeId,
    externalId,
    url: "https://campandclimb.co.za/product/x",
    image: null,
    brand: null,
    category: "other",
    storeCategories: [],
    sku: null,
    matchKey: null,
    priceZar: 100,
    maxPriceZar: null,
    wasZar: null,
    inStock: true,
    clearance: null,
    firstSeen: "2026-11-18",
    deal: null,
    ...overrides,
  };
}
