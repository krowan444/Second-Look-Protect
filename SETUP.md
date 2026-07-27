# Second Look Protect — Go-Live Checklist

Everything the code needs, in the order it needs it.
**Every key is pasted by YOU into Vercel — never share them in chat.**

Items marked **[NEW]** are the ones added in this round of work.

---

## 1. Email — move everything to hello@secondlookprotect.co.uk **[NEW]**

The mailbox is a Google account, so **receiving** already works. Resend only
needs permission to **send** as that address — it adds DNS records alongside
your Google MX records and does not touch them.

1. **resend.com → Domains → Add domain → `secondlookprotect.co.uk`**
2. Resend shows you 3 records to add wherever your DNS lives (the registrar, or
   Cloudflare if you use it):
   - a `TXT` SPF record
   - a `CNAME` or `TXT` DKIM record
   - (optional but recommended) a `TXT` DMARC record
   **Do not delete or change your `MX` records** — those are Google's and keep
   your inbox working.
3. Wait for Resend to show **Verified** (usually minutes, occasionally a few hours).
4. **API Keys → create one** → this is `RESEND_API_KEY`.

> Until the domain shows Verified, every email from the site will silently fail.
> Check Resend → Logs if something doesn't arrive.

**What now goes to that inbox:** customer report emails (from + reply-to),
submission acknowledgements, new-check alerts, group-talk enquiries and their
confirmations, and the 90-minute chase email. All of it is defined in one place —
`api/_config.js` — so changing an address later is a one-line edit.

---

## 2. Stripe — show "Second Look Protect" on bank statements **[NEW]**

Customers currently see the wrong business name, which causes chargebacks.

1. **Stripe Dashboard → Settings → Business → Public details**
   - Set **Statement descriptor** to `SECOND LOOK PROTECT` (22 characters max,
     and it must be recognisably your business).
   - Set the **shortened descriptor** to `SECONDLOOK` if prompted.
2. **Settings → Business → Public details** — set the support email to
   `hello@secondlookprotect.co.uk` and the support phone to your number.
3. **Product catalogue** — check the Peace of Mind product name reads
   "Peace of Mind — Second Look Protect", since it appears on receipts.
4. If you run multiple businesses through one Stripe account, consider a separate
   account for SLP so the descriptor is never ambiguous.

> Descriptor changes apply to **new** charges only, not historic ones.

---

## 3. Cal.com — the booking that never leaves the site **[NEW]**

The old link pointed at your Cal.com **profile**, so people landed on a list of
event types with no payment attached. That was the bug. The site now embeds one
specific event inline on `/session`.

1. **cal.com → Event Types →** create (or open) the 60-minute
   **AI Scam Safety Session**.
2. **Apps → Stripe → Install → connect your Stripe account.**
3. On that event type: **Apps tab → Stripe → enable → price £79.99 GBP.**
   Without this step the calendar takes bookings but never charges.
4. Copy the event's full link. It looks like
   `cal.com/kieran-rowan-tiujdp/60-minute-ai-scam-safety-session`.
5. Put everything after `cal.com/` into Vercel as
   `VITE_SESSION_CAL_LINK=kieran-rowan-tiujdp/60-minute-ai-scam-safety-session`.

> It must be `username/event-slug`. A bare username reintroduces the original bug.

---

## 4. Supabase — run the schema again **[NEW]**

Safe to re-run on your existing database. Nothing is dropped.

1. **SQL Editor → paste and run all of `supabase/schema.sql`.**
   This adds the `talk_enquiries` table and the `reminder_stage` column the
   chase reminders depend on.
2. If this is a brand-new project, also do:
   - **Storage → New bucket → `uploads` → Public ON**, then
     **Policies → New policy → allow INSERT for role `anon`**
   - **Authentication → Users → Add user →** `hello@secondlookprotect.co.uk`
     plus a strong password (this is your `/admin` login)
3. **Project Settings → API** — copy the Project URL, anon key and service_role key.

---

## 5. Other keys

- **OpenAI** — platform.openai.com → API keys (OCR + analysis, gpt-4o-mini = pennies)
- **Gemini** — aistudio.google.com → Get API key (web-research corroboration)
- **CallMeBot** (free WhatsApp pings to your phone):
  1. Add **+34 644 84 71 89** to your contacts
  2. WhatsApp it: `I allow callmebot to send me messages`
  3. It replies with your personal apikey
- **Stripe webhook** — Developers → Webhooks → Add endpoint:
  - URL: `https://second-look-protect.vercel.app/api/stripe-webhook`
  - Events: `checkout.session.completed`, `customer.subscription.updated`,
    `customer.subscription.deleted`
  - Copy the signing secret (`whsec_...`)

