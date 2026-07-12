# Second Look Protect v2 — Go-Live Checklist (Kieran's copy)

The site is deployed but the engine needs keys. Do these once, in order.
Every key is pasted by YOU into Vercel — never share them in chat.

## 1. Supabase (fresh project) — ~10 min
1. supabase.com → New project (e.g. "second-look-v2", region: London)
2. SQL Editor → paste & run everything in `supabase/schema.sql`
3. Storage → New bucket → name `uploads` → Public ON.
   Then bucket → Policies → New policy → allow INSERT for role `anon`.
4. Authentication → Users → Add user → hello@learnaifast.co.uk + a strong password
   (this is your dashboard login at /admin)
5. Project Settings → API: copy the Project URL, anon key, service_role key

## 2. Resend (email) — ~10 min
1. resend.com → sign up free → Domains → add learnaifast.co.uk
2. Add the DNS records it shows you (wherever your domain DNS lives)
3. API Keys → create one

## 3. OpenAI + Gemini keys
- platform.openai.com → API keys → create (used for OCR + analysis, gpt-4o-mini = pennies)
- aistudio.google.com → Get API key (used for web-research corroboration)

## 4. CallMeBot (WhatsApp pings to you) — ~2 min
1. Add +34 644 84 71 89 to your phone contacts
2. WhatsApp it the message: "I allow callmebot to send me messages"
3. It replies with your personal apikey

## 5. Stripe £9.99/month — ~10 min
1. Stripe dashboard → Product catalogue → Add product:
   "Peace of Mind — Second Look Protect", £9.99/month recurring
2. Payment Links → create link for it → copy the URL
3. Developers → Webhooks → Add endpoint:
   URL: https://second-look-protect.vercel.app/api/stripe-webhook
   Events: checkout.session.completed, customer.subscription.updated,
           customer.subscription.deleted
   → copy the signing secret (whsec_...)

## 6. Paste into Vercel → second-look-protect → Settings → Environment Variables
```
VITE_SUPABASE_URL          = (Supabase Project URL)
VITE_SUPABASE_ANON_KEY     = (anon key)
VITE_STRIPE_PAYMENT_LINK   = (Stripe payment link URL)
SUPABASE_URL               = (same Project URL)
SUPABASE_SERVICE_ROLE_KEY  = (service_role key)
OPENAI_API_KEY             = (OpenAI key)
GEMINI_API_KEY             = (Gemini key)
RESEND_API_KEY             = (Resend key)
EMAIL_FROM                 = Second Look Protect <hello@learnaifast.co.uk>
ADMIN_NOTIFY_EMAIL         = hello@learnaifast.co.uk
CALLMEBOT_PHONE            = 447563887804
CALLMEBOT_APIKEY           = (CallMeBot apikey)
STRIPE_SECRET_KEY          = (Stripe secret key)
STRIPE_WEBHOOK_SECRET      = (whsec_...)
```
Then Deployments → Redeploy.

## 7. Test the loop
1. Visit /check → submit a fake scam text → you should get email + WhatsApp
2. Visit /admin → log in → review the AI report → Approve & Send
3. Check the customer email arrives (send to yourself first)

## The flow you built
form → Supabase → AI report (OCR + triage + web corroboration)
→ WhatsApp + email ping to you → you review/edit at /admin
→ Approve & Send → branded report to customer (+ £9.99 upsell for non-members)
Stripe webhook keeps the members table current → member badges in your queue.
