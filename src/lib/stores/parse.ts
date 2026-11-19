/**
 * What the store adapters share: reading a catalogue page one product at a time, so one
 * malformed product doesn't cost a store its whole day, and collecting pages into a
 * store's result. When more than MAX_UNREADABLE_SHARE of a store's products can't be
 * read, the catalogue has changed shape rather than one listing being odd, and the store
 * fails as before (its last good products are carried forward).
 */
import type { z } from "zod";

import type { ScrapedProduct } from "@/lib/catalogue/types";
import { StoreFormatError } from "@/lib/scrape/http";

export const MAX_UNREADABLE_SHARE = 0.05;

export interface ParsedItems<T> {
  items: T[];
  /** Items that didn't match the schema. */
  unreadable: number;
  /** What was wrong with the first of them, for the run log. */
  firstProblem: string | null;
}

export function parseEach<S extends z.ZodType>(schema: S, raw: readonly unknown[]): ParsedItems<z.output<S>> {
  const items: z.output<S>[] = [];
  let unreadable = 0;
  let firstProblem: string | null = null;
  for (const item of raw) {
    const parsed = schema.safeParse(item);
    if (parsed.success) {
      items.push(parsed.data);
      continue;
    }
    unreadable += 1;
    if (firstProblem === null) {
      const issue = parsed.error.issues[0];
      const id = typeof item === "object" && item !== null && "id" in item ? ` ${String(item.id)}` : "";
      firstProblem = `product${id}: ${issue.path.join(".") || "item"}: ${issue.message}`;
    }
  }
  return { items, unreadable, firstProblem };
}

/** One catalogue page, as an adapter reads it. */
export interface ParsedPage {
  products: ScrapedProduct[];
  /** Products on the page, including any that couldn't be read. */
  rawCount: number;
  unreadable: number;
  firstProblem: string | null;
}

/** A store's whole catalogue, as an adapter reads it. */
export interface ScrapeResult {
  products: ScrapedProduct[];
  /** Products the catalogue returned, before anything was left out. */
  rawCount: number;
  /** Of rawCount, products that couldn't be read. */
  unreadable: number;
  requests: number;
}

/** Collects a store's pages into its result, failing the store when too much couldn't be read. */
export class PageCollector {
  readonly products: ScrapedProduct[] = [];
  private rawCount = 0;
  private unreadable = 0;
  private firstProblem: string | null = null;

  add(page: ParsedPage): void {
    this.products.push(...page.products);
    this.rawCount += page.rawCount;
    this.unreadable += page.unreadable;
    this.firstProblem ??= page.firstProblem;
  }

  result(storeName: string, requests: number): ScrapeResult {
    if (this.unreadable > this.rawCount * MAX_UNREADABLE_SHARE) {
      throw new StoreFormatError(
        `${this.unreadable} of ${this.rawCount} products in ${storeName}'s catalogue couldn't be read, so it may have changed shape (${this.firstProblem}).`,
      );
    }
    return { products: this.products, rawCount: this.rawCount, unreadable: this.unreadable, requests };
  }
}
