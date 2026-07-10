// api/stripe-webhook.js — keeps the members table in sync with Stripe.
// Point a Stripe webhook at /api/stripe-webhook with events:
//   checkout.session.completed, customer.subscription.updated,
//   customer.subscription.deleted
// Signature verified manually (HMAC-SHA256) — no stripe SDK needed.
import crypto from "node:crypto";

export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function verifyStripeSignature(payload, sigHeader, secret) {
  const parts = Object.fromEntries(
    (sigHeader || "").split(",").map((kv) => kv.split("=").map((s) => s.trim()))
  );
  if (!parts.t || !parts.v1) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${payload}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY || !WEBHOOK_SECRET) return res.status(500).json({ ok: false });
  const sb = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };

  const payload = await readRawBody(req);
  if (!verifyStripeSignature(payload, req.headers["stripe-signature"], WEBHOOK_SECRET)) {
    return res.status(400).json({ ok: false, error: "Bad signature" });
  }

  const event = JSON.parse(payload);
  const upsertMember = async (email, fields) => {
    if (!email) return;
    await fetch(`${SUPABASE_URL}/rest/v1/members?on_conflict=email`, {
      method: "POST",
      headers: { ...sb, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ email: email.toLowerCase(), updated_at: new Date().toISOString(), ...fields }),
    });
  };

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      await upsertMember(s.customer_details?.email || s.customer_email, {
        stripe_customer_id: s.customer || null,
        stripe_subscription_id: s.subscription || null,
        status: "active",
      });
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subObj = event.data.object;
      const status =
        event.type === "customer.subscription.deleted"
          ? "canceled"
          : subObj.status === "active" || subObj.status === "trialing"
          ? "active"
          : subObj.status === "past_due"
          ? "past_due"
          : "canceled";
      /* Find the member row by customer id; fall back to Stripe customer lookup */
      const found = await fetch(
        `${SUPABASE_URL}/rest/v1/members?stripe_customer_id=eq.${encodeURIComponent(subObj.customer)}&select=email&limit=1`,
        { headers: sb }
      );
      const rows = found.ok ? await found.json() : [];
      let email = rows[0]?.email;
      if (!email && STRIPE_KEY) {
        const custRes = await fetch(`https://api.stripe.com/v1/customers/${subObj.customer}`, {
          headers: { Authorization: `Bearer ${STRIPE_KEY}` },
        });
        if (custRes.ok) email = (await custRes.json()).email;
      }
      await upsertMember(email, { stripe_customer_id: subObj.customer, status });
    }
    return res.status(200).json({ received: true });
  } catch (e) {
    console.error("[stripe-webhook] Error:", e.message || e);
    return res.status(500).json({ ok: false });
  }
}
