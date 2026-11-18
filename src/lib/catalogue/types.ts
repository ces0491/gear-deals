import type { CategoryId } from "@/lib/catalogue/categories";
import type { StoreId } from "@/lib/stores/registry";

/** One product as a store adapter reads it, before normalising. */
export interface ScrapedProduct {
  storeId: StoreId;
  /** The store's own product id. */
  externalId: string;
  /** As the store gives it, HTML entities included. */
  title: string;
  url: string;
  image: string | null;
  /** The brand the store's data names, if any. */
  brand: string | null;
  sku: string | null;
  /** Category, product type and tag names, as the store spells them. */
  storeCategories: string[];
  priceZar: number;
  /** Set when the product's options span a range of prices; priceZar is then the lowest. */
  maxPriceZar: number | null;
  /** The store's own was-price, when it shows one above the price. */
  wasZar: number | null;
  inStock: boolean;
}

/** A published product. */
export interface Product {
  /** "<store id>:<store's own id>". */
  id: string;
  storeId: StoreId;
  externalId: string;
  title: string;
  url: string;
  image: string | null;
  brand: string | null;
  category: CategoryId;
  /** The store's category, type and tag names, kept so the category can be re-derived without re-reading the store. */
  storeCategories: string[];
  sku: string | null;
  /** The normalised manufacturer code used to find the same item at other stores. */
  matchKey: string | null;
  priceZar: number;
  maxPriceZar: number | null;
  wasZar: number | null;
  inStock: boolean;
  /** The store's clearance or sale section this product is listed in. */
  clearance: string | null;
  /** First day this site saw the product, YYYY-MM-DD in South Africa. */
  firstSeen: string;
  deal: Deal | null;
}

export type DealReason =
  | {
      kind: "was-price";
      wasZar: number;
      savingZar: number;
      savingPct: number;
      /** First day the store showed this was-price, as far as this site has seen. */
      since: string;
      /** True when `since` is the day tracking began, so it may have been shown for longer. */
      sinceTrackingBegan: boolean;
    }
  | { kind: "clearance"; section: string }
  | {
      kind: "price-drop";
      fromZar: number;
      savingZar: number;
      savingPct: number;
      /** The day the lower price was first seen. */
      on: string;
    }
  | {
      kind: "cheaper-elsewhere";
      otherStoreId: StoreId;
      otherProductId: string;
      otherPriceZar: number;
      savingZar: number;
      savingPct: number;
    };

export type DealKind = DealReason["kind"];

export interface Deal {
  reasons: DealReason[];
  /** The biggest saving among the reasons that have one, as a fraction of the reference price. */
  savingPct: number | null;
  /** The rand saving for that same reason. */
  savingZar: number | null;
}

export interface StoreRunStatus {
  ok: boolean;
  /** Products published for this store. On a failed run these are carried forward. */
  count: number;
  /** Products the store's catalogue returned, before normalising. Set on a successful run. */
  rawCount?: number;
  error?: string;
  ranAt: string;
  /** When this store last read successfully. Set on a failed run when known. */
  lastOkAt?: string;
}

export interface CatalogueFile {
  version: 1;
  generatedAt: string;
  /** The day the prices were read, YYYY-MM-DD in South Africa. */
  pricedOn: string;
  stores: Partial<Record<StoreId, StoreRunStatus>>;
  products: Product[];
}

/** A day the price or was-price changed. */
export interface PricePoint {
  on: string;
  priceZar: number;
  wasZar: number | null;
}

export interface ProductHistory {
  firstSeen: string;
  lastSeen: string;
  points: PricePoint[];
}

export interface HistoryFile {
  version: 1;
  /** The first day any price was recorded. */
  startedOn: string;
  products: Record<string, ProductHistory>;
}
