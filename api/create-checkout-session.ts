import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Allow CORS for local dev
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { priceId, planName } = req.body as { priceId: string; planName: string };

    if (!priceId) {
        return res.status(400).json({ error: 'priceId is required' });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ error: 'Stripe is not configured. Please add STRIPE_SECRET_KEY to environment variables.' });
    }

    try {
        const origin = (req.headers.origin as string) || 'https://www.secondlookprotect.com';

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],

            // Collect full contact details — no website account needed
            billing_address_collection: 'required',
            phone_number_collection: { enabled: true },
            customer_creation: 'always',

            // Pass plan name through to webhook
            metadata: { planName: planName ?? '' },

            // Redirect URLs
            success_url: `${origin}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/#pricing`,
        });

        return res.json({ url: session.url });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to create checkout session';
        console.error('[SLP] Checkout session error:', err);
        return res.status(500).json({ error: message });
    }
}
