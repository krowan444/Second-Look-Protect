import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Debug endpoint — visit /api/check-config in your browser (or Postman) to
 * instantly see which env vars are present in the current Vercel environment.
 * Values are hidden; only ✅/❌ status is shown.
 *
 * Remove or gate this behind a secret header once you're done debugging.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
    const vars = [
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'NEXT_PUBLIC_PRICE_ID_BASIC_MONTHLY',
        'NEXT_PUBLIC_PRICE_ID_BASIC_YEARLY',
        'NEXT_PUBLIC_PRICE_ID_GUARDIAN_MONTHLY',
        'NEXT_PUBLIC_PRICE_ID_GUARDIAN_YEARLY',
        'NEXT_PUBLIC_PRICE_ID_FAMILY_MONTHLY',
        'NEXT_PUBLIC_PRICE_ID_FAMILY_YEARLY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'VITE_SUPABASE_URL',
    ];

    const status = Object.fromEntries(
        vars.map((key) => [key, process.env[key] ? '✅ set' : '❌ MISSING'])
    );

    return res.status(200).json({
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
        config: status,
    });
}
