import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Price ID map resolved from Vercel env vars at runtime (server-side only).
const PRICE_IDS: Record<string, string | undefined> = {
    BASIC_MONTHLY: process.env.NEXT_PUBLIC_PRICE_ID_BASIC_MONTHLY,
    BASIC_YEARLY: process.env.NEXT_PUBLIC_PRICE_ID_BASIC_YEARLY,
    GUARDIAN_MONTHLY: process.env.NEXT_PUBLIC_PRICE_ID_GUARDIAN_MONTHLY,
    GUARDIAN_YEARLY: process.env.NEXT_PUBLIC_PRICE_ID_GUARDIAN_YEARLY,
    FAMILY_MONTHLY: process.env.NEXT_PUBLIC_PRICE_ID_FAMILY_MONTHLY,
    FAMILY_YEARLY: process.env.NEXT_PUBLIC_PRICE_ID_FAMILY_YEARLY,
};

// planKey → Stripe Invoice Rendering Template ID
const PLAN_INVOICE_TEMPLATES: Record<string, string> = {
    BASIC: 'inrtem_1T3bdmFkPVozTYrkpKZ03xse',
    GUARDIAN: 'inrtem_1T3bgdFkPVozTYrksEM4BUhR',
    FAMILY: 'inrtem_1T3biBFkPVozTYrk90FOkEyi',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // ── Validate STRIPE_SECRET_KEY ────────────────────────────────────────
    if (!process.env.STRIPE_SECRET_KEY) {
        console.error('[SLP Checkout] ❌ STRIPE_SECRET_KEY is not set.');
        return res.status(500).json({ error: 'Payment system is not configured.' });
    }

    // ── Diagnostic: log which Price ID env vars are present ───────────────
    const envStatus = Object.entries(PRICE_IDS)
        .map(([key, val]) => `${key}: ${val ? '✅' : '❌ MISSING'}`)
        .join(' | ');
    console.log(`[SLP Checkout] Env → ${envStatus}`);
    console.log(`[SLP Checkout] NODE_ENV=${process.env.NODE_ENV}, VERCEL_ENV=${process.env.VERCEL_ENV}`);

    const { planKey, billingInterval, planName } = req.body as {
        planKey: string;
        billingInterval: string;
        planName: string;
    };

    if (!planKey || !billingInterval) {
        return res.status(400).json({ error: 'planKey and billingInterval are required' });
    }

    // ── Resolve Price ID ──────────────────────────────────────────────────
    const envKey = `${planKey.toUpperCase()}_${billingInterval.toUpperCase()}`;
    const priceId = PRICE_IDS[envKey];

    if (!priceId) {
        console.error(
            `[SLP Checkout] ❌ Price ID missing for key "${envKey}". ` +
            `Add NEXT_PUBLIC_PRICE_ID_${envKey} to Vercel Environment Variables.`
        );
        return res.status(400).json({
            error: `No price configured for the ${planName} plan (${billingInterval}).`,
        });
    }

    // ── Create Stripe Checkout Session ────────────────────────────────────
    try {
        const origin = (req.headers.origin as string) || 'https://www.secondlookprotect.com';
        const invoiceTemplateId = PLAN_INVOICE_TEMPLATES[planKey.toUpperCase()] ?? '';

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],

            // Address + contact collection — all plans ship physical items
            billing_address_collection: 'required',
            phone_number_collection: { enabled: true },
            shipping_address_collection: { allowed_countries: ['GB'] },

            // Session-level metadata — available in checkout.session.completed
            metadata: {
                planName: planName ?? '',
                billingInterval: billingInterval ?? 'monthly',
                invoiceTemplate: invoiceTemplateId,
            },

            // Subscription-level metadata — persists on the subscription for invoice.created
            subscription_data: {
                metadata: {
                    planName: planName ?? '',
                    invoiceTemplate: invoiceTemplateId,
                },
            },

            success_url: `${origin}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/#pricing`,
        });

        console.log(`[SLP Checkout] ✅ Session created — ${planName} (${billingInterval}), price: ${priceId}`);
        return res.json({ url: session.url });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to create checkout session';
        console.error('[SLP Checkout] ❌ Stripe error:', message);
        return res.status(500).json({ error: message });
    }
}
