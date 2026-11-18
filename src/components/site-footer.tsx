import Link from "next/link";

import { catalogue } from "@/lib/data/catalogue";
import { formatDisplayDate, formatTimeInSouthAfrica } from "@/lib/dates";
import { REPO_URL } from "@/lib/site";

export function SiteFooter() {
  const { generatedAt, pricedOn } = catalogue();
  return (
    <footer className="mt-16 border-t border-line bg-surface text-sm text-ink-muted">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:grid-cols-[1fr_auto] sm:px-6">
        <div className="max-w-prose space-y-2">
          <p>
            Prices were read from the stores on {formatDisplayDate(pricedOn)} at {formatTimeInSouthAfrica(generatedAt)}. The
            store&rsquo;s own page has the price you&rsquo;ll pay.
          </p>
          <p>
            No affiliate links or paid placement: stores don&rsquo;t pay to be listed, and this site earns nothing when you buy.
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 sm:flex-col sm:text-right">
          <li>
            <Link href="/how-it-works" className="underline-offset-2 hover:underline">
              How deals are found
            </Link>
          </li>
          <li>
            <Link href="/privacy" className="underline-offset-2 hover:underline">
              Privacy
            </Link>
          </li>
          <li>
            <a href={`${REPO_URL}/issues`} className="underline-offset-2 hover:underline">
              Report a problem
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