---

## 6. Paste into Vercel → second-look-protect → Settings → Environment Variables

```
VITE_SUPABASE_URL          = (Supabase Project URL)
VITE_SUPABASE_ANON_KEY     = (anon key)
VITE_STRIPE_PAYMENT_LINK   = (Stripe payment link URL)
VITE_STRIPE_PORTAL_LINK    = (Stripe billing portal URL)
VITE_SESSION_CAL_LINK      = kieran-rowan-tiujdp/60-minute-ai-scam-safety-session   [NEW]

SUPABASE_URL               = (same Project URL)
SUPABASE_SERVICE_ROLE_KEY  = (service_role key)
OPENAI_API_KEY             = (OpenAI key)
GEMINI_API_KEY             = (Gemini key)

RESEND_API_KEY             = (Resend key)
EMAIL_FROM                 = Second Look Protect <hello@secondlookprotect.co.uk>   [NEW]
SUPPORT_EMAIL              = hello@secondlookprotect.co.uk                          [NEW]
ADMIN_NOTIFY_EMAIL         = hello@secondlookprotect.co.uk                          [NEW]
SITE_URL                   = https://second-look-protect.vercel.app                 [NEW]
SUPPORT_PHONE              = 07563 887804                                           [NEW]

CALLMEBOT_PHONE            = 447563887804
CALLMEBOT_APIKEY           = (CallMeBot apikey)
CRON_SECRET                = (any long random string)                               [NEW]

SMSWORKS_JWT               = (optional — customer SMS)
SMS_SENDER                 = SecondLook

STRIPE_SECRET_KEY          = (Stripe secret key)
STRIPE_WEBHOOK_SECRET      = (whsec_...)
```

Then **Deployments → Redeploy**.

---

## 7. Analytics **[NEW]**

`@vercel/analytics` and `@vercel/speed-insights` are already in the code and
mounted in `src/App.tsx` — nothing to install or paste.

1. **Vercel → your project → Analytics tab → Enable** (and **Speed Insights → Enable**).
2. Data starts appearing after the next deploy and a little real traffic.

Custom funnel events already firing (Analytics → Events):

| Event | Fires when |
|---|---|
| `check_started` | someone clicks a "check it free" CTA or picks a scam type |
| `check_submitted` | a check is successfully sent |
| `membership_clicked` | a Peace of Mind button is clicked |
| `session_viewed` | the `/session` booking page is opened |
| `talks_viewed` | the `/talks` page is opened |
| `talk_enquiry_started` | someone clicks through to the talks enquiry form |
| `talk_enquiry_submitted` | a talks enquiry is successfully sent |

---

## 8. Chase reminders **[NEW]**

If a report hasn't gone back to the customer, you get an escalating WhatsApp
nudge at roughly **30, 60 and 90 minutes**. At 90 minutes you also get an email,
in case your phone is face-down.

- Runs from `api/reminders.js` on a Vercel cron every 10 minutes
  (configured in `vercel.json` — your Pro plan supports this natively).
- Each stage fires **once per submission**; sending or dismissing a check stops
  all further nudges.
- Requires `CRON_SECRET` to be set, and the `reminder_stage` column from step 4.
- To test it by hand:
  `https://second-look-protect.vercel.app/api/reminders?key=YOUR_CRON_SECRET`
  It returns JSON listing anything it nudged.
- To change the timings, edit the `STAGES` array at the top of `api/reminders.js`.

---

## 9. Test the whole loop

1. `/check` → submit a fake scam text → you should get an email + WhatsApp ping,
   and the customer should get an acknowledgement from the new address
2. `/admin` → log in → run the AI check → review → **Approve & Send**
3. Confirm the customer email arrives **from hello@secondlookprotect.co.uk**
   (send to yourself first)
4. `/session` → the calendar loads inline and asks for card payment on the page
5. `/talks` → **Ask about a talk** → submit → you get the enquiry, they get the
   confirmation, and they land on `/talks/thank-you`
6. Leave a test check unsent for 30 minutes and confirm the WhatsApp nudge arrives

---

## The flow you built

```
form → Supabase → AI report (OCR + triage + web corroboration)
     → WhatsApp + email ping to you
     → chase nudges at 30 / 60 / 90 min if it's still sitting there
     → you review and edit at /admin
     → Approve & Send → branded report to the customer (+ £9.99 upsell for non-members)

Stripe webhook keeps the members table current → member badges in your queue.
Talks funnel: /talks → /talks/enquire → Supabase + email + WhatsApp → /talks/thank-you
```
