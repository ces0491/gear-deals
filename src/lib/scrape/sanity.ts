/**
 * Checks a store's products must pass before they're published. Each one guards a failure
 * that would otherwise go out looking like real data: a parser that stopped reading a
 * store, a catalogue that halved overnight, or a price-unit change that turns every
 * product into a 90%-off "deal".
 *
 * A store-wide sale also puts a was-price on most of a store's products. On 27 November
 * 2026 (Black Friday) 2 027 of Camp and Climb's 2 152 products gained one overnight, most
 * at 5% off, each equal to the price recorded the day before. The was-price check lets
 * those through and counts the was-prices the last run doesn't back.
 *
 * The checks judge one store at a time, so a store that fails them is held back on its
 * own (src/lib/scrape/run.ts) and the others publish.
 */
import type { Product } from "@/lib/catalogue/types";
import type { StoreId } from "@/lib/stores/registry";

/** A store whose product count falls below this share of its last count fails. */
export const COUNT_DROP_FLOOR = 0.6;
/** Fewer raw products than this can't support a ratio. */
export const MIN_RAW_FOR_RATIOS = 20;
/** Below this share of raw products surviving the adapter and normaliser, parsing has likely broken. */
export const MIN_YIELD = 0.3;
/** Stores whose catalogue legitimately yields less. */
export const YIELD_FLOORS: Partial<Record<StoreId, number>> = {
  // National Luna lists its whole range but prices only its fridges and freezers: 30 of
  // 175 products on 18 November 2026.
  nationalluna: 0.1,
  // Trappers is mostly clothing and footwear, which are left out; about 30% of a page of
  // its catalogue was equipment on 18 November 2026.
  trappers: 0.15,
};
/** A store fails when more than this share of its products show a was-price the last run doesn't back. */
export const UNBACKED_WAS_CEILING = 0.5;
/** A fall this large since the last run is a "collapse". */
export const COLLAPSE_FRACTION = 0.7;
/** More collapses than this share of a store's products (and at least COLLAPSE_MIN) fails the store. */
export const COLLAPSE_SHARE = 0.1;
export const COLLAPSE_MIN = 5;

/** What the checks read of a product. */
export type Checked = Pick<Product, "id" | "title" | "priceZar" | "wasZar">;

/**
 * Why a store's products shouldn't be published; empty when they can be.
 *
 * `rawCount` is how many products the store's catalogue returned. `was` is the store's
 * products in the last catalogue: after a failed or held run those are the ones carried
 * forward, so still the last good read. A store with none (a new one, or one whose
 * carried products lapsed) can only be judged on how much of its catalogue parsed.
 */
export function sanityFailures(storeId: StoreId, now: readonly Checked[], rawCount: number, was: readonly Checked[]): string[] {
  const failures: string[] = [];

  const floor = YIELD_FLOORS[storeId] ?? MIN_YIELD;
  if (rawCount >= MIN_RAW_FOR_RATIOS && now.length / rawCount < floor) {
    failures.push(`${now.length} of ${rawCount} catalogue products survived (${pct(now.length / rawCount)}, floor ${pct(floor)})`);
  }

  if (was.length > 0 && now.length / was.length < COUNT_DROP_FLOOR) {
    failures.push(`products fell from ${was.length} to ${now.length} since the last run`);
  }

  const last = new Map(was.map((p) => [p.id, p]));

  if (was.length >= MIN_RAW_FOR_RATIOS && now.length >= MIN_RAW_FOR_RATIOS) {
    const unbacked = now.filter((p) => p.wasZar !== null && !backedByLastRun(p.wasZar, last.get(p.id)));
    if (unbacked.length > now.length * UNBACKED_WAS_CEILING) {
      failures.push(
        `${pct(unbacked.length / now.length)} of products show a was-price that is neither the price nor the was-price recorded last run, e.g. ${unbacked
          .slice(0, 3)
          .map((p) => {
            const prior = last.get(p.id);
            return `"${p.title}" was R${p.wasZar}, ${prior ? `R${prior.priceZar} last run` : "not seen last run"}`;
          })
          .join("; ")}`,
      );
    }
  }

  const collapsed = now.filter((p) => {
    const prior = last.get(p.id);
    return prior !== undefined && p.priceZar <= prior.priceZar * (1 - COLLAPSE_FRACTION);
  });
  if (collapsed.length >= COLLAPSE_MIN && collapsed.length > now.length * COLLAPSE_SHARE) {
    failures.push(
      `${collapsed.length} products fell ${pct(COLLAPSE_FRACTION)} or more in price since the last run, e.g. ${collapsed
        .slice(0, 3)
        .map((p) => `"${p.title}" R${last.get(p.id)?.priceZar} → R${p.priceZar}`)
        .join("; ")}`,
    );
  }

  return failures;
}

/**
 * Whether the last run backs a was-price: the product sold for that then, so this site
 * saw the price itself, or the store already showed the same was-price. A was-price with
 * neither behind it rests on the store's field alone, and a misread field or a
 * regular price raised to dress up a sale looks the same.
 */
function backedByLastRun(wasZar: number, prior: Checked | undefined): boolean {
  if (!prior) return false;
  return sameAmount(wasZar, prior.priceZar) || (prior.wasZar !== null && sameAmount(wasZar, prior.wasZar));
}

/** Equal to the cent. */
function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
