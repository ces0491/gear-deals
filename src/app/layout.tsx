import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { IS_PRODUCTION, SITE_NAME, SITE_URL } from "@/lib/site";

import "./globals.css";

// One family in two widths: condensed for prices and headings, normal for reading.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const DESCRIPTION =
  "Deals on 4x4 and camping gear from South African online stores, checked every morning. Each deal says what it's measured against.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: 4x4 and camping gear deals`, template: `%s | ${SITE_NAME}` },
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: SITE_NAME, title: `${SITE_NAME}: 4x4 and camping gear deals`, description: DESCRIPTION },
  // Previews serve the same pages on other hostnames; only production may be indexed.
  robots: IS_PRODUCTION ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e2325" },
    { media: "(prefers-color-scheme: dark)", color: "#141819" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-ZA" className={`${archivo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded focus:bg-surface focus:px-4 focus:py-2 focus:text-ink"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
