/**
 * Where alerts are kept. Production uses Supabase (supabase/migrations); development and
 * the browser tests use an in-memory store, so no database is needed to work on the site.
 */
import { randomUUID } from "node:crypto";

import type { StoreId } from "@/lib/stores/registry";

export interface AlertRecord {
  id: string;
  email: string;
  productId: string;
  productTitle: string;
  storeId: StoreId;
  targetZar: number;
  priceWhenSetZar: number;
  createdAt: string;
  confirmedAt: string | null;
  firedAt: string | null;
  firedPriceZar: number | null;
  /** Set when the alert closed without sending, e.g. the store stopped listing the product. */
  closedReason: string | null;
}

export type NewAlert = Pick<AlertRecord, "email" | "productId" | "productTitle" | "storeId" | "targetZar" | "priceWhenSetZar">;

export interface AlertStore {
  create(alert: NewAlert, now: Date): Promise<AlertRecord>;
  get(id: string): Promise<AlertRecord | null>;
  listByEmail(email: string): Promise<AlertRecord[]>;
  confirm(id: string, now: Date): Promise<AlertRecord | null>;
  /** Deletes one alert, only if it belongs to `email`. */
  delete(id: string, email: string): Promise<boolean>;
  deleteAllForEmail(email: string): Promise<number>;
  /** Confirmed, not yet sent or closed. */
  active(): Promise<AlertRecord[]>;
  markFired(fired: { id: string; priceZar: number }[], now: Date): Promise<void>;
  close(ids: string[], reason: string, now: Date): Promise<void>;
  /** Records a request that sends an email, for the rate limits. */
  logRequest(request: RequestLog, now: Date): Promise<void>;
  /** Requests since `since`, narrowed by whichever fields are given. */
  countRequests(filter: Partial<RequestLog>, since: Date): Promise<number>;
  /** Deletes what's no longer needed. Returns counts for the log. */
  purge(cutoffs: { unconfirmedBefore: Date; sentBefore: Date; requestsBefore: Date }): Promise<Record<string, number>>;
}

export interface RequestLog {
  kind: "alert" | "manage-link";
  email: string;
  /** The requester's network address, hashed (see hashAddress). */
  ipHash: string;
}

export class MemoryAlertStore implements AlertStore {
  private alerts = new Map<string, AlertRecord>();
  private requests: (RequestLog & { at: string })[] = [];

  async create(alert: NewAlert, now: Date): Promise<AlertRecord> {
    const record: AlertRecord = {
      ...alert,
      id: randomUUID(),
      createdAt: now.toISOString(),
      confirmedAt: null,
      firedAt: null,
      firedPriceZar: null,
      closedReason: null,
    };
    this.alerts.set(record.id, record);
    return { ...record };
  }

  async get(id: string) {
    const a = this.alerts.get(id);
    return a ? { ...a } : null;
  }

  async listByEmail(email: string) {
    return [...this.alerts.values()]
      .filter((a) => a.email === email)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((a) => ({ ...a }));
  }

  async confirm(id: string, now: Date) {
    const a = this.alerts.get(id);
    if (!a) return null;
    if (!a.confirmedAt) a.confirmedAt = now.toISOString();
    return { ...a };
  }

  async delete(id: string, email: string) {
    const a = this.alerts.get(id);
    if (!a || a.email !== email) return false;
    return this.alerts.delete(id);
  }

  async deleteAllForEmail(email: string) {
    let n = 0;
    for (const [id, a] of this.alerts) {
      if (a.email === email) {
        this.alerts.delete(id);
        n += 1;
      }
    }
    this.requests = this.requests.filter((r) => r.email !== email);
    return n;
  }

  async active() {
    return [...this.alerts.values()].filter((a) => a.confirmedAt && !a.firedAt && !a.closedReason).map((a) => ({ ...a }));
  }

  async markFired(fired: { id: string; priceZar: number }[], now: Date) {
    for (const f of fired) {
      const a = this.alerts.get(f.id);
      if (a) {
        a.firedAt = now.toISOString();
        a.firedPriceZar = f.priceZar;
      }
    }
  }

  async close(ids: string[], reason: string, now: Date) {
    for (const id of ids) {
      const a = this.alerts.get(id);
      if (a) {
        a.closedReason = reason;
        a.firedAt = now.toISOString();
      }
    }
  }

  async logRequest(request: RequestLog, now: Date) {
    this.requests.push({ ...request, at: now.toISOString() });
  }

  async countRequests(filter: Partial<RequestLog>, since: Date) {
    const from = since.toISOString();
    return this.requests.filter(
      (r) =>
        r.at >= from &&
        (filter.kind === undefined || r.kind === filter.kind) &&
        (filter.email === undefined || r.email === filter.email) &&
        (filter.ipHash === undefined || r.ipHash === filter.ipHash),
    ).length;
  }

  async purge(cutoffs: { unconfirmedBefore: Date; sentBefore: Date; requestsBefore: Date }) {
    const counts = { unconfirmed: 0, sent: 0, requests: 0 };
    for (const [id, a] of this.alerts) {
      if (!a.confirmedAt && a.createdAt < cutoffs.unconfirmedBefore.toISOString()) {
        this.alerts.delete(id);
        counts.unconfirmed += 1;
      } else if (a.firedAt && a.firedAt < cutoffs.sentBefore.toISOString()) {
        this.alerts.delete(id);
        counts.sent += 1;
      }
    }
    const before = this.requests.length;
    this.requests = this.requests.filter((r) => r.at >= cutoffs.requestsBefore.toISOString());
    counts.requests = before - this.requests.length;
    return counts;
  }
}
