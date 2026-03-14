/* ═══════════════════════════════════════════════════════════════════════════
   Stape-Lee — Metric Definitions Dictionary
   ═══════════════════════════════════════════════════════════════════════════
   Plain-English explanations of dashboard metrics so Stape-Lee can explain
   what each value means when a user asks.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface MetricDef {
    label: string;
    definition: string;
    /** What "good" looks like */
    good: string;
    /** What "bad" looks like */
    bad: string;
}

export const metricDefinitions: Record<string, MetricDef> = {
    totalCases: {
        label: 'Total Cases',
        definition: 'The total number of safeguarding concerns submitted in the current period.',
        good: 'A stable or decreasing number suggests effective prevention.',
        bad: 'A sudden spike may indicate a new threat pattern or increased awareness.',
    },
    openCases: {
        label: 'Open Cases',
        definition: 'Cases that have not yet been closed or resolved. Includes cases in review and awaiting decision.',
        good: 'A low count relative to total cases shows efficient case handling.',
        bad: 'A high or growing count means cases are piling up without resolution.',
    },
    highRisk: {
        label: 'High-Risk Cases',
        definition: 'Cases flagged as High or Critical risk by the AI triage or admin review.',
        good: 'Zero or very few high-risk cases open at any time.',
        bad: 'Multiple open high-risk cases need immediate attention and prioritisation.',
    },
    overdue: {
        label: 'Overdue Cases',
        definition: 'Cases that have exceeded the target response time (SLA) without being closed.',
        good: 'Zero overdue cases — all cases handled within target.',
        bad: 'Overdue cases signal response time failures that inspectors will flag.',
    },
    closureRate: {
        label: 'Closure Rate',
        definition: 'The percentage of cases closed within the target timeframe.',
        good: 'Above 90% indicates strong case management.',
        bad: 'Below 70% suggests a backlog or slow decision-making.',
    },
    awaitingReview: {
        label: 'Awaiting Review',
        definition: 'Cases submitted and AI-triaged but not yet reviewed by an admin.',
        good: 'A count of 0–2 means the queue is under control.',
        bad: 'A count above 5 means the review queue is at risk of SLA breach.',
    },
    overallHealth: {
        label: 'Overall Health',
        definition: 'A composite score combining closure rate, triage speed, documentation completeness, and queue depth.',
        good: '80%+ (green) means the organisation is performing well.',
        bad: 'Below 60% (red) means multiple safeguarding areas need urgent improvement.',
    },
    totalLoss: {
        label: 'Total Financial Loss',
        definition: 'The sum of reported financial losses across all cases in the period.',
        good: 'A low or stable figure suggests effective prevention.',
        bad: 'A high or rising figure means residents are suffering significant financial harm.',
    },
    avgResponseTime: {
        label: 'Average Response Time',
        definition: 'The average number of days between case submission and first admin review.',
        good: 'Under 2 days shows prompt safeguarding response.',
        bad: 'Over 5 days suggests resource constraints or process gaps.',
    },
    homes: {
        label: 'Homes',
        definition: 'The number of care homes or sites in this group.',
        good: 'N/A — purely informational.',
        bad: 'N/A — purely informational.',
    },
    pressureScore: {
        label: 'Pressure Score',
        definition: 'A composite measure of safeguarding workload intensity considering case volume, risk levels, and response times.',
        good: 'Low (green) — workload is manageable.',
        bad: 'High (red) — the organisation is under significant safeguarding pressure.',
    },
    queue: {
        label: 'Queue',
        definition: 'The number of cases currently sitting in the review queue waiting for admin action. Shown as a count on the Overview page.',
        good: '0–2 cases in queue — reviews are keeping pace with submissions.',
        bad: '5+ cases in queue — risk of SLA breaches and delayed safeguarding responses.',
    },
    triage: {
        label: 'Triage',
        definition: 'The percentage of submitted cases that have been triaged (risk-assessed and categorised) by the AI or an admin.',
        good: '90%+ means nearly all cases have been assessed promptly.',
        bad: 'Below 70% means cases are sitting unassessed, delaying appropriate safeguarding action.',
    },
    documented: {
        label: 'Documented',
        definition: 'The percentage of cases that have complete documentation — decisions recorded, actions logged, and outcomes noted.',
        good: '90%+ means the organisation has strong record-keeping for inspectors.',
        bad: 'Below 70% means documentation gaps that will be flagged during inspections.',
    },
    elevatedRisk: {
        label: 'Elevated Risk',
        definition: 'The system status banner on the Overview page. It turns amber or red when there are high-risk or critical-severity cases, SLA breaches, or urgent alerts.',
        good: '"All Clear" (green) — no elevated risk factors detected.',
        bad: '"Elevated Risk" (amber) or "Immediate Attention Required" (red) — urgent safeguarding issues need review.',
    },
};

/**
 * Look up a metric definition by searching label or key.
 * Returns null if not found.
 */
export function findMetricDef(query: string): MetricDef | null {
    const q = query.toLowerCase();
    for (const [key, def] of Object.entries(metricDefinitions)) {
        if (q.includes(key.toLowerCase()) || q.includes(def.label.toLowerCase())) {
            return def;
        }
    }
    return null;
}
