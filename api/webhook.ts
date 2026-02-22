import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// ── Env var check at cold-start ────────────────────────────────────────────
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

// ── Price ID → Plan mapping ────────────────────────────────────────────────
const PRICE_PLAN_MAP: Record<string, { planName: string; invoiceTemplate: string }> = {
    'price_1T3ZJNFkPVozTYrkrp9k0hHw': { planName: 'Basic Shield', invoiceTemplate: 'BASIC_SHIELD_TEMPLATE' },
    'price_1T3ZJNFkPVozTYrkkl2f8f3S': { planName: 'Basic Shield', invoiceTemplate: 'BASIC_SHIELD_TEMPLATE' },
    'price_1T3ZKgFkPVozTYrkBwyLcgI4': { planName: 'The Guardian', invoiceTemplate: 'GUARDIAN_TEMPLATE' },
    'price_1T3ZKgFkPVozTYrkAK8GaG9P': { planName: 'The Guardian', invoiceTemplate: 'GUARDIAN_TEMPLATE' },
    'price_1T3ZLcFkPVozTYrkO7bi1GWS': { planName: 'Family Fortress', invoiceTemplate: 'FAMILY_SHIELD_TEMPLATE' },
    'price_1T3ZLcFkPVozTYrktYp5NSYT': { planName: 'Family Fortress', invoiceTemplate: 'FAMILY_SHIELD_TEMPLATE' },
};

// ── Invoice Template IDs (Stripe Rendering Templates) ─────────────────────
const TEMPLATE_IDS: Record<string, string> = {
    BASIC_SHIELD_TEMPLATE: 'inrtem_1T3bdmFkPVozTYrkpKZ03xse',
    GUARDIAN_TEMPLATE: 'inrtem_1T3bgdFkPVozTYrksEM4BUhR',
    FAMILY_SHIELD_TEMPLATE: 'inrtem_1T3biBFkPVozTYrk90FOkEyi',
};

