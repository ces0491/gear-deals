import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test as base, type Page } from "@playwright/test";

import type { CatalogueFile, Product } from "../src/lib/catalogue/types";
import { parseCatalogue } from "../src/lib/scrape/files";

export const OUTBOX = join(__dirname, "..", "test-results", "outbox.jsonl");

/** The fixture catalogue the server is running on. */
export const FIXTURE: CatalogueFile = parseCatalogue(
  readFileSync(join(__dirname, "..", "test", "fixtures", "site", "catalogue.json"), "utf8"),
);

export function fixtureProduct(test: (p: Product) => boolean): Product {
  const p = FIXTURE.products.find(test);
  if (!p) throw new Error("No fixture product matches; rebuild it with npm run fixtures:catalogue");
  return p;
}

export function productPath(p: Product): string {
  return `/product/${p.storeId}/${encodeURIComponent(p.externalId)}`;
}

/** Only the app itself is reachable: store photos and anything else external are blocked. */
export const test = base.extend<{ page: Page }>({
  // The fixture callback is named `provide` rather than Playwright's usual `use`, which
  // React's hooks lint rule mistakes for the `use` hook.
  page: async ({ page, baseURL }, provide) => {
    await page.route("**/*", (route) =>
      route.request().url().startsWith(baseURL ?? "http://localhost") ? route.continue() : route.abort(),
    );
    await provide(page);
  },
});

export { expect };

export interface SentEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
}

export function sentEmails(): SentEmail[] {
  if (!existsSync(OUTBOX)) return [];
  return readFileSync(OUTBOX, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SentEmail);
}

/** The path and query of the first link in an email's text matching `path`. */
export function linkIn(email: SentEmail, path: string): string {
  const match = email.text.match(new RegExp(`https?://[^\\s]+(${path.replace(/\//g, "\\/")}\\?token=[\\w.-]+)`));
  if (!match) throw new Error(`No ${path} link in: ${email.text}`);
  return match[1];
}
