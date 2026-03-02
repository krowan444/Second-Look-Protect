// /api/org-users-update.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_KEY) {
        return res.status(500).json({ ok: false, error: 'Missing Supabase env vars' });
    }

    // Auth: verify JWT
    const authHeader = req.headers['authorization'] ?? '';
    const jwtToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwtToken) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const sbHeaders = {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
    };

    // Verify caller
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${jwtToken}` },
    });
    if (!userRes.ok) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const userData = await userRes.json();
    const callerId = userData?.id;
    if (!callerId) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    // Get caller profile
    const callerRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${callerId}&select=role,organisation_id&limit=1`,
        { headers: sbHeaders }
    );
    const callerProfiles = await callerRes.json();
    const caller = callerProfiles?.[0];
    if (!caller) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const { user_id, organisation_id, role, is_active } = req.body || {};
    if (!user_id || !organisation_id) {
        return res.status(400).json({ ok: false, error: 'Missing required fields: user_id, organisation_id' });
    }

    // Authorize: super_admin or org_admin of same org
    if (caller.role !== 'super_admin' && !(caller.role === 'org_admin' && caller.organisation_id === organisation_id)) {
        return res.status(403).json({ ok: false, error: 'Forbidden: admin role required' });
    }

    // Prevent disabling yourself
    if (user_id === callerId && is_active === false) {
        return res.status(400).json({ ok: false, error: 'Cannot disable your own account' });
    }

    const allowedRoles = ['staff', 'reviewer', 'org_admin', 'read_only', 'manager', 'safeguarding_lead'];
    const patch = {};
    if (role !== undefined) {
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ ok: false, error: `Invalid role. Allowed: ${allowedRoles.join(', ')}` });
        }
        patch.role = role;
    }
    if (is_active !== undefined) {
        patch.is_active = is_active;
    }
    patch.updated_at = new Date().toISOString();

    try {
        // Fetch current state (before) for audit
        const beforeRes = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user_id}&organisation_id=eq.${organisation_id}&select=role,is_active&limit=1`,
            { headers: sbHeaders }
        );
        const beforeRows = await beforeRes.json();
        const before = beforeRows?.[0] ?? {};

        const updateRes = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user_id}&organisation_id=eq.${organisation_id}`,
            {
                method: 'PATCH',
                headers: { ...sbHeaders, Prefer: 'return=representation' },
                body: JSON.stringify(patch),
            }
        );

        if (!updateRes.ok) {
            const errBody = await updateRes.text();
            throw new Error(`Update failed: ${errBody}`);
        }

        const updated = await updateRes.json();
        const after = updated?.[0] ?? {};

        // Determine action type
        let action = 'user_updated';
        if (role !== undefined && role !== before.role) {
            action = 'user_role_changed';
        } else if (is_active !== undefined && is_active !== before.is_active) {
            action = is_active ? 'user_enabled' : 'user_disabled';
        }

        // Insert audit_logs row (non-blocking)
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
                method: 'POST',
                headers: sbHeaders,
                body: JSON.stringify({
                    organisation_id,
                    actor_profile_id: callerId,
                    actor_type: caller.role,
                    action,
                    entity_type: 'profile',
                    entity_id: user_id,
                    before: { role: before.role, is_active: before.is_active },
                    after: { role: after.role, is_active: after.is_active },
                }),
            });
        } catch {
            // Audit insert failure should not block the response
        }

        return res.status(200).json({ ok: true, profile: after });

    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message || 'Unknown error' });
    }
}
