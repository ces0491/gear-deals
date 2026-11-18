import type { MetadataRoute } from "next";

import { catalogue } from "@/lib/data/catalogue";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = catalogue().generatedAt;
  return ["", "/stores", "/how-it-works", "/privacy"].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: path === "" ? "daily" : "monthly",
  }));
}
