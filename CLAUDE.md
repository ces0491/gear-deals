@AGENTS.md

# gear-deals: working notes

What the site does and how is in README.md; what counts as done is in SCOPE.md.

## Live

- https://geardeals.sheetsolved.com (GoDaddy CNAME added 18 November 2026). Vercel
  project `gear-deals` in cesaires-projects, git-connected; a push to `main` deploys
  production, including the morning's data commit.
- gear-deals.vercel.app redirects (308) to the custom domain. The redirect is a setting
  on that domain in the Vercel project, not in next.config.
- Repository `ces0491/gear-deals` is public.
- **The Vercel schedule starts the price run**, at 03:30 UTC through GitHub's API (README,
  "Morning trigger"); it has done so each day since 21 November. GitHub's own schedule,
  set for 03:17 UTC, started it between 11:07 and 13:47 UTC on 20 to 26 November, by
  which time the day's prices were in and the run stopped. When the morning run publishes
  nothing, that late run is a second attempt. `gh run list --workflow prices.yml` shows the runs; a
  good one leaves a `chore(data)` commit that Vercel deploys.
- **Ironman 4x4 is off** since 20 November: it answered the runner with HTTP 403 on 19
  and 20 November.

## Decisions Ces made (18 November 2026)

- **Public site**, like wood-wiz. Stores whose terms ban scraping are left out (Alpha
  Accessories and Camp Cover at first; `LEFT_OUT_STORES` in the registry has the rest).
  The terms of the stores that are read were checked and don't ban it.
- **Alerts are one-shot target prices**, confirmed by email first. No daily or weekly
  digests: Ces expects those to be ignored and unsubscribed from.
- **Watchlist and alerts both in v1.**
- **Second-hand marketplaces are linked to, never read.** Product pages from R1 000 link
  to Facebook Marketplace's and Gumtree's own search.

## Waiting on Ces

- Alerts need a Supabase project (apply `supabase/migrations/`), a Resend sending domain
  on sheetsolved.com, and the five alert values in `.env.example` in both Vercel and the
  repository's Actions secrets. Until then the site says alerts aren't available.
- The privacy page sends anything other than access and deletion to GitHub issues, which
  are public. A private contact address would be better; Ces hasn't given one.

## Working on it

- Before calling a change done: `npm run lint`, `npm run typecheck`, `npm test`, and
  `npm run test:e2e` when pages change. Check README.md against the change too.
- Commit and push only with Ces's go-ahead. A push to `main` deploys to production.
- The site runs on the committed `data/` files, so `npm run dev` needs nothing else.
  Don't scrape to test a UI change.

## Gotchas

- **Shopify rate-limits an address across its stores.** After a burst of research
  requests, several Shopify stores answered HTTP 429 at once for a while. The scrape reads
  Shopify stores one after another for this reason (`laneOf` in `src/lib/scrape/run.ts`),
  and full runs since have had no 429s.
- **The catalogue is read at module scope** (`src/lib/data/catalogue.ts`), so a running
  dev server doesn't see a new scrape; restart it.
- **Cache Components is on.** Anything reading `searchParams`, `params` or the alert
  store sits inside `<Suspense>`; `Date.now()` isn't used in render. Dynamic product routes
  need `generateStaticParams` to return at least one entry. A product URL that isn't in
  the catalogue shows the not-found page with HTTP 200, because the product streams in
  after the shell is sent; product pages are `noindex` (and left crawlable in robots.txt, so crawlers can see that).
- **`vercel link` rewrites `.gitignore`:** it appended `.vercel` and `.env*` after the
  `!.env.example` exception, which would re-ignore `.env.example`. Reverted; check after
  any re-link.
- **Changing category rules:** check them against real data with
  `npm run scrape -- --placements <file>` (costs a full read of every store), or apply them
  to the committed catalogue with `npm run recategorise` (reads nothing).
- **Store reads add up.** On 18 November the stores were read four times while the
  category rules were tuned. Prefer `recategorise` or `--only <store>` over full runs.
