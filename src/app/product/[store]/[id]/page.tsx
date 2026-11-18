import { ChevronLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AlertForm } from "@/components/alert-form";
import { DealTag } from "@/components/deal-tag";
import { PriceChart } from "@/components/price-chart";
import { ProductImage } from "@/components/product-image";
import { WatchButton } from "@/components/watch-button";
import { alertsRuntime } from "@/lib/alerts/runtime";
import { categoryLabel } from "@/lib/catalogue/categories";
import type { Product } from "@/lib/catalogue/types";
import { catalogue, historyOf, productById, sameItemElsewhere } from "@/lib/data/catalogue";
import { DEFAULT_QUERY, queryHref } from "@/lib/data/query";
import { daysBetween, formatDisplayDate } from "@/lib/dates";
import { reasonText } from "@/lib/deal-text";
import { formatRand, plural } from "@/lib/format";
import { historyStats } from "@/lib/history/history";
import { productPath } from "@/lib/paths";
import { SECOND_HAND_MIN_PRICE_ZAR, secondHandLinks, secondHandQuery } from "@/lib/second-hand";
import { storeById } from "@/lib/stores/registry";

/** Product pages prerendered at build: the current best deals. The rest render on first visit. */
const PRERENDERED = 60;

export function generateStaticParams() {
  const best = catalogue()
    .products.filter((p) => p.deal && p.inStock)
    .sort((a, b) => (b.deal?.savingPct ?? 0) - (a.deal?.savingPct ?? 0))
    .slice(0, PRERENDERED);
  // Cache Components needs at least one; an empty catalogue still builds.
  const params = (best.length > 0 ? best : catalogue().products.slice(0, 1)).map((p) => ({ store: p.storeId, id: p.externalId }));
  return params.length > 0 ? params : [{ store: "none", id: "none" }];
}

function lookup(store: string, id: string): Product | null {
  return productById(`${store}:${decodeURIComponent(id)}`);
}

