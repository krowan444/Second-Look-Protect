// /api/safeguarding-monitor.js
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const cronSecret = req.headers['x-cron-secret'];
    const expectedSecret = process.env.SLA_CRON_SECRET || process.env.CRON_SECRET;
    if (!cronSecret || !expectedSecret || cronSecret !== expectedSecret) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const missing = [];
    if (!SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!SERVICE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (missing.length > 0) {
        return res.status(500).json({ ok: false, error: `Missing env vars: ${missing.join(', ')}` });
    }

    const sbHeaders = {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
    };

    try {
        const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/run_all_org_escalation_alerts`, {
            method: 'POST',
            headers: sbHeaders,
            body: JSON.stringify({}),
        });

        if (!rpcRes.ok) {
            const text = await rpcRes.text();
            return res.status(500).json({ ok: false, error: text || `RPC returned ${rpcRes.status}` });
        }

        const summary = await rpcRes.json();

        // ── Dispatch email alerts for SLA-related events ─────────────────
        // Query recent sla_breach, escalation, and overdue notifications created in the last 6 minutes
        // (this cron runs every 5 minutes, so 6 min window catches all new ones)
        const host = req.headers['host'] || 'localhost:3000';
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const dispatchUrl = `${protocol}://${host}/api/email-dispatch`;
        const sixMinAgo = new Date(Date.now() - 360000).toISOString();
        let emailsDispatched = 0;

        const slaTypes = ['sla_breach', 'escalation', 'overdue_review'];
        const emailEventMap = {
            sla_breach: 'admin_sla_breach',
            escalation: 'admin_escalation_notice',
            overdue_review: 'admin_overdue_review',
        };

        for (const notifType of slaTypes) {
            try {
                const notifRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/notifications?type=eq.${notifType}&created_at=gte.${sixMinAgo}&select=organisation_id,case_id&limit=50`,
                    { headers: sbHeaders }
                );
                if (!notifRes.ok) continue;
                const notifs = await notifRes.json();
                if (!Array.isArray(notifs)) continue;

                // Deduplicate by org+case
                const seen = new Set();
                for (const n of notifs) {
                    const key = `${n.organisation_id}:${n.case_id || ''}`;
                    if (seen.has(key)) continue;
                    seen.add(key);

                    try {
                        await fetch(dispatchUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-slp-secret': process.env.SLP_WEBHOOK_SECRET,
                            },
                            body: JSON.stringify({
                                event_type: emailEventMap[notifType],
                                organisation_id: n.organisation_id,
                                case_id: n.case_id || null,
                                context: { message: `${notifType.replace(/_/g, ' ')} detected by safeguarding monitor.` },
                            }),
                        });
                        emailsDispatched++;
                    } catch {
                        // Non-blocking
                    }
                }
            } catch {
                // Non-blocking
            }
        }

        return res.status(200).json({ ok: true, summary, emailsDispatched });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message || 'Unknown error' });
    }
}
