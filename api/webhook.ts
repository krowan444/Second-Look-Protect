import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Service role key — server-side only, never exposed client-side
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Disable body parsing — Stripe requires the raw body to verify the signature
export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const sig = req.headers['stripe-signature'] as string;
    if (!sig) {
        return res.status(400).json({ error: 'Missing Stripe-Signature header' });
    }

    // ── 1. Verify Stripe signature ─────────────────────────────────────────
    let event: Stripe.Event;
    try {
        const rawBody = await readRawBody(req);
        event = stripe.webhooks.constructEvent(
            rawBody,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET as string
        );
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Signature verification failed';
        console.error('[SLP Webhook] ❌ Signature error:', msg);
        return res.status(400).json({ error: msg });
    }

    console.log('[SLP Webhook] ✅ Event received:', event.type);

    // ── 2. Handle checkout.session.completed ──────────────────────────────
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const details = session.customer_details;

        // Contact info
        const name = details?.name ?? null;
        const email = details?.email ?? null;
        const phone = details?.phone ?? null;

        // Plan + billing
        const plan = session.metadata?.planName ?? null;
        const billingInterval = session.metadata?.billingInterval ?? null; // 'monthly' | 'yearly'

        // Stripe IDs
        const stripeCustomerId = typeof session.customer === 'string'
            ? session.customer : null;
        const subscriptionId = typeof session.subscription === 'string'
            ? session.subscription : null;

        console.log(`[SLP Webhook] checkout.session.completed — email: ${email}, plan: ${plan}, interval: ${billingInterval}, sub: ${subscriptionId}`);

        // ── 3. Write to Supabase customers table (service role — bypasses RLS) ──
        const { error } = await supabaseAdmin.from('customers').insert({
            name,
            email,
            phone,
            plan,
            billing_interval: billingInterval,
            stripe_customer_id: stripeCustomerId,
            subscription_id: subscriptionId,
        });

        if (error) {
            // Log the error but still return 200 — payment succeeded, don't make Stripe retry
            console.error('[SLP Webhook] ❌ Supabase insert error:', error.message);
        } else {
            console.log('[SLP Webhook] ✅ Customer saved to Supabase:', email);
        }
    }

    // ── 4. Respond quickly with 200 OK ────────────────────────────────────
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
