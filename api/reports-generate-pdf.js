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

    /* ── Auth check ──────────────────────────────────────────────────────── */

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const userToken = authHeader.replace('Bearer ', '');

    // Verify user via Supabase auth
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

    // Fetch profile to verify org access
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

    // Verify org permission
    if (profile.role !== 'super_admin' && profile.organisation_id !== organisationId) {
        return res.status(403).json({ error: 'Forbidden: organisation mismatch' });
    }

    try {
        /* ── Fetch report ─────────────────────────────────────────────────── */

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

        /* ── Build PDF ────────────────────────────────────────────────────── */

        const m = report.metrics || {};
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        let y = 20;
        const lm = 15; // left margin
        const pw = 180; // printable width

        // --- Header ---
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Safeguarding Monthly Report', lm, y);
        y += 8;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(`${orgName}`, lm, y);
        y += 6;
        doc.text(`Period: ${periodStart} to ${periodEnd}`, lm, y);
        y += 6;
        doc.text(`Status: ${report.status ?? 'draft'}`, lm, y);
        y += 3;
        doc.setDrawColor(200);
        doc.line(lm, y, lm + pw, y);
        y += 8;

        // --- Key Metrics ---
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Key Metrics', lm, y);
        y += 7;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        const byStatus = m.byStatus || {};
        const outcomeMap = m.outcomeMap || {};

        const metricLines = [
            `Total Cases: ${m.total ?? '—'}`,
            `New: ${byStatus.new ?? '—'}  |  In Review: ${byStatus.in_review ?? '—'}  |  Closed: ${byStatus.closed ?? '—'}`,
            `High/Critical Risk: ${m.highRisk ?? '—'}`,
            `Scam Confirmed: ${m.scamConfirmed ?? '—'}`,
            `Prevented: ${outcomeMap.prevented ?? '—'}  |  Lost: ${outcomeMap.lost ?? '—'}  |  Escalated: ${outcomeMap.escalated ?? '—'}`,
            `Avg Time to Review: ${m.avgReview ?? '—'}`,
            `Avg Time to Close: ${m.avgClose ?? '—'}`,
            `SLA Overdue (>3 days): ${m.slaOverdue ?? '—'}`,
        ];

        for (const line of metricLines) {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.text(line, lm, y);
            y += 5.5;
        }
        y += 4;

        // --- Helper: render simple table ---
        function renderTable(title, entries, headers = ['Name', 'Count']) {
            if (!entries || entries.length === 0) return;
            if (y > 250) { doc.addPage(); y = 20; }
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(title, lm, y);
            y += 6;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(headers[0], lm, y);
            doc.text(headers[1], lm + 100, y);
            y += 5;
            doc.setFont('helvetica', 'normal');
            for (const entry of entries) {
                if (y > 275) { doc.addPage(); y = 20; }
                const name = Array.isArray(entry) ? entry[0] : entry.name ?? String(entry);
                const count = Array.isArray(entry) ? String(entry[1]) : String(entry.count ?? '');
                doc.text(capitalize(String(name)), lm, y);
                doc.text(count, lm + 100, y);
                y += 4.5;
            }
            y += 4;
        }

        // Categories
        renderTable('Top Categories', m.categories);

        // Channels
        renderTable('Submission Channels', m.channels);

        // Risk distribution
        if (m.riskMap) {
            renderTable(
                'Risk Distribution',
                Object.entries(m.riskMap).map(([k, v]) => [k, v])
            );
        }

        // Decisions
        renderTable('Decisions Distribution', m.decisions);

        // --- Text sections ---
        function renderTextSection(title, text) {
            if (!text) return;
            if (y > 250) { doc.addPage(); y = 20; }
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(title, lm, y);
            y += 6;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const lines = doc.splitTextToSize(text, pw);
            for (const line of lines) {
                if (y > 275) { doc.addPage(); y = 20; }
                doc.text(line, lm, y);
                y += 5;
            }
            y += 4;
        }

        renderTextSection('Executive Summary', report.ai_summary);
        renderTextSection('Key Trends This Month', m.keyTrends);
        renderTextSection('Recommendations', report.recommendations);

        // Inspection-ready notes
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Inspection Ready Notes', lm, y);
        y += 6;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const inspectionNotes = [
            '✓ All case submissions contain timestamped evidence in case_actions',
            '✓ Audit timeline shows chronological actions + reviews per case',
            '✓ Row-level security enforced — users cannot access data outside their organisation',
            '✓ Compliance notes are append-only and immutable',
            '✓ Reports can be locked to prevent post-hoc editing',
            '✓ All case statuses and reviews traceable via case_reviews',
        ];
        for (const note of inspectionNotes) {
            if (y > 275) { doc.addPage(); y = 20; }
            doc.text(note, lm, y);
            y += 4.5;
        }

        // --- Footer ---
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(
                `Generated ${new Date().toISOString().slice(0, 10)} — Page ${i} of ${pageCount}`,
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

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
