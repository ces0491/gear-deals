/**
 * Product photos load straight from the stores' own servers; this site doesn't copy or
 * resize them. Shopify's CDN resizes on request, so its photos are asked for at the
 * width they're shown. WooCommerce stores publish fixed sizes, and the catalogue already
 * holds their catalogue-sized one.
 */
export function sizedImage(url: string, width: number): string {
  try {
    const u = new URL(url);
    if (u.hostname === "cdn.shopify.com" || u.pathname.includes("/cdn/shop/")) {
      u.searchParams.set("width", String(width));
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}
