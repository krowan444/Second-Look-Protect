// /api/safeguarding-monitor.js
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const cronSecret = req.headers['x-cron-secret'];
    if (!cronSecret || cronSecret !== process.env.SLA_CRON_SECRET) {
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

    try {
        const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/run_all_org_escalation_alerts`, {
            method: 'POST',
            headers: {
                apikey: SERVICE_KEY,
                Authorization: `Bearer ${SERVICE_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
        });

        if (!rpcRes.ok) {
            const text = await rpcRes.text();
            return res.status(500).json({ ok: false, error: text || `RPC returned ${rpcRes.status}` });
        }

        const summary = await rpcRes.json();
        return res.status(200).json({ ok: true, summary });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message || 'Unknown error' });
    }
}
