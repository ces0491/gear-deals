import type { NextConfig } from "next";

/**
 * Without nonces, as in Next's CSP guide: nonces need every page rendered per request,
 * which would give up the static shells Cache Components builds. So inline scripts are
 * allowed, and the policy's work is keeping out other origins' scripts, plugins, framing
 * and form targets. Product photos load from each store's own host, hence any https image.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  // Preview deployments load Vercel's toolbar from other origins; production and local builds get the policy.
  ...(process.env.VERCEL_ENV === "preview" ? [] : [{ key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY }]),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
  // Pages prerender a static shell and stream what depends on the request (search
  // parameters, alerts). See src/lib/data/catalogue.ts for how the data files are read.
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
