import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// ── Env var check at cold-start — visible in Vercel Function Logs ──────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY as string;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET as string;

console.log('[SLP Webhook] Cold-start env check:',
    `SUPABASE_URL=${SUPABASE_URL ? '✅' : '❌ MISSING'}`,
    `SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY ? '✅' : '❌ MISSING'}`,
    `STRIPE_SECRET=${STRIPE_SECRET ? '✅' : '❌ MISSING'}`,
    `WEBHOOK_SECRET=${WEBHOOK_SECRET ? '✅' : '❌ MISSING'}`,
);

// Service role client — bypasses RLS, never reaches the browser
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const stripe = new Stripe(STRIPE_SECRET);

// Disable body parsing — Stripe needs the raw bytes to verify signatures
export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // ── Step 1: method guard ───────────────────────────────────────────────
    console.log(`[SLP Webhook] 📥 Received ${req.method} request`);
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // ── Step 2: signature header check ────────────────────────────────────
    const sig = req.headers['stripe-signature'] as string;
    if (!sig) {
        console.error('[SLP Webhook] ❌ Missing Stripe-Signature header');
        return res.status(400).json({ error: 'Missing Stripe-Signature header' });
    }
    console.log('[SLP Webhook] ✅ Stripe-Signature header present');

    // ── Step 3: verify signature and parse event ──────────────────────────
    let event: Stripe.Event;
    try {
        const rawBody = await readRawBody(req);
        console.log(`[SLP Webhook] Raw body length: ${rawBody.length} bytes`);
        event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
        console.log('[SLP Webhook] ✅ Signature verified — event type:', event.type);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Signature verification failed';
        console.error('[SLP Webhook] ❌ Signature error:', msg);
        return res.status(400).json({ error: msg });
    }

    // ── Step 4: handle checkout.session.completed ─────────────────────────
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('[SLP Webhook] Processing checkout.session.completed, session id:', session.id);

        const details = session.customer_details;
        const name = details?.name ?? null;
        const email = details?.email ?? null;
        const phone = details?.phone ?? null;
        const plan = session.metadata?.planName ?? null;
        const billingInterval = session.metadata?.billingInterval ?? null;
        const stripeCustomerId = typeof session.customer === 'string'
            ? session.customer : null;
        const subscriptionId = typeof session.subscription === 'string'
            ? session.subscription : null;

        console.log('[SLP Webhook] Extracted data:', {
            email, plan, billingInterval, stripeCustomerId, subscriptionId,
        });

        // ── Step 5: upsert to Supabase ─────────────────────────────────────
        // onConflict: 'email' — updates the row if the customer re-subscribes.
        // Requires a UNIQUE constraint on the email column (see SQL note below).
        console.log('[SLP Webhook] Attempting Supabase upsert for email:', email);

        const { data, error } = await supabaseAdmin
            .from('customers')
            .upsert(
                {
                    name,
                    email,
                    phone,
                    plan,
                    billing_interval: billingInterval,
                    stripe_customer_id: stripeCustomerId,
                    subscription_id: subscriptionId,
                    subscription_status: 'active',
                },
                { onConflict: 'email' }
            )
            .select();

        if (error) {
            // Always return 200 — payment succeeded; don't trigger Stripe retries
            console.error('[SLP Webhook] ❌ Supabase upsert error:', JSON.stringify(error));
        } else {
            console.log('[SLP Webhook] ✅ Supabase upsert succeeded. Row:', JSON.stringify(data));
        }
    } else {
        console.log('[SLP Webhook] ℹ️ Unhandled event type (ignoring):', event.type);
    }

    // ── Step 6: respond 200 immediately ──────────────────────────────────
    console.log('[SLP Webhook] Responding 200 OK');
    return res.status(200).json({ received: true });
}

function readRawBody(req: VercelRequest): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}
