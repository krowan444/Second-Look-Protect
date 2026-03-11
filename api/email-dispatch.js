// /api/email-dispatch.js
// ── Shared Email Notification Dispatcher ─────────────────────────────────
// Central endpoint for all event-based email alerts.
// Input: { event_type, organisation_id, case_id?, actor_id?, context? }
// Flow: auth → load settings → check enabled → resolve recipients → send → log

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const EMAIL_FROM = process.env.EMAIL_FROM;
    const SLP_SECRET = process.env.SLP_WEBHOOK_SECRET;

    if (!SUPABASE_URL || !SERVICE_KEY) {
        return res.status(500).json({ ok: false, error: 'Missing Supabase env vars' });
    }
    if (!RESEND_API_KEY || !EMAIL_FROM) {
        return res.status(500).json({ ok: false, error: 'Missing email env vars (RESEND_API_KEY, EMAIL_FROM)' });
    }

    // ── Auth: x-slp-secret (server-to-server) OR Bearer JWT (frontend) ────
    const secret = req.headers['x-slp-secret'];
    const authHeader = req.headers['authorization'] || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    let authed = false;

    if (secret && secret === SLP_SECRET) {
        authed = true;
    } else if (bearerToken) {
        // Verify the JWT is a valid Supabase user session
        try {
            const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
                headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${bearerToken}` },
            });
            if (userRes.ok) authed = true;
        } catch { /* auth failed */ }
    }

    if (!authed) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const sbHeaders = {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
    };

    // ── Parse body ───────────────────────────────────────────────────────
    const { event_type, organisation_id, case_id, actor_id, context } = req.body || {};
    if (!event_type || !organisation_id) {
        return res.status(400).json({ ok: false, error: 'Missing required: event_type, organisation_id' });
    }

    // ── Event type → settings column mapping ─────────────────────────────
    const EVENT_CONFIG = {
        // Admin events → alert_recipients
        admin_case_created:               { col: 'email_admin_case_created',              type: 'admin', subject: 'New Case Created',              icon: '📋' },
        admin_case_updated:               { col: 'email_admin_case_updated',              type: 'admin', subject: 'Case Updated',                  icon: '✏️' },
        admin_high_risk_alert:            { col: 'email_admin_high_risk_alert',           type: 'admin', subject: 'High-Risk Case Flagged',         icon: '🔴' },
        admin_critical_case:              { col: 'email_admin_critical_case',             type: 'admin', subject: 'Critical Case Flagged',          icon: '🚨' },
        admin_sla_breach:                 { col: 'email_admin_sla_breach',                type: 'admin', subject: 'SLA Breach Alert',               icon: '⏱️' },
        admin_overdue_review:             { col: 'email_admin_overdue_review',            type: 'admin', subject: 'Overdue Review Alert',           icon: '⏳' },
        admin_escalation_notice:          { col: 'email_admin_escalation_notice',         type: 'admin', subject: 'Escalation Notice',              icon: '📢' },
        admin_new_evidence:               { col: 'email_admin_new_evidence',              type: 'admin', subject: 'New Evidence Uploaded',           icon: '📎' },
        admin_inspection_pack_generated:  { col: 'email_admin_inspection_pack_generated', type: 'admin', subject: 'Inspection Pack Generated',      icon: '📦' },
        admin_inspection_pack_sent:       { col: 'email_admin_inspection_pack_sent',      type: 'admin', subject: 'Inspection Pack Sent',           icon: '📨' },
        admin_repeat_targeting:           { col: 'email_admin_repeat_targeting',          type: 'admin', subject: 'Repeat Targeting Detected',      icon: '🔁' },
        admin_loss_threshold:             { col: 'email_admin_loss_threshold',            type: 'admin', subject: 'Loss Threshold Reached',         icon: '💰' },
        admin_new_user:                   { col: 'email_admin_new_user',                  type: 'admin', subject: 'New User Added',                 icon: '👤' },
        // Staff events → assigned staff/submitter
        staff_case_assigned:              { col: 'email_staff_case_assigned',             type: 'staff', subject: 'Case Assigned to You',           icon: '📌' },
        staff_case_moved_to_review:       { col: 'email_staff_case_moved_to_review',      type: 'staff', subject: 'Your Case Moved to Review',     icon: '🔍' },
        staff_case_closed:                { col: 'email_staff_case_closed',               type: 'staff', subject: 'Your Case Has Been Closed',     icon: '✅' },
        staff_information_requested:      { col: 'email_staff_information_requested',     type: 'staff', subject: 'Information Requested',          icon: '❓' },
        staff_evidence_requested:         { col: 'email_staff_evidence_requested',        type: 'staff', subject: 'Evidence Requested',             icon: '📋' },
        staff_evidence_added:             { col: 'email_staff_evidence_added',            type: 'staff', subject: 'Evidence Added to Your Case',    icon: '📎' },
    };

    const config = EVENT_CONFIG[event_type];
    if (!config) {
        return res.status(400).json({ ok: false, error: `Unknown event_type: ${event_type}` });
    }

    try {
        // 1) Load organisation settings
        const settingsRes = await fetch(
            `${SUPABASE_URL}/rest/v1/organisation_settings?organisation_id=eq.${organisation_id}&select=*&limit=1`,
            { headers: sbHeaders }
        );
        if (!settingsRes.ok) {
            throw new Error(`Failed to load settings: ${settingsRes.status}`);
        }
        const settingsRows = await settingsRes.json();
        const settings = settingsRows?.[0] ?? {};

        // 2) Check if this email event is enabled
        const isEnabled = settings[config.col] ?? false;
        if (!isEnabled) {
            // Log as skipped
            await logEmail(SUPABASE_URL, sbHeaders, {
                organisation_id,
                case_id: case_id || null,
                event_type,
                recipient_email: '(skipped — disabled)',
                subject: config.subject,
                status: 'skipped',
                meta: { reason: 'event_disabled' },
            });
            return res.status(200).json({ ok: true, skipped: true, reason: 'Event disabled in settings' });
        }

        // 3) Resolve recipients
        let recipients = [];
        let recipientRole = null;

        if (config.type === 'admin') {
            // Use alert_recipients from settings
            recipientRole = 'admin';
            if (Array.isArray(settings.alert_recipients)) {
                recipients = settings.alert_recipients.filter(Boolean);
            }
            // Fallback: org_admin profile emails
            if (recipients.length === 0) {
                const adminRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/profiles?organisation_id=eq.${organisation_id}&role=eq.org_admin&is_active=eq.true&select=email&limit=20`,
                    { headers: sbHeaders }
                );
                if (adminRes.ok) {
                    const adminRows = await adminRes.json();
                    recipients = (adminRows || []).map(r => r.email).filter(Boolean);
                }
            }
        } else {
            // Staff events: resolve the target staff member's email
            recipientRole = 'staff';
            let targetUserId = actor_id || null;

            // For case-related staff events, look up the assigned_to or submitted_by
            if (case_id && !targetUserId) {
                const caseRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/cases?id=eq.${case_id}&select=assigned_to,submitted_by&limit=1`,
                    { headers: sbHeaders }
                );
                if (caseRes.ok) {
                    const caseRows = await caseRes.json();
                    const c = caseRows?.[0];
                    if (c) {
                        // Always prefer assigned staff/carer; fall back to submitter only if unassigned
                        targetUserId = c.assigned_to || c.submitted_by;
                    }
                }
            }

            if (targetUserId) {
                const profileRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${targetUserId}&select=email&limit=1`,
                    { headers: sbHeaders }
                );
                if (profileRes.ok) {
                    const profileRows = await profileRes.json();
                    const email = profileRows?.[0]?.email;
                    if (email) recipients.push(email);
                }
            }
        }

        if (recipients.length === 0) {
            await logEmail(SUPABASE_URL, sbHeaders, {
                organisation_id,
                case_id: case_id || null,
                event_type,
                recipient_email: '(no recipients)',
                subject: config.subject,
                status: 'skipped',
                meta: { reason: 'no_recipients' },
            });
            return res.status(200).json({ ok: true, skipped: true, reason: 'No recipients found' });
        }

        // 4) Deduplication check — same (org, event_type, case_id) within 1 hour
        if (case_id) {
            const dedupRes = await fetch(
                `${SUPABASE_URL}/rest/v1/email_logs?organisation_id=eq.${organisation_id}&event_type=eq.${event_type}&case_id=eq.${case_id}&status=eq.sent&created_at=gte.${new Date(Date.now() - 3600000).toISOString()}&select=id&limit=1`,
                { headers: sbHeaders }
            );
            if (dedupRes.ok) {
                const dedupRows = await dedupRes.json();
                if (Array.isArray(dedupRows) && dedupRows.length > 0) {
                    return res.status(200).json({ ok: true, skipped: true, reason: 'Duplicate within 1 hour' });
                }
            }
        }

        // 5) Fetch org name for email template
        let orgName = 'Your Organisation';
        const orgRes = await fetch(
            `${SUPABASE_URL}/rest/v1/organisations?id=eq.${organisation_id}&select=name&limit=1`,
            { headers: sbHeaders }
        );
        if (orgRes.ok) {
            const orgRows = await orgRes.json();
            if (orgRows?.[0]?.name) orgName = orgRows[0].name;
        }

        // 6) Build email HTML
        const subject = `${config.subject} — ${orgName}`;
        const html = buildAlertEmailHtml({
            icon: config.icon,
            subject: config.subject,
            orgName,
            eventType: event_type,
            caseId: case_id,
            context: context || {},
            dashboardUrl: `https://secondlookprotect.co.uk/dashboard`,
        });

        // 7) Send via Resend
        const emailPayload = {
            from: EMAIL_FROM,
            to: recipients,
            subject,
            html,
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
            // Log failure for each recipient
            for (const email of recipients) {
                await logEmail(SUPABASE_URL, sbHeaders, {
                    organisation_id,
                    case_id: case_id || null,
                    event_type,
                    recipient_email: email,
                    recipient_role: recipientRole,
                    subject,
                    status: 'failed',
                    error_message: emailData?.message || `Resend error ${emailRes.status}`,
                    meta: context || {},
                });
            }
            throw new Error(emailData?.message || `Resend error ${emailRes.status}`);
        }

        // 8) Log success for each recipient
        const providerMessageId = emailData?.id || null;
        for (const email of recipients) {
            await logEmail(SUPABASE_URL, sbHeaders, {
                organisation_id,
                case_id: case_id || null,
                event_type,
                recipient_email: email,
                recipient_role: recipientRole,
                subject,
                status: 'sent',
                provider_message_id: providerMessageId,
                meta: context || {},
            });
        }

        return res.status(200).json({
            ok: true,
            sent: true,
            recipients,
            provider_message_id: providerMessageId,
        });
    } catch (err) {
        console.error('[email-dispatch] Error:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Unknown error' });
    }
}


