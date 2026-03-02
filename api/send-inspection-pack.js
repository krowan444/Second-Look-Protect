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

    // ── Auth: cron-secret OR JWT super_admin ──────────────────────
    let authedViaCron = false;
    let jwtToken = '';

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

        // Check super_admin role
        const profileRes = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role&limit=1`,
            { headers: sbHeaders }
        );
        if (!profileRes.ok) {
            return res.status(401).json({ ok: false, error: 'Unauthorized' });
        }
        const profiles = await profileRes.json();
        if (!profiles?.[0] || profiles[0].role !== 'super_admin') {
            return res.status(403).json({ ok: false, error: 'Forbidden: super_admin only' });
        }
    }

    // ── Parse body ────────────────────────────────────────────────
    const { organisation_id, snapshot_month } = req.body || {};
    if (!organisation_id || !snapshot_month) {
        return res.status(400).json({ ok: false, error: 'Missing required fields: organisation_id, snapshot_month' });
    }

    try {
        // 1) Fetch organisation details (name + recipients)
        const orgRes = await fetch(
            `${SUPABASE_URL}/rest/v1/organisations?id=eq.${organisation_id}&select=name,inspection_pack_recipients,inspection_pack_cc&limit=1`,
            { headers: sbHeaders }
        );
        if (!orgRes.ok) throw new Error(`Failed to fetch organisation: ${orgRes.status}`);
        const orgRows = await orgRes.json();
        const org = orgRows?.[0];
        if (!org) {
            return res.status(404).json({ ok: false, error: 'Organisation not found' });
        }

        const orgName = org.name ?? 'Unknown organisation';
        const recipients = Array.isArray(org.inspection_pack_recipients) ? org.inspection_pack_recipients.filter(Boolean) : [];
        const cc = Array.isArray(org.inspection_pack_cc) ? org.inspection_pack_cc.filter(Boolean) : [];

        if (recipients.length === 0) {
            return res.status(400).json({ ok: false, error: 'No inspection_pack_recipients configured for this organisation' });
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

        const pdfRes = await fetch(pdfUrl, {
            headers: { Authorization: `Bearer ${pdfAuthToken}` },
        });

        if (!pdfRes.ok) {
            const errBody = await pdfRes.text();
            throw new Error(`PDF generation failed (${pdfRes.status}): ${errBody}`);
        }

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
