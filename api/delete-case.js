// /api/delete-case.js — Super admin only case deletion
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
        return res.status(500).json({ ok: false, error: 'Server configuration error' });
    }

    // ── 1. Verify caller identity and role ──────────────────────────────────────
    const authHeader = req.headers.authorization || '';
    const callerToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!callerToken) {
        return res.status(401).json({ ok: false, error: 'Unauthorised' });
    }

    // Verify the JWT against Supabase and check the role in profiles
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${callerToken}`,
        },
    });

    if (!userRes.ok) {
        return res.status(401).json({ ok: false, error: 'Unauthorised' });
    }

    const userData = await userRes.json();
    const callerId = userData?.id;
    if (!callerId) {
        return res.status(401).json({ ok: false, error: 'Unauthorised' });
    }

    // Fetch role from profiles table (server-side source of truth)
    const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(callerId)}&select=role&limit=1`,
        {
            headers: {
                apikey: SERVICE_KEY,
                Authorization: `Bearer ${SERVICE_KEY}`,
                Accept: 'application/vnd.pgrst.object+json',
            },
        }
    );

    if (!profileRes.ok) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const profile = await profileRes.json();
    if (profile?.role !== 'super_admin') {
        console.warn('[delete-case] Forbidden — caller role is:', profile?.role, '| uid:', callerId);
        return res.status(403).json({ ok: false, error: 'Forbidden — super admin only' });
    }

    // ── 2. Validate input ────────────────────────────────────────────────────────
    const { case_id } = req.body || {};
    if (!case_id || typeof case_id !== 'string') {
        return res.status(400).json({ ok: false, error: 'case_id is required' });
    }

    console.log('[delete-case] Super admin', callerId, 'deleting case:', case_id);

    // ── 3. Verify the case exists ────────────────────────────────────────────────
    const caseCheckRes = await fetch(
        `${SUPABASE_URL}/rest/v1/cases?id=eq.${encodeURIComponent(case_id)}&select=id&limit=1`,
        {
            headers: {
                apikey: SERVICE_KEY,
                Authorization: `Bearer ${SERVICE_KEY}`,
                Accept: 'application/vnd.pgrst.object+json',
            },
        }
    );

    if (!caseCheckRes.ok || caseCheckRes.status === 406) {
        return res.status(404).json({ ok: false, error: 'Case not found' });
    }

    // ── 4. Delete child records in safe order ────────────────────────────────────
    const deleteChild = async (table) => {
        const r = await fetch(
            `${SUPABASE_URL}/rest/v1/${table}?case_id=eq.${encodeURIComponent(case_id)}`,
            {
                method: 'DELETE',
                headers: {
                    apikey: SERVICE_KEY,
                    Authorization: `Bearer ${SERVICE_KEY}`,
                },
            }
        );
        if (!r.ok) {
            const text = await r.text().catch(() => '');
            console.warn(`[delete-case] Warning deleting from ${table}:`, r.status, text);
        } else {
            console.log(`[delete-case] Deleted from ${table} — status:`, r.status);
        }
    };

    // Also delete notifications — they reference case_id differently (stored in meta or via any column)
    const deleteNotifications = async () => {
        // Notifications may have case_id as a direct column or inside meta; try direct column first
        const r = await fetch(
            `${SUPABASE_URL}/rest/v1/notifications?case_id=eq.${encodeURIComponent(case_id)}`,
            {
                method: 'DELETE',
                headers: {
                    apikey: SERVICE_KEY,
                    Authorization: `Bearer ${SERVICE_KEY}`,
                },
            }
        );
        if (!r.ok && r.status !== 404) {
            // Silently ignore if the column doesn't exist — it won't block deletion
            console.warn('[delete-case] Notifications delete returned:', r.status);
        }
    };

    await deleteNotifications();
    await deleteChild('case_timeline_events');
    await deleteChild('ai_triage_results');
    await deleteChild('case_actions');
    await deleteChild('case_reviews');

    // ── 5. Delete the case itself ────────────────────────────────────────────────
    const caseDeleteRes = await fetch(
        `${SUPABASE_URL}/rest/v1/cases?id=eq.${encodeURIComponent(case_id)}`,
        {
            method: 'DELETE',
            headers: {
                apikey: SERVICE_KEY,
                Authorization: `Bearer ${SERVICE_KEY}`,
            },
        }
    );

    if (!caseDeleteRes.ok) {
        const text = await caseDeleteRes.text().catch(() => '');
        console.error('[delete-case] Failed to delete case row:', caseDeleteRes.status, text);
        return res.status(500).json({ ok: false, error: 'Failed to delete case. Please try again.' });
    }

    console.log('[delete-case] Case deleted successfully:', case_id, '| by:', callerId);
    return res.status(200).json({ ok: true });
}
