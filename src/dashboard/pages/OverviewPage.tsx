import React, { useState, useEffect, useMemo } from 'react';
import {
    LayoutDashboard, AlertTriangle, ShieldCheck, Clock,
    TrendingUp, Loader2, Info, Bell, Users, Globe,
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
    resident_ref: string | null;
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
    const [orgName, setOrgName] = useState<string>('');
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    // Canonical source of truth: CASES
    const [casesMonth, setCasesMonth] = useState<CaseRow[]>([]);
    const [casesAll, setCasesAll] = useState<CaseRow[]>([]);
    const [alerts, setAlerts] = useState<AlertEntry[]>([]);
    const [execAlerts, setExecAlerts] = useState<ExecAlert[]>([]);

    // Platform-wide data (super admin global)
    const [platformOrgCount, setPlatformOrgCount] = useState(0);
    const [platformCases, setPlatformCases] = useState<(CaseRow & { org_name?: string })[]>([]);

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
                const isAdmin = profile?.role === 'super_admin';
                if (!cancelled) setIsSuperAdmin(isAdmin);

                if (isAdmin) {
                    const switcherOrg =
                        localStorage.getItem('slp_viewing_as_org_id') ||
                        localStorage.getItem('slp_active_org_id');
                    if (switcherOrg) orgId = switcherOrg;
                }

                if (!orgId) {
                    if (isAdmin) {
                        // Super Admin (Global) — fetch platform-wide data
                        const { count: orgCount } = await supabase
                            .from('organisations')
                            .select('id', { count: 'exact', head: true });

                        const { data: allCases } = await supabase
                            .from('cases')
                            .select('id, submitted_at, submission_type, status, risk_level, decision, category, organisation_id, resident_ref')
                            .order('submitted_at', { ascending: false })
                            .limit(500);

                        // Fetch org names for recent cases
                        const orgIds = [...new Set((allCases ?? []).map(c => c.organisation_id).filter(Boolean))];
                        let orgMap: Record<string, string> = {};
                        if (orgIds.length > 0) {
                            const { data: orgs } = await supabase
                                .from('organisations')
                                .select('id, name')
                                .in('id', orgIds);
                            for (const o of (orgs ?? [])) orgMap[o.id] = o.name;
                        }

                        if (!cancelled) {
                            setPlatformOrgCount(orgCount ?? 0);
                            setPlatformCases((allCases ?? []).map(c => ({ ...c, org_name: orgMap[c.organisation_id ?? ''] ?? 'Unknown' })));
                            setNoOrg(true);
                            setLoading(false);
                        }
                        return;
                    }
                    // Non-admin with no org
                    setNoOrg(true);
                    setLoading(false);
                    return;
                }

                // Fetch org name for header
                const { data: orgRow } = await supabase
                    .from('organisations')
                    .select('name')
                    .eq('id', orgId)
                    .single();
                if (!cancelled) setOrgName(orgRow?.name ?? '');

                // This-month cases
                const now = new Date();
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

                const { data: monthRows, error: mErr } = await supabase
                    .from('cases')
                    .select('id, submitted_at, submission_type, status, risk_level, decision, category, organisation_id, resident_ref')
                    .eq('organisation_id', orgId)
                    .gte('submitted_at', monthStart)
                    .order('submitted_at', { ascending: false });

                if (mErr) throw mErr;

                // All cases (for panels that aren't month-limited)
                const { data: allRows, error: aErr } = await supabase
                    .from('cases')
                    .select('id, submitted_at, submission_type, status, risk_level, decision, category, organisation_id, resident_ref')
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

    /* ── Residents needing attention (all-time, 2+ incidents) ────────────── */
    const residentsAttention = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const c of casesAll) {
            const ref = (c.resident_ref ?? '').trim();
            if (ref) counts[ref] = (counts[ref] || 0) + 1;
        }
        return Object.entries(counts)
            .filter(([, n]) => n >= 2)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
    }, [casesAll]);

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
        // Super Admin (Global) — show platform-wide overview
        if (isSuperAdmin) {
            const totalCases = platformCases.length;
            const highRisk = platformCases.filter(c => ['high', 'critical'].includes((c.risk_level ?? '').toLowerCase())).length;
            const needsReview = platformCases.filter(c => c.status === 'new' || c.status === 'submitted').length;
            const recentCases = platformCases.slice(0, 10);

            return (
                <div>
                    <div className="dashboard-page-header">
                        <p style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 500, letterSpacing: '0.02em', marginBottom: '0.15rem' }}>
                            Super Admin (Global)
                        </p>
                        <h1 className="dashboard-page-title">Platform Overview</h1>
                        <p className="dashboard-page-subtitle">
                            Cross-organisation summary across the entire platform.
                        </p>
                    </div>

                    {totalCases === 0 ? (
                        <div className="dashboard-placeholder-card">
                            <div className="dashboard-placeholder-icon"><Globe /></div>
                            <p className="dashboard-page-title" style={{ fontSize: '1.1rem' }}>No platform data yet</p>
                            <p className="dashboard-page-subtitle" style={{ textAlign: 'center', margin: '0.5rem auto 0' }}>
                                Cases will appear here once organisations begin submitting.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Stat cards */}
                            <div className="dashboard-overview-cards">
                                <div className="dashboard-stat-card">
                                    <div className="dashboard-stat-card-accent accent-blue" />
                                    <div className="dashboard-stat-card-body">
                                        <div className="dashboard-stat-icon blue"><Globe size={20} /></div>
                                        <div className="dashboard-stat-value">{platformOrgCount}</div>
                                        <div className="dashboard-stat-label">Total Organisations</div>
                                    </div>
                                </div>
                                <div className="dashboard-stat-card">
                                    <div className="dashboard-stat-card-accent accent-gold" />
                                    <div className="dashboard-stat-card-body">
                                        <div className="dashboard-stat-icon gold"><LayoutDashboard size={20} /></div>
                                        <div className="dashboard-stat-value">{totalCases}</div>
                                        <div className="dashboard-stat-label">Total Cases</div>
                                    </div>
                                </div>
                                <div className="dashboard-stat-card">
                                    <div className="dashboard-stat-card-accent accent-red" />
                                    <div className="dashboard-stat-card-body">
                                        <div className="dashboard-stat-icon red"><AlertTriangle size={20} /></div>
                                        <div className="dashboard-stat-value">{highRisk}</div>
                                        <div className="dashboard-stat-label">High Risk Cases</div>
                                    </div>
                                </div>
                                <div className="dashboard-stat-card">
                                    <div className="dashboard-stat-card-accent accent-amber" />
                                    <div className="dashboard-stat-card-body">
                                        <div className="dashboard-stat-icon amber"><Clock size={20} /></div>
                                        <div className="dashboard-stat-value">{needsReview}</div>
                                        <div className="dashboard-stat-label">Cases Needing Review</div>
                                    </div>
                                </div>
                            </div>

                            {/* Recent cases across all orgs */}
                            <div className="dashboard-panel" style={{ marginTop: '1.5rem' }}>
                                <div className="dashboard-panel-header">
                                    <h2 className="dashboard-panel-title">
                                        <TrendingUp size={16} className="dashboard-panel-title-icon" />
                                        Recent Cases (All Organisations)
                                    </h2>
                                    <span className="dashboard-panel-count">{recentCases.length}</span>
                                </div>
                                <div className="dashboard-panel-table-wrap" style={{ overflowX: 'auto' }}>
                                    <table className="dashboard-panel-table" style={{ minWidth: '700px' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ minWidth: '100px' }}>Date</th>
                                                <th style={{ minWidth: '160px' }}>Organisation</th>
                                                <th style={{ minWidth: '140px' }}>Type</th>
                                                <th style={{ minWidth: '100px' }}>Status</th>
                                                <th style={{ minWidth: '90px' }}>Risk</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentCases.map((c) => (
                                                <tr key={c.id}>
                                                    <td>{fmtDate(c.submitted_at)}</td>
                                                    <td style={{ fontWeight: 500 }}>{c.org_name ?? '—'}</td>
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
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            );
        }

        // Non-admin with no org — original empty state
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
                {orgName && (
                    <p style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 500, letterSpacing: '0.02em', marginBottom: '0.15rem' }}>
                        {orgName}
                    </p>
                )}
                <h1 className="dashboard-page-title">Safeguarding Overview</h1>
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

            {/* ── Residents Needing Attention ────────────────────────────── */}
            <div className="dashboard-panel" style={{ marginBottom: '1.5rem' }}>
                <div className="dashboard-panel-header">
                    <h2 className="dashboard-panel-title">
                        <Users size={16} className="dashboard-panel-title-icon" />
                        Residents Needing Attention
                    </h2>
                    <span className="dashboard-panel-count">{residentsAttention.length}</span>
                </div>
                {residentsAttention.length === 0 ? (
                    <div className="dashboard-panel-empty">
                        No repeated resident incidents detected.
                    </div>
                ) : (
                    <div style={{ padding: '0 1rem 1rem' }}>
                        {residentsAttention.map(([ref, count]) => (
                            <div
                                key={ref}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.55rem 0',
                                    borderBottom: '1px solid #f1f5f9',
                                    fontSize: '0.85rem',
                                }}
                            >
                                <span style={{ fontWeight: 500, color: '#1e293b' }}>{ref}</span>
                                <span style={{ color: '#64748b', fontSize: '0.78rem' }}>{count} incident{count !== 1 ? 's' : ''}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

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
