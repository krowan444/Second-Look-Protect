// /api/org-users-list.js
export default async function handler(req, res) {
    if (req.method !== 'GET') {
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

    const organisationId = req.query.organisation_id;
    if (!organisationId) {
        return res.status(400).json({ ok: false, error: 'Missing organisation_id' });
    }

    // Authorize: super_admin or org_admin of same org
    if (caller.role !== 'super_admin' && !(caller.role === 'org_admin' && caller.organisation_id === organisationId)) {
        return res.status(403).json({ ok: false, error: 'Forbidden: admin role required' });
    }

    try {
        // Fetch profiles for this org
        const profilesRes = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?organisation_id=eq.${organisationId}&select=id,full_name,role,is_active,created_at&order=created_at.asc`,
            { headers: sbHeaders }
        );
        if (!profilesRes.ok) throw new Error(`Profiles fetch failed: ${profilesRes.status}`);
        const profiles = await profilesRes.json();

        if (!profiles || profiles.length === 0) {
            return res.status(200).json({ ok: true, users: [] });
        }

        // Fetch emails from auth admin API for each user
        const users = [];
        for (const p of profiles) {
            let email = '—';
            try {
                const authUserRes = await fetch(
                    `${SUPABASE_URL}/auth/v1/admin/users/${p.id}`,
                    { headers: sbHeaders }
                );
                if (authUserRes.ok) {
                    const authUser = await authUserRes.json();
                    email = authUser?.email ?? '—';
                }
            } catch {
                // Non-blocking
            }
            users.push({
                id: p.id,
                email,
                full_name: p.full_name ?? null,
                role: p.role,
                is_active: p.is_active ?? true,
                created_at: p.created_at,
            });
        }

        return res.status(200).json({ ok: true, users });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message || 'Unknown error' });
    }
}
