import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Price ID map — resolved from Vercel env vars at runtime (server-only, never exposed client-side)
// Env var names follow the NEXT_PUBLIC_ convention set in Vercel dashboard.
const PRICE_IDS: Record<string, string | undefined> = {
    BASIC_MONTHLY: process.env.NEXT_PUBLIC_PRICE_ID_BASIC_MONTHLY,
    BASIC_YEARLY: process.env.NEXT_PUBLIC_PRICE_ID_BASIC_YEARLY,
    GUARDIAN_MONTHLY: process.env.NEXT_PUBLIC_PRICE_ID_GUARDIAN_MONTHLY,
    GUARDIAN_YEARLY: process.env.NEXT_PUBLIC_PRICE_ID_GUARDIAN_YEARLY,
    FAMILY_MONTHLY: process.env.NEXT_PUBLIC_PRICE_ID_FAMILY_MONTHLY,
    FAMILY_YEARLY: process.env.NEXT_PUBLIC_PRICE_ID_FAMILY_YEARLY,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers for local dev
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ error: 'STRIPE_SECRET_KEY is not configured on the server.' });
    }

    const { planKey, billingInterval, planName } = req.body as {
        planKey: string;            // 'BASIC' | 'GUARDIAN' | 'FAMILY'
        billingInterval: string;    // 'monthly' | 'yearly'
        planName: string;
    };

    if (!planKey || !billingInterval) {
        return res.status(400).json({ error: 'planKey and billingInterval are required' });
    }

    // Resolve the Price ID server-side from env vars
    const envKey = `${planKey.toUpperCase()}_${billingInterval.toUpperCase()}`;
    const priceId = PRICE_IDS[envKey];

    if (!priceId) {
        console.error(`[SLP Checkout] No price ID configured for key: ${envKey}`);
        return res.status(400).json({
            error: `No price configured for ${envKey}. Please set NEXT_PUBLIC_PRICE_ID_${envKey} in Vercel environment variables.`,
        });
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

            // Pass plan name + billing interval to webhook via metadata
            metadata: {
                planName: planName ?? '',
                billingInterval: billingInterval ?? 'monthly',
            },

            // Redirect URLs
            success_url: `${origin}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/#pricing`,
        });

        console.log(`[SLP Checkout] ✅ Session created — plan: ${planName} (${billingInterval}), priceId: ${priceId}`);
        return res.json({ url: session.url });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to create checkout session';
        console.error('[SLP Checkout] ❌ Error:', err);
        return res.status(500).json({ error: message });
    }
}
