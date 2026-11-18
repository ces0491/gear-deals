import { randomBytes } from "node:crypto";
import { join } from "node:path";

import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests against a frozen catalogue (test/fixtures/site), built and served as in
 * production. The live catalogue changes every morning, so tests against it would break
 * daily.
 *
 * Alerts run on the in-memory store, and emails are written to an outbox file the tests
 * read confirmation links from. Each run gets a fresh signing secret. The tests block
 * every request that isn't to the app, so no store or image CDN sees traffic from them.
 */
const port = Number(process.env.PORT ?? 3210);
const baseURL = `http://localhost:${port}`;
/** Read by the tests through e2e/helpers.ts. */
const OUTBOX = join(__dirname, "test-results", "outbox.jsonl");

export default defineConfig({
  testDir: "e2e",
  // Alert tests share the server's memory store and outbox, so tests run one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    timezoneId: "Africa/Johannesburg",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /layout\.spec\.ts/ },
    { name: "layout", use: { ...devices["Pixel 7"] }, testMatch: /layout\.spec\.ts/ },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      GEAR_DEALS_DATA: "fixture",
      NEXT_PUBLIC_SITE_URL: baseURL,
      ALERTS_STORE: "memory",
      ALERTS_OUTBOX: OUTBOX,
      ALERTS_SECRET: randomBytes(32).toString("hex"),
    },
  },
});
