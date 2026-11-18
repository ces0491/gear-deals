import Link from "next/link";

import { cn } from "@/lib/cn";

/** Page numbers around the current page, with the first and last always shown. */
export function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  for (const p of sorted) {
    const last = out.at(-1);
    if (typeof last === "number" && p - last > 1) out.push("gap");
    out.push(p);
  }
  return out;
}

export function Pagination({ page, pageCount, href }: { page: number; pageCount: number; href: (page: number) => string }) {
  if (pageCount <= 1) return null;
  const item = "flex min-w-10 items-center justify-center rounded border px-3 py-2";
  return (
    <nav aria-label="Pages" className="mt-8">
      <ul className="flex flex-wrap items-center justify-center gap-2">
        {page > 1 && (
          <li>
            <Link href={href(page - 1)} className={cn(item, "border-line bg-surface")} rel="prev">
              Previous
            </Link>
          </li>
        )}
        {pageWindow(page, pageCount).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-ink-muted">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={href(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(item, p === page ? "border-ink bg-ink text-surface" : "border-line bg-surface")}
              >
                {p}
              </Link>
            </li>
          ),
        )}
        {page < pageCount && (
          <li>
            <Link href={href(page + 1)} className={cn(item, "border-line bg-surface")} rel="next">
              Next
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
