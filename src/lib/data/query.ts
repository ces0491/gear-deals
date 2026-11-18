/**
 * Searching, filtering, sorting and paging the catalogue for the deals page. Pure, so
 * it's tested without a server; the page passes in the catalogue's products.
 *
 * URL parameters are read leniently: a link can be edited by hand, and a value the site
 * doesn't know (an old category, a typo) is dropped rather than turned into an error.
 */
import { CATEGORY_IDS, type CategoryId } from "@/lib/catalogue/categories";
import type { DealKind, Product } from "@/lib/catalogue/types";
import { isStoreId, type StoreId } from "@/lib/stores/registry";
import { searchable } from "@/lib/text";

export const SORTS = ["rand", "saving", "price-asc", "price-desc"] as const;
export type Sort = (typeof SORTS)[number];

/**
 * Rand saving is the default. By percentage the top deals on 18 November 2026 were all
 * R100 to R200 light filters at about 70% off; by rand they were bull bars and side
 * steps, which is what a 4x4 buyer is looking for.
 */
export const DEFAULT_SORT: Sort = "rand";

export const SORT_LABELS: Record<Sort, string> = {
  rand: "Biggest saving (rand)",
  saving: "Biggest saving (%)",
  "price-asc": "Price, low to high",
  "price-desc": "Price, high to low",
};

export const DEAL_KINDS = ["was-price", "price-drop", "cheaper-elsewhere", "clearance"] as const satisfies readonly DealKind[];

export const DEAL_KIND_LABELS: Record<DealKind, string> = {
  "was-price": "Store's was-price",
  "price-drop": "Price drop we tracked",
  "cheaper-elsewhere": "Cheaper than another store",
  clearance: "In a clearance section",
};

export const MIN_SAVING_OPTIONS = [0, 10, 20, 30, 50] as const;
export const PAGE_SIZE = 24;
/** Longest search accepted; longer text is cut. */
const MAX_QUERY_LENGTH = 80;

export interface DealQuery {
  q: string;
  categories: CategoryId[];
  stores: StoreId[];
  brand: string | null;
  reasons: DealKind[];
  /** Minimum saving, in whole percent. 0 means any. */
  minPct: number;
  /** Include products that aren't deals. */
  all: boolean;
  includeOutOfStock: boolean;
  sort: Sort;
  page: number;
}

export const DEFAULT_QUERY: DealQuery = {
  q: "",
  categories: [],
  stores: [],
  brand: null,
  reasons: [],
  minPct: 0,
  all: false,
  includeOutOfStock: false,
  sort: DEFAULT_SORT,
  page: 1,
};

type Params = Record<string, string | string[] | undefined>;

function values(params: Params, key: string): string[] {
  const v = params[key];
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}

