import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
);

/**
 * POST /api/update-shipping
 * Body: { email: string, line1: string, city: string, postalCode: string }
 *
 * Safely patches ONLY the shipping_address JSONB column for the given email.
 * billing_interval, subscription_status and all other columns are untouched.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, line1, city, postalCode } = req.body as {
        email: string;
        line1: string;
        city: string;
        postalCode: string;
    };

    if (!email || !line1 || !city || !postalCode) {
        return res.status(400).json({ error: 'email, line1, city and postalCode are required' });
    }

    const shippingAddress = {
        line1,
        city,
        postal_code: postalCode,
        country: 'GB',
    };

    console.log('[SLP] update-shipping — email:', email, '| address:', JSON.stringify(shippingAddress));

    const { error } = await supabaseAdmin
        .from('customers')
        // .update() patches ONLY the columns listed — all other columns are untouched
        .update({ shipping_address: shippingAddress })
        .eq('email', email);

    if (error) {
        console.error('[SLP] ❌ update-shipping failed:', JSON.stringify(error));
        return res.status(500).json({ error: error.message });
    }

    console.log('[SLP] ✅ shipping_address saved for:', email);
    return res.status(200).json({ success: true });
}
