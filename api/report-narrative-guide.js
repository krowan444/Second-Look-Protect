// /api/report-narrative-guide.js
//
// ─── AI NARRATIVE GUIDANCE MODULE ────────────────────────────────────────────
// Isolated guidance layer for the safeguarding report AI narrative system.
// To update the AI tone, sections, or instructions, edit ONLY this file.
// Consumed by: reports-compose-ai.js
// Do NOT import this from any frontend component — backend only.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * System prompt — defines the AI's role, tone, and strict rules.
 * Update this to refine the overall narrative quality or tone.
 */
export const SYSTEM_PROMPT = `You are a professional safeguarding intelligence analyst and report writer for a UK registered care home inspection platform. Your role is to produce polished, inspection-grade safeguarding narrative from structured case data.

TONE AND STYLE RULES:
- Write clearly and professionally in plain UK English.
- Suitable for: care home managers, safeguarding leads, group oversight, CQC-style inspectors, and governance boards.
- Serious, concise, and intelligent. Not flashy. Not exaggerated. Not like a consumer AI.
- Every sentence must earn its place. Avoid padding and generic filler.
- Do not invent or embellish statistics, case outcomes, or threats.

CONTENT RULES:
- Write only from the data provided. Never invent cases, categories, or risk levels.
- Never mention internal system names, database fields, or technical platform internals.
- If data is sparse (few cases, minimal categories), still write complete professional paragraphs that accurately reflect the quieter period — do not hallucinate activity.
- Do not repeat the same fact across multiple sections.
- Use grounded language for scam or threat patterns: "may indicate", "suggests", "consistent with", "pattern of concern" — never overstate certainty.
- Recommendations must be practical and actionable, not generic boilerplate.

SECTION STRUCTURE:
Return a valid JSON object with exactly these 10 string keys. No markdown, no code fences, no explanation — just raw JSON:

{
  "execSummary": "2-3 sentence executive overview of the reporting period — total caseload, risk posture, and one headline observation",
  "safeguardingTrends": "paragraph on case volume, patterns, and trends vs prior period if available — note if volume is stable, rising, or falling and what that suggests",
  "emergingRisks": "paragraph on risk levels, high-risk concern categories, any emerging or escalating patterns — if no significant risks, state that clearly and professionally",
  "scamThemeInsight": "paragraph analysing scam-related patterns in the period — types of scam technique evident from categories and channels, any signs of social engineering or trust manipulation, whether patterns are consistent with AI-enabled or digitally sophisticated methods — use grounded language only, and state clearly if data shows no such patterns",
  "operationalPressure": "paragraph on review timelines, SLA compliance, open case volume, and whether operational capacity appears sufficient or under strain",
  "positiveSignals": "paragraph on what is working well — closures, low-risk outcomes, effective responses, signs of strong safeguarding culture",
  "defensiveRecommendations": "4-6 concise recommended defensive actions as a newline-separated list, each line starting with a dash and a space — mix of immediate actions, next-review items, and inspection-ready governance steps — practical and specific to this period's patterns",
  "recommendedActions": "3-4 broader recommended actions as a newline-separated list, each starting with a dash — suitable for leadership and governance review",
  "inspectionSummary": "1-2 sentence inspection-ready assessment of this period — suitable to read aloud to an inspector or governance lead",
  "leadershipSummary": "2-sentence summary for board or group leadership — confident, brief, clear"
}`;

/**
 * Builds the user-facing prompt from structured case context.
 * @param {object} context
 * @param {string} context.orgName
 * @param {string} context.periodStart  e.g. "2026-03-01"
 * @param {string} context.periodEnd    e.g. "2026-03-31"
 * @param {object} context.metrics      extracted metrics summary
 * @param {Array}  context.caseThemes   [{category, count, channel, riskLevel}] — top case themes from DB
 * @param {Array}  context.channels     [[channelName, count]] — top channels
 * @param {object} context.riskBreakdown {critical, high, medium, low}
 * @param {number} context.totalLoss    total loss_amount across period (£)
 * @param {number} context.scamConfirmed confirmed scam cases
 * @param {Array}  context.decisions    [[decisionLabel, count]]
 * @param {object} context.prev         prior period summary {total, highRisk}
 */
