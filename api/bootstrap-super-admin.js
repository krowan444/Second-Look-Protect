// /api/bootstrap-super-admin.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
        return res.status(500).json({ ok: false, error: 'Missing Supabase env vars' });
    }

    // Authenticate the caller via JWT
    const authHeader = req.headers['authorization'] ?? '';
    const jwtToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwtToken) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${jwtToken}` },
    });
    if (!userRes.ok) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const userData = await userRes.json();
    const userId = userData?.id;
    const userEmail = userData?.email;

    if (!userId || !userEmail) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    // Only allow the designated super admin email
    if (userEmail !== 'kierandrowan@gmail.com') {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const sbHeaders = {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
    };

    try {
        // Check current profile
        const profileRes = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role,organisation_id&limit=1`,
            { headers: sbHeaders }
        );
        if (!profileRes.ok) {
            throw new Error(`Profile fetch failed: ${profileRes.status}`);
        }
        const profiles = await profileRes.json();
        const current = profiles?.[0];

        if (current && current.role === 'super_admin' && current.organisation_id === null) {
            return res.status(200).json({ ok: true, changed: false });
        }

        // Update to super_admin with null organisation_id
        const updateRes = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
            {
                method: 'PATCH',
                headers: { ...sbHeaders, Prefer: 'return=minimal' },
                body: JSON.stringify({ role: 'super_admin', organisation_id: null }),
            }
        );
        if (!updateRes.ok) {
            throw new Error(`Profile update failed: ${updateRes.status}`);
        }

        return res.status(200).json({ ok: true, changed: true });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message || 'Unknown error' });
    }
}
