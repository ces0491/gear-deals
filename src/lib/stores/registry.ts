/**
 * The stores the site reads, and the ones looked at and left out.
 *
 * A store is listed when it publishes a machine-readable catalogue (Shopify's
 * /products.json or WooCommerce's Store API), sells online with prices, and its terms
 * don't ban automated reading. Checked 18 to 20 November 2026.
 */

import type { CategoryHints } from "@/lib/catalogue/categories";

export const STORE_IDS = [
  "campandclimb",
  "megaworld",
  "tentco",
  "oppositelock",
  "eeziawn",
  "bushtech",
  "nationalluna",
  "ironman",
  "adventureinc",
  "trappers",
] as const;

export type StoreId = (typeof STORE_IDS)[number];

export type Platform = "shopify" | "woocommerce";

export interface Store {
  id: StoreId;
  name: string;
  /** The storefront's origin, without a trailing slash. */
  url: string;
  platform: Platform;
  /**
   * The brand whose own shop this is. Its products take this brand, since a maker's
   * shop rarely names itself on each product.
   */
  ownBrand?: string;
  /** Store category names, as the store spells them, that mark a clearance or sale section. */
  clearanceCategories?: string[];
  /** Store category names that mean a particular category at this store (see categorise). */
  categoryHints?: CategoryHints;
  /**
   * Whether the daily scrape reads this store. A store whose site refuses the scrape
   * runner isn't worked around: it's turned off and listed in LEFT_OUT_STORES.
   */
  enabled: boolean;
}

export const STORES: readonly Store[] = [
  {
    id: "campandclimb",
    name: "Camp and Climb",
    url: "https://campandclimb.co.za",
    platform: "woocommerce",
    // Handheld and stand-mounted rechargeable lights, not vehicle spotlights.
    categoryHints: { Spotlights: "camp-lighting" },
    enabled: true,
  },
  {
    id: "megaworld",
    name: "4x4 Mega World",
    url: "https://www.4x4megaworldonline.com",
    platform: "woocommerce",
    clearanceCategories: ["Clearance - Spring Sale"],
    // Mostly headlight globes (H4, H7), not head torches, which it lists as "Flashlights".
    categoryHints: { Headlamps: "vehicle-lighting" },
    enabled: true,
  },
  {
    id: "tentco",
    name: "Tentco",
    url: "https://www.tentco.co.za",
    platform: "woocommerce",
    ownBrand: "Tentco",
    // Tentco's spares, extensions and canvas by the metre are tent and gazebo parts.
    categoryHints: { Spares: "tents", Extensions: "tents", Material: "tents" },
    enabled: true,
  },
  {
    id: "oppositelock",
    name: "Opposite Lock",
    url: "https://oppositelock.co.za",
    platform: "woocommerce",
    // Opposite Lock's lighting range is vehicle lighting: spots, light bars, work lights.
    categoryHints: { Lighting: "vehicle-lighting" },
    enabled: true,
  },
  {
    id: "eeziawn",
    name: "Eezi-Awn",
    url: "https://eezi-awn.com",
    platform: "woocommerce",
    ownBrand: "Eezi-Awn",
    enabled: true,
  },
  {
    id: "bushtech",
    name: "Bushtech",
    url: "https://www.bushtech.co.za",
    platform: "woocommerce",
    ownBrand: "Bushtech",
    enabled: true,
  },
  {
    id: "nationalluna",
    name: "National Luna",
    url: "https://www.nationalluna.com",
    platform: "woocommerce",
    ownBrand: "National Luna",
    enabled: true,
  },
  {
    id: "ironman",
    name: "Ironman 4x4",
    url: "https://www.ironman4x4.co.za",
    platform: "shopify",
    // No ownBrand: the shop also sells Cadac and Born Free, and names each product's vendor.
    // Off since 20 November 2026: it answered the scrape runner with HTTP 403 on 19 and 20
    // November (see LEFT_OUT_STORES). Kept here so its captured responses still test the adapter.
    enabled: false,
  },
  {
    id: "adventureinc",
    name: "Adventure Inc",
    url: "https://www.adventureinc.co.za",
    platform: "shopify",
    enabled: true,
  },
  {
    id: "trappers",
    name: "Trappers",
    url: "https://www.trappers.co.za",
    platform: "shopify",
    enabled: true,
  },
];

