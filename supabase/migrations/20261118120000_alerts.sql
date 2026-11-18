-- Price alerts: the only personal data the site holds (an email address per alert).
-- Row level security is on with no policies, so the public (anon) key can't read or
-- write either table; only the server, using the secret key, can.

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and length(email) between 3 and 254),
  product_id text not null check (length(product_id) <= 200),
  product_title text not null check (length(product_title) <= 500),
  store_id text not null check (length(store_id) <= 40),
  target_zar numeric(12, 2) not null check (target_zar > 0),
  price_when_set_zar numeric(12, 2) not null check (price_when_set_zar > 0),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  fired_at timestamptz,
  fired_price_zar numeric(12, 2),
  closed_reason text
);

create index alerts_email_idx on public.alerts (email);
create index alerts_active_idx on public.alerts (product_id)
  where confirmed_at is not null and fired_at is null;

-- One row per request that sends an email, for the per-address, per-network and daily
-- limits. Kept two days. ip_hash is a salted hash, never the address itself.
create table public.alert_requests (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('alert', 'manage-link')),
  email text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index alert_requests_created_idx on public.alert_requests (created_at);

alter table public.alerts enable row level security;
alter table public.alert_requests enable row level security;

revoke all on public.alerts from anon, authenticated;
revoke all on public.alert_requests from anon, authenticated;
