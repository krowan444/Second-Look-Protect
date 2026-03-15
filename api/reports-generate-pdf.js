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
     *      "not_scam" → "Not Scam"
     */
    function fmtLabel(v) {
        if (!v || typeof v !== 'string') return v ?? '';
        return v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    /**
     * Sanitise a string for jsPDF output:
     * - Decode any HTML entities that may have been stored in the DB
     * - Strip any remaining HTML tags
     * - Replace Unicode characters jsPDF's Latin-1 subset cannot render
     *   (jsPDF default font is Helvetica which uses WinAnsi/Latin-1)
     */
    function sanitisePdfText(text) {
        if (!text) return '';
        return String(text)
            // HTML entity decode (common cases from textarea storage)
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'")
            .replace(/&nbsp;/g, ' ')
            // Strip any stray HTML tags
            .replace(/<[^>]*>/g, '')
            // Replace Unicode checkmarks / emojis with ASCII equivalents safe for Latin-1
            .replace(/✅/g, '[x]')
            .replace(/✓/g, '[x]')
            .replace(/☑/g, '[x]')
            .replace(/❌/g, '[-]')
            .replace(/⚠️/g, '[!]')
            .replace(/⚠/g, '[!]')
            .replace(/🔒/g, '[locked]')
            .replace(/📝/g, '[draft]')
            // Replace any remaining non-Latin-1 characters with a safe placeholder
            .replace(/[^\x00-\xFF]/g, '?')
            .trim();
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
        // The metrics snapshot is the canonical source — same data the page showed
        // when the report was saved or approved.
        const m = report.metrics || {};
        const byStatus = m.byStatus || {};
        const outcomeMap = m.outcomeMap || {};
        const riskMap = m.riskMap || {};

        // SLA overdue: stored as slaOverdueNow in the metrics snapshot.
        // Fall back to legacy key slaOverdue for older saved reports.
        const slaOverdue = m.slaOverdueNow ?? m.slaOverdue ?? '—';

        /* ── Build PDF ────────────────────────────────────────────────────────── */

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        const lm = 15;      // left margin
        const pw = 180;     // printable width
        const rm = lm + pw; // right edge
        let y = 0;

        /* ── Colour palette ─────────────────────────────────────────────────── */
        const navy = [11, 30, 54];   // #0B1E36
        const gold = [201, 168, 76];    // #C9A84C
        const light = [248, 250, 252];    // #f8fafc
        const slate = [71, 85, 105];   // #475569
        const border = [226, 232, 240];    // #e2e8f0

        /* ── Helpers ─────────────────────────────────────────────────────────── */
        function setCol(rgb) { doc.setTextColor(...rgb); }
        function setFill(rgb) { doc.setFillColor(...rgb); }
        function setDraw(rgb) { doc.setDrawColor(...rgb); }
        function newPage() { doc.addPage(); y = 20; }
        function checkY(needed = 10) { if (y + needed > 275) newPage(); }

        function renderSectionTitle(title) {
            checkY(14);
            setFill(navy);
            doc.rect(lm, y, pw, 8, 'F');
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text(sanitisePdfText(title), lm + 3, y + 5.5);
            setCol([0, 0, 0]);
            y += 12;
        }

        function renderBodyText(text, fallback) {
            const content = sanitisePdfText(text) || sanitisePdfText(fallback) || 'No content recorded.';
            doc.setFontSize(9.5);
            doc.setFont('helvetica', 'normal');
            setCol(slate);
            const lines = doc.splitTextToSize(content, pw);
            for (const line of lines) {
                checkY(6);
                doc.text(line, lm, y);
                y += 5.2;
            }
            y += 4;
        }

        function renderBulletList(text, fallback) {
            const content = sanitisePdfText(text) || sanitisePdfText(fallback) || 'No recommendations recorded.';
            const items = content.split('\n').map(l => l.replace(/^[-–—•]\s*/, '').trim()).filter(Boolean);
            doc.setFontSize(9.5);
            doc.setFont('helvetica', 'normal');
            setCol(slate);
            for (const item of items) {
                checkY(6);
                doc.text('›', lm + 1, y);
                const wrapped = doc.splitTextToSize(item, pw - 8);
                doc.text(wrapped, lm + 6, y);
                y += wrapped.length * 5.2;
            }
            y += 4;
        }

        function renderKpiBox(label, value, x, w) {
            setFill(light);
            setDraw(border);
            doc.rect(x, y, w, 20, 'FD');
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            setCol(navy);
            doc.text(String(value), x + w / 2, y + 10, { align: 'center' });
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            setCol(slate);
            doc.text(sanitisePdfText(label), x + w / 2, y + 16.5, { align: 'center' });
        }

        function renderTable(title, entries, headers = ['Category', 'Count']) {
            renderSectionTitle(title);
            if (!entries || entries.length === 0) {
                doc.setFontSize(9);
                doc.setFont('helvetica', 'italic');
                setCol(slate);
                doc.text('No data recorded for this period.', lm, y);
                y += 8;
                return;
            }
            // Header row
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            setCol(slate);
            doc.text(headers[0], lm + 2, y);
            doc.text(headers[1], rm - 3, y, { align: 'right' });
            y += 4;
            setDraw(border);
            doc.line(lm, y, rm, y);
            y += 2;

            // Data rows
            doc.setFont('helvetica', 'normal');
            setCol([30, 41, 59]);
            let shade = false;
            for (const entry of entries) {
                checkY(7);
                const name = Array.isArray(entry) ? entry[0] : (entry.name ?? String(entry));
                const count = Array.isArray(entry) ? String(entry[1]) : String(entry.count ?? '');
                if (shade) { setFill(light); doc.rect(lm, y - 3.5, pw, 6, 'F'); }
                doc.text(sanitisePdfText(fmtLabel(String(name))), lm + 2, y);
                doc.text(sanitisePdfText(count), rm - 3, y, { align: 'right' });
                y += 5.5;
                shade = !shade;
            }
            y += 5;
        }

        /* ── Page 1: Cover block ─────────────────────────────────────────────── */
        y = 0;
        // Dark navy header band
        setFill(navy);
        doc.rect(0, 0, 210, 58, 'F');

        // Gold accent bar
        setFill(gold);
        doc.rect(0, 58, 210, 2.5, 'F');

        // Branding copy
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(201, 168, 76); // gold
        doc.text('SECOND LOOK PROTECT', lm, 16);

        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(248, 250, 252); // light
        doc.text('Safeguarding Monthly Report', lm, 28);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184); // muted slate
        doc.text(sanitisePdfText(orgName), lm, 37);
        doc.text(`Period: ${periodStart}  to  ${periodEnd}`, lm, 44);

        const statusLabel = fmtLabel(report.status ?? 'draft');
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        const statusColor = (report.status === 'approved' || report.status === 'locked')
            ? [74, 222, 128]   // green
            : [201, 168, 76];  // gold (draft)
        doc.setTextColor(...statusColor);
        doc.text(`Status: ${statusLabel}`, lm, 51);

        // Reset colour
        setCol([0, 0, 0]);
        y = 72;

        /* ── KPI strip ───────────────────────────────────────────────────────── */
        const kpiCount = 5;
        const kpiW = (pw - (kpiCount - 1) * 3) / kpiCount;
        const byStatus = m.byStatus || {};
        const outcomeMap = m.outcomeMap || {};
        const riskMap = m.riskMap || {};
        const slaOverdue = m.slaOverdueNow ?? m.slaOverdue ?? '—';
        const closureRate = (typeof m.total === 'number' && m.total > 0 && typeof byStatus.closed === 'number')
            ? Math.round((byStatus.closed / m.total) * 100) + '%'
            : '—';

        renderKpiBox('Total Cases', m.total ?? 0, lm, kpiW);
        renderKpiBox('High Risk', m.highRisk ?? 0, lm + (kpiW + 3), kpiW);
        renderKpiBox('Closed', byStatus.closed ?? 0, lm + (kpiW + 3) * 2, kpiW);
        renderKpiBox('SLA Overdue', slaOverdue, lm + (kpiW + 3) * 3, kpiW);
        renderKpiBox('Closure Rate', closureRate, lm + (kpiW + 3) * 4, kpiW);
        y += 26;

        // Secondary metrics row (smaller text)
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        setCol(slate);
        const metaLine = [
            `New: ${byStatus.new ?? 0}`,
            `In Review: ${byStatus.in_review ?? 0}`,
            `Avg Review: ${m.avgReview ?? '—'}`,
            `Avg Close: ${m.avgClose ?? '—'}`,
            `Scam Confirmed: ${m.scamConfirmed ?? 0}`,
        ].join('   ·   ');
        doc.text(sanitisePdfText(metaLine), lm, y);
        y += 10;

        /* ── AI narrative sections ─────────────────────────────────────────── */
        // Prefer the AI narrative from metrics.aiNarrative; fall back to legacy fields
        const ai = m.aiNarrative || {};

        const narrativeSections = [
            { title: 'Executive Summary', text: ai.execSummary || report.ai_summary, isList: false },
            { title: 'Safeguarding Trends', text: ai.safeguardingTrends || m.keyTrends, isList: false },
            { title: 'Emerging Risks', text: ai.emergingRisks, isList: false },
            { title: 'Operational Pressure', text: ai.operationalPressure, isList: false },
            { title: 'Positive Signals', text: ai.positiveSignals, isList: false },
            { title: 'Recommended Actions', text: ai.recommendedActions || report.recommendations, isList: true },
            { title: 'Inspection Summary', text: ai.inspectionSummary, isList: false },
            { title: 'Leadership Summary', text: ai.leadershipSummary, isList: false },
        ];

        for (const section of narrativeSections) {
            if (!section.text) continue; // skip empty sections quietly
            renderSectionTitle(section.title);
            if (section.isList) {
                renderBulletList(section.text, '');
            } else {
                renderBodyText(section.text, '');
            }
        }

        /* ── Supporting data tables ─────────────────────────────────────────── */
        renderTable('Top Concern Categories', m.categories);
        renderTable('Submission Channels', m.channels);

        if (riskMap && Object.keys(riskMap).length > 0) {
            renderTable('Risk Distribution', Object.entries(riskMap).map(([k, v]) => [k, v]));
        } else {
            renderTable('Risk Distribution', []);
        }

        renderTable('Decisions Distribution', m.decisions);

        /* ── Inspection Ready Notes ──────────────────────────────────────────── */
        renderSectionTitle('Inspection Ready Notes');
        const inspectionLines = [
            'All case submissions contain timestamped evidence in case actions',
            'Audit timeline shows chronological actions and reviews per case',
            'Row-level security enforced — users cannot access data outside their organisation',
            'Compliance notes are append-only and immutable',
            'Reports can be locked to prevent post-hoc editing',
            'All case statuses and reviews are traceable via case reviews',
        ];
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        setCol(slate);
        for (const note of inspectionLines) {
            checkY(6);
            doc.text('[x]', lm + 1, y);
            doc.text(sanitisePdfText(note), lm + 9, y);
            y += 5.5;
        }
        y += 4;

        /* ── Footer on every page ────────────────────────────────────────────── */
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(7.5);
            doc.setTextColor(148, 163, 184);
            doc.text(
                sanitisePdfText(
                    `Generated ${new Date().toISOString().slice(0, 10)}  ·  ${orgName}  ·  Period: ${periodStart} to ${periodEnd}  ·  Page ${i} of ${pageCount}`
                ),
                lm, 290
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
