/**
 * Links from a product page to second-hand marketplaces' own search for the same item.
 * The site never reads those listings: Meta's terms ban automated collection from
 * Facebook, and a used listing has no product code or price history to measure a deal
 * against. These are plain links that open each site's search.
 *
 * Search URLs checked on 18 November 2026: Facebook Marketplace's location-neutral
 * search (it uses the viewer's own location) and Gumtree's search page.
 */
import type { Product } from "@/lib/catalogue/types";
import { HOUSE_DEFAULT_BRANDS } from "@/lib/deals/match";

/** Below this, a used one isn't worth hunting for, and the links would be clutter. */
export const SECOND_HAND_MIN_PRICE_ZAR = 1000;

/** Sellers describe items briefly; a long query finds nothing. */
const MAX_QUERY_WORDS = 6;

/**
 * What a seller would likely call it: the brand and the product's name, without the
 * variant details stores put after a dash or a comma or in brackets ("– Toyota Hilux
 * 2016+", "(Sliding Handle)").
 */
export function secondHandQuery(p: Pick<Product, "title" | "brand">): string {
  const name = p.title
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .split(/\s[–—-]\s|,/)[0]
    .replace(/\s+/g, " ")
    .trim();
  const brand = p.brand && !HOUSE_DEFAULT_BRANDS.has(p.brand.toLowerCase()) ? p.brand : null;
  const withBrand = brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name;
  return withBrand.split(" ").slice(0, MAX_QUERY_WORDS).join(" ");
}

export interface SecondHandLink {
  site: string;
  url: string;
}

export function secondHandLinks(query: string): SecondHandLink[] {
  return [
    {
      site: "Facebook Marketplace",
      url: `https://www.facebook.com/marketplace/search/?${new URLSearchParams({ query })}`,
    },
    {
      site: "Gumtree",
      url: `https://www.gumtree.co.za/search?${new URLSearchParams({ q: query })}`,
    },
  ];
}
