// api/_config.js — single source of truth for addresses and branding.
// Change an address HERE and it changes everywhere in the backend.
// (Files starting with "_" are not exposed as routes by Vercel.)

/* The Second Look Protect mailbox. Everything customer-facing comes from,
   and replies to, this address. Override per-environment with env vars. */
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "hello@secondlookprotect.co.uk";

/* Where Kieran's own alerts land (new checks, talk enquiries, chase pings). */
export const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || SUPPORT_EMAIL;

/* Where group-talk enquiries land — same inbox by default, but can be split
   out later (e.g. talks@secondlookprotect.co.uk) without touching any code. */
export const TALKS_EMAIL = process.env.TALKS_NOTIFY_EMAIL || ADMIN_EMAIL;

/* The verified "from" identity in Resend. Must be on a domain you've verified. */
export const EMAIL_FROM = process.env.EMAIL_FROM || `Second Look Protect <${SUPPORT_EMAIL}>`;

/* Public site URL, used to build links in emails and WhatsApp pings. */
export const SITE_URL = (process.env.SITE_URL || "https://second-look-protect.vercel.app").replace(/\/$/, "");

/* Phone number shown to customers. */
export const SUPPORT_PHONE = process.env.SUPPORT_PHONE || "07563 887804";

/* Small helper so every Resend call is built the same way. */
export function resendPayload({ to, subject, html, replyTo = SUPPORT_EMAIL }) {
  return {
    from: EMAIL_FROM,
    to: Array.isArray(to) ? to : [to],
    reply_to: replyTo,
    subject,
    html,
  };
}

/* Shared footer disclaimer so the wording stays identical everywhere. */
export const DISCLAIMER_HTML =
  `Our reports are guidance based on the information you provide — not legal or financial advice, ` +
  `and they cannot guarantee whether something is or isn't a scam. Any decisions you take remain your own. ` +
  `If you have lost money, contact your bank immediately and report it to Action Fraud on 0300 123 2040 ` +
  `(actionfraud.police.uk).`;