// Disable body parsing — Stripe needs the raw bytes to verify signatures
export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
    console.log('WEBHOOK_RECEIVED', req.method);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // ── Signature verification ─────────────────────────────────────────────
    const sig = req.headers['stripe-signature'] as string;
    if (!sig) return res.status(400).json({ error: 'Missing Stripe-Signature header' });

    let event: Stripe.Event;
    try {
        const rawBody = await readRawBody(req);
        event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
        console.log('[SLP Webhook] ✅ Event verified:', event.type);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Signature verification failed';
        console.error('[SLP Webhook] ❌ Signature error:', msg);
        return res.status(400).json({ error: msg });
    }

    // ── Event routing ──────────────────────────────────────────────────────
    switch (event.type) {

        // ── invoice.created ──────────────────────────────────────────────────
        // Fires when Stripe creates any invoice for a subscription — including
        // the VERY FIRST one, while it is still in 'draft' state. This is the
        // earliest point we can apply a custom rendering template.
        case 'invoice.created': {
            const invoice = event.data.object as Stripe.Invoice;
            console.log('[SLP Webhook] invoice.created — status:', invoice.status, '| id:', invoice.id);

            if (invoice.status !== 'draft') {
                console.log('[SLP Webhook] Invoice already past draft — skipping template apply');
                break;
            }

            // The template ID is stored in subscription metadata (set at checkout creation)
            let templateId: string | null = null;

            // `.subscription` exists at runtime but isn't typed in all SDK versions
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const invoiceSub = (invoice as any).subscription as string | Stripe.Subscription | null | undefined;

            if (invoiceSub) {
                try {
                    const sub = await stripe.subscriptions.retrieve(
                        typeof invoiceSub === 'string'
                            ? invoiceSub
                            : (invoiceSub as Stripe.Subscription).id
                    );
                    const templateFromMeta = sub.metadata?.invoiceTemplate ?? null;
                    templateId = templateFromMeta
                        ? (TEMPLATE_IDS[templateFromMeta] ?? null)
                        : null;
                    console.log('[SLP Webhook] Subscription metadata invoiceTemplate:', templateFromMeta, '→ ID:', templateId);
                } catch (err) {
                    console.error('[SLP Webhook] ⚠️ Could not retrieve subscription:', err instanceof Error ? err.message : err);
                }
            }

            if (templateId) {
                try {
                    await stripe.invoices.update(invoice.id, {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        rendering: { template: templateId } as any,
                    });
                    console.log('[SLP Webhook] ✅ Invoice template applied to draft invoice:', invoice.id, '→', templateId);
                } catch (err) {
                    console.error('[SLP Webhook] ⚠️ Invoice template update failed:', err instanceof Error ? err.message : err);
                }
            } else {
                console.log('[SLP Webhook] ℹ️ No template ID resolved for invoice:', invoice.id);
            }
            break;
        }

        // ── checkout.session.completed ───────────────────────────────────────
        // Primary handler: saves customer to Supabase and applies template to
        // the subscription (covers all future renewal invoices).
        case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            console.log('[SLP Webhook] Processing session:', session.id);

            // Resolve plan via price_id (authoritative — can't be spoofed)
            let priceId: string | null = null;
            try {
                const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
                priceId = lineItems.data[0]?.price?.id ?? null;
                console.log('[SLP Webhook] price_id:', priceId);
            } catch (err) {
                console.error('[SLP Webhook] ⚠️ Could not fetch line items:', err instanceof Error ? err.message : err);
            }

            const planInfo = priceId ? PRICE_PLAN_MAP[priceId] : null;
            const involveTemplate = planInfo?.invoiceTemplate ?? null;
            const plan = planInfo?.planName ?? session.metadata?.planName ?? null;
            const billingInterval = session.metadata?.billingInterval ?? null;
            const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
            const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null;

            console.log(`[SLP Webhook] Plan: "${plan}" | template: "${involveTemplate}" | interval: "${billingInterval}"`);

            // Apply template to the subscription for all future renewal invoices
            const templateId = involveTemplate ? TEMPLATE_IDS[involveTemplate] : null;
            if (templateId && subscriptionId) {
                try {
                    await stripe.subscriptions.update(subscriptionId, {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        invoice_settings: { rendering: { template: templateId } } as any,
                    });
                    console.log('[SLP Webhook] ✅ Template applied to subscription:', involveTemplate, '→', templateId);
                } catch (err) {
                    console.error('[SLP Webhook] ⚠️ Subscription template update failed:', err instanceof Error ? err.message : err);
                }
            }

            // ── Retrieve + log the latest invoice ─────────────────────────
            // Proves the invoice exists in Stripe. If it shows here, look for it in
            // Stripe Dashboard → Billing → Invoices (filter by the ID below).
            if (subscriptionId) {
                try {
                    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
                        expand: ['latest_invoice'],
                    });
                    const inv = sub.latest_invoice as Stripe.Invoice | null;
                    if (inv) {
                        console.log(`[SLP Webhook] 📄 Latest invoice — id: ${inv.id} | status: ${inv.status} | amount: ${inv.amount_paid} | hosted_url: ${inv.hosted_invoice_url}`);
                    } else {
                        console.warn('[SLP Webhook] ⚠️ No latest_invoice found on subscription — this is unexpected for subscription mode');
                    }
                } catch (err) {
                    console.error('[SLP Webhook] ⚠️ Could not retrieve subscription invoice:', err instanceof Error ? err.message : err);
                }
            }

            // Upsert customer to Supabase
            const details = session.customer_details;
            const { error } = await supabaseAdmin
                .from('customers')
                .upsert(
                    {
                        name: details?.name ?? null,
                        email: details?.email ?? null,
                        phone: details?.phone ?? null,
                        plan,
                        billing_interval: billingInterval,
                        stripe_customer_id: stripeCustomerId,
                        subscription_id: subscriptionId,
                        subscription_status: 'active',
                    },
                    { onConflict: 'email' },
                );

            console.log('SUPABASE_UPDATE_STATUS', error ? JSON.stringify(error) : 'success');
            break;
        }

        default:
            console.log('[SLP Webhook] ℹ️ Unhandled event type:', event.type);
    }

    // Always 200 — prevents Stripe retries on our processing errors
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
