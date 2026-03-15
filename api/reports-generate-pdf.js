// /api/reports-generate-pdf.js
import { jsPDF } from 'jspdf';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
        return res.status(500).json({ error: 'Missing Supabase env vars' });
    }

    /* ── Helpers ─────────────────────────────────────────────────────────── */

    async function supabaseRest(path, options = {}) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
            ...options,
            headers: {
                apikey: SERVICE_KEY,
                Authorization: `Bearer ${SERVICE_KEY}`,
                'Content-Type': 'application/json',
                ...(options.headers || {}),
            },
        });
        const text = await r.text();
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { }
        return { ok: r.ok, status: r.status, json, text };
    }

    /**
     * Convert a raw DB key (underscore_separated) into a clean title-case label.
     * e.g. "suspicious_phone_call" → "Suspicious Phone Call"
     */
    function fmtLabel(v) {
        if (!v || typeof v !== 'string') return v ?? '';
        return v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    /**
     * Sanitise a string for jsPDF output:
     * - Decode HTML entities
     * - Strip HTML tags
     * - Replace Unicode characters the Latin-1 Helvetica font cannot render
     */
    function sanitisePdfText(text) {
        if (!text) return '';
        return String(text)
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
            .replace(/&lsquo;/g, "'").replace(/&rsquo;/g, "'")
            .replace(/&ndash;/g, '-').replace(/&mdash;/g, '--')
            .replace(/<[^>]*>/g, '')
            .replace(/\u2014/g, '--').replace(/\u2013/g, '-')
            .replace(/\u2018/g, "'").replace(/\u2019/g, "'")
            .replace(/\u201C/g, '"').replace(/\u201D/g, '"')
            .replace(/\u2026/g, '...')
            .replace(/\u00B7/g, '.').replace(/\u00B0/g, ' deg')
            .replace(/[✅✓☑]/g, '[x]')
            .replace(/[❌]/g, '[-]')
            .replace(/[⚠️⚠]/g, '[!]')
            .replace(/🔒/g, '[locked]')
            .replace(/📝/g, '[draft]')
            .replace(/[^\x00-\xFF]/g, '?')
            .trim();
    }

    /**
     * AI quality filter -- mirrors the on-screen goodAiText helper.
     * Returns null if the text is absent, too short to be meaningful
     * (< 40 chars), or matches known stub/placeholder patterns.
     * Callers fall through to deterministic copy when this returns null.
     */
    function goodAiText(v) {
        if (!v || typeof v !== 'string') return null;
        const t = sanitisePdfText(v);
        if (t.length < 40) return null;
        const stubs = [
            /^no (data|content|information)/i,
            /^n\/a$/i,
            /^none\.?$/i,
            /^not available/i,
            /^(this section|this report|the report) (will|has not)/i,
        ];
        if (stubs.some(re => re.test(t))) return null;
        return t;
    }

    /* ── Auth check ──────────────────────────────────────────────────────── */

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const userToken = authHeader.replace('Bearer ', '');

    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${userToken}`,
        },
    });

    if (!authRes.ok) {
        return res.status(401).json({ error: 'Invalid session' });
    }

    const authUser = await authRes.json();
    const userId = authUser.id;

    if (!userId) {
        return res.status(401).json({ error: 'No user ID in session' });
    }

    const profileRes = await supabaseRest(
        `profiles?select=role,organisation_id&id=eq.${userId}&limit=1`
    );

    if (!profileRes.ok || !Array.isArray(profileRes.json) || profileRes.json.length === 0) {
        return res.status(403).json({ error: 'Profile not found' });
    }

    const profile = profileRes.json[0];

    /* ── Parse body ──────────────────────────────────────────────────────── */

    const { reportId, organisationId, periodStart, periodEnd } = req.body || {};

    if (!reportId || !organisationId || !periodStart || !periodEnd) {
        return res.status(400).json({ error: 'Missing required fields: reportId, organisationId, periodStart, periodEnd' });
    }

    if (profile.role !== 'super_admin' && profile.organisation_id !== organisationId) {
        return res.status(403).json({ error: 'Forbidden: organisation mismatch' });
    }

    try {
        /* ── Fetch report (canonical source of truth) ─────────────────────── */

        const reportRes = await supabaseRest(
            `reports?select=*&id=eq.${reportId}&limit=1`
        );

        if (!reportRes.ok || !Array.isArray(reportRes.json) || reportRes.json.length === 0) {
            return res.status(404).json({ error: 'Report not found' });
        }

        const report = reportRes.json[0];

        /* ── Fetch org name ───────────────────────────────────────────────── */

        const orgRes = await supabaseRest(
            `organisations?select=name&id=eq.${organisationId}&limit=1`
        );
        const orgName = orgRes.json?.[0]?.name ?? 'Organisation';

        /* ── Extract metrics from saved snapshot ──────────────────────────── */

        const m = report.metrics || {};
        const byStatus = m.byStatus || {};
        const riskMap = m.riskMap || {};
        const slaOverdue = m.slaOverdueNow ?? m.slaOverdue ?? '—';

        const closureRate = (typeof m.total === 'number' && m.total > 0 && typeof byStatus.closed === 'number')
            ? Math.round((byStatus.closed / m.total) * 100) + '%'
            : '—';
        const openCount = (byStatus.new ?? 0) + (byStatus.in_review ?? 0);

        // AI narrative — prefer metrics snapshot, fall back to legacy report fields
        const ai = m.aiNarrative || {};

        /* ════════════════════════════════════════════════════════════════════
           BUILD PDF
        ════════════════════════════════════════════════════════════════════ */

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        const lm = 15;       // left margin (mm)
        const pw = 180;      // printable width (mm)
        const rm = lm + pw;  // right edge
        let y = 0;

        /* Colour palettes — all as [R, G, B] for jsPDF */
        const COL_NAVY = [11, 30, 54];
        const COL_GOLD = [201, 168, 76];
        const COL_LIGHT = [248, 250, 252];
        const COL_SLATE = [71, 85, 105];
        const COL_BORDER = [226, 232, 240];
        const COL_WHITE = [255, 255, 255];
        const COL_MUTED = [148, 163, 184];
        const COL_BODY = [51, 65, 85];
        const COL_AMBER = [217, 119, 6];
        const COL_RED = [220, 38, 38];
        const COL_GREEN = [22, 163, 74];

        /* Low-level drawing shortcuts */
        const setCol = (...rgb) => doc.setTextColor(...rgb);
        const setFill = (...rgb) => doc.setFillColor(...rgb);
        const setDraw = (...rgb) => doc.setDrawColor(...rgb);

        function newPage() { doc.addPage(); y = 22; }
        function checkY(needed = 10) { if (y + needed > 278) newPage(); }

        /* ── renderDivider: thin horizontal rule with centred section label ── */
        function renderDivider(label) {
            checkY(16);
            y += 5;
            setDraw(...COL_BORDER);
            doc.setLineWidth(0.3);

            const labelText = sanitisePdfText(label.toUpperCase());
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'bold');
            setCol(...COL_MUTED);
            const tw = doc.getTextWidth(labelText);
            const midX = lm + pw / 2;

            doc.line(lm, y, midX - tw / 2 - 4, y);
            doc.text(labelText, midX, y + 1, { align: 'center' });
            doc.line(midX + tw / 2 + 4, y, rm, y);

            doc.setLineWidth(0.2);
            y += 9;
            setCol(0, 0, 0);
        }

        /* ── renderNarrativeCard: premium titled card ─────────────────────── */
        function renderNarrativeCard(title, text, fallback, opts = {}) {
            const content = sanitisePdfText(text) || sanitisePdfText(fallback) || '';
            const isList = opts.isList || false;
            const isDark = opts.isDark || false;

            // Rough height estimate for pre-flight page-break check
            const charPerLine = 85;
            let lineEst = 3;
            if (content) {
                if (isList) {
                    const items = content.split('\n').filter(l => l.trim());
                    lineEst = Math.max(3, items.reduce((s, i) => s + Math.ceil(i.length / charPerLine), 0) + items.length);
                } else {
                    lineEst = Math.max(2, Math.ceil(content.length / charPerLine));
                }
            }
            checkY(Math.min(10 + lineEst * 5.5, 50));

            /* -- Header bar -- */
            if (isDark) { setFill(...COL_NAVY); } else { setFill(...COL_WHITE); }
            setDraw(...COL_BORDER);
            doc.rect(lm, y, pw, 8.5, isDark ? 'F' : 'FD');

            // Left accent stripe (3 mm wide)
            setFill(...(isDark ? COL_GOLD : COL_NAVY));
            doc.rect(lm, y, 3, 8.5, 'F');

            // Title text
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            setCol(...(isDark ? COL_GOLD : COL_NAVY));
            doc.text(sanitisePdfText(title), lm + 6, y + 6);
            y += 8.5;

            /* -- Body -- */
            const bodyY = y;

            if (!content) {
                doc.setFontSize(9);
                doc.setFont('helvetica', 'italic');
                setCol(...COL_MUTED);
                checkY(8);
                doc.text('No content recorded for this period.', lm + 4, y + 6);
                y += 12;
            } else if (isList) {
                const items = content.split('\n')
                    .map(l => l.replace(/^[-–—•*]\s*/, '').trim())
                    .filter(Boolean);
                y += 4;
                for (const item of items) {
                    checkY(7);
                    // Gold arrow bullet
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'bold');
                    setCol(...COL_GOLD);
                    doc.text('\xBB', lm + 4, y);   // » character (Latin-1 safe)
                    // Item text
                    doc.setFontSize(9.5);
                    doc.setFont('helvetica', 'normal');
                    setCol(...(isDark ? [203, 213, 225] : COL_BODY));
                    const wrapped = doc.splitTextToSize(item, pw - 11);
                    doc.text(wrapped, lm + 8, y);
                    y += wrapped.length * 5.2 + 1;
                }
                y += 4;
            } else {
                y += 4;
                doc.setFontSize(9.5);
                doc.setFont('helvetica', 'normal');
                setCol(...(isDark ? [203, 213, 225] : COL_BODY));
                const lines = doc.splitTextToSize(content, pw - 6);
                for (const line of lines) {
                    checkY(6);
                    doc.text(line, lm + 3, y);
                    y += 5.2;
                }
                y += 4;
            }

            // Body border (light mode only)
            if (!isDark) {
                setDraw(...COL_BORDER);
                doc.rect(lm, bodyY, pw, y - bodyY, 'D');
            }

            y += 5;
            setCol(0, 0, 0);
        }

        /* ── renderTable: shaded data table with navy title bar ──────────── */
        function renderTable(title, entries, headers = ['Category', 'Count']) {
            checkY(20);

            // Title bar
            setFill(...COL_NAVY);
            doc.rect(lm, y, pw, 8, 'F');
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            setCol(...COL_WHITE);
            doc.text(sanitisePdfText(title), lm + 3, y + 5.5);
            setCol(0, 0, 0);
            y += 12;

            if (!entries || entries.length === 0) {
                doc.setFontSize(9);
                doc.setFont('helvetica', 'italic');
                setCol(...COL_SLATE);
                doc.text('No data recorded for this period.', lm, y);
                y += 9;
                return;
            }

            // Column header row
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            setCol(...COL_SLATE);
            doc.text(headers[0], lm + 2, y);
            doc.text(headers[1], rm - 3, y, { align: 'right' });
            y += 4;
            setDraw(...COL_BORDER);
            doc.line(lm, y, rm, y);
            y += 2;

            // Data rows
            doc.setFont('helvetica', 'normal');
            let shade = false;
            for (const entry of entries) {
                checkY(7);
                const name = Array.isArray(entry) ? entry[0] : (entry.name ?? String(entry));
                const count = Array.isArray(entry) ? String(entry[1]) : String(entry.count ?? '');
                if (shade) { setFill(...COL_LIGHT); doc.rect(lm, y - 3.5, pw, 6, 'F'); }
                doc.setFontSize(9);
                setCol(...COL_BODY);
                doc.text(sanitisePdfText(fmtLabel(String(name))), lm + 2, y);
                doc.text(sanitisePdfText(count), rm - 3, y, { align: 'right' });
                y += 5.5;
                shade = !shade;
            }
            y += 7;
        }

        /* ════════════════════════════════════════════════════════════════════
           PAGE 1 — COVER BLOCK
        ════════════════════════════════════════════════════════════════════ */
        y = 0;
        doc.setLineWidth(0.2);

        // Full-width dark navy cover band
        setFill(...COL_NAVY);
        doc.rect(0, 0, 210, 65, 'F');

        // Gold stripe at very top (2 mm)
        setFill(...COL_GOLD);
        doc.rect(0, 0, 210, 2, 'F');

        // Gold stripe at bottom of band
        setFill(...COL_GOLD);
        doc.rect(0, 65, 210, 2.5, 'F');

        // Subtle "SLP" watermark text (barely visible)
        doc.setFontSize(72);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 45, 74);  // only slightly lighter than navy bg
        doc.text('SLP', 148, 58);

        // Brand micro-label (gold)
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        setCol(...COL_GOLD);
        doc.text('SECOND LOOK PROTECT  \u00B7  SAFEGUARDING REPORT', lm, 16);

        // Headline
        doc.setFontSize(21);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(248, 250, 252);
        doc.text('Monthly Safeguarding Summary', lm, 30);

        // Org name (truncate at 55 chars to avoid overflow)
        const orgNameSafe = sanitisePdfText(orgName).substring(0, 55);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(orgNameSafe, lm, 42);

        // Period line
        doc.setFontSize(9.5);
        doc.setTextColor(100, 116, 139);
        doc.text(sanitisePdfText(`Reporting period:  ${periodStart}  \u2013  ${periodEnd}`), lm, 52);

        // Status badge (top-right of cover)
        const isApproved = report.status === 'approved' || report.status === 'locked';
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        setCol(...(isApproved ? COL_GREEN : COL_GOLD));
        doc.text(
            sanitisePdfText(`STATUS: ${fmtLabel(report.status ?? 'draft').toUpperCase()}`),
            rm, 16, { align: 'right' }
        );

        // Generation date (top-right)
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(
            `Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
            rm, 23, { align: 'right' }
        );

        setCol(0, 0, 0);
        y = 79;

        /* ── KPI Strip ──────────────────────────────────────────────────────── */
        const kpiItems = [
            { label: 'Total Cases', value: m.total ?? 0, accent: COL_NAVY },
            { label: 'Open Cases', value: openCount, accent: COL_AMBER },
            { label: 'High / Crit Risk', value: m.highRisk ?? 0, accent: COL_RED },
            {
                label: 'SLA Overdue',
                value: slaOverdue,
                accent: (String(slaOverdue) !== '0' && slaOverdue !== '\u2014' && slaOverdue !== '—')
                    ? COL_RED : COL_GREEN,
            },
            { label: 'Closure Rate', value: closureRate, accent: COL_GREEN },
        ];

        const kpiCount = kpiItems.length;
        const kpiGap = 3;
        const kpiW = (pw - (kpiCount - 1) * kpiGap) / kpiCount;
        const kpiH = 23;

        for (let i = 0; i < kpiCount; i++) {
            const kpi = kpiItems[i];
            const kpiX = lm + i * (kpiW + kpiGap);

            // Card background
            setFill(...COL_LIGHT);
            setDraw(...COL_BORDER);
            doc.rect(kpiX, y, kpiW, kpiH, 'FD');

            // Coloured top accent bar (3 mm)
            setFill(...kpi.accent);
            doc.rect(kpiX, y, kpiW, 3, 'F');

            // Metric value
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            setCol(...COL_NAVY);
            doc.text(String(kpi.value), kpiX + kpiW / 2, y + 15, { align: 'center' });

            // Metric label (small-caps style via uppercase + small font)
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'normal');
            setCol(...COL_SLATE);
            doc.text(sanitisePdfText(kpi.label).toUpperCase(), kpiX + kpiW / 2, y + 21, { align: 'center' });
        }
        y += kpiH + 4;

        // Secondary metrics inline row — suppress if no cases this period
        if ((m.total ?? 0) > 0) {
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'normal');
            setCol(...COL_SLATE);
            const metaLine = [
                `New: ${byStatus.new ?? 0}`,
                `In Review: ${byStatus.in_review ?? 0}`,
                `Avg Review: ${m.avgReview ?? '\u2014'}`,
                `Avg Close: ${m.avgClose ?? '\u2014'}`,
                `Scam Confirmed: ${m.scamConfirmed ?? 0}`,
            ].join('   \u00B7   ');
            doc.text(sanitisePdfText(metaLine), lm, y);
            y += 11;
        } else {
            // Quiet period — calm single-line note
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'italic');
            setCol(...COL_MUTED);
            doc.text('No cases were submitted during this reporting period.', lm, y);
            y += 11;
        }

        /* ════════════════════════════════════════════════════════════════════
           SECTION A — INTELLIGENCE & ANALYSIS
        ════════════════════════════════════════════════════════════════════ */
        renderDivider('Intelligence & Analysis');

        // Executive Summary
        const execFallback = (m.total ?? 0) > 0
            ? `${m.total} case${m.total !== 1 ? 's' : ''} were recorded during this reporting period.`
            + ((m.highRisk ?? 0) > 0
                ? ` ${m.highRisk} ${m.highRisk !== 1 ? 'were' : 'was'} classified as high or critical risk.`
                : ' No high-risk cases were identified during this period.')
            + (closureRate !== '\u2014' ? ` Closure rate: ${closureRate}.` : '')
            : 'No cases were submitted during this reporting period. Safeguarding protocols remained active throughout, with no submissions requiring review. This report is available for record and inspection purposes.';
        renderNarrativeCard('Executive Summary', goodAiText(ai.execSummary) || goodAiText(report.ai_summary), execFallback);

        // Safeguarding Trends
        const hasPrevTotal = typeof m.prevTotal === 'number';
        const trendsFallback = (m.total ?? 0) === 0
            ? 'No submissions were recorded during this period. Historic comparison data will become available as further reporting periods are recorded.'
            : hasPrevTotal
                ? `${m.total} case${m.total !== 1 ? 's' : ''} were recorded this period, compared with ${m.prevTotal} in the previous period.`
                : `${m.total} case${m.total !== 1 ? 's' : ''} were recorded during this reporting period. Historic comparison data is still building for this organisation -- comparative trend confidence will increase as further periods are recorded.`;
        renderNarrativeCard('Safeguarding Trends', goodAiText(ai.safeguardingTrends) || goodAiText(m.keyTrends), trendsFallback);

        // Emerging Risks
        const riskFallback = (m.highRisk ?? 0) > 0
            ? `${m.highRisk} case${m.highRisk !== 1 ? 's' : ''} were classified as high or critical risk during this reporting period. These cases are recommended for priority review.`
            : (m.total ?? 0) === 0
                ? 'No cases were submitted during this period, so no elevated risk signals were present.'
                : 'No high or critical risk cases were recorded during this period -- a positive indicator for the organisation.';
        renderNarrativeCard('Emerging Risks', goodAiText(ai.emergingRisks), riskFallback);

        // Operational Pressure
        const slaNote = (String(slaOverdue) !== '0' && slaOverdue !== '\u2014' && slaOverdue !== '--')
            ? ` ${slaOverdue} case(s) remain open beyond the standard 3-day review threshold and should be progressed promptly.`
            : ' All cases are within SLA thresholds, reflecting sustained operational throughput.';
        const pressureFallback = (m.total ?? 0) === 0
            ? 'No active cases were recorded during this period, so no operational pressure metrics apply.'
            : `Average time to first review: ${m.avgReview ?? '--'}. Average time to close: ${m.avgClose ?? '--'}.${slaNote}`;
        renderNarrativeCard('Operational Pressure', goodAiText(ai.operationalPressure), pressureFallback);

        // Positive Signals
        const closurePct = typeof closureRate === 'string' ? parseInt(closureRate, 10) : NaN;
        const signalsFallback = (m.total ?? 0) === 0
            ? 'No safeguarding cases were submitted during this period. This may reflect a quiet period or effective early intervention within the organisation.'
            : (!isNaN(closurePct) && closurePct >= 60)
                ? `${closureRate} of cases recorded this period were closed, reflecting strong case review throughput and effective team response.`
                : ((m.highRisk ?? 0) === 0)
                    ? 'No high or critical risk cases were reported during this period -- a positive indicator of a well-managed safeguarding environment.'
                    : 'Case processing continued within normal operational parameters during this period.';
        renderNarrativeCard('Positive Signals', goodAiText(ai.positiveSignals), signalsFallback);

        // Recommended Actions
        const actionsFallback = '- Ensure all open cases are reviewed and progressed promptly.\n- Confirm SLA compliance across all active cases.\n- Review any high-risk cases with the safeguarding lead.';
        renderNarrativeCard(
            'Recommended Actions',
            goodAiText(ai.recommendedActions) || goodAiText(report.recommendations),
            actionsFallback,
            { isList: true }
        );

        /* ════════════════════════════════════════════════════════════════════
           SECTION B — INSPECTION & LEADERSHIP
        ════════════════════════════════════════════════════════════════════ */
        renderDivider('Inspection & Leadership');

        // Inspection Summary -- dark navy card
        const inspFallback = 'This report has been prepared in accordance with safeguarding reporting standards. All case records, review timelines, decisions, and supporting evidence are available for inspection purposes. Data is organisation-scoped and access-controlled throughout.';
        renderNarrativeCard('Inspection Summary', goodAiText(ai.inspectionSummary), inspFallback, { isDark: true });

        // Leadership Summary -- light card
        const leaderFallback = (m.total ?? 0) === 0
            ? 'No safeguarding cases were recorded in this period. No escalation or immediate leadership action is required. The organisation maintained normal safeguarding oversight throughout.'
            : (m.highRisk ?? 0) > 0
                ? `${m.total} case${m.total !== 1 ? 's' : ''} were managed during this period, including ${m.highRisk} classified as high or critical risk. Leadership review of high-risk cases is recommended.`
                : `${m.total} case${m.total !== 1 ? 's' : ''} were managed during this period. No high-risk cases were identified, and case review throughput remained within expected parameters. No immediate leadership escalation is required.`;
        renderNarrativeCard('Leadership Summary', goodAiText(ai.leadershipSummary), leaderFallback);

        /* ================================================================================
           SECTION C -- SUPPORTING DETAIL
        ================================================================================ */
        renderDivider('Supporting Detail');

        // Only render tables that have data -- suppress empty shells entirely
        if (m.categories && m.categories.length > 0) renderTable('Top Concern Categories', m.categories);
        if (m.channels && m.channels.length > 0) renderTable('Submission Channels', m.channels);

        if (riskMap && Object.keys(riskMap).length > 0) {
            renderTable('Risk Distribution', Object.entries(riskMap).map(([k, v]) => [k, v]));
        }

        if (m.decisions && m.decisions.length > 0) renderTable('Decisions Distribution', m.decisions);

        // If no breakdown data exists, show a calm single note instead of empty shells
        const hasAnyDetail = (m.categories?.length > 0) || (m.channels?.length > 0) ||
            (Object.keys(riskMap ?? {}).length > 0) || (m.decisions?.length > 0);
        if (!hasAnyDetail) {
            checkY(20);
            doc.setFontSize(9.5);
            doc.setFont('helvetica', 'italic');
            setCol(...COL_MUTED);
            const noteLines = doc.splitTextToSize(
                'No detailed breakdown data is available for this reporting period. This section will become more informative as reporting activity is recorded.',
                pw
            );
            noteLines.forEach(line => { checkY(6); doc.text(line, lm, y); y += 5.5; });
            y += 6;
        }

        /* ── Footer on every page ─────────────────────────────────────────── */
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setLineWidth(0.2);
            doc.setDrawColor(...COL_BORDER);
            doc.line(lm, 284, rm, 284);

            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184);
            doc.text(
                sanitisePdfText(`${orgName}  \u00B7  ${periodStart} to ${periodEnd}`),
                lm, 289
            );
            doc.text(
                sanitisePdfText(`Second Look Protect  \u00B7  Page ${i} of ${pageCount}`),
                rm, 289, { align: 'right' }
            );
            doc.setTextColor(0, 0, 0);
        }

        /* ── Export to buffer ──────────────────────────────────────────────── */

        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

        /* ── Upload to Supabase Storage ───────────────────────────────────── */

        const storagePath = `${organisationId}/${periodStart}_to_${periodEnd}/${reportId}.pdf`;

        const uploadRes = await fetch(
            `${SUPABASE_URL}/storage/v1/object/reports/${storagePath}`,
            {
                method: 'POST',
                headers: {
                    apikey: SERVICE_KEY,
                    Authorization: `Bearer ${SERVICE_KEY}`,
                    'Content-Type': 'application/pdf',
                    'x-upsert': 'true',
                },
                body: pdfBuffer,
            }
        );

        if (!uploadRes.ok) {
            const uploadErr = await uploadRes.text();
            return res.status(500).json({ error: 'Storage upload failed', detail: uploadErr });
        }

        /* ── Update report row with pdf_url ────────────────────────────────── */

        const pdfUrl = `${SUPABASE_URL}/storage/v1/object/public/reports/${storagePath}`;

        const updateRes = await supabaseRest(`reports?id=eq.${reportId}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ pdf_url: pdfUrl }),
        });

        if (!updateRes.ok) {
            return res.status(500).json({ error: 'Failed to update report with pdf_url' });
        }

        return res.status(200).json({ ok: true, pdf_url: pdfUrl });

    } catch (err) {
        console.error('PDF generation error:', err);
        return res.status(500).json({ error: err.message ?? 'Internal server error' });
    }
}
