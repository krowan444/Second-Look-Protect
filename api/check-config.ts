import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/check-config
 *
 * Live diagnostic endpoint — visit in your browser to see:
 *   1. Which env vars are set vs missing
 *   2. Whether the Supabase service role key can actually connect
 *   3. What error Supabase returns (RLS, bad key, wrong URL, missing column, etc.)
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
    const vars = {
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        NEXT_PUBLIC_PRICE_ID_BASIC_MONTHLY: process.env.NEXT_PUBLIC_PRICE_ID_BASIC_MONTHLY,
        NEXT_PUBLIC_PRICE_ID_BASIC_YEARLY: process.env.NEXT_PUBLIC_PRICE_ID_BASIC_YEARLY,
        NEXT_PUBLIC_PRICE_ID_GUARDIAN_MONTHLY: process.env.NEXT_PUBLIC_PRICE_ID_GUARDIAN_MONTHLY,
        NEXT_PUBLIC_PRICE_ID_GUARDIAN_YEARLY: process.env.NEXT_PUBLIC_PRICE_ID_GUARDIAN_YEARLY,
        NEXT_PUBLIC_PRICE_ID_FAMILY_MONTHLY: process.env.NEXT_PUBLIC_PRICE_ID_FAMILY_MONTHLY,
        NEXT_PUBLIC_PRICE_ID_FAMILY_YEARLY: process.env.NEXT_PUBLIC_PRICE_ID_FAMILY_YEARLY,
    };

    const envStatus = Object.fromEntries(
        Object.entries(vars).map(([k, v]) => [k, v ? '✅ set' : '❌ MISSING'])
    );

    // ── Live Supabase connection test ─────────────────────────────────────
    let supabaseTest: Record<string, unknown> = { skipped: 'env vars missing' };

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceKey) {
        try {
            const supabaseAdmin = createClient(supabaseUrl, serviceKey);

            // 1. Try to read a single row — tells us if the key + URL work
            const { error: readError } = await supabaseAdmin
                .from('customers')
                .select('id')
                .limit(1);

            if (readError) {
                supabaseTest = {
                    status: '❌ READ FAILED',
                    code: readError.code,
                    message: readError.message,
                    details: readError.details,
                    hint: readError.hint,
                };
            } else {
                // 2. Try to insert a _test_ row to check write permissions
                const { error: writeError } = await supabaseAdmin
                    .from('customers')
                    .insert({ email: '__config_test__@slp.internal', name: 'Config Test' });

                if (writeError) {
                    supabaseTest = {
                        status: '⚠️  READ OK but WRITE FAILED',
                        code: writeError.code,
                        message: writeError.message,
                        details: writeError.details,
                        hint: writeError.hint,
                        action: 'This is likely an RLS policy issue or missing column. See hint above.',
                    };
                } else {
                    // Clean up the test row immediately
                    await supabaseAdmin
                        .from('customers')
                        .delete()
                        .eq('email', '__config_test__@slp.internal');

                    supabaseTest = { status: '✅ READ + WRITE both succeeded — Supabase is fully connected' };
                }
            }
        } catch (err) {
            supabaseTest = {
                status: '❌ EXCEPTION',
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }

    return res.status(200).json({
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
        envVars: envStatus,
        supabaseTest,
    });
}
