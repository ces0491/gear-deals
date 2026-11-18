/**
 * Re-applies the category rules in src/lib/catalogue/categories.ts to the committed
 * catalogue, without reading any store: `npm run recategorise`. Use it after changing the
 * rules; products the rules now leave out are dropped from data/catalogue.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { recategorise } from "../src/lib/catalogue/recategorise";
import { parseCatalogue, stringifyCatalogue } from "../src/lib/scrape/files";

const path = join(process.cwd(), "data", "catalogue.json");
const catalogue = parseCatalogue(readFileSync(path, "utf8"));
const { products, moved, dropped } = recategorise(catalogue.products);
writeFileSync(path, stringifyCatalogue({ ...catalogue, products }));
console.log(`Moved ${moved} products to another category and dropped ${dropped}; ${products.length} remain.`);
