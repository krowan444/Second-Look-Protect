// /api/ai-triage-rerun.js
// Manual "Rerun AI Triage" endpoint — admin / super_admin only.
// Enforces a server-side 60-second per-case rate limit.

import aiTriageHandler from './ai-triage.js';

export default async function handler(req, res) {
    console.log('[ai-triage-rerun] ▶ Request received:', req.method);

    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
        return res.status(500).json({ ok: false, error: 'Server configuration error' });
    }

    const { case_id, organisation_id, user_token } = req.body || {};

    if (!case_id || !organisation_id || !user_token) {
        return res.status(400).json({ ok: false, error: 'case_id, organisation_id, and user_token are required' });
    }

    /* ── 1. Verify caller identity and role ─────────────────────────────────── */
    let callerRole = null;
    try {
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
                apikey: SERVICE_KEY,
                Authorization: `Bearer ${user_token}`,
            },
        });
        if (!userRes.ok) {
            console.error('[ai-triage-rerun] Auth check failed:', userRes.status);
            return res.status(401).json({ ok: false, error: 'Unauthorised — could not verify user' });
        }
        const userData = await userRes.json();
        const callerId = userData?.id;
        if (!callerId) {
            return res.status(401).json({ ok: false, error: 'Unauthorised — no user id' });
        }

        // Look up role from profiles
        const profRes = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(callerId)}&select=role&limit=1`,
            {
                headers: {
                    apikey: SERVICE_KEY,
                    Authorization: `Bearer ${SERVICE_KEY}`,
                },
            },
        );
        if (profRes.ok) {
            const profRows = await profRes.json();
            callerRole = profRows?.[0]?.role ?? null;
        }
    } catch (authErr) {
        console.error('[ai-triage-rerun] Auth lookup error:', authErr.message);
        return res.status(500).json({ ok: false, error: 'Auth lookup failed' });
    }

    const ALLOWED_ROLES = ['org_admin', 'super_admin'];
    if (!callerRole || !ALLOWED_ROLES.includes(callerRole)) {
        console.warn('[ai-triage-rerun] Forbidden — callerRole:', callerRole);
        return res.status(403).json({ ok: false, error: 'Forbidden — admin or super admin role required' });
    }

    console.log('[ai-triage-rerun] Caller authorised — role:', callerRole, '| case_id:', case_id);

    /* ── 2. Server-side rate limit: once per 60 seconds per case ────────────── */
    const cutoffIso = new Date(Date.now() - 60_000).toISOString();
    try {
        const rateRes = await fetch(
            `${SUPABASE_URL}/rest/v1/ai_triage_results?case_id=eq.${encodeURIComponent(case_id)}&updated_at=gte.${encodeURIComponent(cutoffIso)}&select=id,updated_at&limit=1`,
            {
                headers: {
                    apikey: SERVICE_KEY,
                    Authorization: `Bearer ${SERVICE_KEY}`,
                },
            },
        );
        if (rateRes.ok) {
            const recentRows = await rateRes.json();
            // Also check created_at in case updated_at is null (first-run rows)
            if (recentRows.length > 0) {
                // Check created_at too
                const createdCutoffRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/ai_triage_results?case_id=eq.${encodeURIComponent(case_id)}&created_at=gte.${encodeURIComponent(cutoffIso)}&select=id,created_at&limit=1`,
                    {
                        headers: {
                            apikey: SERVICE_KEY,
                            Authorization: `Bearer ${SERVICE_KEY}`,
                        },
                    },
                );
                const createdRows = createdCutoffRes.ok ? await createdCutoffRes.json() : [];
                if (createdRows.length > 0) {
                    const secondsRemaining = Math.ceil((new Date(createdRows[0].created_at).getTime() + 60_000 - Date.now()) / 1000);
                    console.warn('[ai-triage-rerun] Rate limited — case_id:', case_id, '| seconds remaining:', secondsRemaining);
                    return res.status(429).json({
                        ok: false,
                        error: `AI triage can only be rerun once per minute. Please wait ${secondsRemaining} second${secondsRemaining !== 1 ? 's' : ''} before trying again.`,
                        retry_after_seconds: secondsRemaining,
                    });
                }
            }
        }
    } catch (rateErr) {
        // Non-blocking — if rate check fails, proceed (fail-open for ops reliability)
        console.warn('[ai-triage-rerun] Rate limit check error (non-blocking):', rateErr.message);
    }

    /* ── 3. Delete existing triage row(s) for this case ─────────────────────── */
    try {
        const delRes = await fetch(
            `${SUPABASE_URL}/rest/v1/ai_triage_results?case_id=eq.${encodeURIComponent(case_id)}`,
            {
                method: 'DELETE',
                headers: {
                    apikey: SERVICE_KEY,
                    Authorization: `Bearer ${SERVICE_KEY}`,
                },
            },
        );
        if (!delRes.ok) {
            const delErr = await delRes.text();
            console.error('[ai-triage-rerun] Failed to delete existing triage:', delRes.status, delErr);
            return res.status(500).json({ ok: false, error: 'Failed to clear existing triage result before rerun' });
        }
        console.log('[ai-triage-rerun] Existing triage deleted for case_id:', case_id);
    } catch (delErr) {
        console.error('[ai-triage-rerun] Delete error:', delErr.message);
        return res.status(500).json({ ok: false, error: 'Failed to clear existing triage result' });
    }

    /* ── 4. Re-use the full ai-triage pipeline ───────────────────────────────── */
    // Reconstruct the request body as ai-triage.js expects it
    req.body = { case_id, organisation_id };
    console.log('[ai-triage-rerun] Delegating to ai-triage handler for case_id:', case_id);
    return aiTriageHandler(req, res);
}
