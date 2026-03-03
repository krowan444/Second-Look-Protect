import React, { useState, useEffect, useMemo } from 'react';
import {
    LayoutDashboard, AlertTriangle, ShieldCheck, Clock,
    TrendingUp, Loader2, Info, Bell,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface CaseRow {
    id: string;
    submitted_at: string;
    submission_type: string | null;
    status: string | null;
    risk_level: string | null;
    decision: string | null;
    category: string | null;
    organisation_id: string | null;
}

interface AlertEntry {
    id: string;
    event_type: string;
    entity_type: string | null;
    severity: string | null;
    sent_at: string;
}

interface ExecAlert {
    id: string;
    event_type: string;
    severity: string | null;
    title: string | null;
    description: string | null;
    recommendation: string | null;
    sent_at: string | null;
    last_triggered_at: string | null;
    meta: any;
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
        case 'critical': return 'high'; // reuse existing high styling if you don't have a 'critical' class yet
        case 'high': return 'high';
        case 'medium': return 'medium';
        case 'low': return 'low';
        default: return 'unknown';
    }
}

/** CSS modifier for alert severity */
function severityRiskClass(sev: string | null): string {
    switch (sev?.toLowerCase()) {
        case 'critical': return 'high';
        case 'high': return 'high';
        case 'warning': return 'medium';
        case 'info': return 'low';
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
    const [noOrg, setNoOrg] = useState(false);

    // Canonical source of truth: CASES
    const [casesMonth, setCasesMonth] = useState<CaseRow[]>([]);
    const [casesAll, setCasesAll] = useState<CaseRow[]>([]);
    const [alerts, setAlerts] = useState<AlertEntry[]>([]);
    const [execAlerts, setExecAlerts] = useState<ExecAlert[]>([]);

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

                // Fetch profile to get organisation_id and role
                const { data: profile, error: profErr } = await supabase
                    .from('profiles')
                    .select('organisation_id, role')
                    .eq('id', session.user.id)
                    .single();

                if (profErr) {
                    setError('Could not load profile.');
                    setLoading(false);
                    return;
                }

                // Resolve org: super_admin uses the org switcher
                let orgId = profile?.organisation_id ?? null;
                if (profile?.role === 'super_admin') {
                    const switcherOrg =
                        localStorage.getItem('slp_viewing_as_org_id') ||
                        localStorage.getItem('slp_active_org_id');
                    if (switcherOrg) orgId = switcherOrg;
                }

                if (!orgId) {
                    // No org selected — show friendly empty state
                    setNoOrg(true);
                    setLoading(false);
                    return;
                }

                // This-month cases
                const now = new Date();
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

                const { data: monthRows, error: mErr } = await supabase
                    .from('cases')
                    .select('id, submitted_at, submission_type, status, risk_level, decision, category, organisation_id')
                    .eq('organisation_id', orgId)
                    .gte('submitted_at', monthStart)
                    .order('submitted_at', { ascending: false });

                if (mErr) throw mErr;

                // All cases (for panels that aren't month-limited)
                const { data: allRows, error: aErr } = await supabase
                    .from('cases')
                    .select('id, submitted_at, submission_type, status, risk_level, decision, category, organisation_id')
                    .eq('organisation_id', orgId)
                    .order('submitted_at', { ascending: false });

                if (aErr) throw aErr;

                if (!cancelled) {
                    setCasesMonth((monthRows ?? []) as CaseRow[]);
                    setCasesAll((allRows ?? []) as CaseRow[]);
                }

                // Fetch safeguarding alerts (last 14 days)
                const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
                const { data: alertRows } = await supabase
                    .from('alert_log')
                    .select('id, event_type, entity_type, severity, sent_at')
                    .eq('organisation_id', orgId)
                    .gte('sent_at', fourteenDaysAgo)
                    .order('sent_at', { ascending: false })
                    .limit(5);

                if (!cancelled) {
                    setAlerts((alertRows ?? []) as AlertEntry[]);
                }

                // Fetch executive safeguarding alerts via RPC
                const { data: execRows } = await supabase.rpc('get_executive_alerts', {
                    p_org_id: orgId,
                });
                if (!cancelled) {
                    setExecAlerts(((execRows ?? []) as ExecAlert[]).slice(0, 3));
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
        const total = casesMonth.length;

        // High risk includes HIGH + CRITICAL (matches your reports logic)
        const highRisk = casesMonth.filter((c) =>
            ['high', 'critical'].includes((c.risk_level ?? '').toLowerCase())
        ).length;

        const withDecision = casesMonth.filter((c) => (c.decision ?? '').trim() !== '');
        const scamCount = withDecision.filter((c) => c.decision?.toLowerCase() === 'scam').length;

        // Your system uses not_scam (not "legit")
        const notScamCount = withDecision.filter((c) => c.decision?.toLowerCase() === 'not_scam').length;

        const decisionTotal = scamCount + notScamCount;
        const scamPct = decisionTotal > 0 ? Math.round((scamCount / decisionTotal) * 100) : null;
        const legitPct = decisionTotal > 0 ? 100 - (scamPct ?? 0) : null;

        const AWAITING_STATUSES = ['new', 'submitted', 'in_review'];
        const awaiting = casesMonth.filter(
            (c) => c.status && AWAITING_STATUSES.includes(c.status.toLowerCase())
        ).length;

        return { total, highRisk, scamPct, legitPct, decisionTotal, awaiting };
    }, [casesMonth]);

    /* ── Panel data ────────────────────────────────────────────────────────── */
    const panels = useMemo(() => {
        const AWAITING_STATUSES = ['new', 'submitted', 'in_review'];

        const awaitingReview = casesAll
            .filter((c) => c.status && c.status.toLowerCase() !== 'closed')
            .filter((c) => AWAITING_STATUSES.includes((c.status ?? '').toLowerCase()))
            .slice(0, 5);

        const highRiskQueue = casesAll
            .filter((c) => ['high', 'critical'].includes((c.risk_level ?? '').toLowerCase()))
            .filter((c) => c.status?.toLowerCase() !== 'closed')
            .slice(0, 5);

        const recentCases = casesAll.slice(0, 5);

        return { awaitingReview, highRiskQueue, recentCases };
    }, [casesAll]);

    /* ── Calm insight ──────────────────────────────────────────────────────── */
    const insight = useMemo(() => {
        if (casesMonth.length === 0) return null;

        // Most common category
        const catCounts: Record<string, number> = {};
        for (const c of casesMonth) {
            const cat = c.category ?? 'Uncategorised';
            catCounts[cat] = (catCounts[cat] || 0) + 1;
        }
        const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';

        return `This month saw ${casesMonth.length} incident${casesMonth.length !== 1 ? 's' : ''}. Most common category: ${topCategory}. High-risk: ${metrics.highRisk}.`;
    }, [casesMonth, metrics.highRisk]);

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

    if (noOrg) {
        return (
            <div>
                <div className="dashboard-page-header">
                    <h1 className="dashboard-page-title">Overview</h1>
                    <p className="dashboard-page-subtitle">
                        Select an organisation from the &ldquo;Viewing as&rdquo; dropdown above to view its overview.
                    </p>
                </div>
                <div className="dashboard-placeholder-card">
                    <div className="dashboard-placeholder-icon">
                        <LayoutDashboard />
                    </div>
                    <p className="dashboard-page-title" style={{ fontSize: '1.1rem' }}>
                        No organisation selected
                    </p>
                    <p className="dashboard-page-subtitle" style={{ textAlign: 'center', margin: '0.5rem auto 0' }}>
                        Please choose an organisation to see its dashboard overview.
                    </p>
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
                    Your organisation&apos;s activity this month at a glance.
                </p>
            </div>

            {/* ── Executive Safeguarding Alerts ──────────────────────────── */}
            {(() => {
                const sevs = execAlerts.map(e => (e.severity ?? '').toLowerCase());
                const sysStatus = sevs.includes('critical') ? 'Immediate Attention Required'
                    : sevs.includes('high') ? 'Elevated Risk'
                        : sevs.includes('warning') ? 'Monitor Closely'
                            : 'Stable';
                return <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem' }}><strong>System Status:</strong> {sysStatus}</p>;
            })()}
            <div className="dashboard-panel" style={{ marginBottom: '1.5rem' }}>
                <div className="dashboard-panel-header">
                    <h2 className="dashboard-panel-title">
                        <AlertTriangle size={16} className="dashboard-panel-title-icon" />
                        Executive Safeguarding Alerts
                    </h2>
                </div>
                <p style={{ padding: '0 1rem', margin: '0 0 0.75rem', fontSize: '0.78rem', color: '#64748b' }}>
                    Automated safeguarding intelligence – updated continuously.
                </p>
                {execAlerts.length === 0 ? (
                    <div className="dashboard-panel-empty">
                        No executive alerts currently triggered.
                    </div>
                ) : (
                    <div style={{ padding: '0 1rem 1rem' }}>
                        {execAlerts.map((ea, i) => (
                            <div key={ea.id} style={{
                                padding: '0.75rem',
                                marginBottom: i < execAlerts.length - 1 ? '0.5rem' : 0,
                                borderRadius: '8px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                    <strong style={{ fontSize: '0.85rem' }}>{ea.severity ? `${ea.severity.toUpperCase()}: ${ea.title}` : ea.title}</strong>
                                    <span className={`dashboard-risk-badge risk-${severityRiskClass(ea.severity)}`} style={{ fontSize: '0.7rem' }}>
                                        {ea.severity}
                                    </span>
                                </div>
                                <p style={{ margin: '0 0 0.25rem', fontSize: '0.72rem', color: '#64748b' }}>Last triggered: {fmtDate(ea.last_triggered_at ?? ea.sent_at ?? '')}</p>
                                {typeof ea.meta?.count === 'number' && (
                                    <p style={{ margin: '0 0 0.25rem', fontSize: '0.72rem', color: '#64748b' }}>Detected: {ea.meta.count} cases (7-day window)</p>
                                )}
                                <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: '#334155' }}>{ea.description}</p>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{ea.recommendation}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Safeguarding Alerts ─────────────────────────────────────── */}
            <div className="dashboard-panel" style={{ marginBottom: '1.5rem' }}>
                <div className="dashboard-panel-header">
                    <h2 className="dashboard-panel-title">
                        <Bell size={16} className="dashboard-panel-title-icon" />
                        Safeguarding Alerts
                    </h2>
                    <span className="dashboard-panel-count">{alerts.length}</span>
                </div>

                {alerts.length === 0 ? (
                    <div className="dashboard-panel-empty">
                        <ShieldCheck size={16} style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
                        No active safeguarding alerts.
                    </div>
                ) : (
                    <div className="dashboard-panel-table-wrap">
                        <table className="dashboard-panel-table">
                            <thead>
                                <tr>
                                    <th>Event</th>
                                    <th>Entity</th>
                                    <th>Severity</th>
                                    <th>Sent At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {alerts.map((a) => (
                                    <tr key={a.id}>
                                        <td>{a.event_type}</td>
                                        <td>{a.entity_type ?? '—'}</td>
                                        <td>
                                            {a.severity ? (
                                                <span className={`dashboard-risk-badge risk-${riskClass(a.severity)}`}>
                                                    {a.severity}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td>{fmtDate(a.sent_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
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
                        <div className="dashboard-stat-label">Scam vs Not Scam</div>
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
                                    {panels.awaitingReview.map((c) => (
                                        <tr key={c.id}>
                                            <td>{fmtDate(c.submitted_at)}</td>
                                            <td>{c.submission_type ?? '—'}</td>
                                            <td>
                                                <span className={`dashboard-status-badge status-${statusClass(c.status)}`}>
                                                    {statusLabel(c.status)}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`dashboard-risk-badge risk-${riskClass(c.risk_level)}`}>
                                                    {c.risk_level ?? '—'}
                                                </span>
                                            </td>
                                            <td>{c.category ?? '—'}</td>
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
                                    {panels.highRiskQueue.map((c) => (
                                        <tr key={c.id}>
                                            <td>{fmtDate(c.submitted_at)}</td>
                                            <td>{c.submission_type ?? '—'}</td>
                                            <td>
                                                <span className={`dashboard-status-badge status-${statusClass(c.status)}`}>
                                                    {statusLabel(c.status)}
                                                </span>
                                            </td>
                                            <td>{c.category ?? '—'}</td>
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
                                    {panels.recentCases.map((c) => (
                                        <tr key={c.id}>
                                            <td>{fmtDate(c.submitted_at)}</td>
                                            <td>{c.submission_type ?? '—'}</td>
                                            <td>
                                                <span className={`dashboard-status-badge status-${statusClass(c.status)}`}>
                                                    {statusLabel(c.status)}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`dashboard-risk-badge risk-${riskClass(c.risk_level)}`}>
                                                    {c.risk_level ?? '—'}
                                                </span>
                                            </td>
                                            <td>{c.category ?? '—'}</td>
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
