import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
