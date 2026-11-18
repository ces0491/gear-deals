/**
 * WooCommerce stores, read through the Store API that WooCommerce's own block checkout
 * uses: `GET /wp-json/wc/store/v1/products?per_page=100&page=<n>`. It's public and needs
 * no key. Observed on 18 November 2026:
 *
 * - `_fields=<list>` trims each product to the named top-level fields, which cuts a page
 *   by about a third (descriptions and HTML prices are dropped). Nested names such as
 *   `images.src` come back as empty arrays, so only top-level names are asked for.
 * - Prices are strings in minor units (`"189500"` with `currency_minor_unit: 2` is
 *   R1,895.00).
 * - A variable product (one with sizes or colours) gives `price_range` with the lowest
 *   and highest option. Its own `price` and `regular_price` are a default that matches no
 *   option, so no was-price is taken from it.
 * - `is_purchasable: false` marks products the store doesn't sell online (Snomaster's
 *   whole catalogue, some of Opposite Lock's). These, and products priced at zero, are
 *   left out.
 * - Past the last page the API answers `[]`; some installs answer HTTP 400 instead.
 */
import { z } from "zod";

import type { ScrapedProduct } from "@/lib/catalogue/types";
import { getJson, HttpError, StoreFormatError, type HttpOptions } from "@/lib/scrape/http";
import type { Store } from "@/lib/stores/registry";

export const PER_PAGE = 100;
/** Camp and Climb, the largest, ran to 29 pages on 18 November 2026. */
const MAX_PAGES = 60;

export const FIELDS = [
  "id",
  "name",
  "permalink",
  "sku",
  "type",
  "prices",
  "images",
  "categories",
  "brands",
  "is_in_stock",
  "is_purchasable",
  "on_sale",
].join(",");

const wooProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  permalink: z.url(),
  sku: z.string().nullish(),
  type: z.string(),
  prices: z.object({
    price: z.string(),
    regular_price: z.string(),
    currency_code: z.string(),
    currency_minor_unit: z.number().int().min(0).max(4),
    price_range: z.object({ min_amount: z.string(), max_amount: z.string() }).nullish(),
  }),
  images: z.array(z.object({ src: z.string(), thumbnail: z.string().nullish() })).default([]),
  categories: z.array(z.object({ name: z.string() })).default([]),
  // Only stores with a brands plugin send this.
  brands: z.array(z.object({ name: z.string() })).optional().default([]),
  is_in_stock: z.boolean(),
  is_purchasable: z.boolean(),
  on_sale: z.boolean().optional(),
});

export type WooProduct = z.infer<typeof wooProductSchema>;

const pageSchema = z.array(wooProductSchema);

export function productsUrl(store: Store, page: number): string {
  const params = new URLSearchParams({ per_page: String(PER_PAGE), page: String(page), _fields: FIELDS });
  return `${store.url}/wp-json/wc/store/v1/products?${params}`;
}

function amount(minor: string | undefined | null, unit: number): number {
  if (!minor) return Number.NaN;
  return Number(minor) / 10 ** unit;
}

export interface WooPrice {
  priceZar: number;
  maxPriceZar: number | null;
  wasZar: number | null;
}

/** The price a shopper sees, or null when the product has no usable price. */
export function wooPrice(product: WooProduct): WooPrice | null {
  const { prices } = product;
  const unit = prices.currency_minor_unit;
  const range = prices.price_range;

  if (product.type === "variable") {
    // `||` rather than `??`: some installs send "" for an absent amount.
    const price = amount(range?.min_amount || prices.regular_price || prices.price, unit);
    if (!(price > 0)) return null;
    const max = range ? amount(range.max_amount, unit) : Number.NaN;
    return { priceZar: price, maxPriceZar: max > price ? max : null, wasZar: null };
  }

  const price = amount(prices.price, unit);
  if (!(price > 0)) return null;
  const regular = amount(prices.regular_price, unit);
  return { priceZar: price, maxPriceZar: null, wasZar: regular > price ? regular : null };
}

/** Turns one page of the Store API into products, leaving out what can't be bought. */
export function parseWooPage(body: unknown, store: Store): { products: ScrapedProduct[]; rawCount: number } {
  const page = pageSchema.parse(body);
  const products: ScrapedProduct[] = [];
  for (const item of page) {
    if (item.prices.currency_code !== "ZAR") {
      throw new StoreFormatError(`${store.name} priced a product in ${item.prices.currency_code}, not rand.`);
    }
    if (!item.is_purchasable) continue;
    const price = wooPrice(item);
    if (!price) continue;
    const image = item.images[0];
    products.push({
      storeId: store.id,
      externalId: String(item.id),
      title: item.name,
      url: item.permalink,
      image: image ? image.thumbnail || image.src : null,
      brand: item.brands[0]?.name ?? null,
      sku: item.sku?.trim() || null,
      storeCategories: item.categories.map((c) => c.name),
      ...price,
      inStock: item.is_in_stock,
    });
  }
  return { products, rawCount: page.length };
}

export interface ScrapeResult {
  products: ScrapedProduct[];
  /** Products the catalogue returned, before anything was left out. */
  rawCount: number;
  requests: number;
}

/** Reads a store's whole catalogue, one page at a time with a pause between pages. */
export async function scrapeWooCommerce(store: Store, http: HttpOptions, pauseMs: number): Promise<ScrapeResult> {
  const products: ScrapedProduct[] = [];
  let rawCount = 0;
  let requests = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    if (page > 1) await http.sleep(pauseMs);
    let body: unknown;
    try {
      requests += 1;
      body = await getJson(productsUrl(store, page), http);
    } catch (error) {
      // Some installs answer 400 past the last page. A 400 on page one is a real failure.
      if (page > 1 && error instanceof HttpError && error.status === 400) return { products, rawCount, requests };
      throw error;
    }
    const parsed = parseWooPage(body, store);
    products.push(...parsed.products);
    rawCount += parsed.rawCount;
    if (parsed.rawCount < PER_PAGE) return { products, rawCount, requests };
  }
  throw new StoreFormatError(`${store.name} returned more than ${MAX_PAGES} pages; stopped in case pagination is broken.`);
}
