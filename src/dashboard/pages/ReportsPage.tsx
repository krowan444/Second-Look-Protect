import React, { useState, useEffect, useMemo } from 'react';
import {
    BarChart3, Loader2, AlertTriangle, Copy, Download,
    Calendar, ShieldAlert, PieChart, Users, CheckCircle2,
    TrendingUp, Info,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface Submission {
    id: string;
    submitted_at: string;
    submission_type: string | null;
    status: string | null;
    risk_level: string | null;
    decision: string | null;
    category: string | null;
    outcome: string | null;
    resident_ref: string | null;
    loss_amount?: number | null;
}

interface OrgSettings {
    timezone: string | null;
    report_recipients: string[] | null;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

/** Build month options for the last 12 months */
function buildMonthOptions(): { value: string; label: string }[] {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        opts.push({
            value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
            label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        });
    }
    return opts;
}

/** Get month start/end ISO strings in a given timezone */
function monthBoundaries(yearMonth: string, tz: string): { start: string; end: string } {
    const [y, m] = yearMonth.split('-').map(Number);
    // Create dates in the org timezone using Intl
    // Fallback: just use UTC-based ISO boundaries
    try {
        const startDate = new Date(y, m - 1, 1);
        const endDate = new Date(y, m, 1); // first day of next month
        return {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
        };
    } catch {
        const startDate = new Date(y, m - 1, 1);
        const endDate = new Date(y, m, 1);
        return {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
        };
    }
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ─── Reports Page ───────────────────────────────────────────────────────── */

export function ReportsPage() {
    const monthOptions = useMemo(() => buildMonthOptions(), []);
    const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [recentSubs, setRecentSubs] = useState<Submission[]>([]); // last 30 days for repeat targeting
    const [orgSettings, setOrgSettings] = useState<OrgSettings>({ timezone: null, report_recipients: null });
    const [copied, setCopied] = useState(false);

    /* ── Fetch data ─────────────────────────────────────────────────────────── */
    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);
            try {
                const supabase = getSupabase();

                // 1. current session
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) { setError('Not authenticated'); setLoading(false); return; }

                // 2. profile → org
                const { data: profile, error: profErr } = await supabase
                    .from('profiles')
                    .select('organisation_id')
                    .eq('id', session.user.id)
                    .single();
                if (profErr || !profile?.organisation_id) {
                    setError('Could not determine your organisation.');
                    setLoading(false);
                    return;
                }
                const orgId = profile.organisation_id;

                // 3. org settings (timezone + recipients)
                const { data: settings } = await supabase
                    .from('organisation_settings')
                    .select('timezone, report_recipients')
                    .eq('organisation_id', orgId)
                    .single();

                const tz = settings?.timezone ?? 'Europe/London';
                if (!cancelled) {
                    setOrgSettings({
                        timezone: tz,
                        report_recipients: settings?.report_recipients ?? null,
                    });
                }

                // 4. Submissions for selected month
                const { start, end } = monthBoundaries(selectedMonth, tz);
                const { data: monthRows, error: mErr } = await supabase
                    .from('submissions')
                    .select('id, submitted_at, submission_type, status, risk_level, decision, category, outcome, resident_ref, loss_amount')
                    .eq('organisation_id', orgId)
                    .gte('submitted_at', start)
                    .lt('submitted_at', end)
                    .order('submitted_at', { ascending: false });
                if (mErr) throw mErr;

                // 5. Last-30-day submissions (for repeat targeting check)
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
                const { data: recentRows, error: rErr } = await supabase
                    .from('submissions')
                    .select('id, submitted_at, risk_level, resident_ref')
                    .eq('organisation_id', orgId)
                    .gte('submitted_at', thirtyDaysAgo)
                    .not('resident_ref', 'is', null);
                if (rErr) throw rErr;

                if (!cancelled) {
                    setSubmissions(monthRows ?? []);
                    setRecentSubs((recentRows ?? []) as Submission[]);
                    setLoading(false);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setError(err?.message ?? 'Failed to load report data');
                    setLoading(false);
                }
            }
        }

        load();
        return () => { cancelled = true; };
    }, [selectedMonth]);

    /* ── Derived metrics ────────────────────────────────────────────────────── */
    const metrics = useMemo(() => {
        const total = submissions.length;
        const highRisk = submissions.filter(s => s.risk_level?.toLowerCase() === 'high').length;

        // Scam vs Legit
        const withDecision = submissions.filter(s => s.decision && s.decision !== '');
        const scamCount = withDecision.filter(s => s.decision?.toLowerCase() === 'scam').length;
        const legitCount = withDecision.filter(s => s.decision?.toLowerCase() === 'legit').length;
        const decisionTotal = scamCount + legitCount;
        const scamPct = decisionTotal > 0 ? Math.round((scamCount / decisionTotal) * 100) : null;
        const legitPct = decisionTotal > 0 ? 100 - scamPct! : null;

        // Category breakdown
        const categoryMap: Record<string, number> = {};
        for (const s of submissions) {
            const cat = s.category ?? 'Uncategorised';
            categoryMap[cat] = (categoryMap[cat] || 0) + 1;
        }
        const categories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

        // Outcomes breakdown
        const outcomeMap: Record<string, number> = {};
        for (const s of submissions) {
            const out = s.outcome ?? 'none';
            outcomeMap[out] = (outcomeMap[out] || 0) + 1;
        }
        const outcomes = Object.entries(outcomeMap).sort((a, b) => b[1] - a[1]);

        // Loss amount
        const totalLoss = submissions
            .filter(s => s.outcome?.toLowerCase() === 'lost' && s.loss_amount != null)
            .reduce((sum, s) => sum + (Number(s.loss_amount) || 0), 0);
        const hasLossData = submissions.some(s => s.loss_amount != null);

        // Top category & outcome counts for narrative
        const topCategory = categories[0]?.[0] ?? 'N/A';
        const prevented = outcomeMap['prevented'] ?? 0;
        const lost = outcomeMap['lost'] ?? 0;
        const escalated = outcomeMap['escalated'] ?? 0;

        return {
            total, highRisk,
            scamCount, legitCount, scamPct, legitPct, decisionTotal,
            categories, outcomes,
            totalLoss, hasLossData,
            topCategory, prevented, lost, escalated,
        };
    }, [submissions]);

    // Repeated-targeting residents
    const repeatedTargets = useMemo(() => {
        const grouped: Record<string, { total: number; highRisk: number }> = {};
        for (const s of recentSubs) {
            if (!s.resident_ref) continue;
            if (!grouped[s.resident_ref]) grouped[s.resident_ref] = { total: 0, highRisk: 0 };
            grouped[s.resident_ref].total++;
            if (s.risk_level?.toLowerCase() === 'high') grouped[s.resident_ref].highRisk++;
        }
        return Object.entries(grouped)
            .filter(([, v]) => v.total >= 3 || v.highRisk >= 2)
            .map(([ref, v]) => ({ ref, ...v }));
    }, [recentSubs]);

    // Narrative paragraph
    const narrative = useMemo(() => {
        if (metrics.total === 0) return 'No incidents were recorded this month.';
        return `This month saw ${metrics.total} incident${metrics.total !== 1 ? 's' : ''}. Most common category: ${metrics.topCategory}. High-risk: ${metrics.highRisk}. Outcomes: prevented ${metrics.prevented}, lost ${metrics.lost}, escalated ${metrics.escalated}.`;
    }, [metrics]);

    /* ── Copy Summary ───────────────────────────────────────────────────────── */
    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(narrative);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* clipboard not available */ }
    }

    /* ── Render ─────────────────────────────────────────────────────────────── */

    if (loading) {
        return (
            <div className="dashboard-overview-loading">
                <Loader2 className="dashboard-overview-spinner-icon" />
                <p>Loading report…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <div className="dashboard-page-header">
                    <h1 className="dashboard-page-title">Reports</h1>
                </div>
                <div className="dashboard-overview-error">
                    <AlertTriangle size={20} />
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Header + month selector */}
            <div className="dashboard-page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="dashboard-page-title">Reports</h1>
                    <p className="dashboard-page-subtitle">
                        Safeguarding activity report — derived from submissions data.
                    </p>
                </div>
                <div className="dashboard-reports-month-select">
                    <Calendar size={16} />
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="dashboard-reports-select"
                    >
                        {monthOptions.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ── Stat Cards ────────────────────────────────────────────────── */}
            <div className="dashboard-overview-cards">
                <div className="dashboard-stat-card">
                    <div className="dashboard-stat-card-accent accent-blue" />
                    <div className="dashboard-stat-card-body">
                        <div className="dashboard-stat-icon blue"><BarChart3 size={20} /></div>
                        <div className="dashboard-stat-value">{metrics.total}</div>
                        <div className="dashboard-stat-label">Total Cases</div>
                    </div>
                </div>
                <div className="dashboard-stat-card">
                    <div className="dashboard-stat-card-accent accent-red" />
                    <div className="dashboard-stat-card-body">
                        <div className="dashboard-stat-icon red"><ShieldAlert size={20} /></div>
                        <div className="dashboard-stat-value">{metrics.highRisk}</div>
                        <div className="dashboard-stat-label">High Risk</div>
                    </div>
                </div>
                <div className="dashboard-stat-card">
                    <div className="dashboard-stat-card-accent accent-gold" />
                    <div className="dashboard-stat-card-body">
                        <div className="dashboard-stat-icon gold"><PieChart size={20} /></div>
                        <div className="dashboard-stat-value">
                            {metrics.decisionTotal > 0
                                ? `${metrics.scamPct}% / ${metrics.legitPct}%`
                                : '—'}
                        </div>
                        <div className="dashboard-stat-label">Scam vs Legit</div>
                        <div className="dashboard-stat-period">
                            {metrics.decisionTotal > 0 ? `${metrics.decisionTotal} decided` : 'No decisions yet'}
                        </div>
                    </div>
                </div>
                <div className="dashboard-stat-card">
                    <div className="dashboard-stat-card-accent accent-amber" />
                    <div className="dashboard-stat-card-body">
                        <div className="dashboard-stat-icon amber"><TrendingUp size={20} /></div>
                        <div className="dashboard-stat-value">
                            {metrics.hasLossData ? `£${metrics.totalLoss.toLocaleString()}` : 'N/A'}
                        </div>
                        <div className="dashboard-stat-label">Total Loss</div>
                        <div className="dashboard-stat-period">Where outcome = lost</div>
                    </div>
                </div>
            </div>

            {/* ── Narrative ──────────────────────────────────────────────────── */}
            <div className="dashboard-reports-narrative">
                <Info size={16} className="dashboard-insight-icon" />
                <span>{narrative}</span>
            </div>

            {/* ── Action bar ─────────────────────────────────────────────────── */}
            <div className="dashboard-reports-actions">
                <button className="dashboard-reports-action-btn" onClick={handleCopy}>
                    {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied!' : 'Copy Summary'}
                </button>
                <button className="dashboard-reports-action-btn dashboard-reports-action-btn--disabled" disabled>
                    <Download size={16} />
                    Export PDF — coming soon
                </button>
            </div>

            {/* ── Breakdowns ─────────────────────────────────────────────────── */}
            <div className="dashboard-reports-breakdowns">

                {/* Category Breakdown */}
                <div className="dashboard-panel">
                    <div className="dashboard-panel-header">
                        <h2 className="dashboard-panel-title">
                            <PieChart size={16} className="dashboard-panel-title-icon" />
                            Category Breakdown
                        </h2>
                    </div>
                    {metrics.categories.length === 0 ? (
                        <div className="dashboard-panel-empty">No data for this period.</div>
                    ) : (
                        <div className="dashboard-panel-table-wrap">
                            <table className="dashboard-panel-table">
                                <thead>
                                    <tr><th>Category</th><th>Count</th><th>%</th></tr>
                                </thead>
                                <tbody>
                                    {metrics.categories.map(([cat, count]) => (
                                        <tr key={cat}>
                                            <td>{capitalize(cat)}</td>
                                            <td>{count}</td>
                                            <td>{metrics.total > 0 ? `${Math.round((count / metrics.total) * 100)}%` : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Outcomes Breakdown */}
                <div className="dashboard-panel">
                    <div className="dashboard-panel-header">
                        <h2 className="dashboard-panel-title">
                            <TrendingUp size={16} className="dashboard-panel-title-icon" />
                            Outcomes Breakdown
                        </h2>
                    </div>
                    {metrics.outcomes.length === 0 ? (
                        <div className="dashboard-panel-empty">No data for this period.</div>
                    ) : (
                        <div className="dashboard-panel-table-wrap">
                            <table className="dashboard-panel-table">
                                <thead>
                                    <tr><th>Outcome</th><th>Count</th><th>%</th></tr>
                                </thead>
                                <tbody>
                                    {metrics.outcomes.map(([out, count]) => (
                                        <tr key={out}>
                                            <td>{capitalize(out)}</td>
                                            <td>{count}</td>
                                            <td>{metrics.total > 0 ? `${Math.round((count / metrics.total) * 100)}%` : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Repeated Targeting ─────────────────────────────────────────── */}
            <div className="dashboard-panel" style={{ marginTop: '1.25rem' }}>
                <div className="dashboard-panel-header">
                    <h2 className="dashboard-panel-title">
                        <Users size={16} className="dashboard-panel-title-icon" />
                        Repeated Targeting Alerts
                    </h2>
                    <span className="dashboard-panel-count">{repeatedTargets.length}</span>
                </div>
                {repeatedTargets.length === 0 ? (
                    <div className="dashboard-panel-empty">
                        No residents flagged for repeated targeting in the last 30 days.
                    </div>
                ) : (
                    <div className="dashboard-panel-table-wrap">
                        <table className="dashboard-panel-table">
                            <thead>
                                <tr><th>Resident Ref</th><th>Cases (30d)</th><th>High-Risk (30d)</th><th>Flag Reason</th></tr>
                            </thead>
                            <tbody>
                                {repeatedTargets.map(r => (
                                    <tr key={r.ref}>
                                        <td><strong>{r.ref}</strong></td>
                                        <td>{r.total}</td>
                                        <td>{r.highRisk}</td>
                                        <td>
                                            <span className="dashboard-risk-badge risk-high" style={{ fontSize: '0.7rem' }}>
                                                {r.total >= 3 && r.highRisk >= 2
                                                    ? '≥3 cases + ≥2 high-risk'
                                                    : r.total >= 3
                                                        ? '≥3 cases in 30 days'
                                                        : '≥2 high-risk in 30 days'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Report Recipients (read-only) ──────────────────────────────── */}
            <div className="dashboard-reports-recipients">
                <h3 className="dashboard-reports-recipients-title">
                    Report Recipients
                </h3>
                {orgSettings.report_recipients && orgSettings.report_recipients.length > 0 ? (
                    <ul className="dashboard-reports-recipients-list">
                        {orgSettings.report_recipients.map((email, i) => (
                            <li key={i}>{email}</li>
                        ))}
                    </ul>
                ) : (
                    <p className="dashboard-reports-recipients-empty">
                        No report recipients configured. Add them in Settings.
                    </p>
                )}
            </div>
        </div>
    );
}
