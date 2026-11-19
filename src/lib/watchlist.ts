"use client";

/**
 * The watchlist, kept in the browser's local storage: no account, nothing sent anywhere.
 * It lives only in the browser that made it.
 *
 * Storage can be missing or refuse writes (private windows, blocked site data), so every
 * read and write is guarded and an unreadable list counts as empty.
 */
import { useSyncExternalStore } from "react";

import { EMPTY_WATCHLIST, isWatchState, MAX_WATCHED, recordVisit, type WatchItem, type WatchState } from "@/lib/watchlist-core";

export { changeFor, visitBaseline, type VisitSnapshot, type WatchItem, type WatchState } from "@/lib/watchlist-core";

const KEY = "gear-deals:watchlist:v1";
const CHANGE_EVENT = "gear-deals:watchlist";

let cachedRaw: string | null | undefined;
let cachedState: WatchState = EMPTY_WATCHLIST;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** The stored list. The same object is returned until the stored text changes. */
export function readWatchlist(): WatchState {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedState;
  cachedRaw = raw;
  if (raw === null) {
    cachedState = EMPTY_WATCHLIST;
    return cachedState;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    cachedState = isWatchState(parsed) ? parsed : EMPTY_WATCHLIST;
  } catch {
    cachedState = EMPTY_WATCHLIST;
  }
  return cachedState;
}

function write(state: WatchState): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return true;
}

/** Returns false when the browser refused to store it. */
export function watch(item: Omit<WatchItem, "addedAt">, now: Date = new Date()): boolean {
  const state = readWatchlist();
  if (state.items.some((i) => i.id === item.id)) return true;
  const items = [{ ...item, addedAt: now.toISOString() }, ...state.items].slice(0, MAX_WATCHED);
  return write({ ...state, items });
}

export function unwatch(id: string): void {
  const state = readWatchlist();
  write({ ...state, items: state.items.filter((i) => i.id !== id) });
}

/** Records the prices seen on this visit, read on `pricedOn`, so a later visit can say what changed since. */
export function markVisited(pricedOn: string, prices: Record<string, number>, now: Date = new Date()): void {
  write(recordVisit(readWatchlist(), pricedOn, prices, now));
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The watchlist, kept in step with other tabs. Empty during server rendering. */
export function useWatchlist(): WatchState {
  return useSyncExternalStore(subscribe, readWatchlist, () => EMPTY_WATCHLIST);
}
