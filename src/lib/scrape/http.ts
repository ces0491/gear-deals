/**
 * Outbound HTTP for the daily scrape. Requests identify the site honestly, retry only
 * failures that can fix themselves, and give up rather than hammer a store.
 */
import { SITE_URL } from "@/lib/site";

export const USER_AGENT = `gear-deals/0.1 (+${SITE_URL}/how-it-works; price comparison bot)`;

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = 2_000;
/**
 * Ceiling on a store's Retry-After. A store asking for minutes is telling us this run is
 * a write-off, and waiting that long would hold up every other store's publish.
 */
const MAX_RETRY_AFTER_MS = 30_000;

export interface HttpOptions {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  timeoutMs?: number;
  attempts?: number;
  backoffMs?: number;
}

export const realHttp: HttpOptions = {
  fetch: (...args) => fetch(...args),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export class HttpError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
    readonly retryAfterMs?: number,
  ) {
    super(`HTTP ${status} from ${url}`);
    this.name = "HttpError";
  }
}

/** A store answered, but not with what its catalogue endpoint should return. */
export class StoreFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreFormatError";
  }
}

/** Retry-After is delta-seconds or an HTTP date. Undefined when absent or unreadable. */
export function parseRetryAfter(header: string | null, now: number = Date.now()): number | undefined {
  if (!header) return undefined;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

/**
 * Timeouts, network failures, 5xx and 429 are worth another try. Other 4xx answers and
 * unreadable bodies won't change on a second attempt.
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof HttpError) return error.status === 429 || error.status >= 500;
  if (!(error instanceof Error)) return false;
  return error.name === "TimeoutError" || error.name === "AbortError" || error.name === "TypeError";
}

/** Honours a store's Retry-After within the ceiling, and never retries sooner than the backoff. */
export function retryDelayMs(error: unknown, backoffMs: number, attempt: number): number {
  const asked = error instanceof HttpError ? error.retryAfterMs : undefined;
  return Math.max(Math.min(asked ?? 0, MAX_RETRY_AFTER_MS), backoffMs * attempt);
}

const CHALLENGE_MARKERS: readonly { pattern: RegExp; name: string }[] = [
  { pattern: /sgcaptcha/i, name: "SiteGround anti-bot challenge" },
  { pattern: /cf-chl|challenge-platform|cf_chl_opt/i, name: "Cloudflare challenge" },
  { pattern: /wordfence/i, name: "Wordfence block page" },
  { pattern: /imunify360|bot-protection/i, name: "Imunify360 bot protection" },
];

/** A one-line account of a body that should have been JSON, naming a bot challenge when it is one. */
export function describeNonJson(body: string): string {
  const challenge = CHALLENGE_MARKERS.find((m) => m.pattern.test(body));
  const title = body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
  const snippet = body.replace(/\s+/g, " ").trim().slice(0, 120);
  const what = challenge ? `${challenge.name} page` : "non-JSON response";
  return `${what}${title ? ` titled "${title}"` : ""} (${body.length} bytes): ${snippet}`;
}

/** GETs JSON, retrying transient failures with linear backoff. */
export async function getJson(url: string, opts: HttpOptions): Promise<unknown> {
  const attempts = opts.attempts ?? DEFAULT_ATTEMPTS;
  const backoffMs = opts.backoffMs ?? DEFAULT_BACKOFF_MS;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await opts.fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new HttpError(url, response.status, parseRetryAfter(response.headers.get("retry-after")));
      }
      const body = await response.text();
      try {
        return JSON.parse(body) as unknown;
      } catch {
        throw new StoreFormatError(`Expected JSON from ${url}, got a ${describeNonJson(body)}`);
      }
    } catch (error) {
      lastError = error;
      if (attempt < attempts && isRetryable(error)) {
        await opts.sleep(retryDelayMs(error, backoffMs, attempt));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/** A short account of a scrape failure for the stores page and the run log. */
export function describeError(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.status === 429) return "The store asked us to slow down (HTTP 429).";
    if (error.status === 403) return "The store refused the request (HTTP 403).";
    return `The store answered with an error (HTTP ${error.status}).`;
  }
  if (error instanceof StoreFormatError) return error.message;
  if (error instanceof Error) {
    if (error.name === "TimeoutError") return "The store took too long to answer.";
    if (error.name === "ZodError") return "The store's catalogue has changed shape, so it couldn't be read.";
    return `The store couldn't be reached (${error.message}).`;
  }
  return "Unknown error.";
}
