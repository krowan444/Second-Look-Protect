// /api/org-users-invite.js
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

    const { organisation_id, email, full_name, role } = req.body || {};
    if (!organisation_id || !email || !role) {
        return res.status(400).json({ ok: false, error: 'Missing required fields: organisation_id, email, role' });
    }

    // Authorize: super_admin or org_admin of same org
    if (caller.role !== 'super_admin' && !(caller.role === 'org_admin' && caller.organisation_id === organisation_id)) {
        return res.status(403).json({ ok: false, error: 'Forbidden: admin role required' });
    }

    const allowedRoles = ['staff', 'reviewer', 'org_admin', 'read_only', 'manager', 'safeguarding_lead'];
    if (!allowedRoles.includes(role)) {
        return res.status(400).json({ ok: false, error: `Invalid role. Allowed: ${allowedRoles.join(', ')}` });
    }

    try {
        // Invite user via Supabase Auth Admin (sends magic link email)
        const inviteRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
            method: 'POST',
            headers: sbHeaders,
            body: JSON.stringify({
                email,
                email_confirm: false,
                user_metadata: { full_name: full_name || '' },
                // This creates the user but Supabase sends a confirmation/invite email
            }),
        });

        let newUserId;

        if (!inviteRes.ok) {
            const errBody = await inviteRes.json().catch(() => ({}));
            const errMsg = errBody?.msg || errBody?.message || '';
            // If user already exists, try to find their ID
            if (errMsg.includes('already been registered') || errMsg.includes('already exists')) {
                // Look up existing user by email
                const lookupRes = await fetch(
                    `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50`,
                    { headers: sbHeaders }
                );
                if (lookupRes.ok) {
                    const lookupData = await lookupRes.json();
                    const existingUser = (lookupData?.users || []).find(u => u.email === email);
                    if (existingUser) {
                        newUserId = existingUser.id;
                    } else {
                        return res.status(409).json({ ok: false, error: 'User exists but could not be found. Try updating their role instead.' });
                    }
                } else {
                    return res.status(409).json({ ok: false, error: 'User with this email already exists.' });
                }
            } else {
                throw new Error(errMsg || `Invite failed: ${inviteRes.status}`);
            }
        } else {
            const inviteData = await inviteRes.json();
            newUserId = inviteData?.id;
        }

        if (!newUserId) {
            throw new Error('Failed to get user ID');
        }

        // Now send the actual invite/magic-link email
        const magicRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
            method: 'POST',
            headers: sbHeaders,
            body: JSON.stringify({
                type: 'magiclink',
                email,
            }),
        });
        // Non-blocking — if magic link generation fails, user can still use password reset
        if (!magicRes.ok) {
            console.warn('Magic link generation failed, user can use password reset instead');
        }

        // Upsert profile
        const upsertRes = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles`,
            {
                method: 'POST',
                headers: { ...sbHeaders, Prefer: 'return=representation, resolution=merge-duplicates' },
                body: JSON.stringify({
                    id: newUserId,
                    organisation_id,
                    full_name: full_name || null,
                    role,
                    is_active: true,
                    updated_at: new Date().toISOString(),
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
