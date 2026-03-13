import React, { useState, useEffect, useMemo } from 'react';
import {
    LayoutDashboard, AlertTriangle, ShieldCheck, Clock,
    TrendingUp, Loader2, Info, Bell, Users, Globe,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

/* â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

/* â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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
        return 'â€”';
    }
}

/* â”€â”€â”€ Overview Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

    /* â”€â”€ Fetch data on mount â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
                        // Super Admin (Global) â€” fetch platform-wide data
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

    /* â”€â”€ Computed metrics (this month) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

    /* â”€â”€ Panel data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

    /* â”€â”€ Calm insight â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

    /* â”€â”€ Residents needing attention (all-time, 2+ incidents) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

    /* â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    if (loading) {
        return (
            <div className="dashboard-overview-loading">
                <Loader2 className="dashboard-overview-spinner-icon" />
                <p>Loading overviewâ€¦</p>
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
        // Super Admin (Global) â€” show platform-wide overview
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
                                                    <td style={{ fontWeight: 500 }}>{c.org_name ?? 'â€”'}</td>
                                                    <td>{c.submission_type ?? 'â€”'}</td>
                                                    <td>
                                                        <span className={`dashboard-status-badge status-${statusClass(c.status)}`}>
                                                            {statusLabel(c.status)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`dashboard-risk-badge risk-${riskClass(c.risk_level)}`}>
                                                            {c.risk_level ?? 'â€”'}
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

        // Non-admin with no org â€” original empty state
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

    /* â”€â”€ Severity helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    const sevColour = (sev: string | null) => {
        switch (sev?.toLowerCase()) {
            case 'critical': return { bg: '#fef2f2', fg: '#991b1b', border: '#fecaca', dot: '#dc2626' };
            case 'high': return { bg: '#fef2f2', fg: '#991b1b', border: '#fecaca', dot: '#dc2626' };
            case 'warning': return { bg: '#fffbeb', fg: '#92400e', border: '#fde68a', dot: '#f59e0b' };
            case 'info': return { bg: '#f0f9ff', fg: '#0c4a6e', border: '#bae6fd', dot: '#0ea5e9' };
            default: return { bg: '#f8fafc', fg: '#64748b', border: '#e2e8f0', dot: '#94a3b8' };
        }
    };

    const plainEventType = (t: string) =>
        t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    /* â”€â”€ System status banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    const sevs = execAlerts.map(e => (e.severity ?? '').toLowerCase());
    const sysStatusLabel = sevs.includes('critical') ? 'Immediate Attention Required'
        : sevs.includes('high') ? 'Elevated Risk'
            : sevs.includes('warning') ? 'Monitor Closely' : 'All Clear';
    const sysStatusBand = sevs.includes('critical') || sevs.includes('high') ? 'red'
        : sevs.includes('warning') ? 'amber' : 'green';
    const sysBandC = sysStatusBand === 'red' ? { bg: '#fef2f2', fg: '#991b1b', border: '#fecaca' }
        : sysStatusBand === 'amber' ? { bg: '#fffbeb', fg: '#92400e', border: '#fde68a' }
            : { bg: '#ecfdf5', fg: '#065f46', border: '#a7f3d0' };

    /* â”€â”€ Age helper for Awaiting Review â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    const ageLabel = (iso: string) => {
        const hrs = (Date.now() - new Date(iso).getTime()) / 3_600_000;
        if (hrs < 1) return { text: '<1h', band: 'green' as const };
        if (hrs < 4) return { text: `${Math.round(hrs)}h`, band: 'green' as const };
        if (hrs < 24) return { text: `${Math.round(hrs)}h`, band: 'amber' as const };
        return { text: `${(hrs / 24).toFixed(1)}d`, band: 'red' as const };
    };
    const ageBandC = (b: string) => b === 'red' ? '#991b1b' : b === 'amber' ? '#92400e' : '#065f46';
    const ageBandBg = (b: string) => b === 'red' ? '#fef2f2' : b === 'amber' ? '#fffbeb' : '#ecfdf5';

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

            {/* â”€â”€ System Status Banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div style={{ background: sysBandC.bg, border: `1px solid ${sysBandC.border}`, borderRadius: '10px', padding: '0.6rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldCheck size={16} style={{ color: sysBandC.fg }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: sysBandC.fg }}>System Status</span>
                </div>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: sysBandC.fg, background: `${sysBandC.fg}14`, padding: '2px 10px', borderRadius: '20px' }}>{sysStatusLabel}</span>
            </div>

            {/* â”€â”€ Executive Safeguarding Alerts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="dashboard-panel" style={{ marginBottom: '1.5rem' }}>
                <div className="dashboard-panel-header">
                    <h2 className="dashboard-panel-title">
                        <AlertTriangle size={16} className="dashboard-panel-title-icon" />
                        Executive Safeguarding Alerts
                    </h2>
                    <span className="dashboard-panel-count">{execAlerts.length}</span>
                </div>
                <p style={{ padding: '0 1rem', margin: '0 0 0.75rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                    Automated safeguarding intelligence â€” updated continuously.
                </p>
                {execAlerts.length === 0 ? (
                    <div className="dashboard-panel-empty" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldCheck size={14} style={{ color: '#10b981' }} />
                        <span>No executive alerts currently triggered.</span>
                    </div>
                ) : (
                    <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {execAlerts.map((ea) => {
                            const sc = sevColour(ea.severity);
                            return (
                                <div key={ea.id} style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderLeft: `4px solid ${sc.dot}`, borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: sc.fg }}>{ea.title || plainEventType(ea.event_type)}</span>
                                        <span style={{ fontSize: '0.62rem', fontWeight: 600, color: sc.fg, background: `${sc.fg}14`, padding: '1px 7px', borderRadius: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{ea.severity ?? 'info'}</span>
                                    </div>
                                    <p style={{ margin: '0 0 0.15rem', fontSize: '0.78rem', color: '#334155', lineHeight: 1.45, paddingLeft: '1.1rem' }}>{ea.description}</p>
                                    {ea.recommendation && (
                                        <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', paddingLeft: '1.1rem' }}>â†³ {ea.recommendation}</p>
                                    )}
                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', paddingLeft: '1.1rem' }}>
                                        {typeof ea.meta?.count === 'number' && (
                                            <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{ea.meta.count} cases detected (7-day window)</span>
                                        )}
                                        <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Last triggered: {fmtDate(ea.last_triggered_at ?? ea.sent_at ?? '')}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* â”€â”€ KPI Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="dashboard-overview-cards">
                {/* Total Cases */}
                <div className="dashboard-stat-card">
                    <div className="dashboard-stat-card-accent accent-blue" />
                    <div className="dashboard-stat-card-body">
                        <div className="dashboard-stat-icon blue"><LayoutDashboard size={20} /></div>
                        <div className="dashboard-stat-value">{metrics.total}</div>
                        <div className="dashboard-stat-label">Total Cases</div>
                        <div className="dashboard-stat-period">This month</div>
                    </div>
                </div>

                {/* High Risk */}
                <div className="dashboard-stat-card" style={{ borderLeft: metrics.highRisk > 0 ? '3px solid #dc2626' : undefined }}>
                    <div className="dashboard-stat-card-accent accent-red" />
                    <div className="dashboard-stat-card-body">
                        <div className="dashboard-stat-icon red"><AlertTriangle size={20} /></div>
                        <div className="dashboard-stat-value" style={{ color: metrics.highRisk > 0 ? '#dc2626' : undefined }}>{metrics.highRisk}</div>
                        <div className="dashboard-stat-label">High Risk</div>
                        <div className="dashboard-stat-period" style={{ color: metrics.highRisk > 0 ? '#dc2626' : undefined }}>
                            {metrics.highRisk === 0 ? 'None this month' : metrics.highRisk === 1 ? 'Requires attention' : `${metrics.highRisk} require attention`}
                        </div>
                    </div>
                </div>

                {/* Scam vs Not Scam â€” with mini stacked bar */}
                <div className="dashboard-stat-card">
                    <div className="dashboard-stat-card-accent accent-gold" />
                    <div className="dashboard-stat-card-body">
                        <div className="dashboard-stat-icon gold"><ShieldCheck size={20} /></div>
                        <div className="dashboard-stat-value">
                            {metrics.decisionTotal > 0
                                ? `${metrics.scamPct}% / ${metrics.legitPct}%`
                                : 'â€”'}
                        </div>
                        <div className="dashboard-stat-label">Scam vs Not Scam</div>
                        {metrics.decisionTotal > 0 && (
                            <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', marginTop: '4px', background: '#e2e8f0' }}>
                                <div style={{ width: `${metrics.scamPct}%`, background: '#dc2626', transition: 'width 0.5s ease' }} />
                                <div style={{ width: `${metrics.legitPct}%`, background: '#10b981', transition: 'width 0.5s ease' }} />
                            </div>
                        )}
                        <div className="dashboard-stat-period" style={{ marginTop: '2px' }}>
                            {metrics.decisionTotal > 0
                                ? `${metrics.decisionTotal} decided`
                                : 'No decisions yet'}
                        </div>
                    </div>
                </div>

                {/* Awaiting Review */}
                <div className="dashboard-stat-card" style={{ borderLeft: metrics.awaiting > 3 ? '3px solid #f59e0b' : undefined }}>
                    <div className="dashboard-stat-card-accent accent-amber" />
                    <div className="dashboard-stat-card-body">
                        <div className="dashboard-stat-icon amber"><Clock size={20} /></div>
                        <div className="dashboard-stat-value">{metrics.awaiting}</div>
                        <div className="dashboard-stat-label">Awaiting Review</div>
                        <div className="dashboard-stat-period" style={{ color: metrics.awaiting > 3 ? '#92400e' : undefined }}>
                            {metrics.awaiting === 0 ? 'Queue clear' : metrics.awaiting <= 3 ? 'On track' : 'Building up'}
                        </div>
                    </div>
                </div>
            </div>

            {/* â”€â”€ Insight Box â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {insight && (
                <div className="dashboard-insight-box">
                    <Info size={16} className="dashboard-insight-icon" />
                    <span>{insight}</span>
                </div>
            )}

            {/* â”€â”€ Residents Needing Attention â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="dashboard-panel" style={{ marginBottom: '1.5rem' }}>
                <div className="dashboard-panel-header">
                    <h2 className="dashboard-panel-title">
                        <Users size={16} className="dashboard-panel-title-icon" />
                        Residents Needing Attention
                    </h2>
                    <span className="dashboard-panel-count">{residentsAttention.length}</span>
                </div>
                <p style={{ padding: '0 1rem', margin: '0 0 0.5rem', fontSize: '0.72rem', color: '#94a3b8' }}>
                    Residents with two or more reported incidents across all time.
                </p>
                {residentsAttention.length === 0 ? (
                    <div className="dashboard-panel-empty" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldCheck size={14} style={{ color: '#10b981' }} />
                        <span>No repeated resident incidents detected.</span>
                    </div>
                ) : (
                    <div style={{ padding: '0 1rem 1rem' }}>
                        {(() => {
                            const maxCount = Math.max(...residentsAttention.map(([, n]) => n), 1);
                            return residentsAttention.map(([ref, count]) => {
                                const pct = Math.max(8, (count / maxCount) * 100);
                                const barColour = count >= 5 ? '#dc2626' : count >= 3 ? '#f59e0b' : '#3b82f6';
                                const barBg = count >= 5 ? '#fef2f2' : count >= 3 ? '#fffbeb' : '#eff6ff';
                                return (
                                    <div key={ref} style={{ marginBottom: '0.4rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#1e293b' }}>{ref}</span>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: barColour }}>{count} incident{count !== 1 ? 's' : ''}</span>
                                        </div>
                                        <div style={{ height: '6px', background: barBg, borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: barColour, borderRadius: '3px', transition: 'width 0.5s ease' }} />
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                )}
            </div>

            {/* â”€â”€ Panels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                    <p style={{ padding: '0 1rem', margin: '0 0 0.35rem', fontSize: '0.72rem', color: '#94a3b8' }}>
                        Open cases that still need an admin decision.
                    </p>
                    {panels.awaitingReview.length === 0 ? (
                        <div className="dashboard-panel-empty" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <ShieldCheck size={14} style={{ color: '#10b981' }} />
                            <span>No cases awaiting review â€” great work.</span>
                        </div>
                    ) : (
                        <div className="dashboard-panel-table-wrap">
                            <table className="dashboard-panel-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Age</th>
                                        <th>Type</th>
                                        <th>Status</th>
                                        <th>Risk</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {panels.awaitingReview.map((c) => {
                                        const age = ageLabel(c.submitted_at);
                                        return (
                                            <tr key={c.id}>
                                                <td>{fmtDate(c.submitted_at)}</td>
                                                <td>
                                                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: ageBandC(age.band), background: ageBandBg(age.band), padding: '1px 7px', borderRadius: '8px' }}>{age.text}</span>
                                                </td>
                                                <td>{c.submission_type ? plainEventType(c.submission_type) : 'â€”'}</td>
                                                <td>
                                                    <span className={`dashboard-status-badge status-${statusClass(c.status)}`}>
                                                        {statusLabel(c.status)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`dashboard-risk-badge risk-${riskClass(c.risk_level)}`}>
                                                        {c.risk_level ?? 'â€”'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* High-Risk Queue */}
                <div className="dashboard-panel" style={{ borderLeft: panels.highRiskQueue.length > 0 ? '3px solid #dc2626' : undefined }}>
                    <div className="dashboard-panel-header">
                        <h2 className="dashboard-panel-title">
                            <AlertTriangle size={16} className="dashboard-panel-title-icon" style={{ color: '#dc2626' }} />
                            High-Risk Queue
                        </h2>
                        <span className="dashboard-panel-count" style={{ background: panels.highRiskQueue.length > 0 ? '#fef2f2' : undefined, color: panels.highRiskQueue.length > 0 ? '#991b1b' : undefined }}>
                            {panels.highRiskQueue.length}
                        </span>
                    </div>
                    <p style={{ padding: '0 1rem', margin: '0 0 0.35rem', fontSize: '0.72rem', color: '#94a3b8' }}>
                        Open cases assessed as high risk or critical.
                    </p>
                    {panels.highRiskQueue.length === 0 ? (
                        <div className="dashboard-panel-empty" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <ShieldCheck size={14} style={{ color: '#10b981' }} />
                            <span>No high-risk cases open â€” looking good.</span>
                        </div>
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
                                            <td>{c.submission_type ? plainEventType(c.submission_type) : 'â€”'}</td>
                                            <td>
                                                <span className={`dashboard-status-badge status-${statusClass(c.status)}`}>
                                                    {statusLabel(c.status)}
                                                </span>
                                            </td>
                                            <td>{c.category ? plainEventType(c.category) : 'â€”'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Recent Cases â€“ calmer styling */}
                <div className="dashboard-panel" style={{ opacity: 0.85 }}>
                    <div className="dashboard-panel-header">
                        <h2 className="dashboard-panel-title" style={{ color: '#64748b' }}>
                            <TrendingUp size={16} className="dashboard-panel-title-icon" style={{ color: '#94a3b8' }} />
                            Recent Cases
                        </h2>
                        <span className="dashboard-panel-count">{panels.recentCases.length}</span>
                    </div>
                    <p style={{ padding: '0 1rem', margin: '0 0 0.35rem', fontSize: '0.72rem', color: '#94a3b8' }}>
                        Latest submissions for reference.
                    </p>
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
                                            <td>{c.submission_type ? plainEventType(c.submission_type) : 'â€”'}</td>
                                            <td>
                                                <span className={`dashboard-status-badge status-${statusClass(c.status)}`}>
                                                    {statusLabel(c.status)}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`dashboard-risk-badge risk-${riskClass(c.risk_level)}`}>
                                                    {c.risk_level ?? 'â€”'}
                                                </span>
                                            </td>
                                            <td>{c.category ? plainEventType(c.category) : 'â€”'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* â”€â”€ Safeguarding Alert Log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="dashboard-panel" style={{ marginTop: '1.5rem', opacity: 0.85 }}>
                <div className="dashboard-panel-header">
                    <h2 className="dashboard-panel-title" style={{ color: '#64748b' }}>
                        <Bell size={16} className="dashboard-panel-title-icon" style={{ color: '#94a3b8' }} />
                        Alert Log (Last 14 Days)
                    </h2>
                    <span className="dashboard-panel-count">{alerts.length}</span>
                </div>
                {alerts.length === 0 ? (
                    <div className="dashboard-panel-empty" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldCheck size={14} style={{ color: '#10b981' }} />
                        <span>No recent alerts.</span>
                    </div>
                ) : (
                    <div className="dashboard-panel-table-wrap">
                        <table className="dashboard-panel-table">
                            <thead>
                                <tr>
                                    <th>Event</th>
                                    <th>Entity</th>
                                    <th>Severity</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {alerts.map((a) => (
                                    <tr key={a.id}>
                                        <td>{plainEventType(a.event_type)}</td>
                                        <td>{a.entity_type ? plainEventType(a.entity_type) : 'â€”'}</td>
                                        <td>
                                            {a.severity ? (
                                                <span className={`dashboard-risk-badge risk-${severityRiskClass(a.severity)}`}>
                                                    {a.severity}
                                                </span>
                                            ) : 'â€”'}
                                        </td>
                                        <td>{fmtDate(a.sent_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

        </div>
    );
}

