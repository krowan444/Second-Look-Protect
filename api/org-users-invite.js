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

                        // Unban auth user in case they were previously removed
                        try {
                            await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${newUserId}`, {
                                method: 'PUT',
                                headers: sbHeaders,
                                body: JSON.stringify({ ban_duration: 'none' }),
                            });
                            console.log(`[org-users-invite] Unbanned auth user ${newUserId} for re-invite`);
                        } catch (unbanErr) {
                            console.error('[org-users-invite] Unban failed (non-blocking):', unbanErr);
                        }

                        // Re-activate profile if it was deactivated
                        try {
                            await fetch(
                                `${SUPABASE_URL}/rest/v1/profiles?id=eq.${newUserId}&organisation_id=eq.${organisation_id}`,
                                {
                                    method: 'PATCH',
                                    headers: { ...sbHeaders, Prefer: 'return=minimal' },
                                    body: JSON.stringify({ is_active: true, role, updated_at: new Date().toISOString() }),
                                }
                            );
                            console.log(`[org-users-invite] Re-activated profile ${newUserId}`);
                        } catch (reactivateErr) {
                            console.error('[org-users-invite] Re-activate failed (non-blocking):', reactivateErr);
                        }
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

        // Now generate the actual invite link and send the email
        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        const EMAIL_FROM = process.env.EMAIL_FROM || 'Second Look Protect <noreply@secondlookprotect.co.uk>';

        if (!RESEND_API_KEY) {
            console.error('RESEND_API_KEY not set — cannot send invite email');
            // Still create the profile, but warn that email failed
        }

        let inviteLink = null;

        // Try invite-type link first (works for unconfirmed users)
        const linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
            method: 'POST',
            headers: sbHeaders,
            body: JSON.stringify({ type: 'invite', email }),
        });

        if (linkRes.ok) {
            const linkData = await linkRes.json();
            inviteLink = linkData?.action_link || linkData?.properties?.action_link || null;
        }

        // Fallback: try recovery link if invite link fails (e.g. user already confirmed)
        if (!inviteLink) {
            const recoveryRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
                method: 'POST',
                headers: sbHeaders,
                body: JSON.stringify({ type: 'recovery', email }),
            });
            if (recoveryRes.ok) {
                const recoveryData = await recoveryRes.json();
                inviteLink = recoveryData?.action_link || recoveryData?.properties?.action_link || null;
            }
        }

        // Send the invite email via Resend
        let emailSent = false;
        if (RESEND_API_KEY && inviteLink) {
            const displayName = full_name || email;
            const emailBody = {
                from: EMAIL_FROM,
                to: [email],
                subject: 'You\'ve been invited to Second Look Protect',
                html: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
                        <div style="text-align: center; margin-bottom: 32px;">
                            <h1 style="color: #1e293b; font-size: 22px; margin: 0;">Second Look Protect</h1>
                            <p style="color: #64748b; font-size: 14px; margin: 8px 0 0 0;">Safeguarding Intelligence Platform</p>
                        </div>
                        <div style="background: #f8fafc; border-radius: 12px; padding: 28px; border: 1px solid #e2e8f0;">
                            <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 12px 0;">Welcome, ${displayName}</h2>
                            <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                                You've been invited to join your organisation's safeguarding dashboard.
                                Click the button below to set your password and activate your account.
                            </p>
                            <div style="text-align: center; margin: 24px 0;">
                                <a href="${inviteLink}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">
                                    Set Password &amp; Activate Account
                                </a>
                            </div>
                            <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 20px 0 0 0;">
                                If the button doesn't work, copy and paste this link into your browser:<br/>
                                <a href="${inviteLink}" style="color: #2563eb; word-break: break-all;">${inviteLink}</a>
                            </p>
                        </div>
                        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 24px 0 0 0;">
                            This invitation was sent by an administrator. If you didn't expect this, you can safely ignore it.
                        </p>
                    </div>
                `,
            };

            try {
                const sendRes = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(emailBody),
                });
                if (sendRes.ok) {
                    emailSent = true;
                    const sendData = await sendRes.json().catch(() => null);
                    console.log(`[org-users-invite] Invite email sent to ${email} — provider_id: ${sendData?.id}`);
                    // Log to email_logs for traceability
                    try {
                        await fetch(`${SUPABASE_URL}/rest/v1/email_logs`, {
                            method: 'POST',
                            headers: { ...sbHeaders, Prefer: 'return=minimal' },
                            body: JSON.stringify({
                                organisation_id,
                                event_type: 'user_invite_sent',
                                recipient_email: email,
                                recipient_role: role || 'staff',
                                subject: emailBody.subject,
                                status: 'sent',
                                provider_message_id: sendData?.id || null,
                                meta: { full_name: full_name || null },
                                sent_at: new Date().toISOString(),
                            }),
                        });
                    } catch { /* non-blocking */ }
                } else {
                    const sendErr = await sendRes.text().catch(() => '');
                    console.error(`Resend failed for invite to ${email}:`, sendErr);
                }
            } catch (emailErr) {
                console.error(`Email send error for ${email}:`, emailErr);
            }
        } else if (!inviteLink) {
            console.warn(`Could not generate invite link for ${email}`);
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
        return res.status(201).json({ ok: true, profile: profile?.[0] ?? null, email, emailSent });

    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message || 'Unknown error' });
    }
}
