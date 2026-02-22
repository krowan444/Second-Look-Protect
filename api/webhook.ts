import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Must use service role key (server-side only) so RLS doesn't block the insert
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Disable body parsing — Stripe requires the raw body to verify signatures
export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const sig = req.headers['stripe-signature'] as string;

    if (!sig) {
        return res.status(400).json({ error: 'Missing Stripe signature' });
    }

    let event: Stripe.Event;

    try {
        const rawBody = await readRawBody(req);
        event = stripe.webhooks.constructEvent(
            rawBody,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET as string
        );
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Webhook verification failed';
        console.error('[SLP Webhook] Signature error:', msg);
        return res.status(400).json({ error: msg });
    }

    // Handle successful checkout
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const details = session.customer_details;

        const name = details?.name ?? null;
        const email = details?.email ?? null;
        const phone = details?.phone ?? null;
        const plan = session.metadata?.planName ?? null;
        const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null;

        console.log('[SLP Webhook] checkout.session.completed — saving customer:', email);

        const { error } = await supabaseAdmin.from('customers').insert({
            name,
            email,
            phone,
            plan,
            stripe_customer_id: stripeCustomerId,
        });

        if (error) {
            console.error('[SLP Webhook] Supabase insert error:', error.message);
            // Still return 200 so Stripe doesn't retry (the payment succeeded)
        } else {
            console.log('[SLP Webhook] Customer saved to Supabase ✓');
        }
    }

    return res.json({ received: true });
}

function readRawBody(req: VercelRequest): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}
