@AGENTS.md

# gear-deals: working notes

What the site does and how is in README.md; what counts as done is in SCOPE.md.

## Decisions Ces made (18 November 2026)

- **Public site**, like wood-wiz. Alpha Accessories and Camp Cover are left out because
  their terms ban scraping; every other store's terms were checked and none does.
- **Alerts are one-shot target prices**, confirmed by email first. No daily or weekly
  digests: Ces expects those to be ignored and unsubscribed from.
- **Watchlist and alerts both in v1.**

## Deployed (18 November 2026)

Public repo `ces0491/gear-deals`, git-connected Vercel project `gear-deals` in
cesaires-projects, live at gear-deals.vercel.app. CI passed on the first push. The
Daily prices workflow hadn't run yet; its first scheduled run is 03:00 UTC on
19 November, and that's the first time the stores are read from a GitHub runner.

## Not done yet, waiting on Ces

- GoDaddy CNAME `geardeals` → `38d8fddbc39b8f2a.vercel-dns-016.com`. After it resolves,
  set gear-deals.vercel.app to redirect (308) to the custom domain in the Vercel
  project's domain settings.
- Alerts need a Supabase project (apply `supabase/migrations/`), a Resend sending domain
  on sheetsolved.com, and the five values in `.env.example` in both Vercel and the
  repository's Actions secrets. Until then the site says alerts aren't available.
- The privacy page sends anything other than access and deletion to GitHub issues, which
  are public. A private contact address would be better; Ces hasn't given one.

## Gotchas

- **Shopify rate-limits by address across all its stores.** After a burst of research
  requests, each Shopify store tried answered HTTP 429 for a while, whichever client asked.
  The scrape reads Shopify stores one after another for this reason (`laneOf` in
  `src/lib/scrape/run.ts`), and a full run since has had no 429s.
- **The catalogue is read at module scope** (`src/lib/data/catalogue.ts`), so a running
  dev server doesn't see a new scrape; restart it.
- **Cache Components is on.** Anything reading `searchParams`, `params` or the alert
  store sits inside `<Suspense>`; `Date.now()` isn't used in render. Dynamic product routes
  need `generateStaticParams` to return at least one entry. A product URL that isn't in
  the catalogue shows the not-found page with HTTP 200, because the product streams in
  after the shell is sent; product pages are `noindex` and disallowed in robots.txt.
- **`vercel link` rewrites `.gitignore`:** it appended `.vercel` and `.env*` after the
  `!.env.example` exception, which would re-ignore `.env.example`. Reverted; check after
  any re-link.
- **Changing category rules:** check them against real data with
  `npm run scrape -- --placements <file>` (costs a full read of every store), or apply them
  to the committed catalogue with `npm run recategorise` (reads nothing).
- **Store reads add up.** On 18 November the stores were read four times while the
  category rules were tuned. Prefer `recategorise` or `--only <store>` over full runs.
- **`npm audit` in CI** holds dev dependencies to "critical" because of an unfixed
  picomatch advisory; raise it back to "high" once picomatch ships a fix (see
  `.github/workflows/ci.yml`).
