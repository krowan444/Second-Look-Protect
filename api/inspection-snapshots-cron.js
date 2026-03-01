// /api/inspection-snapshots-cron.js
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

    if (!SUPABASE_URL || !SERVICE_KEY) {
        return res.status(500).json({ ok: false, error: 'Missing required env vars' });
    }

    try {
        const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/run_monthly_inspection_snapshots`, {
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

        const data = await rpcRes.json();
        return res.status(200).json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message || 'Unknown error' });
    }
}
