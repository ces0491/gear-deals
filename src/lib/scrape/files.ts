/**
 * The committed data files. Each product sits on its own line, so a day's commit
 * shows exactly which products changed, and git stores the daily file as a small delta.
 */
import { z } from "zod";

import type { CatalogueFile, HistoryFile } from "@/lib/catalogue/types";

export function stringifyCatalogue(file: CatalogueFile): string {
  const { products, ...head } = file;
  const lines = products.map((p) => JSON.stringify(p));
  const headJson = JSON.stringify(head);
  return `${headJson.slice(0, -1)},"products":[\n${lines.join(",\n")}\n]}\n`;
}

export function stringifyHistory(file: HistoryFile): string {
  const { products, ...head } = file;
  const lines = Object.keys(products)
    .sort()
    .map((id) => `${JSON.stringify(id)}:${JSON.stringify(products[id])}`);
  const headJson = JSON.stringify(head);
  return `${headJson.slice(0, -1)},"products":{\n${lines.join(",\n")}\n}}\n`;
}

/** Light shape checks on read: enough to refuse a truncated or foreign file. */
const catalogueHead = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  pricedOn: z.string(),
  stores: z.record(z.string(), z.unknown()),
  products: z.array(z.object({ id: z.string(), storeId: z.string(), priceZar: z.number() }).loose()),
});

const historyHead = z.object({
  version: z.literal(1),
  startedOn: z.string(),
  products: z.record(z.string(), z.object({ points: z.array(z.unknown()) }).loose()),
});

export function parseCatalogue(text: string): CatalogueFile {
  const json: unknown = JSON.parse(text);
  catalogueHead.parse(json);
  return json as CatalogueFile;
}

export function parseHistory(text: string): HistoryFile {
  const json: unknown = JSON.parse(text);
  historyHead.parse(json);
  return json as HistoryFile;
}
