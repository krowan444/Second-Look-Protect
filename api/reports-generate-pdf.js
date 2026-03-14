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

        /* ── Build PDF ────────────────────────────────────────────────────── */

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        let y = 20;
        const lm = 15;  // left margin
        const pw = 180; // printable width

        // ── Header ──────────────────────────────────────────────────────────
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Safeguarding Monthly Report', lm, y);
        y += 8;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(sanitisePdfText(orgName), lm, y);
        y += 6;
        doc.text(`Period: ${periodStart} to ${periodEnd}`, lm, y);
        y += 6;
        doc.text(`Status: ${fmtLabel(report.status ?? 'draft')}`, lm, y);
        y += 3;
        doc.setDrawColor(200);
        doc.line(lm, y, lm + pw, y);
        y += 8;

        // ── Key Metrics ──────────────────────────────────────────────────────
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Key Metrics', lm, y);
        y += 7;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        const metricLines = [
            `Total Cases: ${m.total ?? '0'}`,
            `New: ${byStatus.new ?? '0'}  |  In Review: ${byStatus.in_review ?? '0'}  |  Closed: ${byStatus.closed ?? '0'}`,
            `High/Critical Risk: ${m.highRisk ?? '0'}`,
            `Scam Confirmed: ${m.scamConfirmed ?? '0'}`,
            `Prevented: ${outcomeMap.prevented ?? '0'}  |  Lost: ${outcomeMap.lost ?? '0'}  |  Escalated: ${outcomeMap.escalated ?? '0'}`,
            `Avg Time to Review: ${m.avgReview ?? '—'}`,
            `Avg Time to Close: ${m.avgClose ?? '—'}`,
            `SLA Overdue (>3 days): ${slaOverdue}`,
        ];

        for (const line of metricLines) {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.text(sanitisePdfText(line), lm, y);
            y += 5.5;
        }
        y += 4;

        // ── Helper: render a breakdown table ────────────────────────────────
        function renderTable(title, entries, headers = ['Name', 'Count']) {
            if (!entries || entries.length === 0) {
                // Render section with a clean fallback instead of silently omitting
                if (y > 255) { doc.addPage(); y = 20; }
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text(sanitisePdfText(title), lm, y);
                y += 6;
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.text('No data recorded for this period.', lm, y);
                y += 8;
                return;
            }
            if (y > 250) { doc.addPage(); y = 20; }
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(sanitisePdfText(title), lm, y);
            y += 6;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(headers[0], lm, y);
            doc.text(headers[1], lm + 100, y);
            y += 5;
            doc.setFont('helvetica', 'normal');
            for (const entry of entries) {
                if (y > 275) { doc.addPage(); y = 20; }
                const name = Array.isArray(entry) ? entry[0] : (entry.name ?? String(entry));
                const count = Array.isArray(entry) ? String(entry[1]) : String(entry.count ?? '');
                // Apply full title-case formatting (handles underscores in category/channel names)
                doc.text(sanitisePdfText(fmtLabel(String(name))), lm, y);
                doc.text(sanitisePdfText(count), lm + 100, y);
                y += 4.5;
            }
            y += 4;
        }

        // Categories
        renderTable('Top Categories', m.categories);

        // Channels
        renderTable('Submission Channels', m.channels);

        // Risk distribution
        if (riskMap && Object.keys(riskMap).length > 0) {
            renderTable(
                'Risk Distribution',
                Object.entries(riskMap).map(([k, v]) => [k, v])
            );
        } else {
            renderTable('Risk Distribution', []);
        }

        // Decisions
        renderTable('Decisions Distribution', m.decisions);

        // ── Helper: render a text section ───────────────────────────────────
        function renderTextSection(title, text, fallback) {
            if (y > 250) { doc.addPage(); y = 20; }
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(sanitisePdfText(title), lm, y);
            y += 6;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');

            const content = sanitisePdfText(text) || fallback || 'No content recorded.';
            const lines = doc.splitTextToSize(content, pw);
            for (const line of lines) {
                if (y > 275) { doc.addPage(); y = 20; }
                doc.text(line, lm, y);
                y += 5;
            }
            y += 4;
        }

        renderTextSection(
            'Executive Summary',
            report.ai_summary,
            'No executive summary was provided for this period.'
        );
        renderTextSection(
            'Key Trends This Month',
            m.keyTrends,
            'No key trends were recorded for this period.'
        );
        renderTextSection(
            'Recommendations',
            report.recommendations,
            'No recommendations were recorded for this period.'
        );

        // ── Inspection Ready Notes ───────────────────────────────────────────
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Inspection Ready Notes', lm, y);
        y += 6;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');

        // ASCII-safe checkmarks — jsPDF Helvetica (Latin-1) cannot render Unicode
        const inspectionNotes = [
            '[x] All case submissions contain timestamped evidence in case_actions',
            '[x] Audit timeline shows chronological actions + reviews per case',
            '[x] Row-level security enforced — users cannot access data outside their organisation',
            '[x] Compliance notes are append-only and immutable',
            '[x] Reports can be locked to prevent post-hoc editing',
            '[x] All case statuses and reviews traceable via case_reviews',
        ];
        for (const note of inspectionNotes) {
            if (y > 275) { doc.addPage(); y = 20; }
            doc.text(note, lm, y);
            y += 4.5;
        }

        // ── Footer on every page ─────────────────────────────────────────────
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(
                `Generated ${new Date().toISOString().slice(0, 10)} | ${sanitisePdfText(orgName)} | Period: ${periodStart} to ${periodEnd} | Page ${i} of ${pageCount}`,
                lm, 290
            );
            doc.setTextColor(0);
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
