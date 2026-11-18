/**
 * Shopify stores, read through the storefront's public catalogue,
 * `GET /products.json?limit=250&page=<n>`, which most Shopify stores leave on. Observed
 * on 18 November 2026:
 *
 * - Each product lists its variants (sizes, colours, kits) with a price string in rand
 *   and an optional `compare_at_price`, the store's was-price.
 * - The catalogue carries no currency, so `GET /meta.json` is read once per run to check
 *   the store prices in rand.
 * - Shopify's edge rate-limits quick runs of catalogue requests from one address with
 *   HTTP 429, across stores, and keeps limiting for a while once it starts. Pages are read
 *   one at a time with a pause, and a 429 is retried after the delay the store asks for.
 */
import { z } from "zod";

import type { ScrapedProduct } from "@/lib/catalogue/types";
import { getJson, StoreFormatError, type HttpOptions } from "@/lib/scrape/http";
import type { Store } from "@/lib/stores/registry";
import type { ScrapeResult } from "@/lib/stores/woocommerce";

export const PAGE_SIZE = 250;
const MAX_PAGES = 40;

const variantSchema = z.object({
  id: z.number(),
  price: z.string(),
  compare_at_price: z.string().nullish(),
  available: z.boolean(),
  sku: z.string().nullish(),
});

const shopifyProductSchema = z.object({
  id: z.number(),
  title: z.string(),
  handle: z.string(),
  vendor: z.string().nullish(),
  product_type: z.string().nullish(),
  // Older storefronts send tags as one comma-separated string.
  tags: z
    .union([z.array(z.string()), z.string()])
    .nullish()
    .transform((tags) =>
      Array.isArray(tags)
        ? tags
        : (tags ?? "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
    ),
  images: z.array(z.object({ src: z.string() })).default([]),
  variants: z.array(variantSchema),
});

export type ShopifyProduct = z.infer<typeof shopifyProductSchema>;

const pageSchema = z.object({ products: z.array(shopifyProductSchema) });

const metaSchema = z.object({ currency: z.string() });

export function productsUrl(store: Store, page: number): string {
  return `${store.url}/products.json?limit=${PAGE_SIZE}&page=${page}`;
}

/** The variant whose price a shopper sees first: the cheapest in stock, else the cheapest. */
export function shopifyPrice(product: ShopifyProduct) {
  const priced = product.variants
    .map((v) => ({ ...v, amount: Number(v.price) }))
    .filter((v) => v.amount > 0);
  if (priced.length === 0) return null;
  const available = priced.filter((v) => v.available);
  const pool = available.length > 0 ? available : priced;
  const chosen = pool.reduce((best, v) => (v.amount < best.amount ? v : best));
  const max = Math.max(...pool.map((v) => v.amount));
  const compareAt = Number(chosen.compare_at_price);
  return {
    priceZar: chosen.amount,
    maxPriceZar: max > chosen.amount ? max : null,
    wasZar: compareAt > chosen.amount ? compareAt : null,
    sku: chosen.sku?.trim() || null,
    inStock: available.length > 0,
  };
}

export function parseShopifyPage(body: unknown, store: Store): { products: ScrapedProduct[]; rawCount: number } {
  const page = pageSchema.parse(body);
  const products: ScrapedProduct[] = [];
  for (const item of page.products) {
    const price = shopifyPrice(item);
    if (!price) continue;
    products.push({
      storeId: store.id,
      externalId: String(item.id),
      title: item.title,
      url: `${store.url}/products/${item.handle}`,
      image: item.images[0]?.src ?? null,
      brand: item.vendor?.trim() || null,
      sku: price.sku,
      storeCategories: [item.product_type, ...item.tags].filter((c): c is string => Boolean(c)),
      priceZar: price.priceZar,
      maxPriceZar: price.maxPriceZar,
      wasZar: price.wasZar,
      inStock: price.inStock,
    });
  }
  return { products, rawCount: page.products.length };
}

export async function scrapeShopify(store: Store, http: HttpOptions, pauseMs: number): Promise<ScrapeResult> {
  const meta = metaSchema.parse(await getJson(`${store.url}/meta.json`, http));
  if (meta.currency !== "ZAR") {
    throw new StoreFormatError(`${store.name} prices in ${meta.currency}, not rand.`);
  }
  const products: ScrapedProduct[] = [];
  let rawCount = 0;
  let requests = 1;
  for (let page = 1; page <= MAX_PAGES; page++) {
    await http.sleep(pauseMs);
    requests += 1;
    const parsed = parseShopifyPage(await getJson(productsUrl(store, page), http), store);
    products.push(...parsed.products);
    rawCount += parsed.rawCount;
    if (parsed.rawCount < PAGE_SIZE) return { products, rawCount, requests };
  }
  throw new StoreFormatError(`${store.name} returned more than ${MAX_PAGES} pages; stopped in case pagination is broken.`);
}
