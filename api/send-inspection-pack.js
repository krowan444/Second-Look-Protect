// /api/send-inspection-pack.js
//
// ─── PIPELINE IDENTITY (Phase 10 premium migration) ─────────────────────────
// ACTION: "Send Inspection Pack" button in Reports page action bar
// FLOW:
//   1. Authenticates caller (JWT or cron secret)
//   2. Resolves recipient emails from organisation_settings
//   3. Fetches report data from `reports` table (premium renderer data source)
//   4. Builds premium HTML inspection pack (inline styles, email-safe)
//   5. If report is locked/approved and has pdf_url: downloads & attaches stored PDF
//   6. Sends via Resend
//   7. Logs to inspection_pack_deliveries + email_logs
// RENDERER USED: PREMIUM (reports table — AI narrative, metrics_snapshot, exec_summary)
// MIGRATED FROM: /api/inspection-pack-pdf.js (legacy jsPDF, inspection_snapshots)
// NOT RELATED TO: send-report-email.js (separate recipient flow — untouched)
// ─────────────────────────────────────────────────────────────────────────────
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

        // ── Step 2: Fetch premium report data from reports table ──────────────────
        console.log('[send-inspection-pack] Fetching premium report row — org:', organisation_id, 'month:', snapshot_month);
        const report = await fetchReportRow(SUPABASE_URL, sbHeaders, organisation_id, snapshot_month);
        console.log('[send-inspection-pack] Report found:', !!report, 'status:', report?.status, 'has_pdf_url:', !!report?.pdf_url, 'has_ai_narrative:', !!report?.ai_narrative);

        // ── Step 3: Extract and normalise metrics ─────────────────────────────────
        const metrics = extractMetrics(report?.metrics_snapshot);

        // ── Step 4: Build premium HTML inspection pack ────────────────────────────
        const premiumHtml = buildPremiumInspectionPackHtml({
            report,
            metrics,
            orgName,
            snapshotMonth: snapshot_month,
        });

        // ── Step 5: Optional PDF attachment for locked/approved reports ───────────
        // Only attach a PDF if the report has been approved/locked and has a stored pdf_url.
        // This preserves frozen snapshot integrity — the stored PDF is the canonical frozen output.
        let pdfAttachment = null;
        const reportIsLocked = report?.status === 'locked' || report?.status === 'approved';
        if (reportIsLocked && report?.pdf_url) {
            try {
                console.log('[send-inspection-pack] Downloading stored premium PDF for locked report:', report.pdf_url);
                const pdfBytes = await downloadPdfBytes(report.pdf_url);
                if (pdfBytes) {
                    const monthSlug = snapshot_month.slice(0, 7);
                    pdfAttachment = {
                        filename: `Safeguarding-Report-${monthSlug}.pdf`,
                        content: pdfBytes.toString('base64'),
                    };
                    console.log('[send-inspection-pack] PDF attachment ready, bytes:', pdfBytes.length);
                }
            } catch (pdfErr) {
                // Non-blocking — if PDF download fails, still send the HTML pack
                console.warn('[send-inspection-pack] PDF attachment download failed (continuing without):', pdfErr.message);
            }
        }

        // ── Step 6: Compose and send email via Resend ─────────────────────────────
        const monthLabel = formatMonthLabel(snapshot_month);
        const emailPayload = {
            from: EMAIL_FROM,
            to: recipients,
            ...(cc.length > 0 ? { cc } : {}),
            subject: `Safeguarding Inspection Pack \u2014 ${orgName} \u2014 ${monthLabel}`,
            html: premiumHtml,
            ...(pdfAttachment ? { attachments: [pdfAttachment] } : {}),
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

        // ── Step 7: Log successful delivery ──────────────────────────────────────
        const providerMessageId = emailData?.id || null;
        await logDelivery(SUPABASE_URL, sbHeaders, {
            organisation_id,
            snapshot_month,
            recipients,
            cc,
            status: 'sent',
            provider_message_id: providerMessageId,
        });

        // Email log entries
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
                        meta: {
                            snapshot_month,
                            renderer: 'premium',
                            has_pdf_attachment: !!pdfAttachment,
                            report_status: report?.status ?? 'no_report',
                        },
                        sent_at: new Date().toISOString(),
                    }),
                });
            } catch {
                // Non-blocking
            }
        }

        return res.status(200).json({
            ok: true,
            message: `Premium inspection pack sent to ${recipients.join(', ')}`,
            provider_message_id: providerMessageId,
            has_pdf_attachment: !!pdfAttachment,
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

// ── Helper: fetch premium report row from reports table ──────
async function fetchReportRow(supabaseUrl, headers, organisationId, snapshotMonth) {
    try {
        // Match on organisation_id + period month — period_start contains the month
        const [y, m] = snapshotMonth.split('-').map(Number);
        const periodStart = `${y}-${String(m).padStart(2, '0')}-01`;
        const res = await fetch(
            `${supabaseUrl}/rest/v1/reports?organisation_id=eq.${organisationId}&period_start=gte.${periodStart}&period_start=lt.${periodStart.slice(0, 7)}-32&select=id,status,exec_summary,recommendations,key_trends,ai_narrative,metrics_snapshot,pdf_url,locked_at,approved_at,created_at&order=created_at.desc&limit=1`,
            { headers }
        );
        if (!res.ok) {
            console.warn('[send-inspection-pack] fetchReportRow failed:', res.status);
            return null;
        }
        const rows = await res.json();
        return rows?.[0] ?? null;
    } catch (err) {
        console.warn('[send-inspection-pack] fetchReportRow error:', err.message);
        return null;
    }
}

// ── Helper: safely extract metrics from metrics_snapshot JSON ─
function extractMetrics(metricsSnapshot) {
    const defaults = {
        total: 0,
        highRisk: 0,
        byStatus: { new: 0, in_review: 0, closed: 0 },
        avgReview: 'N/A',
        avgClose: 'N/A',
        categories: [],
        channels: [],
        riskMap: {},
        decisions: [],
        scamConfirmed: 0,
    };
    if (!metricsSnapshot || typeof metricsSnapshot !== 'object') return defaults;
    const s = metricsSnapshot;
    return {
        total: s.total ?? 0,
        highRisk: s.highRisk ?? s.high_risk ?? 0,
        byStatus: {
            new: s.byStatus?.new ?? s.by_status?.new ?? 0,
            in_review: s.byStatus?.in_review ?? s.by_status?.in_review ?? 0,
            closed: s.byStatus?.closed ?? s.by_status?.closed ?? 0,
        },
        avgReview: s.avgReview ?? s.avg_review ?? 'N/A',
        avgClose: s.avgClose ?? s.avg_close ?? 'N/A',
        categories: Array.isArray(s.categories) ? s.categories : [],
        channels: Array.isArray(s.channels) ? s.channels : [],
        riskMap: (s.riskMap ?? s.risk_map) || {},
        decisions: Array.isArray(s.decisions) ? s.decisions : [],
        scamConfirmed: s.scamConfirmed ?? s.scam_confirmed ?? 0,
    };
}

// ── Helper: format snapshot_month (e.g. "2026-03") to "March 2026" ──
function formatMonthLabel(snapshotMonth) {
    try {
        const [y, m] = snapshotMonth.split('-').map(Number);
        return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    } catch {
        return snapshotMonth?.slice(0, 7) ?? '';
    }
}

// ── Helper: format snapshot_month to "01 Mar 2026 – 31 Mar 2026" ────
function formatDateRange(snapshotMonth) {
    try {
        const [y, m] = snapshotMonth.split('-').map(Number);
        const first = new Date(y, m - 1, 1);
        const last = new Date(y, m, 0);
        const fmt = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        return `${fmt(first)} \u2013 ${fmt(last)}`;
    } catch {
        return '';
    }
}

// ── Helper: download PDF bytes from a storage URL ───────────────
async function downloadPdfBytes(pdfUrl) {
    const res = await fetch(pdfUrl);
    if (!res.ok) throw new Error(`PDF download failed: ${res.status}`);
    const buf = await res.arrayBuffer();
    return Buffer.from(buf);
}

// ── Helper: goodAiText — mirrors ReportsPage.tsx quality filter ──
function goodAiText(text) {
    if (!text || typeof text !== 'string') return null;
    const t = text.trim();
    if (t.length < 40) return null;
    const lower = t.toLowerCase();
    if (lower.includes('no ai') || lower.includes('not available') || lower.includes('n/a')) return null;
    return t;
}

// ══════════════════════════════════════════════════════════════════════════════
// Premium HTML Inspection Pack Builder
// Produces inspection-grade, email-safe HTML with inline styles.
// Data: report row from reports table + extracted metrics.
// ══════════════════════════════════════════════════════════════════════════════
function buildPremiumInspectionPackHtml({ report, metrics, orgName, snapshotMonth }) {
    const monthLabel = formatMonthLabel(snapshotMonth);
    const dateRange = formatDateRange(snapshotMonth);
    const generatedAt = new Date().toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const status = report?.status ?? 'draft';
    const isLocked = status === 'locked' || status === 'approved';
    const statusLabel = status === 'approved' ? 'Approved and Locked'
        : status === 'locked' ? 'Locked for Review'
            : status === 'draft' ? 'Draft'
                : 'Current Data';
    const dataSource = isLocked
        ? 'Monthly inspection snapshot (locked)'
        : 'Live case data';

    // Derive AI narrative sections
    const aiNarrative = report?.ai_narrative ?? {};
    const execSummaryAi = goodAiText(aiNarrative?.execSummary);
    const execSummaryStored = goodAiText(report?.exec_summary);
    const closureRate = metrics.total > 0 ? Math.round((metrics.byStatus.closed / metrics.total) * 100) : null;
    const openCount = (metrics.byStatus.new ?? 0) + (metrics.byStatus.in_review ?? 0);
    const inspectionReady = metrics.total === 0 || (closureRate !== null && closureRate >= 90 && metrics.total > 0);

    const execText = execSummaryAi || execSummaryStored || (
        metrics.total === 0
            ? `No cases were submitted during ${monthLabel}. Safeguarding protocols remained active throughout this period.`
            : `${metrics.total} case${metrics.total !== 1 ? 's' : ''} were recorded during ${monthLabel}.${metrics.highRisk > 0
                ? ` ${metrics.highRisk} ${metrics.highRisk !== 1 ? 'were' : 'was'} classified as high or critical risk.`
                : ' No high-risk cases were identified.'
            }${closureRate !== null ? ` Closure rate: ${closureRate}%.` : ''}`
    );

    const trends = goodAiText(aiNarrative?.safeguardingTrends)
        || goodAiText(report?.key_trends)
        || (metrics.total === 0 ? `No submissions were recorded during ${monthLabel}.`
            : `${metrics.total} case${metrics.total !== 1 ? 's' : ''} were recorded during ${monthLabel}.`);

    const risks = goodAiText(aiNarrative?.emergingRisks)
        || (metrics.highRisk > 0
            ? `${metrics.highRisk} case${metrics.highRisk !== 1 ? 's' : ''} were classified as high or critical risk during ${monthLabel}.`
            : 'No high or critical risk cases were recorded during this period.');

    const pressure = goodAiText(aiNarrative?.operationalPressure)
        || (metrics.total === 0
            ? 'No active cases were recorded during this period.'
            : `Average review time: ${metrics.avgReview}. Average close time: ${metrics.avgClose}.`);

    const positiveSignals = goodAiText(aiNarrative?.positiveSignals)
        || (closureRate !== null && closureRate >= 60
            ? `${closureRate}% of cases recorded during this period were closed — a strong indicator of effective case throughput.`
            : metrics.highRisk === 0
                ? 'No high or critical risk cases were reported during this period.'
                : 'Case processing continued within normal operational parameters.');

    const recommendedActionsRaw = goodAiText(aiNarrative?.recommendedActions)
        || goodAiText(report?.recommendations)
        || '- Ensure all open cases are reviewed and progressed promptly.\n- Confirm SLA compliance across all active cases.\n- Review any high-risk cases with the safeguarding lead.';

    const recommendedItems = recommendedActionsRaw
        .split('\n')
        .map(l => l.trim().replace(/^[-\u2013\u2014\u2022]\s*/, ''))
        .filter(l => l.length > 0);

    const inspSummary = goodAiText(aiNarrative?.inspectionSummary)
        || 'This report has been prepared in accordance with safeguarding reporting standards. All case records, review timelines, decisions, and supporting evidence are available for inspection.';

    const leaderSummary = goodAiText(aiNarrative?.leadershipSummary)
        || (metrics.total === 0
            ? `No safeguarding cases were recorded during ${monthLabel}. No escalation required.`
            : metrics.highRisk > 0
                ? `${metrics.total} case${metrics.total !== 1 ? 's' : ''} managed, including ${metrics.highRisk} high or critical risk. Leadership review recommended.`
                : `${metrics.total} case${metrics.total !== 1 ? 's' : ''} managed. No high-risk cases identified.`);

    // KPI rows
    const kpis = [
        { label: 'Total Cases', value: String(metrics.total), color: '#0B1E36' },
        { label: 'Open Cases', value: String(openCount), color: '#d97706' },
        { label: 'High / Critical Risk', value: String(metrics.highRisk), color: metrics.highRisk > 0 ? '#dc2626' : '#16a34a' },
        { label: 'SLA Overdue', value: String(metrics.total > 0 ? (metrics.total - metrics.byStatus.closed) : 0), color: '#64748b' },
        { label: 'Closure Rate', value: closureRate !== null ? `${closureRate}%` : '\u2014', color: closureRate !== null && closureRate >= 70 ? '#16a34a' : '#C9A84C' },
    ];

    // Top categories (up to 5)
    const topCategories = metrics.categories.slice(0, 5);

    // ── Shared inline styles ──────────────────────────────────────────────────
    const BASE = 'font-family: Inter, Arial, sans-serif; font-size: 14px; color: #334155; line-height: 1.6;';
    const CARD = 'background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px 24px; margin-bottom: 16px;';
    const LABEL = 'font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin: 0 0 4px;';
    const SECTION_DIVIDER = 'border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Safeguarding Inspection Pack \u2014 ${orgName} \u2014 ${monthLabel}</title>
</head>
<body style="margin: 0; padding: 0; background: #f1f5f9; ${BASE}">
<div style="max-width: 680px; margin: 0 auto; padding: 24px 16px;">

  <!-- ═══ HEADER ═════════════════════════════════════════════════ -->
  <div style="background: #0B1E36; border-radius: 12px; overflow: hidden; margin-bottom: 20px;">
    <!-- Gold accent stripe -->
    <div style="height: 4px; background: linear-gradient(90deg, #C9A84C, #e6c96e, #C9A84C);"></div>
    <div style="padding: 28px 32px 24px;">
      <p style="margin: 0 0 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #C9A84C;">
        Second Look Protect &middot; Safeguarding Report
      </p>
      <h1 style="margin: 0 0 6px; font-size: 22px; font-weight: 800; color: #f8fafc; letter-spacing: -0.02em; line-height: 1.2;">
        ${escHtml(orgName)}
      </h1>
      <p style="margin: 0; font-size: 14px; color: #94a3b8;">
        Monthly Safeguarding Summary &middot; ${escHtml(monthLabel)}
      </p>
      <p style="margin: 12px 0 0; font-size: 11px; color: #475569;">
        Generated ${escHtml(generatedAt)}
      </p>
    </div>
  </div>

  <!-- ═══ REPORT IDENTITY GRID ════════════════════════════════════ -->
  <div style="${CARD}">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="50%" style="padding-right: 16px; padding-bottom: 16px; vertical-align: top;">
          <p style="${LABEL}">Reporting Period</p>
          <p style="margin: 0; font-size: 14px; font-weight: 600; color: #0f172a;">${escHtml(monthLabel)}</p>
        </td>
        <td width="50%" style="padding-bottom: 16px; vertical-align: top;">
          <p style="${LABEL}">Date Range</p>
          <p style="margin: 0; font-size: 14px; font-weight: 600; color: #0f172a;">${escHtml(dateRange)}</p>
        </td>
      </tr>
      <tr>
        <td width="50%" style="padding-right: 16px; vertical-align: top;">
          <p style="${LABEL}">Report Status</p>
          <p style="margin: 0; font-size: 13px; font-weight: 700; color: ${isLocked ? '#16a34a' : '#d97706'};">
            ${isLocked ? '&#10003; ' : ''}${escHtml(statusLabel)}
          </p>
        </td>
        <td width="50%" style="vertical-align: top;">
          <p style="${LABEL}">Data Source</p>
          <p style="margin: 0; font-size: 13px; color: #334155;">${escHtml(dataSource)}</p>
        </td>
      </tr>
    </table>
  </div>

  <!-- ═══ ATTENTION / HEADLINE ═══════════════════════════════════ -->
  <div style="${CARD} border-left: 4px solid ${inspectionReady ? '#16a34a' : '#d97706'};">
    <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 99px; background: ${inspectionReady ? '#f0fdf4' : '#fffbeb'}; border: 1px solid ${inspectionReady ? '#bbf7d0' : '#fde68a'}; margin-bottom: 10px;">
      <span style="font-size: 11px; font-weight: 700; color: ${inspectionReady ? '#16a34a' : '#d97706'};">
        ${inspectionReady ? '&#10003; Inspection Ready' : '&#9888; Attention Required'}
      </span>
    </div>
    <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.6;">${escHtml(execText)}</p>
  </div>

  <!-- ═══ KPI STRIP ════════════════════════════════════════════════ -->
  <div style="${CARD} padding: 16px;">
    <p style="${LABEL} margin-bottom: 12px;">Key Performance Indicators</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        ${kpis.map(kpi => `
        <td style="text-align: center; padding: 8px 4px; border-top: 3px solid ${kpi.color}; background: #f8fafc; border-radius: 4px; margin: 2px;">
          <div style="font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.03em;">${escHtml(kpi.value)}</div>
          <div style="font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px;">${escHtml(kpi.label)}</div>
        </td>`).join('<td style="width: 6px;"></td>')}
      </tr>
    </table>
  </div>

  <hr style="${SECTION_DIVIDER}" />

  <!-- ═══ INTELLIGENCE & ANALYSIS ════════════════════════════════ -->
  <p style="${LABEL} margin-bottom: 12px;">Intelligence &amp; Analysis</p>

  <!-- Safeguarding Trends -->
  <div style="${CARD}">
    <p style="${LABEL}">Safeguarding Trends</p>
    <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.7;">${escHtml(trends)}</p>
  </div>

  <!-- Emerging Risks -->
  <div style="${CARD}">
    <p style="${LABEL}">Emerging Risks</p>
    <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.7;">${escHtml(risks)}</p>
  </div>

  <!-- Operational Pressure -->
  <div style="${CARD}">
    <p style="${LABEL}">Operational Pressure</p>
    <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.7;">${escHtml(pressure)}</p>
  </div>

  <!-- Positive Signals -->
  <div style="${CARD}">
    <p style="${LABEL}">Positive Signals</p>
    <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.7;">${escHtml(positiveSignals)}</p>
  </div>

  <!-- Recommended Actions -->
  <div style="${CARD}">
    <p style="${LABEL} margin-bottom: 10px;">Recommended Actions</p>
    <ul style="margin: 0; padding-left: 0; list-style: none;">
      ${recommendedItems.map(item =>
        `<li style="display: flex; gap: 8px; align-items: flex-start; margin-bottom: 8px; font-size: 14px; color: #334155; line-height: 1.6;">
          <span style="color: #C9A84C; font-weight: 700; flex-shrink: 0; margin-top: 1px;">&#8250;</span>
          <span>${escHtml(item)}</span>
        </li>`
    ).join('')}
    </ul>
  </div>

  ${topCategories.length > 0 ? `
  <!-- Top Categories -->
  <div style="${CARD}">
    <p style="${LABEL} margin-bottom: 10px;">Top Case Categories</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <th style="text-align: left; font-size: 11px; font-weight: 600; color: #94a3b8; padding: 0 0 6px; text-transform: uppercase; letter-spacing: 0.05em;">Category</th>
          <th style="text-align: right; font-size: 11px; font-weight: 600; color: #94a3b8; padding: 0 0 6px; text-transform: uppercase; letter-spacing: 0.05em;">Count</th>
          <th style="text-align: right; font-size: 11px; font-weight: 600; color: #94a3b8; padding: 0 0 6px; text-transform: uppercase; letter-spacing: 0.05em;">%</th>
        </tr>
      </thead>
      <tbody>
        ${topCategories.map(([cat, count]) => {
        const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
        const label = cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return `<tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 7px 0; font-size: 13px; color: #334155;">${escHtml(label)}</td>
              <td style="padding: 7px 0; font-size: 13px; color: #0f172a; font-weight: 600; text-align: right;">${count}</td>
              <td style="padding: 7px 0; font-size: 13px; color: #64748b; text-align: right;">${pct}%</td>
            </tr>`;
    }).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <hr style="${SECTION_DIVIDER}" />

  <!-- ═══ INSPECTION & LEADERSHIP ════════════════════════════════ -->
  <p style="${LABEL} margin-bottom: 12px;">Inspection &amp; Leadership</p>

  <!-- Inspection Summary — dark panel -->
  <div style="background: #0B1E36; border-radius: 10px; padding: 20px 24px; margin-bottom: 16px;">
    <p style="margin: 0 0 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #C9A84C;">Inspection Summary</p>
    <p style="margin: 0; font-size: 14px; color: #cbd5e1; line-height: 1.75;">${escHtml(inspSummary)}</p>
  </div>

  <!-- Leadership Summary — light panel -->
  <div style="${CARD}">
    <p style="${LABEL}">Leadership Summary</p>
    <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.75;">${escHtml(leaderSummary)}</p>
  </div>

  <hr style="${SECTION_DIVIDER}" />

  <!-- ═══ FOOTER ══════════════════════════════════════════════════ -->
  <div style="text-align: center; padding: 8px 0 16px;">
    <p style="margin: 0 0 4px; font-size: 12px; color: #94a3b8;">
      Generated by <strong style="color: #64748b;">Second Look Protect</strong> &middot; ${escHtml(generatedAt)}
    </p>
    ${isLocked ? `<p style="margin: 4px 0 0; font-size: 11px; color: #94a3b8;">This report reflects a locked, frozen inspection snapshot. Data integrity is preserved.</p>` : ''}
    <p style="margin: 4px 0 0; font-size: 11px; color: #cbd5e1;">
      Safeguarding Inspection Pack &middot; ${escHtml(orgName)} &middot; ${escHtml(monthLabel)}
    </p>
  </div>

</div>
</body>
</html>`;
}

// ── Helper: escape HTML entities ──────────────────────────────────
function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
