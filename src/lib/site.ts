/* src/lib/site.ts — one place for addresses, links and prices.
   Change it here and it changes across every page. */

export const SITE = {
  /* Contact */
  email: "hello@secondlookprotect.co.uk",
  phoneDisplay: "07563 887804",
  phoneDial: "+447563887804",

  /* Sister brand */
  learnAiFast: "https://www.learnaifast.co.uk",

  /* Peace of Mind subscription */
  membershipPrice: "£9.99",
  paymentLink: (import.meta.env.VITE_STRIPE_PAYMENT_LINK as string) || "/check",
  billingPortal:
    (import.meta.env.VITE_STRIPE_PORTAL_LINK as string) ||
    "https://billing.stripe.com/p/login/dRm8wPde41D2a385m8dby00",

  /* One-to-one AI Scam Safety Session */
  sessionPrice: "£79.99",
  /* Cal.com booking, embedded inline on /session.
     Must be "username/event-slug" — NOT just the username, or the
     visitor lands on a list of event types with no payment attached. */
  sessionCalLink:
    (import.meta.env.VITE_SESSION_CAL_LINK as string) || "kieran-rowan-tiujdp/60-minute-ai-scam-safety-session",
} as const;

export const NAV_LINKS = [
  { href: "/talks", label: "Group talks" },
  { href: "/session", label: "1-to-1 session" },
  { href: "/about", label: "About" },
] as const;
