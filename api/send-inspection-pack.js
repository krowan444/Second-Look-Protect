// /api/send-inspection-pack.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const EMAIL_FROM = process.env.EMAIL_FROM;
    const CRON_SECRET = process.env.SLA_CRON_SECRET || process.env.CRON_SECRET;

    if (!SUPABASE_URL || !SERVICE_KEY) {
        return res.status(500).json({ ok: false, error: 'Missing Supabase env vars' });
    }
    if (!RESEND_API_KEY || !EMAIL_FROM) {
        return res.status(500).json({ ok: false, error: 'Missing email env vars (RESEND_API_KEY, EMAIL_FROM)' });
    }

    const sbHeaders = {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
    };

    // ── Auth: cron-secret OR JWT (super_admin / org_admin) ─────────
    let authedViaCron = false;
    let jwtToken = '';
    let callerRole = '';
    let callerOrgId = '';

    const cronSecret = req.headers['x-cron-secret'];
    if (cronSecret && CRON_SECRET && cronSecret === CRON_SECRET) {
        authedViaCron = true;
    } else {
        // Try JWT auth
        const authHeader = req.headers['authorization'] ?? '';
        jwtToken = authHeader.replace(/^Bearer\s+/i, '');
        if (!jwtToken) {
            return res.status(401).json({ ok: false, error: 'Unauthorized' });
        }

        // Verify user from token
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${jwtToken}` },
        });
        if (!userRes.ok) {
            return res.status(401).json({ ok: false, error: 'Unauthorized' });
        }
        const userData = await userRes.json();
        const userId = userData?.id;
        if (!userId) {
            return res.status(401).json({ ok: false, error: 'Unauthorized' });
        }

        // Fetch caller profile (role + organisation_id)
        const profileRes = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role,organisation_id&limit=1`,
            { headers: sbHeaders }
        );
        if (!profileRes.ok) {
            return res.status(401).json({ ok: false, error: 'Unauthorized' });
        }
        const profiles = await profileRes.json();
        const profile = profiles?.[0];
        if (!profile) {
            return res.status(403).json({ ok: false, error: 'Forbidden' });
        }

        callerRole = profile.role || '';
        callerOrgId = profile.organisation_id || '';

        // Allow super_admin (any org) or org_admin (own org only)
        if (callerRole !== 'super_admin' && callerRole !== 'org_admin') {
            return res.status(403).json({ ok: false, error: 'Forbidden: admin role required' });
        }
    }

    // ── Parse body ────────────────────────────────────────────────
    const { organisation_id, snapshot_month } = req.body || {};
    if (!organisation_id || !snapshot_month) {
        return res.status(400).json({ ok: false, error: 'Missing required fields: organisation_id, snapshot_month' });
    }

    // org_admin: enforce own-org scope server-side
    if (!authedViaCron && callerRole === 'org_admin' && callerOrgId !== organisation_id) {
        return res.status(403).json({ ok: false, error: 'Forbidden: org_admin can only send inspection packs for their own organisation' });
    }

    try {
        // 1) Fetch organisation name
        const orgRes = await fetch(
            `${SUPABASE_URL}/rest/v1/organisations?id=eq.${organisation_id}&select=name&limit=1`,
            { headers: sbHeaders }
        );
        if (!orgRes.ok) throw new Error(`Failed to fetch organisation: ${orgRes.status}`);
        const orgRows = await orgRes.json();
        const org = orgRows?.[0];
        if (!org) {
            return res.status(404).json({ ok: false, error: 'Organisation not found' });
        }

        const orgName = org.name ?? 'Unknown organisation';

        // 1b) Fetch recipients from organisation_settings (inspection_pack_recipients → report_recipients fallback)
        console.log('[send-inspection-pack] Querying organisation_settings for org:', organisation_id);
        const settingsRes = await fetch(
            `${SUPABASE_URL}/rest/v1/organisation_settings?organisation_id=eq.${organisation_id}&select=*&limit=1`,
            { headers: sbHeaders }
        );
        if (!settingsRes.ok) {
            const errBody = await settingsRes.text().catch(() => '');
            console.error('[send-inspection-pack] Settings query failed:', settingsRes.status, errBody);
            return res.status(500).json({ ok: false, error: `Failed to load organisation settings: ${settingsRes.status}` });
        }
        const settingsRows = await settingsRes.json();
        const settings = settingsRows?.[0] ?? {};
        console.log('[send-inspection-pack] Settings row found:', !!settingsRows?.[0], 'inspection_pack_recipients:', settings.inspection_pack_recipients, 'report_recipients:', settings.report_recipients);

        // Fallback chain: inspection_pack_recipients → report_recipients → org admin emails
        let recipients = Array.isArray(settings.inspection_pack_recipients) ? settings.inspection_pack_recipients.filter(Boolean) : [];
        if (recipients.length === 0) {
            recipients = Array.isArray(settings.report_recipients) ? settings.report_recipients.filter(Boolean) : [];
        }
        if (recipients.length === 0) {
            // Final fallback: org_admin emails resolved from auth.users (profiles has no email column)
            console.log('[send-inspection-pack] No custom recipients — falling back to org admin emails via auth.users');
            const adminRes = await fetch(
                `${SUPABASE_URL}/rest/v1/profiles?organisation_id=eq.${organisation_id}&role=eq.org_admin&is_active=eq.true&select=id&limit=10`,
                { headers: sbHeaders }
            );
            if (adminRes.ok) {
                const adminRows = await adminRes.json();
                for (const row of (adminRows || [])) {
                    try {
                        const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${row.id}`, { headers: sbHeaders });
                        if (authRes.ok) {
                            const authUser = await authRes.json();
                            if (authUser?.email) recipients.push(authUser.email);
                        }
                    } catch { /* skip this user */ }
                }
            }
        }
        const cc = Array.isArray(settings.report_cc) ? settings.report_cc.filter(Boolean) : [];
        console.log('[send-inspection-pack] Resolved recipients:', recipients, 'cc:', cc);

        if (recipients.length === 0) {
            return res.status(400).json({ ok: false, error: 'No inspection pack recipients configured. Please add recipients in Settings → Inspection Pack Recipients or Report Recipients.' });
        }

        // 2) Generate PDF by calling the existing endpoint internally
        //    The PDF endpoint requires a JWT Bearer token (super_admin).
        //    If authed via cron, we don't have a user JWT — use service role key
        //    to call the PDF endpoint's underlying logic via Supabase REST directly.
        //    Since we cannot modify the PDF endpoint, we replicate the PDF call
        //    by hitting it on the same host with proper auth.
        const host = req.headers['host'] || 'localhost:3000';
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const pdfUrl = `${protocol}://${host}/api/inspection-pack-pdf?org_id=${encodeURIComponent(organisation_id)}&month=${encodeURIComponent(snapshot_month)}`;

        // For cron auth, we need a valid JWT. Use service role key as Bearer
        // (the PDF endpoint validates via Supabase auth — service role key works as a valid token).
        const pdfAuthToken = authedViaCron ? SERVICE_KEY : jwtToken;
        console.log('[send-inspection-pack] PDF call — url:', pdfUrl, 'authType:', authedViaCron ? 'service-role' : 'user-jwt', 'tokenPresent:', !!pdfAuthToken);

        const pdfRes = await fetch(pdfUrl, {
            headers: { Authorization: `Bearer ${pdfAuthToken}` },
        });

        if (!pdfRes.ok) {
            const errBody = await pdfRes.text();
            console.error('[send-inspection-pack] PDF generation failed — status:', pdfRes.status, 'body:', errBody);
            throw new Error(`PDF generation failed (${pdfRes.status}): ${errBody}`);
        }
        console.log('[send-inspection-pack] PDF generated successfully, status:', pdfRes.status);

        const pdfArrayBuffer = await pdfRes.arrayBuffer();
        const pdfBase64 = Buffer.from(pdfArrayBuffer).toString('base64');
        const filename = `inspection-pack-${snapshot_month.slice(0, 7)}.pdf`;

        // 3) Send email via Resend
        const emailPayload = {
            from: EMAIL_FROM,
            to: recipients,
            ...(cc.length > 0 ? { cc } : {}),
            subject: `Inspection Pack — ${snapshot_month.slice(0, 7)}`,
            html: `
                <div style="font-family: Inter, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                    <h2 style="margin: 0 0 8px; font-size: 18px;">Inspection Pack</h2>
                    <p style="margin: 0 0 16px; color: #64748b; font-size: 14px;">${orgName} — ${snapshot_month.slice(0, 7)}</p>
                    <p style="font-size: 14px; line-height: 1.6; color: #334155;">
                        Please find attached the Inspection Pack for <strong>${orgName}</strong> for the period <strong>${snapshot_month.slice(0, 7)}</strong>.
                    </p>
                    <p style="font-size: 14px; line-height: 1.6; color: #334155;">
                        This pack contains an immutable snapshot of safeguarding metrics, evidence and governance notes,
                        and is suitable for inspection and regulatory purposes.
                    </p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                    <p style="font-size: 12px; color: #94a3b8;">Generated by Second Look Protect</p>
                </div>
            `,
            attachments: [{ filename, content: pdfBase64 }],
        };

        const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(emailPayload),
        });

        const emailData = await emailRes.json();

        if (!emailRes.ok) {
            // Log failed delivery
            await logDelivery(SUPABASE_URL, sbHeaders, {
                organisation_id,
                snapshot_month,
                recipients,
                cc,
                status: 'failed',
                error_message: emailData?.message || emailData?.error || `Resend error ${emailRes.status}`,
            });
            throw new Error(emailData?.message || `Resend error ${emailRes.status}`);
        }

        // 4) Log successful delivery
        const providerMessageId = emailData?.id || null;
        await logDelivery(SUPABASE_URL, sbHeaders, {
            organisation_id,
            snapshot_month,
            recipients,
            cc,
            status: 'sent',
            provider_message_id: providerMessageId,
        });

        // 5) Email log entries
        for (const recipientEmail of recipients) {
            try {
                await fetch(`${SUPABASE_URL}/rest/v1/email_logs`, {
                    method: 'POST',
                    headers: { ...sbHeaders, Prefer: 'return=minimal' },
                    body: JSON.stringify({
                        organisation_id,
                        event_type: 'inspection_pack_sent',
                        recipient_email: recipientEmail,
                        recipient_role: 'inspection_pack_recipient',
                        subject: emailPayload.subject,
                        status: 'sent',
                        provider_message_id: providerMessageId,
                        meta: { snapshot_month },
                        sent_at: new Date().toISOString(),
                    }),
                });
            } catch {
                // Non-blocking
            }
        }

        return res.status(200).json({
            ok: true,
            message: `Inspection pack sent to ${recipients.join(', ')}`,
            provider_message_id: providerMessageId,
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message || 'Unknown error' });
    }
}

// ── Helper: log delivery to inspection_pack_deliveries ───────
async function logDelivery(supabaseUrl, headers, row) {
    try {
        await fetch(`${supabaseUrl}/rest/v1/inspection_pack_deliveries`, {
            method: 'POST',
            headers: { ...headers, Prefer: 'return=minimal' },
            body: JSON.stringify({
                organisation_id: row.organisation_id,
                snapshot_month: row.snapshot_month,
                recipients: row.recipients,
                cc: row.cc,
                status: row.status,
                ...(row.provider_message_id ? { provider_message_id: row.provider_message_id } : {}),
                ...(row.error_message ? { error_message: row.error_message } : {}),
            }),
        });
    } catch {
        // Non-blocking — don't fail the request if logging fails
    }
}
