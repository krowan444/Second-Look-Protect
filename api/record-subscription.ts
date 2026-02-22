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
 * Called immediately from the /subscription-success page after Stripe redirects.
 * Saves the customer to Supabase and returns their email for the confirmation message.
 *
 * Two-phase write strategy:
 *   Phase 1 — Full upsert with all columns. Works once you've added the columns + unique
 *             constraint in Supabase (see note printed to logs).
 *   Phase 2 — Minimal insert fallback using only the 4 columns every fresh table has.
 *             This guarantees something is written even on a bare-bones schema.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { session_id } = req.query;
    if (!session_id || typeof session_id !== 'string') {
        return res.status(400).json({ error: 'session_id is required' });
    }

    // ── 1. Env var audit ──────────────────────────────────────────────────
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const stripeSecret = process.env.STRIPE_SECRET_KEY;

    console.log('[SLP] record-subscription env:',
        `VITE_SUPABASE_URL=${supabaseUrl ? '✅' : '❌ MISSING'}`,
        `SERVICE_ROLE_KEY=${serviceRoleKey ? '✅' : '❌ MISSING'}`,
        `STRIPE_SECRET_KEY=${stripeSecret ? '✅' : '❌ MISSING'}`,
    );

    if (!supabaseUrl || !serviceRoleKey) {
        return res.status(500).json({ error: 'Supabase env vars missing on server. Check Vercel → Settings → Environment Variables.' });
    }

    // ── 2. Retrieve & verify Stripe session ──────────────────────────────
    let session: Stripe.Checkout.Session;
    try {
        session = await stripe.checkout.sessions.retrieve(session_id);
        console.log('[SLP] ✅ Stripe session retrieved:', session.id, '| status:', session.status);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stripe error';
        console.error('[SLP] ❌ Stripe retrieve error:', msg);
        return res.status(500).json({ error: msg });
    }

    // ── 3. Extract data ───────────────────────────────────────────────────
    const details = session.customer_details;
    const email = details?.email ?? null;
    const name = details?.name ?? null;
    const phone = details?.phone ?? null;
    const plan = session.metadata?.planName ?? null;
    const billingInterval = session.metadata?.billingInterval ?? null;
    const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null;
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;

    console.log('[SLP] Extracted — email:', email, '| plan:', plan, '| interval:', billingInterval);

    // ── 4a. Phase 1: Full upsert (requires unique email constraint + extra columns) ──
    console.log('[SLP] Phase 1: attempting full upsert with all columns...');
    const { error: upsertError } = await supabaseAdmin
        .from('customers')
        .upsert(
            {
                email,
                name,
                phone,
                plan,
                billing_interval: billingInterval,
                stripe_customer_id: stripeCustomerId,
                subscription_id: subscriptionId,
                subscription_status: 'active',
            },
            { onConflict: 'email' },
        );

    if (!upsertError) {
        console.log('[SLP] ✅ Phase 1 upsert succeeded for:', email);
        return res.status(200).json({ email, plan, billingInterval });
    }

    // ── 4b. Phase 2: Minimal insert fallback (works with bare-bones schema) ──
    console.error('[SLP] ⚠️  Phase 1 upsert failed:', upsertError.code, upsertError.message);
    console.log('[SLP] Hint — to enable full upsert run this in Supabase SQL Editor:');
    console.log(`  ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_interval text;`);
    console.log(`  ALTER TABLE customers ADD COLUMN IF NOT EXISTS subscription_id text;`);
    console.log(`  ALTER TABLE customers ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'active';`);
    console.log(`  ALTER TABLE customers ADD CONSTRAINT customers_email_key UNIQUE (email);`);

    console.log('[SLP] Phase 2: attempting minimal insert (email + name + phone + plan)...');
    const { error: insertError } = await supabaseAdmin
        .from('customers')
        .insert({ email, name, phone, plan });

    if (!insertError) {
        console.log('[SLP] ✅ Phase 2 minimal insert succeeded for:', email);
        return res.status(200).json({ email, plan, billingInterval });
    }

    // Both failed — log full error objects so we can see exactly what's wrong
    console.error('[SLP] ❌ Phase 2 insert also failed:', JSON.stringify(insertError));
    return res.status(200).json({ email, plan, billingInterval, dbError: insertError.message });
}
