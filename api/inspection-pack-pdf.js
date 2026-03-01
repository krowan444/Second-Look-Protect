// /api/inspection-pack-pdf.js
import { jsPDF } from 'jspdf';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_KEY) {
        return res.status(500).json({ ok: false, error: 'Missing required env vars' });
    }

    // Authenticate via Supabase JWT (browser sends Authorization: Bearer <token>)
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const headers = {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
    };

    // Verify user from token
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
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
        { headers }
    );
    if (!profileRes.ok) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const profiles = await profileRes.json();
    if (!profiles?.[0] || profiles[0].role !== 'super_admin') {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const { org_id, month } = req.query;
    if (!org_id || !month) {
        return res.status(400).json({ ok: false, error: 'Missing required query params: org_id, month' });
    }

    try {
        // 1) Fetch organisation name
        const orgRes = await fetch(
            `${SUPABASE_URL}/rest/v1/organisations?id=eq.${org_id}&select=name&limit=1`,
            { headers }
        );
        if (!orgRes.ok) throw new Error(`Failed to fetch organisation: ${orgRes.status}`);
        const orgRows = await orgRes.json();
        const orgName = orgRows?.[0]?.name ?? 'Unknown organisation';

        // 2) Fetch snapshot
        const snapRes = await fetch(
            `${SUPABASE_URL}/rest/v1/inspection_snapshots?organisation_id=eq.${org_id}&snapshot_month=eq.${month}&select=total_open_cases,overdue_open_cases,sla_compliance_percent,safeguarding_score,generated_at&order=generated_at.desc&limit=1`,
            { headers }
        );
        if (!snapRes.ok) throw new Error(`Failed to fetch snapshot: ${snapRes.status}`);
        const snapRows = await snapRes.json();

        if (!snapRows || snapRows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Snapshot not found' });
        }

        const snap = snapRows[0];

        // 3) Generate PDF
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const pw = doc.internal.pageSize.getWidth();
        let y = 30;

        // Title
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('Inspection Pack', pw / 2, y, { align: 'center' });
        y += 12;

        // Organisation + month
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(orgName, pw / 2, y, { align: 'center' });
        y += 7;
        doc.setFontSize(10);
        doc.setTextColor(120);
        doc.text(`Month: ${month.slice(0, 7)}`, pw / 2, y, { align: 'center' });
        y += 14;

        // Divider
        doc.setDrawColor(200);
        doc.line(20, y, pw - 20, y);
        y += 12;

        // Metrics
        doc.setTextColor(0);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');

        const metrics = [
            ['Total Open Cases', snap.total_open_cases ?? '—'],
            ['Overdue Open Cases', snap.overdue_open_cases ?? '—'],
            ['SLA Compliance', snap.sla_compliance_percent != null ? `${snap.sla_compliance_percent}%` : '—'],
            ['Safeguarding Score', snap.safeguarding_score ?? '—'],
        ];

        for (const [label, value] of metrics) {
            doc.setFont('helvetica', 'normal');
            doc.text(label, 25, y);
            doc.setFont('helvetica', 'bold');
            doc.text(String(value), pw - 25, y, { align: 'right' });
            y += 9;
        }

        y += 6;

        // Generated at
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(140);
        const genAt = snap.generated_at ? new Date(snap.generated_at).toLocaleString('en-GB') : '—';
        doc.text(`Snapshot generated: ${genAt}`, 25, y);
        y += 20;

        // Footer divider
        doc.setDrawColor(200);
        doc.line(20, y, pw - 20, y);
        y += 8;

        doc.setFontSize(9);
        doc.setTextColor(160);
        doc.text('Generated by Second Look Protect', pw / 2, y, { align: 'center' });

        // 4) Return PDF
        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="inspection-pack-${month.slice(0, 7)}.pdf"`);
        return res.status(200).send(pdfBuffer);
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message || 'Unknown error' });
    }
}
