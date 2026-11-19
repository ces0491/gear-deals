-- The request log keeps a keyed hash of the email address, as it already did for the
-- network address. Deleting an address's alerts then leaves the log alone, so it no longer
-- resets the daily limits the log enforces. Rows logged before this hold plain addresses
-- and are dropped; the log only ever holds two days.
truncate public.alert_requests;
alter table public.alert_requests rename column email to email_hash;

-- Checks the daily limits and logs the request in one transaction. Callers queue on a
-- transaction-scoped advisory lock, so requests arriving together can't all pass the same
-- count. Returns 'ok', or the limit reached: 'sitewide', 'email' or 'network'.
create function public.claim_alert_request(
  p_kind text,
  p_email_hash text,
  p_ip_hash text,
  p_since timestamptz,
  p_now timestamptz,
  p_per_email integer,
  p_per_network integer,
  p_sitewide integer
) returns text
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('public.alert_requests'));

  if (select count(*) from public.alert_requests where created_at >= p_since) >= p_sitewide then
    return 'sitewide';
  end if;
  if (select count(*) from public.alert_requests where created_at >= p_since and email_hash = p_email_hash) >= p_per_email then
    return 'email';
  end if;
  if (select count(*) from public.alert_requests where created_at >= p_since and ip_hash = p_ip_hash) >= p_per_network then
    return 'network';
  end if;

  insert into public.alert_requests (kind, email_hash, ip_hash, created_at)
  values (p_kind, p_email_hash, p_ip_hash, p_now);
  return 'ok';
end;
$$;

-- Only the server, with the secret key, may call it.
revoke all on function public.claim_alert_request(text, text, text, timestamptz, timestamptz, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_alert_request(text, text, text, timestamptz, timestamptz, integer, integer, integer)
  to service_role;
