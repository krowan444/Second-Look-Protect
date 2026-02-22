import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

/** GET /api/get-session?session_id=cs_xxx
 *  Returns the customer email from the completed Checkout Session.
 *  Only exposes email — nothing sensitive.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).end();

    const { session_id } = req.query;

    if (!session_id || typeof session_id !== 'string') {
        return res.status(400).json({ error: 'session_id is required' });
    }

    try {
        const session = await stripe.checkout.sessions.retrieve(session_id);
        const email = session.customer_details?.email ?? null;
        return res.json({ email });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to retrieve session';
        console.error('[SLP] get-session error:', msg);
        return res.status(500).json({ error: msg });
    }
}
