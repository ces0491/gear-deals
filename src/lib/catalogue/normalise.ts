import { brandFromTitle, canonicalBrand } from "@/lib/catalogue/brands";
import { categorise } from "@/lib/catalogue/categories";
import type { Product, ScrapedProduct } from "@/lib/catalogue/types";
import { cleanText } from "@/lib/text";
import { storeById, type Store } from "@/lib/stores/registry";

/** A product before history and deals are added. */
export type NormalisedProduct = Omit<Product, "firstSeen" | "deal">;

/**
 * A was-price implying more than this discount is taken to be a store's data error (a
 * placeholder or a missing digit) rather than a real discount, and is dropped. The
 * largest discount in the stores' data on 18 November 2026 was 75%.
 */
export const MAX_CREDIBLE_DISCOUNT = 0.9;

/** Shortest manufacturer code that's matched across stores. Shorter codes collide. */
export const MIN_SKU_LENGTH = 5;

/** Upper-case letters and digits only, or null when too short or not code-like. */
export function normaliseSku(sku: string | null): string | null {
  if (!sku) return null;
  const key = sku.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (key.length < MIN_SKU_LENGTH) return null;
  // A code has both letters and digits; a bare number is usually a store's own counter.
  if (!/[A-Z]/.test(key) || !/\d/.test(key)) return null;
  return key;
}

export type NormaliseOutcome = { product: NormalisedProduct } | { excluded: true; because: string };

export function normalise(scraped: ScrapedProduct, store: Store = storeById(scraped.storeId)): NormaliseOutcome {
  const title = cleanText(scraped.title);
  const storeCategories = scraped.storeCategories.map(cleanText).filter(Boolean);
  if (!title) return { excluded: true, because: "no name" };

  const placement = categorise(title, storeCategories, store.categoryHints);
  if ("excluded" in placement) return placement;

  // A maker's own shop names its brand; otherwise a known brand at the start of the name
  // beats the store's brand field, which some stores fill with a house default (4x4 Mega
  // World tags "ARB Hydraulic Jack Adaptor" as Desert Products).
  const givenBrand = scraped.brand ? cleanText(scraped.brand) : null;
  const brand = store.ownBrand ?? brandFromTitle(title) ?? (givenBrand ? canonicalBrand(givenBrand) : null);

  const wasZar =
    scraped.wasZar !== null && 1 - scraped.priceZar / scraped.wasZar <= MAX_CREDIBLE_DISCOUNT ? scraped.wasZar : null;

  const clearanceNames = new Set((store.clearanceCategories ?? []).map((c) => c.toLowerCase()));
  const clearance = storeCategories.find((c) => clearanceNames.has(c.toLowerCase())) ?? null;

  return {
    product: {
      id: `${scraped.storeId}:${scraped.externalId}`,
      storeId: scraped.storeId,
      externalId: scraped.externalId,
      title,
      url: scraped.url,
      image: scraped.image,
      brand,
      category: placement.category,
      storeCategories,
      sku: scraped.sku,
      matchKey: normaliseSku(scraped.sku),
      priceZar: round2(scraped.priceZar),
      maxPriceZar: scraped.maxPriceZar === null ? null : round2(scraped.maxPriceZar),
      wasZar: wasZar === null ? null : round2(wasZar),
      inStock: scraped.inStock,
      clearance,
    },
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
