import type { NextRequest } from "next/server";

import { catalogue, productById } from "@/lib/data/catalogue";
import { tagText } from "@/lib/deal-text";
import { productPath } from "@/lib/paths";
import { storeById } from "@/lib/stores/registry";
import { MAX_WATCHED } from "@/lib/watchlist-core";

/** What the watchlist shows for each product. */
export interface WatchedProduct {
  id: string;
  title: string;
  storeName: string;
  path: string;
  image: string | null;
  priceZar: number;
  inStock: boolean;
  tag: { big: string; small: string } | null;
}

export interface WatchedProducts {
  products: WatchedProduct[];
  /** The day these prices were read. */
  pricedOn: string;
}

/** Current details for the watchlist: `?ids=<id>,<id>`. Unknown ids are left out. */
export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, MAX_WATCHED);
  const products: WatchedProduct[] = [];
  for (const id of ids) {
    const p = productById(id);
    if (!p) continue;
    products.push({
      id: p.id,
      title: p.title,
      storeName: storeById(p.storeId).name,
      path: productPath(p),
      image: p.image,
      priceZar: p.priceZar,
      inStock: p.inStock,
      tag: p.deal ? tagText(p.deal) : null,
    });
  }
  const body: WatchedProducts = { products, pricedOn: catalogue().pricedOn };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
