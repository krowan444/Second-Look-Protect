// /api/send-report-email.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const EMAIL_FROM = process.env.EMAIL_FROM;

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

    // ── Auth: JWT → verify user → check role ──────────────────────
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
    const callerId = userData?.id;
    if (!callerId) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    // Get caller profile + role
    const callerRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${callerId}&select=role,organisation_id&limit=1`,
        { headers: sbHeaders }
    );
    const callerProfiles = await callerRes.json();
    const caller = callerProfiles?.[0];
    if (!caller) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const allowedRoles = ['super_admin', 'org_admin', 'safeguarding_lead'];
    if (!allowedRoles.includes(caller.role)) {
        return res.status(403).json({ ok: false, error: 'Forbidden: admin role required' });
    }

    // ── Parse body ────────────────────────────────────────────────
    const { organisation_id, report_period, report_id } = req.body || {};
    if (!organisation_id || !report_period || !report_id) {
        return res.status(400).json({ ok: false, error: 'Missing required fields: organisation_id, report_period, report_id' });
    }

    // Non-super_admin must belong to the same org
    if (caller.role !== 'super_admin' && caller.organisation_id !== organisation_id) {
        return res.status(403).json({ ok: false, error: 'Forbidden: cannot send report for another organisation' });
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

        // 2) Resolve recipients: report_recipients first, then org_admin email fallback
        console.log('[send-report-email] Resolving recipients for org:', organisation_id);
        let recipients = [];

        // Try organisation_settings.report_recipients first
        const settingsRes = await fetch(
            `${SUPABASE_URL}/rest/v1/organisation_settings?organisation_id=eq.${organisation_id}&select=*&limit=1`,
            { headers: sbHeaders }
        );
        if (settingsRes.ok) {
            const settingsRows = await settingsRes.json();
            const settings = settingsRows?.[0] ?? {};
            console.log('[send-report-email] Settings row found:', !!settingsRows?.[0], 'report_recipients:', settings.report_recipients);
            if (Array.isArray(settings.report_recipients)) {
                recipients = settings.report_recipients.filter(Boolean);
            }
        } else {
            console.error('[send-report-email] Settings query failed:', settingsRes.status);
        }

        // Fallback: org admin emails resolved from auth.users (profiles table has no email column)
        if (recipients.length === 0) {
            console.log('[send-report-email] No custom recipients — falling back to org admin emails via auth.users');
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
        console.log('[send-report-email] Resolved recipients:', recipients);

        if (recipients.length === 0) {
            return res.status(400).json({ ok: false, error: 'No valid recipient found. Please ensure at least one org admin has an email address, or configure report recipients in organisation settings.' });
        }

        // 3) Fetch saved report data
        const reportRes = await fetch(
            `${SUPABASE_URL}/rest/v1/reports?id=eq.${report_id}&organisation_id=eq.${organisation_id}&select=*&limit=1`,
            { headers: sbHeaders }
        );
        if (!reportRes.ok) throw new Error(`Failed to fetch report: ${reportRes.status}`);
        const reportRows = await reportRes.json();
        const report = reportRows?.[0];
        if (!report) {
            return res.status(404).json({ ok: false, error: 'Report not found. Please save a draft first.' });
        }

        const m = report.metrics || {};
        const totalCases = m.total ?? 0;
        const highRisk = m.highRisk ?? 0;
        const scamConfirmed = m.scamConfirmed ?? 0;
        const avgReview = m.avgReview ?? '—';
        const avgClose = m.avgClose ?? '—';
        const slaOverdue = m.slaOverdueNow ?? 0;
        const byStatus = m.byStatus || {};
        const keyTrends = m.keyTrends || '';
        const execSummary = report.ai_summary || '';
        const recommendations = report.recommendations || '';

        // Format period label
        const [pYear, pMonth] = report_period.split('-').map(Number);
        const periodLabel = new Date(pYear, pMonth - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

        // Build dashboard link
        const host = req.headers['host'] || 'localhost:3000';
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const dashboardUrl = `${protocol}://${host}/dashboard/reports`;

        // 4) Build branded HTML email
        const html = buildReportEmailHtml({
            orgName,
            periodLabel,
            totalCases,
            highRisk,
            scamConfirmed,
            avgReview,
            avgClose,
            slaOverdue,
            byStatus,
            keyTrends,
            execSummary,
            recommendations,
            dashboardUrl,
        });

        // 5) Send email via Resend
        const emailPayload = {
            from: EMAIL_FROM,
            to: recipients,
            subject: `Safeguarding Monthly Report — ${orgName} — ${periodLabel}`,
            html,
            // attachments: []  — structured for future PDF attachment support
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
            console.error('[send-report-email] Resend FAILED — status:', emailRes.status, 'error:', emailData?.message || 'unknown');
            throw new Error(emailData?.message || `Resend error ${emailRes.status}`);
        }
        console.log('[send-report-email] Resend SUCCESS — provider_id:', emailData?.id, 'recipients:', recipients);

        // 6) Audit log entry
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
                method: 'POST',
                headers: sbHeaders,
                body: JSON.stringify({
                    organisation_id,
                    actor_profile_id: callerId,
                    actor_type: caller.role,
                    action: 'report_email_sent',
                    entity_type: 'report',
                    entity_id: report_id,
                    after: {
                        recipients,
                        period: report_period,
                        provider_message_id: emailData?.id || null,
                    },
                }),
            });
        } catch {
            // Audit insert failure should not block the response
        }

        // 7) Email log entries
        for (const recipientEmail of recipients) {
            try {
                await fetch(`${SUPABASE_URL}/rest/v1/email_logs`, {
                    method: 'POST',
                    headers: { ...sbHeaders, Prefer: 'return=minimal' },
                    body: JSON.stringify({
                        organisation_id,
                        event_type: 'report_email_sent',
                        recipient_email: recipientEmail,
                        recipient_role: 'report_recipient',
                        subject: emailPayload.subject,
                        status: 'sent',
                        provider_message_id: emailData?.id || null,
                        meta: { report_id, period: report_period },
                        sent_at: new Date().toISOString(),
                    }),
                });
            } catch {
                // Non-blocking
            }
        }

        return res.status(200).json({
            ok: true,
            message: `Report email sent to ${recipients.join(', ')}`,
            provider_message_id: emailData?.id || null,
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message || 'Unknown error' });
    }
}