// ── Helper: write email_logs entry ───────────────────────────────────────
async function logEmail(supabaseUrl, headers, row) {
    try {
        await fetch(`${supabaseUrl}/rest/v1/email_logs`, {
            method: 'POST',
            headers: { ...headers, Prefer: 'return=minimal' },
            body: JSON.stringify({
                organisation_id: row.organisation_id,
                case_id: row.case_id || null,
                event_type: row.event_type,
                recipient_email: row.recipient_email,
                recipient_role: row.recipient_role || null,
                subject: row.subject || '',
                status: row.status,
                provider_message_id: row.provider_message_id || null,
                error_message: row.error_message || null,
                meta: row.meta || {},
                sent_at: row.status === 'sent' ? new Date().toISOString() : null,
            }),
        });
    } catch {
        // Non-blocking — don't fail the request if logging fails
        console.error('[email-dispatch] Failed to write email_logs entry');
    }
}


// ── Branded alert email template ─────────────────────────────────────────
function buildAlertEmailHtml({ icon, subject, orgName, eventType, caseId, context, dashboardUrl }) {
    const contextDetails = context.message || context.details || '';
    const caseLink = caseId
        ? `<a href="${dashboardUrl}/cases/${caseId}" style="display: inline-block; margin-top: 16px; padding: 10px 24px; background: #1e40af; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">View Case in Dashboard</a>`
        : `<a href="${dashboardUrl}" style="display: inline-block; margin-top: 16px; padding: 10px 24px; background: #1e40af; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">Open Dashboard</a>`;

    return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f1f5f9; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 32px 16px;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); border-radius: 12px 12px 0 0; padding: 28px 24px; text-align: center;">
            <div style="font-size: 28px; margin-bottom: 6px;">🛡️</div>
            <h1 style="margin: 0; font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">Second Look Protect</h1>
            <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">Email Alert Notification</p>
        </div>

        <!-- Body -->
        <div style="background: #ffffff; padding: 28px 24px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
            <div style="margin-bottom: 20px;">
                <div style="font-size: 24px; margin-bottom: 8px;">${icon}</div>
                <h2 style="margin: 0 0 4px; font-size: 18px; font-weight: 600; color: #0f172a;">${subject}</h2>
                <p style="margin: 0; font-size: 13px; color: #64748b;">${orgName}</p>
            </div>

            ${contextDetails ? `
            <div style="margin: 16px 0; padding: 12px 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #334155;">${contextDetails}</p>
            </div>` : ''}

            ${caseId ? `
            <div style="margin: 12px 0; padding: 8px 12px; background: #eff6ff; border-radius: 6px; border: 1px solid #bfdbfe;">
                <p style="margin: 0; font-size: 12px; color: #1e40af;"><strong>Case ID:</strong> ${caseId}</p>
            </div>` : ''}

            <div style="text-align: center; margin-top: 24px;">
                ${caseLink}
            </div>
        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none; padding: 16px 24px; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                Generated by <strong>Second Look Protect</strong><br>
                You received this because your organisation has email alerts enabled.<br>
                Manage your preferences in <a href="${dashboardUrl}/settings" style="color: #64748b;">Dashboard Settings</a>.
            </p>
        </div>

    </div>
</body>
</html>
    `.trim();
}
