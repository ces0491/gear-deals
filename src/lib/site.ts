/**
 * The origin this deployment advertises as its own, read by metadata, the sitemap, the
 * robots policy, alert emails and the scraper's user agent so they all name one host.
 *
 * A preview deployment advertises itself (VERCEL_URL); production names the custom
 * domain, since VERCEL_URL there is the deployment's generated hostname rather than the
 * alias. NEXT_PUBLIC_SITE_URL overrides both.
 */
export const PRODUCTION_URL = "https://geardeals.sheetsolved.com";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_ENV === "production"
    ? PRODUCTION_URL
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.GITHUB_ACTIONS
        ? PRODUCTION_URL
        : "http://localhost:3000");

/** Whether this is the public production deployment. Previews refuse indexing. */
export const IS_PRODUCTION = process.env.VERCEL_ENV === "production";

export const SITE_NAME = "Gear Deals";

export const REPO_URL = "https://github.com/ces0491/gear-deals";
