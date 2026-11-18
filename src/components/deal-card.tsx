import Link from "next/link";

import { DealTag } from "@/components/deal-tag";
import { ProductImage } from "@/components/product-image";
import { WatchButton } from "@/components/watch-button";
import type { Product } from "@/lib/catalogue/types";
import { headlineReason, reasonText } from "@/lib/deal-text";
import { formatRand } from "@/lib/format";
import { productPath } from "@/lib/paths";
import { storeById } from "@/lib/stores/registry";

export function DealCard({ product, pricedOn, priority = false }: { product: Product; pricedOn: string; priority?: boolean }) {
  const store = storeById(product.storeId);
  const lead = product.deal ? headlineReason(product.deal) : null;
  return (
    <article className="group relative flex w-full flex-col overflow-hidden rounded-md border border-line bg-surface hover:border-canvas">
      <div className="relative">
        <ProductImage src={product.image} alt="" width={360} priority={priority} />
        {product.deal && <DealTag deal={product.deal} className="absolute top-3 left-0" />}
        {!product.inStock && (
          <span className="absolute right-2 bottom-2 rounded-sm bg-ink px-2 py-0.5 text-xs font-medium text-surface">Out of stock</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="text-sm text-ink-muted">
          {product.brand && product.brand !== store.name ? (
            <>
              <span className="text-ink">{product.brand}</span> at {store.name}
            </>
          ) : (
            <>At {store.name}</>
          )}
        </p>
        <h3 className="line-clamp-2 leading-snug font-medium">
          <Link href={productPath(product)} className="after:absolute after:inset-0 after:content-['']">
            {product.title}
          </Link>
        </h3>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="price text-2xl">
            {product.maxPriceZar !== null && <span className="text-base font-medium">from </span>}
            {formatRand(product.priceZar)}
          </span>
          {lead?.kind === "was-price" && <s className="text-ink-muted">{formatRand(lead.wasZar)}</s>}
          {lead?.kind === "price-drop" && <s className="text-ink-muted">{formatRand(lead.fromZar)}</s>}
        </p>
        {lead && <p className="text-sm text-ink-muted">{reasonText(lead, pricedOn)}</p>}
        <div className="relative z-10 mt-auto pt-1">
          <WatchButton id={product.id} title={product.title} priceZar={product.priceZar} compact />
        </div>
      </div>
    </article>
  );
}
