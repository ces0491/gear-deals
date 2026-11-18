import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { AlertRecord, AlertStore, NewAlert, RequestLog } from "@/lib/alerts/store";
import type { StoreId } from "@/lib/stores/registry";

/** The alerts table as PostgREST returns it. */
interface AlertRow {
  id: string;
  email: string;
  product_id: string;
  product_title: string;
  store_id: string;
  target_zar: number | string;
  price_when_set_zar: number | string;
  created_at: string;
  confirmed_at: string | null;
  fired_at: string | null;
  fired_price_zar: number | string | null;
  closed_reason: string | null;
}

function toRecord(r: AlertRow): AlertRecord {
  return {
    id: r.id,
    email: r.email,
    productId: r.product_id,
    productTitle: r.product_title,
    storeId: r.store_id as StoreId,
    targetZar: Number(r.target_zar),
    priceWhenSetZar: Number(r.price_when_set_zar),
    createdAt: r.created_at,
    confirmedAt: r.confirmed_at,
    firedAt: r.fired_at,
    firedPriceZar: r.fired_price_zar === null ? null : Number(r.fired_price_zar),
    closedReason: r.closed_reason,
  };
}

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(`Supabase: ${result.error.message}`);
  return result.data;
}

/** Alerts in Supabase, reached with the project's secret key from the server only. */
export class SupabaseAlertStore implements AlertStore {
  private db: SupabaseClient;

  constructor(url: string, secretKey: string) {
    this.db = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async create(alert: NewAlert, now: Date) {
    const row = check(
      await this.db
        .from("alerts")
        .insert({
          email: alert.email,
          product_id: alert.productId,
          product_title: alert.productTitle,
          store_id: alert.storeId,
          target_zar: alert.targetZar,
          price_when_set_zar: alert.priceWhenSetZar,
          created_at: now.toISOString(),
        })
        .select()
        .single<AlertRow>(),
    );
    if (!row) throw new Error("Supabase: the new alert wasn't returned.");
    return toRecord(row);
  }

  async get(id: string) {
    const row = check(await this.db.from("alerts").select().eq("id", id).maybeSingle<AlertRow>());
    return row ? toRecord(row) : null;
  }

  async listByEmail(email: string) {
    const rows = check(await this.db.from("alerts").select().eq("email", email).order("created_at", { ascending: false }));
    return (rows as AlertRow[]).map(toRecord);
  }

  async confirm(id: string, now: Date) {
    // Only sets the time once; a second click leaves the first confirmation in place.
    check(await this.db.from("alerts").update({ confirmed_at: now.toISOString() }).eq("id", id).is("confirmed_at", null));
    return this.get(id);
  }

  async delete(id: string, email: string) {
    const rows = check(await this.db.from("alerts").delete().eq("id", id).eq("email", email).select("id"));
    return (rows as unknown[]).length > 0;
  }

  async deleteAllForEmail(email: string) {
    const rows = check(await this.db.from("alerts").delete().eq("email", email).select("id"));
    check(await this.db.from("alert_requests").delete().eq("email", email));
    return (rows as unknown[]).length;
  }

  async active() {
    const rows = check(
      await this.db.from("alerts").select().not("confirmed_at", "is", null).is("fired_at", null).is("closed_reason", null),
    );
    return (rows as AlertRow[]).map(toRecord);
  }

  async markFired(fired: { id: string; priceZar: number }[], now: Date) {
    for (const f of fired) {
      check(await this.db.from("alerts").update({ fired_at: now.toISOString(), fired_price_zar: f.priceZar }).eq("id", f.id));
    }
  }

  async close(ids: string[], reason: string, now: Date) {
    if (ids.length === 0) return;
    check(await this.db.from("alerts").update({ closed_reason: reason, fired_at: now.toISOString() }).in("id", ids));
  }

  async logRequest(request: RequestLog, now: Date) {
    check(
      await this.db
        .from("alert_requests")
        .insert({ kind: request.kind, email: request.email, ip_hash: request.ipHash, created_at: now.toISOString() }),
    );
  }

  async countRequests(filter: Partial<RequestLog>, since: Date) {
    let q = this.db.from("alert_requests").select("id", { count: "exact", head: true }).gte("created_at", since.toISOString());
    if (filter.kind) q = q.eq("kind", filter.kind);
    if (filter.email) q = q.eq("email", filter.email);
    if (filter.ipHash) q = q.eq("ip_hash", filter.ipHash);
    const { count, error } = await q;
    if (error) throw new Error(`Supabase: ${error.message}`);
    return count ?? 0;
  }

  async purge(cutoffs: { unconfirmedBefore: Date; sentBefore: Date; requestsBefore: Date }) {
    const unconfirmed = check(
      await this.db.from("alerts").delete().is("confirmed_at", null).lt("created_at", cutoffs.unconfirmedBefore.toISOString()).select("id"),
    ) as unknown[];
    const sent = check(
      await this.db.from("alerts").delete().not("fired_at", "is", null).lt("fired_at", cutoffs.sentBefore.toISOString()).select("id"),
    ) as unknown[];
    const requests = check(
      await this.db.from("alert_requests").delete().lt("created_at", cutoffs.requestsBefore.toISOString()).select("id"),
    ) as unknown[];
    return { unconfirmed: unconfirmed.length, sent: sent.length, requests: requests.length };
  }
}