// ── Branded HTML email template ──────────────────────────────────
function buildReportEmailHtml({
    orgName,
    periodLabel,
    totalCases,
    highRisk,
    scamConfirmed,
    avgReview,
    avgClose,
    slaOverdue,
    byStatus,
    keyTrends,
    execSummary,
    recommendations,
    dashboardUrl,
}) {
    const statCell = (label, value, color = '#1e293b') => `
        <td style="padding: 12px 16px; text-align: center; border: 1px solid #e2e8f0;">
            <div style="font-size: 24px; font-weight: 700; color: ${color}; line-height: 1.2;">${value}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">${label}</div>
        </td>
    `;

    const sectionBlock = (title, content) => {
        if (!content) return '';
        // Convert newlines to <br> for plain-text content
        const htmlContent = content.replace(/\n/g, '<br>');
        return `
            <div style="margin-top: 24px;">
                <h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">${title}</h3>
                <div style="font-size: 13px; line-height: 1.7; color: #334155;">${htmlContent}</div>
            </div>
        `;
    };

    return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f1f5f9; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 640px; margin: 0 auto; padding: 32px 16px;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); border-radius: 12px 12px 0 0; padding: 32px 24px; text-align: center;">
            <div style="font-size: 28px; margin-bottom: 8px;">🛡️</div>
            <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">Second Look Protect</h1>
            <p style="margin: 6px 0 0; font-size: 13px; color: #94a3b8;">Safeguarding Monthly Report</p>
        </div>

        <!-- Main content -->
        <div style="background: #ffffff; padding: 32px 24px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">

            <!-- Org + period -->
            <div style="margin-bottom: 24px;">
                <h2 style="margin: 0 0 4px; font-size: 18px; font-weight: 600; color: #0f172a;">${orgName}</h2>
                <p style="margin: 0; font-size: 13px; color: #64748b;">Report period: <strong>${periodLabel}</strong></p>
            </div>

            <!-- Stats grid -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 8px; border-radius: 8px; overflow: hidden;">
                <tr>
                    ${statCell('Total Cases', totalCases, '#1e40af')}
                    ${statCell('High / Critical', highRisk, highRisk > 0 ? '#dc2626' : '#16a34a')}
                    ${statCell('Scam Confirmed', scamConfirmed, scamConfirmed > 0 ? '#d97706' : '#16a34a')}
                </tr>
                <tr>
                    ${statCell('Avg Review', avgReview)}
                    ${statCell('Avg Close', avgClose)}
                    ${statCell('SLA Overdue', slaOverdue, slaOverdue > 0 ? '#dc2626' : '#16a34a')}
                </tr>
            </table>

            <!-- Status breakdown -->
            <div style="margin-top: 16px; padding: 12px 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 6px;">Case Status Breakdown</div>
                <div style="font-size: 13px; color: #334155;">
                    <strong>${byStatus.new ?? 0}</strong> New &nbsp;·&nbsp;
                    <strong>${byStatus.in_review ?? 0}</strong> In Review &nbsp;·&nbsp;
                    <strong>${byStatus.closed ?? 0}</strong> Closed
                </div>
            </div>

            ${sectionBlock('Executive Summary', execSummary)}
            ${sectionBlock('Key Trends', keyTrends)}
            ${sectionBlock('Recommendations', recommendations)}

            <!-- CTA -->
            <div style="margin-top: 32px; text-align: center;">
                <a href="${dashboardUrl}" style="display: inline-block; padding: 12px 28px; background: #1e40af; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">View Full Report in Dashboard</a>
            </div>
        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none; padding: 20px 24px; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                Generated by <strong>Second Look Protect</strong><br>
                This email was sent from <span style="color: #64748b;">reports@secondlookprotect.co.uk</span>
            </p>
        </div>

    </div>
</body>
</html>
    `.trim();
}
