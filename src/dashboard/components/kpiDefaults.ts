/* ── KPI Defaults & Colour Tokens ──────────────────────────────────────────
   Version 1 uses sensible hard-coded thresholds.
   Later these can be loaded from organisation_settings via Supabase.       */

// ── Status colour tokens (soft, premium, safeguarding-appropriate) ──────
export const KPI_COLORS = {
    green:  { ring: '#10b981', bg: '#ecfdf5', fg: '#065f46', label: 'On Track' },
    amber:  { ring: '#f59e0b', bg: '#fffbeb', fg: '#92400e', label: 'Needs Attention' },
    red:    { ring: '#ef4444', bg: '#fef2f2', fg: '#991b1b', label: 'Behind Target' },
    track:  '#e2e8f0',  // ring background track
} as const;

export type KpiStatus = 'green' | 'amber' | 'red';

// ── Default thresholds ──────────────────────────────────────────────────
// "higher is better" KPIs (percentage-based)
export const DEFAULTS = {
    closureWithinTargetDays: 7,         // green if closed within 7d
    closureWarningDays: 14,             // amber if closed within 14d, red > 14d
    triageWithinTargetHours: 24,        // green if triaged within 24h
    triageWarningHours: 48,             // amber within 48h, red > 48h
    reviewQueueGreen: 3,                // ≤ 3 = green
    reviewQueueAmber: 6,                // ≤ 6 = amber, > 6 = red
    highRiskPctGreen: 10,               // ≤ 10% = green
    highRiskPctAmber: 25,               // ≤ 25% = amber, > 25% = red
    docCompletenessGreen: 80,           // ≥ 80% = green
    docCompletenessAmber: 50,           // ≥ 50% = amber, < 50% = red
} as const;

// ── Helper: determine status from a "higher is better" percentage ───────
export function getStatusHigherBetter(pct: number, greenThreshold: number, amberThreshold: number): KpiStatus {
    if (pct >= greenThreshold) return 'green';
    if (pct >= amberThreshold) return 'amber';
    return 'red';
}

// ── Helper: determine status from a "lower is better" count ─────────────
export function getStatusLowerBetter(value: number, greenMax: number, amberMax: number): KpiStatus {
    if (value <= greenMax) return 'green';
    if (value <= amberMax) return 'amber';
    return 'red';
}
