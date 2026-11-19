import type { MetadataRoute } from "next";

import { IS_PRODUCTION, SITE_URL } from "@/lib/site";

/**
 * Previews refuse all crawling. In production, pages that shouldn't be indexed (product,
 * alert and watchlist pages) say so with `noindex`, which a crawler only sees on a page it
 * may fetch, so they aren't disallowed here.
 */
export default function robots(): MetadataRoute.Robots {
  if (!IS_PRODUCTION) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
