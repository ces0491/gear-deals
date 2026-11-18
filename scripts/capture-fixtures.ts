/**
 * Re-captures the store responses the unit tests run against:
 * `npm run fixtures:capture` (WooCommerce stores) or `-- --shopify` (Shopify stores).
 *
 * Reads the first catalogue page of each fixture store, exactly as the scraper asks for
 * it, and keeps a small sample that covers the cases the parsers handle: sale prices,
 * option ranges, products not for sale or priced at zero, clearance sections, HTML
 * entities in names, and categories that aren't gear. One request per store (two for
 * Shopify), a second apart.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getJson, realHttp } from "../src/lib/scrape/http";
import { storeById, type StoreId } from "../src/lib/stores/registry";
import { productsUrl as shopifyUrl } from "../src/lib/stores/shopify";
import { productsUrl as wooUrl } from "../src/lib/stores/woocommerce";

const WOO_STORES: StoreId[] = ["campandclimb", "oppositelock", "megaworld", "tentco"];
const SHOPIFY_STORES: StoreId[] = ["ironman", "adventureinc", "trappers"];
const KEEP = 24;
const OUT = join(process.cwd(), "test", "fixtures", "stores");

type Item = Record<string, unknown>;

/** Picks up to `n` items matching `test`, in catalogue order, that aren't already picked. */
function pick(items: Item[], chosen: Set<Item>, n: number, test: (item: Item) => boolean) {
  for (const item of items) {
    if (n <= 0) return;
    if (!chosen.has(item) && test(item)) {
      chosen.add(item);
      n -= 1;
    }
  }
}

function sampleWoo(items: Item[]): Item[] {
  const chosen = new Set<Item>();
  const prices = (i: Item) => i.prices as { price: string; regular_price: string; price_range: unknown };
  const categories = (i: Item) => (i.categories as { name: string }[]).map((c) => c.name).join(" ");
  pick(items, chosen, 6, (i) => i.on_sale === true);
  pick(items, chosen, 3, (i) => i.type === "variable" && prices(i).price_range !== null);
  pick(items, chosen, 3, (i) => i.is_purchasable === false);
  pick(items, chosen, 2, (i) => i.is_purchasable === true && !(Number(prices(i).price) > 0));
  pick(items, chosen, 3, (i) => /clearance/i.test(categories(i)));
  pick(items, chosen, 3, (i) => /&#?\w+;/.test(String(i.name)));
  pick(items, chosen, 2, (i) => /climb|book|clothing/i.test(categories(i)));
  pick(items, chosen, KEEP - chosen.size, () => true);
  return items.filter((i) => chosen.has(i));
}

function sampleShopify(items: Item[]): Item[] {
  const chosen = new Set<Item>();
  const variants = (i: Item) => i.variants as { price: string; compare_at_price: string | null; available: boolean }[];
  pick(items, chosen, 6, (i) => variants(i).some((v) => v.compare_at_price && Number(v.compare_at_price) > Number(v.price)));
  pick(items, chosen, 3, (i) => variants(i).length > 1 && new Set(variants(i).map((v) => v.price)).size > 1);
  pick(items, chosen, 3, (i) => variants(i).every((v) => !v.available));
  pick(items, chosen, KEEP - chosen.size, () => true);
  return items.filter((i) => chosen.has(i));
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const shopify = process.argv.includes("--shopify");
  for (const id of shopify ? SHOPIFY_STORES : WOO_STORES) {
    const store = storeById(id);
    if (shopify) {
      const meta = await getJson(`${store.url}/meta.json`, realHttp);
      await realHttp.sleep(1000);
      const page = (await getJson(shopifyUrl(store, 1), realHttp)) as { products: Item[] };
      const sample = { products: sampleShopify(page.products) };
      writeFileSync(join(OUT, `${id}-meta.json`), `${JSON.stringify({ currency: (meta as Item).currency }, null, 2)}\n`);
      writeFileSync(join(OUT, `${id}.json`), `${JSON.stringify(sample, null, 2)}\n`);
      console.log(`${id}: kept ${sample.products.length} of ${page.products.length}`);
    } else {
      const page = (await getJson(wooUrl(store, 1), realHttp)) as Item[];
      const sample = sampleWoo(page);
      writeFileSync(join(OUT, `${id}.json`), `${JSON.stringify(sample, null, 2)}\n`);
      console.log(`${id}: kept ${sample.length} of ${page.length}`);
    }
    await realHttp.sleep(1000);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
