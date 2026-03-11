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

    // Authenticate via Supabase JWT or service-role key (server-to-server)
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
        return res.status(401).json({ ok: false, error: 'Unauthorized: no token' });
    }

    const headers = {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
    };

    const { org_id, month } = req.query;
    if (!org_id || !month) {
        return res.status(400).json({ ok: false, error: 'Missing required query params: org_id, month' });
    }

    // Check if this is a service-role key call (server-to-server, e.g. from send-inspection-pack)
    const isServiceRole = token === SERVICE_KEY;
    let callerRole = null;
    let callerOrgId = null;

    if (isServiceRole) {
        // Service role key = trusted server-to-server call, skip user auth
        console.log('[inspection-pack-pdf] Authenticated via service-role key for org:', org_id);
        callerRole = 'super_admin'; // service role has full access
    } else {
        // Verify user from JWT token
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
        });
        if (!userRes.ok) {
            console.error('[inspection-pack-pdf] JWT user verification failed:', userRes.status);
            return res.status(401).json({ ok: false, error: 'Unauthorized: invalid token' });
        }
        const userData = await userRes.json();
        const userId = userData?.id;
        if (!userId) {
            return res.status(401).json({ ok: false, error: 'Unauthorized: no user id' });
        }

        // Check role
        const profileRes = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role,organisation_id&limit=1`,
            { headers }
        );
        if (!profileRes.ok) {
            console.error('[inspection-pack-pdf] Profile fetch failed:', profileRes.status);
            return res.status(401).json({ ok: false, error: 'Unauthorized: profile lookup failed' });
        }
        const profiles = await profileRes.json();
        const profile = profiles?.[0];
        if (!profile) {
            return res.status(401).json({ ok: false, error: 'Unauthorized: profile not found' });
        }

        callerRole = profile.role;
        callerOrgId = profile.organisation_id;
        console.log('[inspection-pack-pdf] User auth — role:', callerRole, 'userOrg:', callerOrgId, 'requestedOrg:', org_id);

        // Allow super_admin (any org) or org_admin (own org only)
        const allowed = callerRole === 'super_admin' || (callerRole === 'org_admin' && callerOrgId === org_id);
        if (!allowed) {
            console.error('[inspection-pack-pdf] Forbidden — role:', callerRole, 'userOrg:', callerOrgId, 'requestedOrg:', org_id);
            return res.status(403).json({ ok: false, error: `Forbidden: ${callerRole} cannot generate PDF for this organisation` });
        }
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
        // Normalize month: frontend sends YYYY-MM, DB column is date (YYYY-MM-01)
        const snapshotMonth = month.length === 7 ? `${month}-01` : month;
        const snapUrl = `${SUPABASE_URL}/rest/v1/inspection_snapshots?organisation_id=eq.${org_id}&snapshot_month=eq.${snapshotMonth}&select=*&order=generated_at.desc&limit=1`;
        console.log('[inspection-pack-pdf] Snapshot fetch — org_id:', org_id, 'rawMonth:', month, 'snapshotMonth:', snapshotMonth);
        console.log('[inspection-pack-pdf] Snapshot URL:', snapUrl);
        const snapRes = await fetch(snapUrl, { headers });
        const snapBody = await snapRes.text();
        console.log('[inspection-pack-pdf] Snapshot response — status:', snapRes.status, 'body:', snapBody);

        if (!snapRes.ok) {
            console.error('[inspection-pack-pdf] Snapshot fetch failed — status:', snapRes.status);
            throw new Error(`Failed to fetch snapshot: ${snapRes.status} — ${snapBody}`);
        }

        let snapRows;
        try { snapRows = JSON.parse(snapBody); } catch { snapRows = []; }
        console.log('[inspection-pack-pdf] Snapshot rows count:', Array.isArray(snapRows) ? snapRows.length : 'not-array', 'keys:', snapRows?.[0] ? Object.keys(snapRows[0]) : 'none');

        if (!Array.isArray(snapRows) || snapRows.length === 0) {
            return res.status(404).json({
                ok: false,
                error: 'Snapshot not found',
                debug: { org_id, snapshotMonth, queryStatus: snapRes.status, rowCount: Array.isArray(snapRows) ? snapRows.length : 0 }
            });
        }

        const snap = snapRows[0];

        // ✅ Fetch official inspector notes from DB (no query param)
        let officialNotes = "";
        let notesMeta = null;
        try {
            const notesRes = await fetch(
                `${SUPABASE_URL}/rest/v1/inspection_pack_notes?organisation_id=eq.${org_id}&snapshot_month=eq.${snapshotMonth}&select=notes,updated_at,created_at&limit=1`,
                { headers }
            );
            if (notesRes.ok) {
                const notesRows = await notesRes.json();
                const noteRow = notesRows?.[0] ?? null;
                if (noteRow?.notes && String(noteRow.notes).trim()) {
                    officialNotes = String(noteRow.notes).trim();
                }
                if (noteRow) {
                    notesMeta = { updated_at: noteRow.updated_at, created_at: noteRow.created_at };
                }
            }
        } catch { /* treat as no notes */ }

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
        y += 14;

        // ── Evidence & Governance ────────────────────────────────────
        const ph = doc.internal.pageSize.getHeight();
        const maxW = pw - 50; // text area width
        function checkPage(needed) {
            if (y + needed > ph - 25) {
                doc.addPage();
                y = 25;
            }
        }

        // Divider
        doc.setDrawColor(200);
        doc.line(20, y, pw - 20, y);
        y += 10;

        // Section title
        checkPage(12);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text('Evidence & Governance', 25, y);
        y += 10;

        // Narrative
        const open = snap.total_open_cases ?? 0;
        const overdue = snap.overdue_open_cases ?? 0;
        const sla = snap.sla_compliance_percent;
        const sg = snap.safeguarding_score;

        let narrative = `As of the snapshot generated on ${genAt}, the organisation has ${open} open case${open !== 1 ? 's' : ''}`;
        if (overdue > 0) narrative += `, of which ${overdue} ${overdue > 1 ? 'are' : 'is'} overdue`;
        narrative += '.';
        if (sla != null) narrative += ` SLA compliance stands at ${sla}%.`;
        if (sg != null) narrative += ` The current safeguarding score is ${sg}.`;
        narrative += ' This data represents an immutable point-in-time record suitable for inspection and regulatory evidence.';

        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50);
        const narLines = doc.splitTextToSize(narrative, maxW);
        checkPage(narLines.length * 4.5 + 4);
        doc.text(narLines, 25, y);
        y += narLines.length * 4.5 + 6;

        // Key risks
        const risks = [];
        if (overdue > 0) risks.push(`${overdue} case${overdue > 1 ? 's' : ''} remain overdue, requiring timely escalation to prevent safeguarding gaps.`);
        if (sla != null && sla < 90) risks.push(`SLA compliance is at ${sla}%, below the recommended 90% threshold. Response times should be reviewed.`);
        if (sg != null && sg < 70) risks.push(`Safeguarding score of ${sg} indicates areas for improvement in the organisation's safeguarding posture.`);
        if (risks.length === 0) risks.push('No significant risk spikes detected in this snapshot period.');

        checkPage(10);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text('Key risks observed', 25, y);
        y += 6;

        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50);
        for (const risk of risks) {
            const rLines = doc.splitTextToSize(risk, maxW - 6);
            checkPage(rLines.length * 4.5 + 2);
            doc.text('•', 27, y);
            doc.text(rLines, 33, y);
            y += rLines.length * 4.5 + 2;
        }
        y += 4;

        // Recommended actions
        const actions = [];
        if (overdue > 0) actions.push('Prioritise resolution of overdue cases and confirm escalation pathways are active.');
        if (sla != null && sla < 90) actions.push('Review SLA performance with the safeguarding team to identify bottlenecks.');
        if (sg != null && sg < 70) actions.push('Schedule a safeguarding review meeting to address score improvement areas.');
        if (actions.length === 0) { actions.push('Continue current monitoring cadence.'); actions.push('Ensure monthly snapshots remain generated for audit continuity.'); }
        if (actions.length < 2) actions.push('Maintain regular snapshot generation for ongoing compliance evidence.');

        checkPage(10);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text('Recommended actions', 25, y);
        y += 6;

        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50);
        for (const action of actions) {
            const aLines = doc.splitTextToSize(action, maxW - 6);
            checkPage(aLines.length * 4.5 + 2);
            doc.text('•', 27, y);
            doc.text(aLines, 33, y);
            y += aLines.length * 4.5 + 2;
        }
        y += 4;

        // Audit note
        checkPage(8);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(140);
        doc.text('This pack is generated from an immutable monthly snapshot for audit integrity.', 25, y);
        y += 10;

        // Inspector notes (from DB)
        if (officialNotes) {
            checkPage(16);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text('Notes for inspector:', 25, y);
            y += 6;

            doc.setFontSize(9.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(50);
            const nLines = doc.splitTextToSize(officialNotes, maxW);
            checkPage(nLines.length * 4.5 + 4);
            doc.text(nLines, 25, y);
            y += nLines.length * 4.5 + 6;
        } else {
            checkPage(10);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(140);
            doc.text('No inspector notes saved for this month.', 25, y);
            y += 8;
        }

        // Footer divider
        checkPage(16);
        doc.setDrawColor(200);
        doc.line(20, y, pw - 20, y);
        y += 8;

        doc.setFontSize(9);
        doc.setTextColor(160);
        doc.setFont('helvetica', 'normal');
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
