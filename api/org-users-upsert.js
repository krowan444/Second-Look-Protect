// /api/org-users-upsert.js
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

    // Check caller is super_admin or org_admin
    const callerProfileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${callerId}&select=role,organisation_id&limit=1`,
        { headers: sbHeaders }
    );
    const callerProfiles = await callerProfileRes.json();
    const caller = callerProfiles?.[0];
    if (!caller || (caller.role !== 'super_admin' && caller.role !== 'org_admin')) {
        return res.status(403).json({ ok: false, error: 'Forbidden: admin role required' });
    }

    const { email, role, organisation_id, user_id } = req.body || {};

    if (!organisation_id) {
        return res.status(400).json({ ok: false, error: 'Missing organisation_id' });
    }

    // org_admin can only manage their own org
    if (caller.role === 'org_admin' && caller.organisation_id !== organisation_id) {
        return res.status(403).json({ ok: false, error: 'Cannot manage users outside your organisation' });
    }

    const allowedRoles = ['staff', 'reviewer', 'org_admin', 'read_only', 'manager', 'safeguarding_lead'];

    try {
        // UPDATE existing user's role
        if (user_id) {
            if (!role || !allowedRoles.includes(role)) {
                return res.status(400).json({ ok: false, error: `Invalid role. Allowed: ${allowedRoles.join(', ')}` });
            }

            const updateRes = await fetch(
                `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user_id}&organisation_id=eq.${organisation_id}`,
                {
                    method: 'PATCH',
                    headers: { ...sbHeaders, Prefer: 'return=representation' },
                    body: JSON.stringify({ role }),
                }
            );
            if (!updateRes.ok) {
                const errBody = await updateRes.text();
                throw new Error(`Update failed: ${errBody}`);
            }
            const updated = await updateRes.json();
            return res.status(200).json({ ok: true, profile: updated?.[0] ?? null });
        }

        // CREATE new user via Supabase Auth Admin
        if (!email) {
            return res.status(400).json({ ok: false, error: 'Missing email' });
        }
        if (!role || !allowedRoles.includes(role)) {
            return res.status(400).json({ ok: false, error: `Invalid role. Allowed: ${allowedRoles.join(', ')}` });
        }

        // Create auth user with a random password (they'll use magic link / password reset)
        const tempPassword = crypto.randomUUID() + '!Aa1';
        const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
            method: 'POST',
            headers: sbHeaders,
            body: JSON.stringify({
                email,
                password: tempPassword,
                email_confirm: true,
            }),
        });

        if (!createRes.ok) {
            const errBody = await createRes.json().catch(() => ({}));
            // User may already exist in auth
            if (errBody?.msg?.includes('already been registered') || errBody?.message?.includes('already been registered')) {
                // Look up existing auth user
                const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1`, {
                    headers: sbHeaders,
                });
                // Can't easily search by email via admin API, so try to find by profiles
                const profileRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`,
                    { headers: sbHeaders }
                );
                return res.status(409).json({ ok: false, error: 'User with this email already exists. Update their role instead.' });
            }
            throw new Error(errBody?.msg || errBody?.message || `Auth create failed: ${createRes.status}`);
        }

        const newUser = await createRes.json();
        const newUserId = newUser?.id;

        if (!newUserId) {
            throw new Error('Failed to get new user ID from auth');
        }

        // Create or update profile row
        const upsertRes = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles`,
            {
                method: 'POST',
                headers: { ...sbHeaders, Prefer: 'return=representation, resolution=merge-duplicates' },
                body: JSON.stringify({
                    id: newUserId,
                    role,
                    organisation_id,
                    is_active: true,
                }),
            }
        );

        if (!upsertRes.ok) {
            const errBody = await upsertRes.text();
            throw new Error(`Profile upsert failed: ${errBody}`);
        }

        const profile = await upsertRes.json();
        return res.status(201).json({ ok: true, profile: profile?.[0] ?? null, email });

    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message || 'Unknown error' });
    }
}
