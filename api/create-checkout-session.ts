import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Price ID map resolved from Vercel env vars at runtime (server-side only).
// Set these in Vercel Dashboard → Settings → Environment Variables
// and make sure to tick ALL three environments: Production, Preview, Development.
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

    // ── Validate STRIPE_SECRET_KEY ────────────────────────────────────────
    if (!process.env.STRIPE_SECRET_KEY) {
        console.error('[SLP Checkout] ❌ STRIPE_SECRET_KEY is not set in environment variables.');
        return res.status(500).json({ error: 'Payment system is not configured (missing STRIPE_SECRET_KEY).' });
    }

    // ── Diagnostic: log which Price ID env vars are present ───────────────
    // This appears in Vercel Function Logs so you can instantly see what's missing.
    const envStatus = Object.entries(PRICE_IDS)
        .map(([key, val]) => `${key}: ${val ? '✅ set' : '❌ MISSING'}`)
        .join(' | ');
    console.log(`[SLP Checkout] Env var status → ${envStatus}`);
    console.log(`[SLP Checkout] NODE_ENV=${process.env.NODE_ENV}, VERCEL_ENV=${process.env.VERCEL_ENV}`);

    const { planKey, billingInterval, planName } = req.body as {
        planKey: string;
        billingInterval: string;
        planName: string;
    };

    if (!planKey || !billingInterval) {
        return res.status(400).json({ error: 'planKey and billingInterval are required' });
    }

    // ── Resolve Price ID from env vars ────────────────────────────────────
    const envKey = `${planKey.toUpperCase()}_${billingInterval.toUpperCase()}`;
    const priceId = PRICE_IDS[envKey];

    if (!priceId) {
        // Log clearly so you can spot it in Vercel → Functions → Logs
        console.error(
            `[SLP Checkout] ❌ Price ID missing for key "${envKey}". ` +
            `Add NEXT_PUBLIC_PRICE_ID_${envKey} to Vercel Environment Variables ` +
            `and make sure "Production" is ticked, not just Preview/Development.`
        );
        return res.status(400).json({
            error: `No price configured for the ${planName} plan (${billingInterval}). ` +
                `Please contact support if this issue persists.`,
        });
    }

    // ── Create Stripe Checkout Session ────────────────────────────────────
    try {
        const origin = (req.headers.origin as string) || 'https://www.secondlookprotect.com';

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],

            // Collect full contact details — no website account required
            billing_address_collection: 'required',
            phone_number_collection: { enabled: true },
            customer_creation: 'always',

            // Pass through to webhook via metadata
            metadata: {
                planName: planName ?? '',
                billingInterval: billingInterval ?? 'monthly',
            },

            success_url: `${origin}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/#pricing`,
        });

        console.log(`[SLP Checkout] ✅ Session created — plan: ${planName} (${billingInterval}), priceId: ${priceId}`);
        return res.json({ url: session.url });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to create checkout session';
        console.error('[SLP Checkout] ❌ Stripe error:', message);
        return res.status(500).json({ error: message });
    }
}
