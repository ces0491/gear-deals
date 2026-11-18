import Link from "next/link";

import { DealCard } from "@/components/deal-card";
import { FilterForm } from "@/components/filter-form";
import { FilterSheet } from "@/components/filter-sheet";
import { Pagination } from "@/components/pagination";
import { CATEGORIES } from "@/lib/catalogue/categories";
import { catalogue } from "@/lib/data/catalogue";
import {
  activeFilterCount,
  DEAL_KIND_LABELS,
  DEAL_KINDS,
  DEFAULT_QUERY,
  MIN_SAVING_OPTIONS,
  parseQuery,
  queryHref,
  runQuery,
  SORT_LABELS,
  SORTS,
  type DealQuery,
} from "@/lib/data/query";
import { plural } from "@/lib/format";
import { STORES } from "@/lib/stores/registry";

const STORE_NAMES: Record<string, string> = Object.fromEntries(STORES.map((s) => [s.id, s.name]));
const FORM_ID = "deal-filters";
/** Brands offered in the brand list; the rest are reachable by search. */
const MAX_BRANDS = 60;

function Group({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-line py-4 first:border-t-0 first:pt-0">
      <legend className="narrow float-left mb-2 w-full text-lg font-bold">{legend}</legend>
      <div className="clear-left space-y-1.5">{children}</div>
    </fieldset>
  );
}

function Check({
  name,
  value,
  checked,
  label,
  count,
  type = "checkbox",
}: {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  count?: number;
  type?: "checkbox" | "radio";
}) {
  return (
    <label className="flex items-baseline gap-2.5 py-0.5">
      <input type={type} name={name} value={value} defaultChecked={checked} className="size-4 shrink-0 translate-y-0.5 accent-canvas" />
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="text-sm text-ink-muted tabular-nums">{count}</span>}
    </label>
  );
}

function Filters({ query, facets }: { query: DealQuery; facets: ReturnType<typeof runQuery>["facets"] }) {
  const brands = facets.brands.slice(0, MAX_BRANDS);
  if (query.brand && !brands.some(([b]) => b === query.brand)) brands.unshift([query.brand, 0]);
  return (
    <div className="lg:sticky lg:top-4">
      <Group legend="Deal type">
        {DEAL_KINDS.map((k) => (
          <Check key={k} name="reason" value={k} checked={query.reasons.includes(k)} label={DEAL_KIND_LABELS[k]} count={facets.reasons[k] ?? 0} />
        ))}
      </Group>
      <Group legend="Saving">
        {MIN_SAVING_OPTIONS.map((m) => (
          <Check key={m} type="radio" name="min" value={String(m)} checked={query.minPct === m} label={m === 0 ? "Any" : `${m}% or more`} />
        ))}
      </Group>
      <Group legend="Category">
        {CATEGORIES.filter((c) => (facets.categories[c.id] ?? 0) > 0 || query.categories.includes(c.id)).map((c) => (
          <Check key={c.id} name="category" value={c.id} checked={query.categories.includes(c.id)} label={c.label} count={facets.categories[c.id] ?? 0} />
        ))}
      </Group>
      <Group legend="Store">
        {STORES.filter((s) => (facets.stores[s.id] ?? 0) > 0 || query.stores.includes(s.id)).map((s) => (
          <Check key={s.id} name="store" value={s.id} checked={query.stores.includes(s.id)} label={s.name} count={facets.stores[s.id] ?? 0} />
        ))}
      </Group>
      <Group legend="Brand">
        <label htmlFor="brand" className="sr-only">
          Brand
        </label>
        <select id="brand" name="brand" defaultValue={query.brand ?? ""} className="w-full rounded border border-line bg-surface px-2 py-2">
          <option value="">Any brand</option>
          {brands.map(([b, n]) => (
            <option key={b} value={b}>
              {b} ({n})
            </option>
          ))}
        </select>
      </Group>
      <Group legend="Also show">
        <Check name="all" value="1" checked={query.all} label="Products that aren't deals" />
        <Check name="stock" value="any" checked={query.includeOutOfStock} label="Out of stock" />
      </Group>
      {activeFilterCount(query) > 0 && (
        <p className="border-t border-line pt-4">
          <Link href={queryHref(DEFAULT_QUERY, { q: query.q })} className="font-medium text-canvas underline underline-offset-2">
            Clear filters
          </Link>
        </p>
      )}
      {/* Without JavaScript nothing submits on change, so offer a button. */}
      <noscript>
        <button type="submit" className="mt-4 rounded bg-canvas px-4 py-2 font-semibold text-surface">
          Apply filters
        </button>
      </noscript>
    </div>
  );
}

export async function DealsResults({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const query = parseQuery(await searchParams);
  const { products, pricedOn } = catalogue();
  const result = runQuery(products, query, STORE_NAMES);
  const noun = query.all ? "product" : "deal";
  const resultLabel = `Show ${plural(result.total, noun)}`;

  return (
    <FilterForm id={FORM_ID}>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-[1_1_18rem] gap-2">
          <label htmlFor="q" className="sr-only">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query.q}
            placeholder="Search, e.g. fridge, Front Runner, awning"
            className="min-w-0 flex-1 rounded border border-line bg-surface px-3 py-2 placeholder:text-ink-muted"
          />
          <button type="submit" className="rounded bg-ink px-4 py-2 font-semibold text-surface">
            Search
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="text-sm text-ink-muted">
            Sort
          </label>
          <select id="sort" name="sort" defaultValue={query.sort} className="rounded border border-line bg-surface px-2 py-2">
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[15rem_1fr] lg:gap-8">
        <div className="mb-4 lg:mb-0">
          <FilterSheet activeCount={activeFilterCount(query)} resultLabel={resultLabel}>
            <Filters query={query} facets={result.facets} />
          </FilterSheet>
        </div>
        <section aria-labelledby="results-heading" className="min-w-0">
          <h2 id="results-heading" className="mb-3 text-ink-muted" aria-live="polite">
            {plural(result.total, noun)}
            {query.q && <> for &ldquo;{query.q}&rdquo;</>}
            {result.pageCount > 1 && `, page ${result.page} of ${result.pageCount}`}
          </h2>
          {result.items.length === 0 ? (
            <div className="rounded-md border border-dashed border-line bg-surface p-6">
              <p className="font-medium">Nothing matches these filters.</p>
              <ul className="mt-2 list-inside list-disc text-ink-muted">
                {activeFilterCount(query) > 0 && (
                  <li>
                    <Link href={queryHref(DEFAULT_QUERY, { q: query.q })} className="text-canvas underline">
                      Clear the filters
                    </Link>
                  </li>
                )}
                {!query.all && (
                  <li>
                    <Link href={queryHref(query, { all: true, page: 1 })} className="text-canvas underline">
                      Include products that aren&rsquo;t deals
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {result.items.map((p, i) => (
                <li key={p.id} className="flex">
                  <DealCard product={p} pricedOn={pricedOn} priority={i < 4} />
                </li>
              ))}
            </ul>
          )}
          <Pagination page={result.page} pageCount={result.pageCount} href={(page) => queryHref(query, { page })} />
        </section>
      </div>
    </FilterForm>
  );
}
