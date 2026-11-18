import { MemoryAlertStore, type AlertStore } from "@/lib/alerts/store";
import { SupabaseAlertStore } from "@/lib/alerts/supabase-store";
import { OutboxMailer, ResendMailer, type Mailer } from "@/lib/alerts/mailer";

/**
 * What alerts need, read from the environment (see .env.example):
 *
 * - ALERTS_SECRET signs confirm and manage links. Without it, alerts are off.
 * - SUPABASE_URL and SUPABASE_SECRET_KEY keep alerts in Supabase. ALERTS_STORE=memory keeps
 *   them in this server's memory instead, for development and tests; they're lost on restart.
 * - RESEND_API_KEY and ALERTS_FROM send email through Resend. ALERTS_OUTBOX=<file> writes
 *   emails to a file instead.
 *
 * When any part is missing the site says alerts aren't available rather than failing.
 */
export interface AlertsRuntime {
  store: AlertStore;
  mailer: Mailer;
  secret: string;
}

const globalForAlerts = globalThis as unknown as { __gearDealsMemoryStore?: MemoryAlertStore };

function store(): AlertStore | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (url && key) return new SupabaseAlertStore(url, key);
  if (process.env.ALERTS_STORE === "memory") {
    // One store per server process, kept across hot reloads in development.
    globalForAlerts.__gearDealsMemoryStore ??= new MemoryAlertStore();
    return globalForAlerts.__gearDealsMemoryStore;
  }
  return null;
}

function mailer(): Mailer | null {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ALERTS_FROM;
  if (key && from) return new ResendMailer(key, from);
  if (process.env.ALERTS_OUTBOX) return new OutboxMailer(process.env.ALERTS_OUTBOX);
  return null;
}

/** Null when alerts aren't configured. */
export function alertsRuntime(): AlertsRuntime | null {
  const secret = process.env.ALERTS_SECRET;
  if (!secret || secret.length < 32) return null;
  const s = store();
  const m = mailer();
  return s && m ? { store: s, mailer: m, secret } : null;
}