const BY_ID = new Map(STORES.map((s) => [s.id, s]));

export function storeById(id: StoreId): Store {
  const store = BY_ID.get(id);
  if (!store) throw new Error(`Unknown store ${id}`);
  return store;
}

export function isStoreId(value: string): value is StoreId {
  return BY_ID.has(value as StoreId);
}

export function enabledStores(stores: readonly Store[] = STORES): Store[] {
  return stores.filter((s) => s.enabled);
}

export interface LeftOutStore {
  name: string;
  url: string;
  reason: string;
}

/** Stores looked at from 18 to 20 November 2026 and not read, so an empty result isn't read as "no deals anywhere". */
export const LEFT_OUT_STORES: readonly LeftOutStore[] = [
  {
    name: "Alpha Accessories",
    url: "https://www.alphaaccessories.co.za",
    reason: "Its terms of service ban spidering, crawling and scraping the site.",
  },
  {
    name: "Camp Cover",
    url: "https://www.campcover.co.za",
    reason: "Its terms of service ban spidering, crawling and scraping the site.",
  },
  {
    name: "Flex Adventures",
    url: "https://www.flexadventures.co.za",
    reason: "Its terms of service ban spidering, crawling and scraping the site.",
  },
  {
    name: "The Bakkie Shop",
    url: "https://thebakkieshop.co.za",
    reason: "Its terms of service ban spidering, crawling and scraping the site.",
  },
  {
    name: "Wild Access",
    url: "https://www.wildaccess.co.za",
    reason: "Its terms of service ban spidering, crawling and scraping the site.",
  },
  {
    name: "All Outdoor and Home",
    url: "https://alloutdoorandhome.co.za",
    reason: "Its terms ban using a robot or spider to monitor or copy the site.",
  },
  {
    name: "Melvill & Moon",
    url: "https://www.melvillandmoon.com",
    reason: "Its site refuses automated requests for its catalogue.",
  },
  {
    name: "Thule Store",
    url: "https://thulestore.co.za",
    reason: "Its site challenges automated requests.",
  },
  {
    name: "Ironman 4x4",
    url: "https://www.ironman4x4.co.za",
    reason: "Its site refuses the daily read (HTTP 403).",
  },
  {
    name: "Safari Centre",
    url: "https://www.safaricentre.co.za",
    reason: "Its online catalogue shows no prices.",
  },
  {
    name: "Snomaster",
    url: "https://www.snomaster.co.za",
    reason: "Its site lists prices but doesn't sell online.",
  },
  {
    name: "Alu-Cab",
    url: "https://www.alu-cab.com",
    reason: "Its site shows its range without prices or a way to buy online.",
  },
  {
    name: "Campmaster",
    url: "https://www.campmaster.co.za",
    reason: "Its site lists its range but doesn't sell online.",
  },
  {
    name: "Tyres & More",
    url: "https://tyresandmore.com",
    reason: "Mostly tyres, which this site doesn't cover.",
  },
  {
    name: "Outdoor Warehouse",
    url: "https://www.outdoorwarehouse.co.za",
    reason: "No public machine-readable catalogue.",
  },
  {
    name: "Cape Union Mart",
    url: "https://www.capeunionmart.co.za",
    reason: "No public machine-readable catalogue, and its site challenges automated requests.",
  },
  {
    name: "Front Runner",
    url: "https://www.frontrunneroutfitters.com",
    reason: "No public machine-readable catalogue. Its products show up through Camp and Climb.",
  },
  {
    name: "Dometic",
    url: "https://www.dometic.com/en-za",
    reason: "No public machine-readable catalogue. It now sells the Front Runner range.",
  },
  {
    name: "Wildebees Outdoor",
    url: "https://wildebeesoutdoor.com",
    reason: "No public machine-readable catalogue.",
  },
  {
    name: "Sportsmans Warehouse",
    url: "https://www.sportsmanswarehouse.co.za",
    reason: "No public machine-readable catalogue.",
  },
  {
    name: "Due South",
    url: "https://www.duesouth.co.za",
    reason: "No public machine-readable catalogue.",
  },
];
