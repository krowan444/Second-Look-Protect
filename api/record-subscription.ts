import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Service role key — bypasses RLS entirely, never reaches the browser
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
);

/**
 * GET /api/record-subscription?session_id=cs_test_...
 *
 * Called by the /subscription-success page immediately after Stripe redirects back.
 * 1. Retrieves the completed Checkout Session from Stripe (secure — never trusts the client).
 * 2. Upserts the customer row in Supabase using the service role key (bypasses RLS).
 * 3. Returns { email } so the success page can personalise the confirmation message.
 *
 * This is a belt-and-braces approach: the Stripe webhook also writes to Supabase,
 * but this ensures the row exists even if the webhook has not fired yet.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS — allow browser calls from the same origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { session_id } = req.query;
    if (!session_id || typeof session_id !== 'string') {
        return res.status(400).json({ error: 'session_id is required' });
    }

    // ── Step 1: Log env var status ─────────────────────────────────────────
    console.log('[SLP record-subscription] env check:',
        `STRIPE_SECRET_KEY=${process.env.STRIPE_SECRET_KEY ? '✅' : '❌ MISSING'}`,
        `VITE_SUPABASE_URL=${process.env.VITE_SUPABASE_URL ? '✅' : '❌ MISSING'}`,
        `SERVICE_ROLE_KEY=${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌ MISSING'}`,
    );

    // ── Step 2: Retrieve session from Stripe ──────────────────────────────
    let session: Stripe.Checkout.Session;
    try {
        session = await stripe.checkout.sessions.retrieve(session_id);
        console.log('[SLP record-subscription] ✅ Session retrieved:', session.id);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to retrieve Stripe session';
        console.error('[SLP record-subscription] ❌ Stripe error:', msg);
        return res.status(500).json({ error: msg });
    }

    // Only process completed sessions
    if (session.status !== 'complete' && session.payment_status !== 'paid') {
        console.warn('[SLP record-subscription] Session not complete:', session.status);
        return res.status(400).json({ error: 'Session is not completed yet' });
    }

    // ── Step 3: Extract customer data ──────────────────────────────────────
    const details = session.customer_details;
    const name = details?.name ?? null;
    const email = details?.email ?? null;
    const phone = details?.phone ?? null;
    const plan = session.metadata?.planName ?? null;
    const billingInterval = session.metadata?.billingInterval ?? null;
    const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null;
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;

    console.log('[SLP record-subscription] Extracted:', { email, plan, billingInterval, stripeCustomerId });

    // ── Step 4: Upsert to Supabase using service role (bypasses RLS) ───────
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
        console.error('[SLP record-subscription] ❌ Supabase error code:', error.code, '| message:', error.message, '| details:', error.details);
        // Return the email anyway so the success page still works
        return res.status(200).json({ email, supabaseError: error.message });
    }

    console.log('[SLP record-subscription] ✅ Supabase upsert succeeded. Row:', JSON.stringify(data));
    return res.status(200).json({ email });
}
