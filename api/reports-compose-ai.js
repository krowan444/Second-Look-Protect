// /api/reports-compose-ai.js
//
// ─── PREMIUM AI NARRATIVE COMPOSER — Phase 12 ────────────────────────────────
// AI narrative composer for safeguarding monthly reports.
// Uses OpenAI gpt-4o-mini with server-side case data enrichment.
// Guidance (prompt, schema, message builder) is maintained in report-narrative-guide.js.
// Rate-limited: 1 request per reportId per 5 minutes (in-memory).
// ─────────────────────────────────────────────────────────────────────────────

import { SYSTEM_PROMPT, buildUserMessage } from './report-narrative-guide.js';

const rateLimitMap = new Map(); // Map<reportId, expiresAtMs>
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

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

    const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

    const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?select=role,organisation_id&id=eq.${userId}&limit=1`,
        { headers: sbHeaders }
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

    /* ── Fetch org name ────────────────────────────────────────────────────── */

    const orgRes = await fetch(
        `${SUPABASE_URL}/rest/v1/organisations?select=name&id=eq.${organisationId}&limit=1`,
        { headers: sbHeaders }
    );
    const orgs = await orgRes.json().catch(() => []);
    const orgName = orgs?.[0]?.name ?? 'the organisation';

    /* ── Fetch raw case data for the reporting period (server-side enrichment) ── */

    let caseThemes = [];
    let channels = [];
    let riskBreakdown = { critical: 0, high: 0, medium: 0, low: 0 };
    let totalLoss = 0;
    let scamConfirmed = 0;
    let decisions = [];

    try {
        // Fetch cases for this org + period
        const casesRes = await fetch(
            `${SUPABASE_URL}/rest/v1/cases?` +
            `organisation_id=eq.${organisationId}` +
            `&created_at=gte.${periodStart}T00:00:00.000Z` +
            `&created_at=lte.${periodEnd}T23:59:59.999Z` +
            `&select=category,risk_level,channel,status,decision,loss_amount,is_scam_confirmed` +
            `&limit=500`,
            { headers: sbHeaders }
        );

        if (casesRes.ok) {
            const cases = await casesRes.json().catch(() => []);
            console.log('[reports-compose-ai] Fetched', cases.length, 'cases from DB for period');

            // Aggregate category themes
            const catMap = new Map();
            const chanMap = new Map();
            const decMap = new Map();

            for (const c of (cases || [])) {
                // Category
                const cat = c.category ?? 'uncategorised';
                if (!catMap.has(cat)) catMap.set(cat, { count: 0, riskTally: {}, chanTally: {} });
                const ct = catMap.get(cat);
                ct.count++;
                ct.riskTally[c.risk_level ?? 'unknown'] = (ct.riskTally[c.risk_level ?? 'unknown'] ?? 0) + 1;
                ct.chanTally[c.channel ?? 'unknown'] = (ct.chanTally[c.channel ?? 'unknown'] ?? 0) + 1;

                // Channel
                const chan = c.channel ?? 'unknown';
                chanMap.set(chan, (chanMap.get(chan) ?? 0) + 1);

                // Risk breakdown
                const rl = c.risk_level?.toLowerCase();
                if (rl === 'critical') riskBreakdown.critical++;
                else if (rl === 'high') riskBreakdown.high++;
                else if (rl === 'medium') riskBreakdown.medium++;
                else riskBreakdown.low++;

                // Loss
                if (typeof c.loss_amount === 'number' && c.loss_amount > 0) totalLoss += c.loss_amount;

                // Scam confirmed
                if (c.is_scam_confirmed) scamConfirmed++;

                // Decisions
                if (c.decision) {
                    decMap.set(c.decision, (decMap.get(c.decision) ?? 0) + 1);
                }
            }

            // Build sorted theme list
            caseThemes = [...catMap.entries()]
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 6)
                .map(([category, data]) => {
                    const topRisk = Object.entries(data.riskTally).sort((a, b) => b[1] - a[1])[0]?.[0];
                    const topChannel = Object.entries(data.chanTally).sort((a, b) => b[1] - a[1])[0]?.[0];
                    return { category, count: data.count, topRisk, topChannel };
                });

            // Channels sorted
            channels = [...chanMap.entries()].sort((a, b) => b[1] - a[1]);

            // Decisions sorted
            decisions = [...decMap.entries()].sort((a, b) => b[1] - a[1]);
        }
    } catch (caseErr) {
        // Non-blocking — if DB case fetch fails, we proceed with client payload
        console.warn('[reports-compose-ai] Case DB fetch failed (proceeding with payload):', caseErr.message);
    }

    /* ── Merge client payload with server-enriched data ─────────────────────── */

    const p = payload || {};
    const metrics = {
        total: p.total ?? 0,
        highRisk: p.highRisk ?? (riskBreakdown.critical + riskBreakdown.high),
        byStatus: p.byStatus ?? {},
        avgReview: p.avgReview ?? 'not recorded',
        avgClose: p.avgClose ?? 'not recorded',
        slaOverdueNow: p.slaOverdueNow ?? 0,
    };
    const prev = p.prev || {};

    // If server-side case data didn't yield themes, fall back to client payload categories
    if (caseThemes.length === 0 && Array.isArray(p.categories)) {
        caseThemes = p.categories.slice(0, 6).map(([category, count]) => ({ category, count }));
    }
    if (channels.length === 0 && Array.isArray(p.channels)) {
        channels = p.channels;
    }

    /* ── Build AI prompt via guidance module ──────────────────────────────── */

    const userMessage = buildUserMessage({
        orgName,
        periodStart,
        periodEnd,
        metrics,
        caseThemes,
        channels,
        riskBreakdown,
        totalLoss,
        scamConfirmed,
        decisions,
        prev,
    });

    /* ── Call OpenAI ─────────────────────────────────────────────────────────── */

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
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userMessage },
                ],
                temperature: 0.3,
                max_tokens: 2600,  // Increased from 1800 for 10 sections
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
            // Try to extract JSON from the response if wrapped in markdown
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

    const aiGeneratedAt = new Date().toISOString();

    try {
        // Fetch current metrics snapshot to merge aiNarrative into it (backward compat)
        const reportFetch = await fetch(
            `${SUPABASE_URL}/rest/v1/reports?select=metrics&id=eq.${reportId}&limit=1`,
            { headers: sbHeaders }
        );
        const reportRows = await reportFetch.json().catch(() => []);
        const currentMetrics = reportRows?.[0]?.metrics ?? {};

        const updatedMetrics = {
            ...currentMetrics,
            aiNarrative,
            ai_generated_at: aiGeneratedAt,
        };

        // Persist: metrics blob (backward compat) + top-level ai_narrative column + ai_generated_at
        const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/reports?id=eq.${reportId}`, {
            method: 'PATCH',
            headers: {
                ...sbHeaders,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
            },
            body: JSON.stringify({
                metrics: updatedMetrics,
                ai_narrative: aiNarrative,
                ai_generated_at: aiGeneratedAt,
                // Keep ai_summary in sync for backward compat
                ai_summary: aiNarrative.execSummary ?? null,
            }),
        });

        if (!patchRes.ok) {
            const patchErr = await patchRes.text();
            console.error('[reports-compose-ai] DB patch error:', patchErr);
            // Still return the AI narrative even if DB write fails
        } else {
            console.log('[reports-compose-ai] Narrative persisted successfully for report:', reportId);
        }
    } catch (err) {
        console.error('[reports-compose-ai] DB write error:', err);
    }

    return res.status(200).json({
        ok: true,
        aiNarrative,
        aiGeneratedAt,
        sections: Object.keys(aiNarrative),
    });
}
