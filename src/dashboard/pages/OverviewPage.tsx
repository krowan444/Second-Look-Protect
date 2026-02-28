import React, { useState, useEffect, useMemo } from 'react';
import {
    LayoutDashboard, AlertTriangle, ShieldCheck, Clock,
    TrendingUp, ArrowRight, Loader2, Info,
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
    organisation_id: string | null;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

/** Map DB status to human-friendly label */
function statusLabel(s: string | null): string {
    if (!s) return 'Unknown';
    if (s === 'submitted') return 'New';
    return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** CSS modifier for risk level */
function riskClass(level: string | null): string {
    switch (level?.toLowerCase()) {
        case 'high': return 'high';
        case 'medium': return 'medium';
        case 'low': return 'low';
        default: return 'unknown';
    }
}

/** CSS modifier for status */
function statusClass(s: string | null): string {
    switch (s?.toLowerCase()) {
        case 'new':
        case 'submitted': return 'new';
        case 'in_review': return 'review';
        case 'closed': return 'closed';
        default: return 'default';
    }
}

/** Format an ISO date to a short readable string */
function fmtDate(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
    } catch {
        return '—';
    }
}

/* ─── Overview Page ───────────────────────────────────────────────────────── */

export function OverviewPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);

    /* ── Fetch data on mount ───────────────────────────────────────────────── */
    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const supabase = getSupabase();

                // Get current user session
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) {
                    setError('Not authenticated');
                    setLoading(false);
                    return;
                }

                // Fetch profile to get organisation_id
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

                // This-month submissions
                const now = new Date();
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

                const { data: monthRows, error: mErr } = await supabase
                    .from('submissions')
                    .select('id, submitted_at, submission_type, status, risk_level, decision, category, organisation_id')
                    .eq('organisation_id', orgId)
                    .gte('submitted_at', monthStart)
                    .order('submitted_at', { ascending: false });

                if (mErr) throw mErr;

                // All non-closed submissions (for panels that aren't month-limited)
                const { data: allRows, error: aErr } = await supabase
                    .from('submissions')
                    .select('id, submitted_at, submission_type, status, risk_level, decision, category, organisation_id')
                    .eq('organisation_id', orgId)
                    .order('submitted_at', { ascending: false });

                if (aErr) throw aErr;

                if (!cancelled) {
                    setSubmissions(monthRows ?? []);
                    setAllSubmissions(allRows ?? []);
                    setLoading(false);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setError(err?.message ?? 'Failed to load data');
                    setLoading(false);
                }
            }
        }

        load();
        return () => { cancelled = true; };
    }, []);

    /* ── Computed metrics (this month) ─────────────────────────────────────── */
    const metrics = useMemo(() => {
        const total = submissions.length;
        const highRisk = submissions.filter((s) => s.risk_level?.toLowerCase() === 'high').length;

        const withDecision = submissions.filter((s) => s.decision && s.decision !== '');
        const scamCount = withDecision.filter((s) => s.decision?.toLowerCase() === 'scam').length;
        const legitCount = withDecision.filter((s) => s.decision?.toLowerCase() === 'legit').length;
        const decisionTotal = scamCount + legitCount;
        const scamPct = decisionTotal > 0 ? Math.round((scamCount / decisionTotal) * 100) : null;
        const legitPct = decisionTotal > 0 ? 100 - scamPct! : null;

        const AWAITING_STATUSES = ['new', 'submitted', 'in_review'];
        const awaiting = submissions.filter(
            (s) => s.status && AWAITING_STATUSES.includes(s.status.toLowerCase())
        ).length;

        return { total, highRisk, scamPct, legitPct, decisionTotal, awaiting };
    }, [submissions]);

    /* ── Panel data ────────────────────────────────────────────────────────── */
    const panels = useMemo(() => {
        const AWAITING_STATUSES = ['new', 'submitted', 'in_review'];

        const awaitingReview = allSubmissions
            .filter((s) => s.status && s.status.toLowerCase() !== 'closed')
            .filter((s) => AWAITING_STATUSES.includes((s.status ?? '').toLowerCase()))
            .slice(0, 5);

        const highRiskQueue = allSubmissions
            .filter((s) => s.risk_level?.toLowerCase() === 'high' && s.status?.toLowerCase() !== 'closed')
            .slice(0, 5);

        const recentCases = allSubmissions.slice(0, 5);

        return { awaitingReview, highRiskQueue, recentCases };
    }, [allSubmissions]);

    /* ── Calm insight ──────────────────────────────────────────────────────── */
    const insight = useMemo(() => {
        if (submissions.length === 0) return null;

        // Most common category
        const catCounts: Record<string, number> = {};
        for (const s of submissions) {
            const cat = s.category ?? 'Uncategorised';
            catCounts[cat] = (catCounts[cat] || 0) + 1;
        }
        const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';
        const highRisk = metrics.highRisk;

        return `This month saw ${submissions.length} incident${submissions.length !== 1 ? 's' : ''}. Most common category: ${topCategory}. High-risk: ${highRisk}.`;
    }, [submissions, metrics]);

    /* ── Render ─────────────────────────────────────────────────────────────── */
    if (loading) {
        return (
            <div className="dashboard-overview-loading">
                <Loader2 className="dashboard-overview-spinner-icon" />
                <p>Loading overview…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <div className="dashboard-page-header">
                    <h1 className="dashboard-page-title">Overview</h1>
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
            {/* Header */}
            <div className="dashboard-page-header">
                <h1 className="dashboard-page-title">Overview</h1>
                <p className="dashboard-page-subtitle">
                    Your organisation's activity this month at a glance.
                </p>
            </div>

            {/* ── Stat Cards ────────────────────────────────────────────────── */}
            <div className="dashboard-overview-cards">
                <div className="dashboard-stat-card">
                    <div className="dashboard-stat-card-accent accent-blue" />
                    <div className="dashboard-stat-card-body">
                        <div className="dashboard-stat-icon blue">
                            <LayoutDashboard size={20} />
                        </div>
                        <div className="dashboard-stat-value">{metrics.total}</div>
                        <div className="dashboard-stat-label">Total Cases</div>
                        <div className="dashboard-stat-period">This month</div>
                    </div>
                </div>

                <div className="dashboard-stat-card">
                    <div className="dashboard-stat-card-accent accent-red" />
                    <div className="dashboard-stat-card-body">
                        <div className="dashboard-stat-icon red">
                            <AlertTriangle size={20} />
                        </div>
                        <div className="dashboard-stat-value">{metrics.highRisk}</div>
                        <div className="dashboard-stat-label">High Risk</div>
                        <div className="dashboard-stat-period">This month</div>
                    </div>
                </div>

                <div className="dashboard-stat-card">
                    <div className="dashboard-stat-card-accent accent-gold" />
                    <div className="dashboard-stat-card-body">
                        <div className="dashboard-stat-icon gold">
                            <ShieldCheck size={20} />
                        </div>
                        <div className="dashboard-stat-value">
                            {metrics.decisionTotal > 0
                                ? `${metrics.scamPct}% / ${metrics.legitPct}%`
                                : '—'}
                        </div>
                        <div className="dashboard-stat-label">Scam vs Legit</div>
                        <div className="dashboard-stat-period">
                            {metrics.decisionTotal > 0
                                ? `${metrics.decisionTotal} decided`
                                : 'No decisions yet'}
                        </div>
                    </div>
                </div>

                <div className="dashboard-stat-card">
                    <div className="dashboard-stat-card-accent accent-amber" />
                    <div className="dashboard-stat-card-body">
                        <div className="dashboard-stat-icon amber">
                            <Clock size={20} />
                        </div>
                        <div className="dashboard-stat-value">{metrics.awaiting}</div>
                        <div className="dashboard-stat-label">Awaiting Review</div>
                        <div className="dashboard-stat-period">All open</div>
                    </div>
                </div>
            </div>

            {/* ── Insight Box ───────────────────────────────────────────────── */}
            {insight && (
                <div className="dashboard-insight-box">
                    <Info size={16} className="dashboard-insight-icon" />
                    <span>{insight}</span>
                </div>
            )}

            {/* ── Panels ────────────────────────────────────────────────────── */}
            <div className="dashboard-overview-panels">
                {/* Cases Awaiting Review */}
                <div className="dashboard-panel">
                    <div className="dashboard-panel-header">
                        <h2 className="dashboard-panel-title">
                            <Clock size={16} className="dashboard-panel-title-icon" />
                            Cases Awaiting Review
                        </h2>
                        <span className="dashboard-panel-count">{panels.awaitingReview.length}</span>
                    </div>
                    {panels.awaitingReview.length === 0 ? (
                        <div className="dashboard-panel-empty">No cases awaiting review.</div>
                    ) : (
                        <div className="dashboard-panel-table-wrap">
                            <table className="dashboard-panel-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Type</th>
                                        <th>Status</th>
                                        <th>Risk</th>
                                        <th>Category</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {panels.awaitingReview.map((s) => (
                                        <tr key={s.id}>
                                            <td>{fmtDate(s.submitted_at)}</td>
                                            <td>{s.submission_type ?? '—'}</td>
                                            <td>
                                                <span className={`dashboard-status-badge status-${statusClass(s.status)}`}>
                                                    {statusLabel(s.status)}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`dashboard-risk-badge risk-${riskClass(s.risk_level)}`}>
                                                    {s.risk_level ?? '—'}
                                                </span>
                                            </td>
                                            <td>{s.category ?? '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* High-Risk Queue */}
                <div className="dashboard-panel">
                    <div className="dashboard-panel-header">
                        <h2 className="dashboard-panel-title">
                            <AlertTriangle size={16} className="dashboard-panel-title-icon" />
                            High-Risk Queue
                        </h2>
                        <span className="dashboard-panel-count">{panels.highRiskQueue.length}</span>
                    </div>
                    {panels.highRiskQueue.length === 0 ? (
                        <div className="dashboard-panel-empty">No high-risk cases open — looking good.</div>
                    ) : (
                        <div className="dashboard-panel-table-wrap">
                            <table className="dashboard-panel-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Type</th>
                                        <th>Status</th>
                                        <th>Category</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {panels.highRiskQueue.map((s) => (
                                        <tr key={s.id}>
                                            <td>{fmtDate(s.submitted_at)}</td>
                                            <td>{s.submission_type ?? '—'}</td>
                                            <td>
                                                <span className={`dashboard-status-badge status-${statusClass(s.status)}`}>
                                                    {statusLabel(s.status)}
                                                </span>
                                            </td>
                                            <td>{s.category ?? '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Recent Cases */}
                <div className="dashboard-panel">
                    <div className="dashboard-panel-header">
                        <h2 className="dashboard-panel-title">
                            <TrendingUp size={16} className="dashboard-panel-title-icon" />
                            Recent Cases
                        </h2>
                        <span className="dashboard-panel-count">{panels.recentCases.length}</span>
                    </div>
                    {panels.recentCases.length === 0 ? (
                        <div className="dashboard-panel-empty">No cases submitted yet.</div>
                    ) : (
                        <div className="dashboard-panel-table-wrap">
                            <table className="dashboard-panel-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Type</th>
                                        <th>Status</th>
                                        <th>Risk</th>
                                        <th>Category</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {panels.recentCases.map((s) => (
                                        <tr key={s.id}>
                                            <td>{fmtDate(s.submitted_at)}</td>
                                            <td>{s.submission_type ?? '—'}</td>
                                            <td>
                                                <span className={`dashboard-status-badge status-${statusClass(s.status)}`}>
                                                    {statusLabel(s.status)}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`dashboard-risk-badge risk-${riskClass(s.risk_level)}`}>
                                                    {s.risk_level ?? '—'}
                                                </span>
                                            </td>
                                            <td>{s.category ?? '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
