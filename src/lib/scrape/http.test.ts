import { describe, expect, it } from "vitest";

import { describeError, describeNonJson, getJson, HttpError, isRetryable, parseRetryAfter, retryDelayMs, StoreFormatError } from "@/lib/scrape/http";

import { json, scriptedHttp } from "../../../test/helpers";

describe("parseRetryAfter", () => {
  it("reads seconds and HTTP dates", () => {
    expect(parseRetryAfter("12")).toBe(12_000);
    const now = Date.parse("2026-11-18T10:00:00Z");
    expect(parseRetryAfter("Wed, 18 Nov 2026 10:00:05 GMT", now)).toBe(5_000);
    expect(parseRetryAfter("Wed, 18 Nov 2026 09:00:00 GMT", now)).toBe(0);
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter("soon")).toBeUndefined();
  });
});

describe("retry rules", () => {
  it("retries rate limits, server errors and timeouts, not other client errors", () => {
    expect(isRetryable(new HttpError("u", 429))).toBe(true);
    expect(isRetryable(new HttpError("u", 503))).toBe(true);
    expect(isRetryable(new HttpError("u", 404))).toBe(false);
    expect(isRetryable(Object.assign(new Error("t"), { name: "TimeoutError" }))).toBe(true);
    expect(isRetryable(new StoreFormatError("bad"))).toBe(false);
  });

  it("honours Retry-After up to a ceiling, never sooner than the backoff", () => {
    expect(retryDelayMs(new HttpError("u", 429, 10_000), 2_000, 1)).toBe(10_000);
    expect(retryDelayMs(new HttpError("u", 429, 600_000), 2_000, 1)).toBe(30_000);
    expect(retryDelayMs(new HttpError("u", 429, 0), 2_000, 2)).toBe(4_000);
  });
});

describe("getJson", () => {
  it("retries a 429 after the delay the store asks for", async () => {
    const { http, sleeps } = scriptedHttp([
      new Response("slow down", { status: 429, headers: { "Retry-After": "7" } }),
      json({ ok: true }),
    ]);
    await expect(getJson("https://store.test/x", http)).resolves.toEqual({ ok: true });
    expect(sleeps).toEqual([7_000]);
  });

  it("gives up after the last attempt", async () => {
    const { http, urls } = scriptedHttp([500, 500, 500].map((status) => new Response("", { status })));
    await expect(getJson("https://store.test/x", http)).rejects.toMatchObject({ status: 500 });
    expect(urls).toHaveLength(3);
  });

  it("doesn't retry a 404", async () => {
    const { http, urls } = scriptedHttp([new Response("", { status: 404 })]);
    await expect(getJson("https://store.test/x", http)).rejects.toBeInstanceOf(HttpError);
    expect(urls).toHaveLength(1);
  });

  it("names a bot challenge served instead of JSON", async () => {
    const page = "<html><head><title>Just a moment...</title></head><body>cf_chl_opt</body></html>";
    const { http } = scriptedHttp([new Response(page, { status: 200 })]);
    await expect(getJson("https://store.test/x", http)).rejects.toThrow(/Cloudflare challenge page titled "Just a moment\.\.\."/);
  });
});

describe("describeNonJson and describeError", () => {
  it("describes a plain HTML page", () => {
    expect(describeNonJson("<html><title>Home</title></html>")).toMatch(/^non-JSON response titled "Home"/);
  });

  it("gives short reasons for the stores page", () => {
    expect(describeError(new HttpError("u", 429))).toBe("The store asked us to slow down (HTTP 429).");
    expect(describeError(Object.assign(new Error("x"), { name: "TimeoutError" }))).toBe("The store took too long to answer.");
  });
});
