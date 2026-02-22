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

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const stripe = new Stripe(STRIPE_SECRET);

// ── Price ID → Plan + Invoice Template mapping ────────────────────────────
// Each price_id maps to the plan name shown in Supabase and the template to apply.
const PRICE_PLAN_MAP: Record<string, { planName: string; invoiceTemplate: string }> = {
    // Basic Shield — monthly & yearly
    'price_1T3ZJNFkPVozTYrkrp9k0hHw': { planName: 'Basic Shield', invoiceTemplate: 'BASIC_SHIELD_TEMPLATE' },
    'price_1T3ZJNFkPVozTYrkkl2f8f3S': { planName: 'Basic Shield', invoiceTemplate: 'BASIC_SHIELD_TEMPLATE' },
    // The Guardian — monthly & yearly
    'price_1T3ZKgFkPVozTYrkBwyLcgI4': { planName: 'The Guardian', invoiceTemplate: 'GUARDIAN_TEMPLATE' },
    'price_1T3ZKgFkPVozTYrkAK8GaG9P': { planName: 'The Guardian', invoiceTemplate: 'GUARDIAN_TEMPLATE' },
    // Family Fortress — monthly & yearly
    'price_1T3ZLcFkPVozTYrkO7bi1GWS': { planName: 'Family Fortress', invoiceTemplate: 'FAMILY_SHIELD_TEMPLATE' },
    'price_1T3ZLcFkPVozTYrktYp5NSYT': { planName: 'Family Fortress', invoiceTemplate: 'FAMILY_SHIELD_TEMPLATE' },
};

// ── Invoice Template IDs ──────────────────────────────────────────────────
// Replace placeholder values with real Stripe Invoice Template IDs:
// Stripe Dashboard → Billing → Invoice Templates → copy the ID (format: tmpl_xxx)
const TEMPLATE_IDS: Record<string, string> = {
    BASIC_SHIELD_TEMPLATE: 'inrtem_1T3bdmFkPVozTYrkpKZ03xse',
    GUARDIAN_TEMPLATE: 'inrtem_1T3bgdFkPVozTYrksEM4BUhR',
    FAMILY_SHIELD_TEMPLATE: 'inrtem_1T3biBFkPVozTYrk90FOkEyi',
};

// Disable body parsing — Stripe needs the raw bytes to verify signatures
export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // ── 1: Method guard ────────────────────────────────────────────────────
    console.log('WEBHOOK_RECEIVED', req.method);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // ── 2: Signature verification ──────────────────────────────────────────
    const sig = req.headers['stripe-signature'] as string;
    if (!sig) {
        console.error('[SLP Webhook] ❌ Missing Stripe-Signature header');
        return res.status(400).json({ error: 'Missing Stripe-Signature header' });
    }

    let event: Stripe.Event;
    try {
        const rawBody = await readRawBody(req);
        event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
        console.log('[SLP Webhook] ✅ Signature verified — event:', event.type);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Signature verification failed';
        console.error('[SLP Webhook] ❌ Signature error:', msg);
        return res.status(400).json({ error: msg });
    }

    // ── 3: Handle checkout.session.completed ──────────────────────────────
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('[SLP Webhook] Processing session:', session.id);

        // ── 3a: Resolve plan via price_id from line items ─────────────────
        // This is the authoritative source — price ID can't be spoofed
        let priceId: string | null = null;
        try {
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
            priceId = lineItems.data[0]?.price?.id ?? null;
            console.log('[SLP Webhook] price_id from line_items:', priceId);
        } catch (err) {
            console.error('[SLP Webhook] ⚠️ Could not fetch line items:', err instanceof Error ? err.message : err);
        }

        const planInfo = priceId ? PRICE_PLAN_MAP[priceId] : null;
        const invoiceTemplate = planInfo?.invoiceTemplate ?? null;

        // Fall back to metadata if price ID wasn't in our map
        const plan = planInfo?.planName ?? session.metadata?.planName ?? null;
        const billingInterval = session.metadata?.billingInterval ?? null;

        console.log(`[SLP Webhook] Plan resolved: "${plan}" | template: "${invoiceTemplate}" | interval: "${billingInterval}"`);

        // ── 3b: Apply Stripe Invoice Template to the subscription ─────────
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
        const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null;
        const templateId = invoiceTemplate ? TEMPLATE_IDS[invoiceTemplate] : null;

        if (templateId && subscriptionId) {
            try {
                await stripe.subscriptions.update(subscriptionId, {
                    // invoice_settings.rendering.template is a newer Stripe field not yet
                    // fully typed — cast required to bypass TS definition gap.
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    invoice_settings: { rendering: { template: templateId } } as any,
                });
                console.log(`[SLP Webhook] ✅ Invoice template applied: ${invoiceTemplate} → ${templateId}`);
            } catch (err) {
                console.error('[SLP Webhook] ⚠️ Invoice template apply failed:', err instanceof Error ? err.message : err);
            }
        } else if (invoiceTemplate) {
            // Template name identified but no Stripe ID yet — log for reference
            console.log(`[SLP Webhook] ℹ️ Template identified: "${invoiceTemplate}" — add its Stripe ID to TEMPLATE_IDS in webhook.ts to activate`);
        }

        // ── 3c: Customer contact details ──────────────────────────────────
        const details = session.customer_details;
        const name = details?.name ?? null;
        const email = details?.email ?? null;
        const phone = details?.phone ?? null;

        // ── 3d: Upsert to Supabase (service role bypasses RLS) ────────────
        const { error } = await supabaseAdmin
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
                { onConflict: 'email' },
            );

        console.log('SUPABASE_UPDATE_STATUS', error ? error : 'success');

        if (error) {
            console.error('[SLP Webhook] ❌ Supabase upsert error:', JSON.stringify(error));
        } else {
            console.log('[SLP Webhook] ✅ Customer saved to Supabase:', email, '| plan:', plan);
        }
    } else {
        console.log('[SLP Webhook] ℹ️ Unhandled event type:', event.type);
    }

    // ── 4: Always respond 200 to prevent Stripe retries ──────────────────
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
