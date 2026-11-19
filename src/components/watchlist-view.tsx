"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { WatchedProduct, WatchedProducts } from "@/app/api/products/route";
import { ProductImage } from "@/components/product-image";
import { formatRand } from "@/lib/format";
import {
  changeFor,
  markVisited,
  readWatchlist,
  unwatch,
  useWatchlist,
  visitBaseline,
  type VisitSnapshot,
  type WatchState,
} from "@/lib/watchlist";

type Load =
  | { status: "loading" }
  | { status: "ready"; products: Map<string, WatchedProduct>; baseline: VisitSnapshot | null }
  | { status: "failed" };

function Change({ amount, label }: { amount: number | null; label: string }) {
  if (amount === null) return null;
  if (amount === 0) return <span className="text-ink-muted">No change {label}</span>;
  const down = amount < 0;
  return (
    <span className={down ? "font-semibold text-canvas-strong" : "text-danger"}>
      {down ? "Down" : "Up"} {formatRand(Math.abs(amount))} {label}
    </span>
  );
}

export function WatchlistView() {
  const { items } = useWatchlist();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  // The stored list as it was before this visit is recorded, read once, so "since your last
  // visit" keeps comparing against the same visit when an item is removed and the list reloads.
  const before = useRef<WatchState | undefined>(undefined);
  const ids = items.map((i) => i.id).join(",");

  useEffect(() => {
    before.current ??= readWatchlist();
    const stored = before.current;
    // An empty list renders its own message without loading anything.
    if (!ids) return;
    const controller = new AbortController();
    fetch(`/api/products?ids=${encodeURIComponent(ids)}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const body = (await r.json()) as WatchedProducts;
        const products = new Map(body.products.map((p) => [p.id, p]));
        setLoad({ status: "ready", products, baseline: visitBaseline(stored, body.pricedOn) });
        markVisited(body.pricedOn, Object.fromEntries(body.products.map((p) => [p.id, p.priceZar])));
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ status: "failed" });
      });
    return () => controller.abort();
  }, [ids]);

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line bg-surface p-6">
        <p className="font-medium">Nothing on your watchlist yet.</p>
        <p className="mt-1 text-ink-muted">
          Tap <strong>Watch</strong> on any product and it&rsquo;ll show here with how its price has moved.{" "}
          <Link href="/" className="text-canvas underline">
            Browse deals
          </Link>
        </p>
      </div>
    );
  }
  if (load.status === "failed") {
    return <p className="text-danger">Current prices couldn&rsquo;t be loaded. Refresh the page to try again.</p>;
  }

  return (
    <ul className="divide-y divide-line border-y border-line" aria-busy={load.status === "loading"}>
      {items.map((item) => {
        const p = load.status === "ready" ? load.products.get(item.id) : undefined;
        const change = p && load.status === "ready" ? changeFor(item, p.priceZar, load.baseline) : null;
        return (
          <li key={item.id} className="grid grid-cols-[4.5rem_1fr_auto] items-start gap-4 py-4">
            <ProductImage src={p?.image ?? null} alt="" width={160} className="rounded border border-line" />
            <div className="min-w-0 space-y-1">
              {p ? (
                <Link href={p.path} className="font-medium underline-offset-2 hover:underline">
                  {p.title}
                </Link>
              ) : (
                <span className="font-medium">{item.title}</span>
              )}
              {p ? (
                <>
                  <p className="text-sm text-ink-muted">
                    At {p.storeName}
                    {!p.inStock && <span className="text-danger">, out of stock</span>}
                  </p>
                  <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="price text-2xl">{formatRand(p.priceZar)}</span>
                    {p.tag && (
                      <span className="rounded-sm bg-tag px-1.5 text-sm font-semibold text-tag-ink">
                        {p.tag.big} {p.tag.small}
                      </span>
                    )}
                  </p>
                  {change && (
                    <p className="flex flex-col text-sm sm:flex-row sm:gap-4">
                      <Change amount={change.sinceAdded} label="since you added it" />
                      <Change amount={change.sinceLastVisit} label="since your last visit" />
                    </p>
                  )}
                </>
              ) : load.status === "ready" ? (
                <p className="text-sm text-ink-muted">No longer listed by the store.</p>
              ) : (
                <p className="text-sm text-ink-muted">Loading the price…</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => unwatch(item.id)}
              className="rounded p-1.5 text-ink-muted hover:bg-surface hover:text-ink"
              aria-label={`Remove ${item.title} from the watchlist`}
            >
              <X aria-hidden className="size-5" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