function first(params: Params, key: string): string | undefined {
  return values(params, key)[0];
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function parseQuery(params: Params): DealQuery {
  const categorySet = new Set<string>(CATEGORY_IDS);
  const kindSet = new Set<string>(DEAL_KINDS);
  const sort = first(params, "sort");
  const minPct = Number(first(params, "min"));
  const page = Number(first(params, "page"));
  const brand = first(params, "brand")?.trim();
  return {
    q: (first(params, "q") ?? "").trim().slice(0, MAX_QUERY_LENGTH),
    categories: unique(values(params, "category").filter((c): c is CategoryId => categorySet.has(c))),
    stores: unique(values(params, "store").filter(isStoreId)),
    brand: brand ? brand.slice(0, MAX_QUERY_LENGTH) : null,
    reasons: unique(values(params, "reason").filter((r): r is DealKind => kindSet.has(r))),
    minPct: (MIN_SAVING_OPTIONS as readonly number[]).includes(minPct) ? minPct : 0,
    all: first(params, "all") === "1",
    includeOutOfStock: first(params, "stock") === "any",
    sort: (SORTS as readonly string[]).includes(sort ?? "") ? (sort as Sort) : DEFAULT_SORT,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** The URL parameters for a query, leaving out defaults so links stay short. */
export function toSearchParams(query: DealQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (query.q) p.set("q", query.q);
  for (const c of query.categories) p.append("category", c);
  for (const s of query.stores) p.append("store", s);
  if (query.brand) p.set("brand", query.brand);
  for (const r of query.reasons) p.append("reason", r);
  if (query.minPct) p.set("min", String(query.minPct));
  if (query.all) p.set("all", "1");
  if (query.includeOutOfStock) p.set("stock", "any");
  if (query.sort !== DEFAULT_SORT) p.set("sort", query.sort);
  if (query.page > 1) p.set("page", String(query.page));
  return p;
}

export function queryHref(query: DealQuery, changes: Partial<DealQuery> = {}): string {
  const params = toSearchParams({ ...query, ...changes }).toString();
  return params ? `/?${params}` : "/";
}

/** How many filters are narrowing the results, for the phone's "Filters (3)" button. */
export function activeFilterCount(query: DealQuery): number {
  return (
    query.categories.length +
    query.stores.length +
    query.reasons.length +
    (query.brand ? 1 : 0) +
    (query.minPct ? 1 : 0) +
    (query.all ? 1 : 0) +
    (query.includeOutOfStock ? 1 : 0)
  );
}

type Axis = "category" | "store" | "brand" | "reason";

const haystacks = new WeakMap<Product, string>();

function haystack(product: Product, storeNames: Readonly<Record<string, string>>): string {
  let text = haystacks.get(product);
  if (text === undefined) {
    text = ` ${searchable(`${product.title} ${product.brand ?? ""} ${storeNames[product.storeId] ?? ""}`)} `;
    haystacks.set(product, text);
  }
  return text;
}

function matches(product: Product, query: DealQuery, tokens: string[], storeNames: Readonly<Record<string, string>>, skip?: Axis): boolean {
  if (!query.all && !product.deal) return false;
  if (!query.includeOutOfStock && !product.inStock) return false;
  if (query.minPct > 0 && !((product.deal?.savingPct ?? 0) >= query.minPct / 100)) return false;
  if (skip !== "category" && query.categories.length > 0 && !query.categories.includes(product.category)) return false;
  if (skip !== "store" && query.stores.length > 0 && !query.stores.includes(product.storeId)) return false;
  if (skip !== "brand" && query.brand && product.brand !== query.brand) return false;
  if (skip !== "reason" && query.reasons.length > 0 && !product.deal?.reasons.some((r) => query.reasons.includes(r.kind))) {
    return false;
  }
  if (tokens.length > 0) {
    const text = haystack(product, storeNames);
    // Each word must start a word in the product's text: "tent" finds "tents", not "patent".
    if (!tokens.every((t) => text.includes(` ${t}`))) return false;
  }
  return true;
}

export interface Facets {
  categories: Partial<Record<CategoryId, number>>;
  stores: Partial<Record<StoreId, number>>;
  reasons: Partial<Record<DealKind, number>>;
  /** Most products first. */
  brands: [string, number][];
}

export interface QueryResult {
  total: number;
  page: number;
  pageCount: number;
  items: Product[];
  facets: Facets;
}

function compare(sort: Sort): (a: Product, b: Product) => number {
  const byTitle = (a: Product, b: Product) => a.title.localeCompare(b.title);
  // Clearance listings have no figure; they follow the measured deals, ahead of non-deals.
  const isDeal = (a: Product, b: Product) => Number(Boolean(b.deal)) - Number(Boolean(a.deal));
  switch (sort) {
    case "price-asc":
      return (a, b) => a.priceZar - b.priceZar || byTitle(a, b);
    case "price-desc":
      return (a, b) => b.priceZar - a.priceZar || byTitle(a, b);
    case "rand":
      return (a, b) =>
        (b.deal?.savingZar ?? -1) - (a.deal?.savingZar ?? -1) ||
        isDeal(a, b) ||
        (b.deal?.savingPct ?? -1) - (a.deal?.savingPct ?? -1) ||
        byTitle(a, b);
    case "saving":
      return (a, b) =>
        (b.deal?.savingPct ?? -1) - (a.deal?.savingPct ?? -1) ||
        isDeal(a, b) ||
        (b.deal?.savingZar ?? -1) - (a.deal?.savingZar ?? -1) ||
        byTitle(a, b);
  }
}

export function runQuery(
  products: readonly Product[],
  query: DealQuery,
  storeNames: Readonly<Record<string, string>>,
): QueryResult {
  const tokens = searchable(query.q).split(" ").filter(Boolean);

  const facets: Facets = { categories: {}, stores: {}, reasons: {}, brands: [] };
  const brandCounts = new Map<string, number>();
  const found: Product[] = [];

  for (const p of products) {
    if (matches(p, query, tokens, storeNames, "category")) facets.categories[p.category] = (facets.categories[p.category] ?? 0) + 1;
    if (matches(p, query, tokens, storeNames, "store")) facets.stores[p.storeId] = (facets.stores[p.storeId] ?? 0) + 1;
    if (p.brand && matches(p, query, tokens, storeNames, "brand")) brandCounts.set(p.brand, (brandCounts.get(p.brand) ?? 0) + 1);
    if (p.deal && matches(p, query, tokens, storeNames, "reason")) {
      for (const kind of new Set(p.deal.reasons.map((r) => r.kind))) facets.reasons[kind] = (facets.reasons[kind] ?? 0) + 1;
    }
    if (matches(p, query, tokens, storeNames)) found.push(p);
  }
  facets.brands = [...brandCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  found.sort(compare(query.sort));
  const pageCount = Math.max(1, Math.ceil(found.length / PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  return {
    total: found.length,
    page,
    pageCount,
    items: found.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    facets,
  };
}
