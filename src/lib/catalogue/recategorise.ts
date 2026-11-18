import { categorise } from "@/lib/catalogue/categories";
import { storeById } from "@/lib/stores/registry";

interface Placeable {
  storeId: Parameters<typeof storeById>[0];
  title: string;
  category: string;
  storeCategories: string[];
}

/**
 * Re-applies the current category rules to products already in the catalogue: those
 * carried forward from a failed store read, or the whole file after a rules change
 * (`npm run recategorise`). Products the rules now leave out are dropped.
 */
export function recategorise<T extends Placeable>(products: readonly T[]): { products: T[]; moved: number; dropped: number } {
  const kept: T[] = [];
  let moved = 0;
  let dropped = 0;
  for (const p of products) {
    // A catalogue written before store categories were kept has none; the name still places it.
    const placement = categorise(p.title, p.storeCategories ?? [], storeById(p.storeId).categoryHints);
    if ("excluded" in placement) {
      dropped += 1;
      continue;
    }
    if (placement.category !== p.category) moved += 1;
    kept.push({ ...p, category: placement.category });
  }
  return { products: kept, moved, dropped };
}
