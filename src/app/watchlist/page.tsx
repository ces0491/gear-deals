import type { Metadata } from "next";

import { WatchlistView } from "@/components/watchlist-view";

export const metadata: Metadata = {
  title: "Watchlist",
  description: "Products you're watching, with how their prices have moved.",
  robots: { index: false },
};

export default function WatchlistPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
      <h1 className="narrow text-4xl font-extrabold sm:text-5xl">Watchlist</h1>
      <p className="mt-3 mb-6 max-w-2xl text-ink-muted">
        Kept in this browser only. For an email when something hits your price, set an alert on its page.
      </p>
      <WatchlistView />
    </div>
  );
}