export function buildUserMessage(context) {
    const {
        orgName,
        periodStart,
        periodEnd,
        metrics = {},
        caseThemes = [],
        channels = [],
        riskBreakdown = {},
        totalLoss = 0,
        scamConfirmed = 0,
        decisions = [],
        prev = {},
    } = context;

    const byStatus = metrics.byStatus || {};
    const closureRate = metrics.total > 0 && byStatus.closed != null
        ? Math.round((byStatus.closed / metrics.total) * 100)
        : null;

    // Format case themes (top 6)
    const topThemes = caseThemes.slice(0, 6);
    const themesText = topThemes.length > 0
        ? topThemes.map(t => {
            const cat = t.category?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? 'Unknown';
            return `${cat} (${t.count} cases, risk: ${t.topRisk ?? 'mixed'}, channel: ${t.topChannel ?? 'various'})`;
        }).join('\n  ')
        : 'Not recorded';

    // Format channels
    const channelText = channels.length > 0
        ? channels.slice(0, 5).map(([ch, n]) => `${ch}: ${n}`).join(', ')
        : 'Not recorded';

    // Format decisions
    const decisionText = decisions.length > 0
        ? decisions.slice(0, 5).map(([d, n]) => `${d?.replace(/_/g, ' ')}: ${n}`).join(', ')
        : 'Not recorded';

    // Prior period comparison
    const prevTotal = typeof prev.total === 'number' ? prev.total : null;
    const prevHighRisk = typeof prev.highRisk === 'number' ? prev.highRisk : null;
    const caseDelta = prevTotal !== null ? (metrics.total ?? 0) - prevTotal : null;
    const highRiskDelta = prevHighRisk !== null ? (metrics.highRisk ?? 0) - prevHighRisk : null;

    const scamNote = scamConfirmed > 0
        ? `${scamConfirmed} case${scamConfirmed !== 1 ? 's' : ''} confirmed as scam or fraud-related this period.`
        : 'No cases confirmed as scam or fraud this period.';

    const lossNote = totalLoss > 0
        ? `Total estimated financial loss across reported cases: £${totalLoss.toLocaleString('en-GB')}.`
        : 'No financial losses recorded this period.';

    return `Generate a premium safeguarding intelligence narrative from this structured data.

Organisation: ${orgName}
Reporting Period: ${periodStart} to ${periodEnd}

── CASE VOLUME ──────────────────────────────────────────────
Total cases: ${metrics.total ?? 0}
New / open: ${byStatus.new ?? 0}
In review: ${byStatus.in_review ?? 0}
Closed: ${byStatus.closed ?? 0}
Closure rate: ${closureRate !== null ? closureRate + '%' : 'unknown'}

── RISK PROFILE ─────────────────────────────────────────────
High or critical risk cases: ${metrics.highRisk ?? 0}
  - Critical: ${riskBreakdown.critical ?? 0}
  - High: ${riskBreakdown.high ?? 0}
  - Medium: ${riskBreakdown.medium ?? 0}
  - Low or routine: ${riskBreakdown.low ?? 0}
SLA overdue (open >3 days): ${metrics.slaOverdueNow ?? 0}

── SCAM AND FRAUD INDICATORS ────────────────────────────────
${scamNote}
${lossNote}

── CASE THEMES AND CHANNELS ─────────────────────────────────
Top categories by case theme:
  ${themesText}

Reporting channels used:
  ${channelText}

Decision outcomes:
  ${decisionText}

── RESPONSE METRICS ─────────────────────────────────────────
Average time to first review: ${metrics.avgReview ?? 'not recorded'}
Average time to close: ${metrics.avgClose ?? 'not recorded'}

${prevTotal !== null ? `── PRIOR PERIOD COMPARISON ──────────────────────────────────
Previous period total: ${prevTotal}
Case volume change: ${caseDelta !== null ? (caseDelta >= 0 ? '+' : '') + caseDelta : 'unknown'}
Previous period high/critical: ${prevHighRisk ?? 'unknown'}
High-risk change: ${highRiskDelta !== null ? (highRiskDelta >= 0 ? '+' : '') + highRiskDelta : 'unknown'}` : '── PRIOR PERIOD: not available for this report ──────────────'}`;
}
