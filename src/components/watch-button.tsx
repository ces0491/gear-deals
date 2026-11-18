"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { unwatch, useWatchlist, watch } from "@/lib/watchlist";

interface WatchButtonProps {
  id: string;
  title: string;
  priceZar: number;
  compact?: boolean;
}

export function WatchButton({ id, title, priceZar, compact = false }: WatchButtonProps) {
  const { items } = useWatchlist();
  const [refused, setRefused] = useState(false);
  const watching = items.some((i) => i.id === id);
  const Icon = watching ? BookmarkCheck : Bookmark;

  function toggle() {
    if (watching) {
      unwatch(id);
      return;
    }
    setRefused(!watch({ id, title, priceWhenAdded: priceZar }));
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={watching}
        className={cn(
          "inline-flex items-center gap-1.5 rounded border font-medium",
          compact ? "px-2 py-1 text-sm" : "px-3 py-2",
          watching
            ? "border-canvas bg-canvas-wash text-canvas-strong"
            : "border-line bg-surface text-ink hover:border-canvas hover:text-canvas-strong",
        )}
      >
        <Icon aria-hidden className="size-4" />
        {watching ? "Watching" : "Watch"}
        {compact && <span className="sr-only"> {title}</span>}
      </button>
      {refused && <span className="text-sm text-danger">This browser isn&rsquo;t letting the site save a watchlist.</span>}
    </span>
  );
}
