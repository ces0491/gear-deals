/**
 * Limits on price alerts. They keep the email list small and stop the form being used
 * to send mail to people who didn't ask for it.
 */

/** Alerts an address can have waiting or active at once. */
export const MAX_ALERTS_PER_EMAIL = 25;
/** New alerts an address can request in a day. Each one sends a confirmation email. */
export const MAX_REQUESTS_PER_EMAIL_PER_DAY = 5;
/** Alert requests from one network address in a day. */
export const MAX_REQUESTS_PER_IP_PER_DAY = 20;
/**
 * Confirmation and manage-link emails the site sends in a day, across everyone. Resend's
 * free plan allows 100 emails a day, and alert emails need room too.
 */
export const MAX_SITE_EMAILS_PER_DAY = 50;
/** How long a confirmation link works. */
export const CONFIRM_LINK_HOURS = 48;
/** Unconfirmed alerts are deleted after this. */
export const UNCONFIRMED_RETENTION_DAYS = 7;
/** Sent alerts stay on the manage page this long, then are deleted. */
export const SENT_RETENTION_DAYS = 30;
/** Alerts on a product the store no longer lists are closed after this. */
export const MISSING_PRODUCT_DAYS = 30;
/** Request records used for the per-address and per-network limits are kept this long. */
export const REQUEST_LOG_RETENTION_DAYS = 2;
