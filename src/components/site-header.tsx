import Link from "next/link";

import { WatchlistLink } from "@/components/watchlist-link";
import { SITE_NAME } from "@/lib/site";

const LINKS = [
  { href: "/", label: "Deals" },
  { href: "/stores", label: "Stores" },
  { href: "/how-it-works", label: "How it works" },
] as const;

export function SiteHeader() {
  return (
    <header className="bg-[#1e2325] text-[#e8ebe6]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-baseline gap-2 rounded-sm">
          <span className="narrow text-2xl font-extrabold tracking-tight uppercase">{SITE_NAME}</span>
          <span className="hidden text-sm text-[#aeb6b8] sm:inline">4x4 and camping gear</span>
        </Link>
        <nav aria-label="Main">
          <ul className="flex items-center gap-1 text-[15px]">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block rounded px-2.5 py-1.5 hover:bg-white/10">
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <WatchlistLink />
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
