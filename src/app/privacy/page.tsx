import type { Metadata } from "next";
import Link from "next/link";

import { REQUEST_LOG_RETENTION_DAYS, SENT_RETENTION_DAYS, UNCONFIRMED_RETENTION_DAYS } from "@/lib/alerts/config";
import { REPO_URL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What the site keeps about you: nothing, unless you set a price alert.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
      <h1 className="narrow text-4xl font-extrabold sm:text-5xl">Privacy</h1>
      <div className="mt-6 space-y-4 text-lg leading-relaxed [&_a]:text-canvas [&_a]:underline [&_h2]:narrow [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_p]:max-w-prose">
        <p>
          {SITE_NAME} is run by Sheet Solved. Browsing it needs no account, sets no cookies and uses no analytics. The hosting
          provider keeps routine request logs.
        </p>

        <h2>Your watchlist</h2>
        <p>
          Kept in your browser&rsquo;s local storage, on your device only. Clearing the site&rsquo;s data in your browser deletes
          it.
        </p>

        <h2>Price alerts</h2>
        <p>Only if you set one, the site keeps:</p>
        <ul>
          <li>your email address</li>
          <li>the product, the price you set, and the product&rsquo;s price at the time</li>
          <li>when you set it, confirmed it, and when it was sent</li>
        </ul>
        <p>
          They&rsquo;re used for one thing: emailing you when the product reaches your price. Nothing is sent until you confirm
          the alert from the first email, and nothing else is ever sent to the address. To stop abuse of the form, each request
          is also logged with your email and a scrambled (hashed) form of your network address, kept for{" "}
          {REQUEST_LOG_RETENTION_DAYS} days.
        </p>
        <p>
          Alerts are stored in a Supabase database and emails go out through Resend; neither uses them for anything else. An
          alert you don&rsquo;t confirm is deleted after {UNCONFIRMED_RETENTION_DAYS} days, and a sent alert after{" "}
          {SENT_RETENTION_DAYS} days. Every email links to a page where you can delete any alert, or delete everything held about
          your address. <Link href="/alerts">Get that link again</Link> if you&rsquo;ve lost it.
        </p>

        <h2>Product photos</h2>
        <p>
          Photos load from the stores&rsquo; own servers, which see your browser&rsquo;s request for them, as they would on the
          store&rsquo;s site. The site asks your browser not to tell them which page you were on.
        </p>

        <h2>Links to Facebook Marketplace and Gumtree</h2>
        <p>
          The second-hand search links on product pages open those sites, which then apply their own privacy terms. The
          site asks your browser not to tell them which page you came from.
        </p>

        <h2>Seeing and deleting what&rsquo;s held</h2>
        <p>
          The link in any alert email opens a page showing every alert held for your address, and deletes them or everything at
          once. That covers access and deletion under the Protection of Personal Information Act without you having to contact
          anyone. For anything else, <a href={`${REPO_URL}/issues`}>open an issue</a>; issues are public, so leave your email
          address out of it.
        </p>
      </div>
    </div>
  );
}