export async function generateMetadata({ params }: PageProps<"/product/[store]/[id]">): Promise<Metadata> {
  const { store, id } = await params;
  const product = lookup(store, id);
  if (!product) return { title: "Product not found" };
  return {
    title: `${product.title} at ${storeById(product.storeId).name}`,
    description: `${formatRand(product.priceZar)} at ${storeById(product.storeId).name}, with its price history.`,
    // Product pages restate store listings; only the deals list is offered to search engines.
    robots: { index: false, follow: true },
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-6">
      <h2 className="narrow mb-3 text-2xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

async function ProductView({ params }: { params: PageProps<"/product/[store]/[id]">["params"] }) {
  const { store: storeId, id } = await params;
  const product = lookup(storeId, id);
  if (!product) notFound();

  const store = storeById(product.storeId);
  const { pricedOn } = catalogue();
  const history = historyOf(product.id);
  const stats = history ? historyStats(history, pricedOn) : null;
  const others = sameItemElsewhere(product);
  const alertsOn = alertsRuntime() !== null;

  return (
    <article className="space-y-8">
      <div className="grid gap-6 md:grid-cols-[minmax(0,26rem)_1fr] md:gap-10">
        <div className="relative">
          <ProductImage src={product.image} alt={product.title} width={640} priority className="rounded-md border border-line" />
        </div>
        <div className="min-w-0 space-y-4">
          <p className="text-ink-muted">
            {product.brand && product.brand !== store.name ? (
              <>
                <Link href={queryHref(DEFAULT_QUERY, { brand: product.brand, all: true })} className="text-ink underline-offset-2 hover:underline">
                  {product.brand}
                </Link>{" "}
                at {store.name}
              </>
            ) : (
              <>At {store.name}</>
            )}
          </p>
          <h1 className="narrow text-3xl leading-tight font-extrabold sm:text-4xl">{product.title}</h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <p className="flex items-baseline gap-3">
              <span className="price text-5xl">
                {product.maxPriceZar !== null && <span className="text-xl font-medium">from </span>}
                {formatRand(product.priceZar)}
              </span>
              {product.wasZar !== null && <s className="text-xl text-ink-muted">{formatRand(product.wasZar)}</s>}
            </p>
            {product.deal && <DealTag deal={product.deal} size="lg" />}
          </div>
          {product.maxPriceZar !== null && (
            <p className="text-sm text-ink-muted">Its options run up to {formatRand(product.maxPriceZar)}; the store&rsquo;s page has each one&rsquo;s price.</p>
          )}
          <p className={product.inStock ? "font-medium text-canvas-strong" : "font-medium text-danger"}>
            {product.inStock ? "In stock" : "Out of stock"} at {store.name} on {formatDisplayDate(pricedOn)}
          </p>
          {product.deal && (
            <ul className="space-y-1.5">
              {product.deal.reasons.map((r) => (
                <li key={r.kind} className="border-l-4 border-tag pl-3">
                  {reasonText(r, pricedOn)}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-start gap-3 pt-1">
            <a
              href={product.url}
              rel="noopener"
              className="inline-flex items-center gap-2 rounded bg-ink px-4 py-2 font-semibold text-surface"
            >
              Buy at {store.name}
              <ExternalLink aria-hidden className="size-4" />
            </a>
            <WatchButton id={product.id} title={product.title} priceZar={product.priceZar} />
          </div>
          {alertsOn ? (
            <AlertForm productId={product.id} priceZar={product.priceZar} />
          ) : (
            <p className="rounded-md border border-dashed border-line p-4 text-sm text-ink-muted">Price alerts aren&rsquo;t available right now.</p>
          )}
        </div>
      </div>

      <Section title={`Price at ${store.name}`}>
        {history && stats && history.points.length >= 2 ? (
          <>
            <PriceChart
              points={history.points.map((p) => ({ on: p.on, priceZar: p.priceZar }))}
              end={pricedOn}
              label={`Price at ${store.name}`}
            />
            <p className="mt-2 text-ink-muted">
              Tracked for {plural(stats.trackedDays, "day")}. Lowest seen: {formatRand(stats.lowestZar)}, on {formatDisplayDate(stats.lowestOn)}.
            </p>
          </>
        ) : (
          <p className="text-ink-muted">
            {history
              ? `Tracked since ${formatDisplayDate(history.firstSeen)}${
                  daysBetween(history.firstSeen, pricedOn) > 0 ? `, and it's been ${formatRand(product.priceZar)} every day since` : ""
                }. A chart appears once the price changes.`
              : "This product hasn't been tracked yet."}
          </p>
        )}
      </Section>

      {others.length > 0 && (
        <Section title="Same item at other stores">
          <p className="mb-3 text-sm text-ink-muted">
            Matched on the manufacturer code {product.sku}.{" "}
            <Link href="/how-it-works#matching" className="underline">
              How matching works
            </Link>
          </p>
          <table className="w-full max-w-2xl text-left">
            <thead>
              <tr className="border-b border-line text-sm text-ink-muted">
                <th scope="col" className="py-2 font-medium">
                  Store
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Price
                </th>
                <th scope="col" className="py-2 pl-4 font-medium">
                  Stock
                </th>
              </tr>
            </thead>
            <tbody>
              {[product, ...others].map((p) => (
                <tr key={p.id} className="border-b border-line">
                  <td className="py-2">
                    {p.id === product.id ? (
                      <span className="font-semibold">{storeById(p.storeId).name} (this page)</span>
                    ) : (
                      <Link href={productPath(p)} className="text-canvas underline underline-offset-2">
                        {storeById(p.storeId).name}
                      </Link>
                    )}
                  </td>
                  <td className="price py-2 text-right text-lg">{formatRand(p.priceZar)}</td>
                  <td className="py-2 pl-4">{p.inStock ? "In stock" : "Out of stock"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {product.priceZar >= SECOND_HAND_MIN_PRICE_ZAR && <SecondHand query={secondHandQuery(product)} />}

      <Section title="Details">
        <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt className="text-ink-muted">Category</dt>
          <dd>
            <Link href={queryHref(DEFAULT_QUERY, { categories: [product.category], all: true })} className="text-canvas underline underline-offset-2">
              {categoryLabel(product.category)}
            </Link>
          </dd>
          {product.sku && (
            <>
              <dt className="text-ink-muted">Store&rsquo;s code</dt>
              <dd className="break-all">{product.sku}</dd>
            </>
          )}
          <dt className="text-ink-muted">First seen</dt>
          <dd>{formatDisplayDate(product.firstSeen)}</dd>
        </dl>
      </Section>
    </article>
  );
}

function SecondHand({ query }: { query: string }) {
  return (
    <Section title="Look for a used one">
      <p className="mb-3 max-w-prose text-ink-muted">
        These open each site&rsquo;s own search for &ldquo;{query}&rdquo;. This site doesn&rsquo;t read or check those
        listings, so compare them yourself.
      </p>
      <ul className="flex flex-wrap gap-3">
        {secondHandLinks(query).map((link) => (
          <li key={link.site}>
            {/* noreferrer: the marketplace isn't told which page sent you. */}
            <a
              href={link.url}
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded border border-line bg-surface px-3 py-2 font-medium hover:border-canvas hover:text-canvas-strong"
            >
              Search {link.site}
              <ExternalLink aria-hidden className="size-4" />
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function ProductFallback() {
  return (
    <div aria-busy="true" className="grid gap-6 md:grid-cols-[minmax(0,26rem)_1fr] md:gap-10">
      <div className="aspect-square rounded-md bg-surface" />
      <div className="space-y-4">
        <div className="h-6 w-40 rounded bg-surface" />
        <div className="h-12 w-full rounded bg-surface" />
        <div className="h-14 w-48 rounded bg-surface" />
      </div>
    </div>
  );
}

export default function ProductPage({ params }: PageProps<"/product/[store]/[id]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
      <Link href="/" className="mb-5 inline-flex items-center gap-1 text-canvas underline-offset-2 hover:underline">
        <ChevronLeft aria-hidden className="size-4" />
        All deals
      </Link>
      <Suspense fallback={<ProductFallback />}>
        <ProductView params={params} />
      </Suspense>
    </div>
  );
}
