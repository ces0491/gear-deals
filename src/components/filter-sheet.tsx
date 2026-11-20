"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Holds the filters: a sidebar from the lg breakpoint up, and below it a bottom sheet
 * opened by a "Filters" button, so the results aren't pushed off the screen on a phone.
 */
export function FilterSheet({
  children,
  activeCount,
  resultLabel,
}: {
  children: ReactNode;
  activeCount: number;
  resultLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const opener = useRef<HTMLButtonElement>(null);
  const closer = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // A modal dialog takes focus when it opens and hands it back to its button when it closes.
    const button = opener.current;
    closer.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      button?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={opener}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex items-center gap-2 rounded border border-line bg-surface px-3 py-2 font-medium lg:hidden"
      >
        <SlidersHorizontal aria-hidden className="size-4" />
        Filters{activeCount > 0 && ` (${activeCount})`}
      </button>

      {open && <div aria-hidden className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <div
        id={panelId}
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
        aria-label={open ? "Filters" : undefined}
        className={cn(
          "lg:static lg:block lg:max-h-none lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0",
          open
            ? "fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col rounded-t-lg border-t border-line bg-surface"
            : "hidden",
        )}
      >
        {open && (
          <div className="flex items-center justify-between border-b border-line px-4 py-3 lg:hidden">
            <h2 className="narrow text-xl font-bold">Filters</h2>
            <button ref={closer} type="button" onClick={() => setOpen(false)} className="rounded p-1" aria-label="Close filters">
              <X aria-hidden className="size-5" />
            </button>
          </div>
        )}
        <div className={cn(open && "overflow-y-auto px-4 py-4")}>{children}</div>
        {open && (
          <div className="border-t border-line p-3 lg:hidden">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full rounded bg-canvas px-4 py-2.5 font-semibold text-surface"
            >
              {resultLabel}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
