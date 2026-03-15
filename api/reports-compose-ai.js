// /api/reports-compose-ai.js
// AI narrative composer for safeguarding monthly reports.
// Uses OpenAI gpt-4o-mini to produce 8 structured narrative sections from structured report data.
// Rate-limited: 1 request per reportId per 60 seconds (in-memory, good for Vercel serverless).

const rateLimitMap = new Map(); // Map<reportId, expiresAtMs>
const COOLDOWN_MS = 60_000;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const OPENAI_KEY = process.env.OPENAI_API_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
        return res.status(500).json({ error: 'Missing Supabase configuration' });
    }
    if (!OPENAI_KEY) {
        // Graceful: return fallback flag so the UI can handle it cleanly
        return res.status(200).json({ fallback: true, reason: 'AI service not configured' });
    }

    /* ── Auth ──────────────────────────────────────────────────────────────── */

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const userToken = authHeader.replace('Bearer ', '');

    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${userToken}` },
    });
    if (!authRes.ok) return res.status(401).json({ error: 'Invalid session' });

    const authUser = await authRes.json();
    const userId = authUser?.id;
    if (!userId) return res.status(401).json({ error: 'No user ID in session' });

    /* ── Profile & permission check ────────────────────────────────────────── */

    const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?select=role,organisation_id&id=eq.${userId}&limit=1`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const profiles = await profileRes.json().catch(() => []);
    const profile = Array.isArray(profiles) ? profiles[0] : null;

    if (!profile) return res.status(403).json({ error: 'Profile not found' });

    const allowedRoles = ['super_admin', 'org_admin'];
    if (!allowedRoles.includes(profile.role)) {
        return res.status(403).json({ error: 'Insufficient permissions to generate AI narrative' });
    }

    /* ── Parse body ────────────────────────────────────────────────────────── */

    const { reportId, organisationId, periodStart, periodEnd, payload } = req.body || {};

    if (!reportId || !organisationId || !periodStart || !periodEnd) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Non-super_admin must belong to the same org
    if (profile.role !== 'super_admin' && profile.organisation_id !== organisationId) {
        return res.status(403).json({ error: 'Organisation mismatch' });
    }

    /* ── Rate limit ────────────────────────────────────────────────────────── */

    const now = Date.now();
    const cooldownExpiry = rateLimitMap.get(reportId);
    if (cooldownExpiry && now < cooldownExpiry) {
        const remainingSeconds = Math.ceil((cooldownExpiry - now) / 1000);
        return res.status(429).json({
            error: 'Rate limit: please wait before regenerating',
            retryAfterSeconds: remainingSeconds,
        });
    }
    // Set cooldown before the expensive AI call
    rateLimitMap.set(reportId, now + COOLDOWN_MS);

    /* ── Fetch org name ─────────────────────────────────────────────────────── */

    const orgRes = await fetch(
        `${SUPABASE_URL}/rest/v1/organisations?select=name&id=eq.${organisationId}&limit=1`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const orgs = await orgRes.json().catch(() => []);
    const orgName = orgs?.[0]?.name ?? 'the organisation';

    /* ── Build AI prompt from payload ───────────────────────────────────────── */

    const p = payload || {};
    const byStatus = p.byStatus || {};
    const prevData = p.prev || {};

    // Format top categories cleanly (no underscores, readable)
    let topCatsText = 'not recorded';
    if (Array.isArray(p.categories) && p.categories.length > 0) {
        topCatsText = p.categories
            .slice(0, 5)
            .map(([cat, count]) => `${cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} (${count})`)
            .join(', ');
    }

    // Case volume change vs prior period
    const prevTotal = typeof prevData.total === 'number' ? prevData.total : null;
    const prevHighRisk = typeof prevData.highRisk === 'number' ? prevData.highRisk : null;
    const caseDelta = prevTotal !== null ? (p.total ?? 0) - prevTotal : null;
    const highRiskDelta = prevHighRisk !== null ? (p.highRisk ?? 0) - prevHighRisk : null;

    const closureRate = p.closureRate ?? (
        (p.total > 0 && byStatus.closed != null)
            ? Math.round((byStatus.closed / p.total) * 100)
            : null
    );

    const systemPrompt = `You are a professional safeguarding compliance report writer for a UK care home regulatory platform. You write polished, inspection-ready safeguarding reports in plain, professional English.

Rules you must follow:
- Write only from the data provided. Never invent statistics, cases, or outcomes.
- Never mention internal system names, database columns, technical schemas, or platform internals.
- Write calmly and clearly. Suitable for care home managers, safeguarding leads, group leads, and CQC-style inspectors.
- If data is sparse (few cases, no categories), still write complete professional paragraphs that reflect accurately on the quiet period.
- Avoid generic filler. Make every sentence earn its place.
- Do not repeat the same fact across multiple sections.

Return a valid JSON object with exactly these 8 string keys. No markdown, no code fences, just raw JSON:
{
  "execSummary": "2-3 sentence executive overview of the period",
  "safeguardingTrends": "paragraph on case volume, patterns, and trends vs prior period if available",
  "emergingRisks": "paragraph on risk levels, concern categories, and any emerging patterns — if no risks, state that clearly and professionally",
  "operationalPressure": "paragraph on review response times, SLA compliance, open cases, and whether capacity appears sufficient",
  "positiveSignals": "paragraph on what is working well, closures achieved, or where the organisation is performing strongly",
  "recommendedActions": "3-4 concise recommended actions as a newline-separated list, each line starting with a dash and a space",
  "inspectionSummary": "1-2 sentence inspection-ready assessment of this period's safeguarding posture",
  "leadershipSummary": "2-sentence high-level summary for board or group leadership — professional, brief, clear"
}`;

    const userMessage = `Generate a safeguarding monthly report narrative from this data:

Organisation: ${orgName}
Reporting Period: ${periodStart} to ${periodEnd}

Case Volume:
- Total cases: ${p.total ?? 0}
- New / open: ${byStatus.new ?? 0}
- In review: ${byStatus.in_review ?? 0}
- Closed: ${byStatus.closed ?? 0}
- Closure rate: ${closureRate !== null ? closureRate + '%' : 'unknown'}

Risk Profile:
- High or critical risk cases: ${p.highRisk ?? 0}
- SLA overdue (open >3 days): ${p.slaOverdueNow ?? 0}

Response Metrics:
- Average time to first review: ${p.avgReview ?? 'not recorded'}
- Average time to close: ${p.avgClose ?? 'not recorded'}

Top Concern Categories: ${topCatsText}

${prevTotal !== null ? `Prior Period Comparison:
- Previous period total cases: ${prevTotal}
- Case volume change: ${caseDelta !== null ? (caseDelta >= 0 ? '+' : '') + caseDelta : 'unknown'}
- Previous period high/critical risk: ${prevHighRisk ?? 'unknown'}
- High-risk change: ${highRiskDelta !== null ? (highRiskDelta >= 0 ? '+' : '') + highRiskDelta : 'unknown'}` : 'Prior period data: not available for this report'}

${Array.isArray(p.trendSignals) && p.trendSignals.length > 0
            ? `Key signals from this period:\n${p.trendSignals.map(s => `- ${s.label}: ${s.value}`).join('\n')}`
            : ''}`;

    /* ── Call OpenAI ────────────────────────────────────────────────────────── */

    let aiNarrative = null;

    try {
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${OPENAI_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage },
                ],
                temperature: 0.3,
                max_tokens: 1800,
                response_format: { type: 'json_object' },
            }),
        });

        if (!openaiRes.ok) {
            const errText = await openaiRes.text();
            console.error('[reports-compose-ai] OpenAI error:', openaiRes.status, errText);
            return res.status(200).json({ fallback: true, reason: 'AI service unavailable' });
        }

        const openaiData = await openaiRes.json();
        const rawContent = openaiData?.choices?.[0]?.message?.content;
        if (!rawContent) {
            return res.status(200).json({ fallback: true, reason: 'Empty AI response' });
        }

        // Parse the JSON response
        try {
            aiNarrative = JSON.parse(rawContent);
        } catch {
            // Try to extract JSON from the response if it's wrapped in markdown
            const match = rawContent.match(/\{[\s\S]*\}/);
            if (match) {
                try { aiNarrative = JSON.parse(match[0]); } catch { /* fall through */ }
            }
        }

        if (!aiNarrative || typeof aiNarrative !== 'object') {
            return res.status(200).json({ fallback: true, reason: 'Could not parse AI response' });
        }

    } catch (err) {
        console.error('[reports-compose-ai] Fetch error:', err);
        return res.status(200).json({ fallback: true, reason: 'AI service unavailable' });
    }

    /* ── Persist to reports table ────────────────────────────────────────────── */

    try {
        // Fetch current metrics snapshot to merge aiNarrative into it
        const reportFetch = await fetch(
            `${SUPABASE_URL}/rest/v1/reports?select=metrics&id=eq.${reportId}&limit=1`,
            { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
        );
        const reportRows = await reportFetch.json().catch(() => []);
        const currentMetrics = reportRows?.[0]?.metrics ?? {};

        const updatedMetrics = { ...currentMetrics, aiNarrative };

        const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/reports?id=eq.${reportId}`, {
            method: 'PATCH',
            headers: {
                apikey: SERVICE_KEY,
                Authorization: `Bearer ${SERVICE_KEY}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
            },
            body: JSON.stringify({
                metrics: updatedMetrics,
                // Keep ai_summary in sync for backward compat
                ai_summary: aiNarrative.execSummary ?? null,
            }),
        });

        if (!patchRes.ok) {
            const patchErr = await patchRes.text();
            console.error('[reports-compose-ai] DB patch error:', patchErr);
            // Still return the AI narrative even if DB write fails
        }
    } catch (err) {
        console.error('[reports-compose-ai] DB write error:', err);
    }

    return res.status(200).json({ ok: true, aiNarrative });
}
