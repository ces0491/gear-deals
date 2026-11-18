"use client";

import Link from "next/link";

import { useWatchlist } from "@/lib/watchlist";

export function WatchlistLink() {
  const { items } = useWatchlist();
  return (
    <Link
      href="/watchlist"
      aria-label={items.length > 0 ? `Watchlist, ${items.length} watched` : undefined}
      className="flex items-center gap-1.5 rounded px-2.5 py-1.5 hover:bg-white/10"
    >
      Watchlist
      {items.length > 0 && (
        <span aria-hidden className="price min-w-6 rounded-sm bg-[#e8ebe6] px-1.5 text-center text-sm text-[#1e2325]">
          {items.length}
        </span>
      )}
    </Link>
  );
}
