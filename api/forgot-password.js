// /api/forgot-password.js
//
// Secure password-reset request endpoint.
// - Never discloses whether the email exists (always returns 200 ok).
// - Rate-limited to 3 requests per email per 15 minutes.
// - Delegates to Supabase Admin generateLink to send the reset email to the
//   real account email address only — never to an unverified address.
// - Logs a hashed record for audit purposes without storing plaintext emails.

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

/* ── In-memory rate limit store ─────────────────────────────────────────────
   Structure: { emailHash -> { count, windowStart } }
   This is per-instance; for multi-instance Vercel deployments this is
   best-effort protection. A Redis/KV store can replace it for strict limits.  */
const rateLimitStore = new Map();
const RATE_LIMIT_MAX = 3;          // max requests per window
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;  // 15 minutes

function checkRateLimit(emailHash) {
    const now = Date.now();
    const entry = rateLimitStore.get(emailHash);

    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        // First request in a new window
        rateLimitStore.set(emailHash, { count: 1, windowStart: now });
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
    }

    if (entry.count >= RATE_LIMIT_MAX) {
        const retryAfterSec = Math.ceil(
            (RATE_LIMIT_WINDOW_MS - (now - entry.windowStart)) / 1000
        );
        return { allowed: false, retryAfterSec };
    }

    entry.count += 1;
    return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// Clean up old entries periodically to avoid memory leaks
setInterval(() => {
    const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
    for (const [key, entry] of rateLimitStore.entries()) {
        if (entry.windowStart < cutoff) rateLimitStore.delete(key);
    }
}, 5 * 60 * 1000); // every 5 minutes

/* ── Helper ──────────────────────────────────────────────────────────────── */

function hashEmail(email) {
    return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 16);
}

/* ── Handler ─────────────────────────────────────────────────────────────── */

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
        console.error('[forgot-password] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const { email } = req.body || {};

    // Basic validation — still return 200 on failure to avoid disclosure
    if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(200).json({ ok: true });
    }

    const normalisedEmail = email.toLowerCase().trim();
    const emailHash = hashEmail(normalisedEmail);

    /* ── Rate limiting ───────────────────────────────────────────────────── */
    const rateCheck = checkRateLimit(emailHash);
    if (!rateCheck.allowed) {
        console.warn(`[forgot-password] Rate limit hit for hash=${emailHash}`);
        // Return 429 only — still do NOT disclose the email status
        return res.status(429).json({
            error: 'Too many requests. Please wait a few minutes before trying again.',
            retryAfterSec: rateCheck.retryAfterSec,
        });
    }

    /* ── Send reset email via Supabase Admin ─────────────────────────────── */
    try {
        const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Determine where the reset email should redirect the user.
        // Must be an allowed redirect URL in Supabase Auth settings.
        const redirectTo = `${process.env.SITE_URL || 'https://second-look-protect.vercel.app'}/dashboard`;

        // generateLink sends the email AND returns a link — we only care about
        // the side effect (sending the email). If the email doesn't exist,
        // Supabase may return an error, which we swallow silently.
        await supabase.auth.admin.generateLink({
            type: 'recovery',
            email: normalisedEmail,
            options: { redirectTo },
        });

        // Audit log — hash only, never plaintext email
        console.log(`[forgot-password] Reset requested hash=${emailHash} at=${new Date().toISOString()}`);

    } catch (err) {
        // Swallow all errors — never disclose to client whether email exists
        console.error('[forgot-password] Internal error (suppressed from client):', err?.message);
    }

    // Always return success — never reveal whether email exists
    return res.status(200).json({ ok: true });
}
