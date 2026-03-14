import React, { useState, useEffect, useMemo } from 'react';
import {
    LayoutDashboard, AlertTriangle, ShieldCheck, Clock,
    TrendingUp, Loader2, Info, Bell, Users, Globe,
    Eye, BarChart3,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import { usePublishPageData } from '../assistant/StapeLeeDataContext';
import { KpiRingChart } from '../components/KpiRingChart';
import {
    KPI_COLORS, DEFAULTS,
    getStatusHigherBetter, getStatusLowerBetter,
} from '../components/kpiDefaults';

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

export function OverviewPage({ onNavigate }: { onNavigate?: (path: string) => void }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [noOrg, setNoOrg] = useState(false);
    const [orgName, setOrgName] = useState<string>('');
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    // ── View mode toggle (Standard / Visual) ─────────────────────────────
    const [viewMode, setViewMode] = useState<'standard' | 'visual'>(() => {
        try { return (localStorage.getItem('slp_overview_mode') as any) || 'standard'; }
        catch { return 'standard'; }
    });
    const toggleMode = (m: 'standard' | 'visual') => {
        setViewMode(m);
        try { localStorage.setItem('slp_overview_mode', m); } catch { }
    };

    // Canonical source of truth: CASES
    const [casesMonth, setCasesMonth] = useState<CaseRow[]>([]);
    const [casesAll, setCasesAll] = useState<CaseRow[]>([]);
    const [alerts, setAlerts] = useState<AlertEntry[]>([]);
    const [execAlerts, setExecAlerts] = useState<ExecAlert[]>([]);

    // Platform-wide data (super admin global)
    const [platformOrgCount, setPlatformOrgCount] = useState(0);
    const [platformCases, setPlatformCases] = useState<(CaseRow & { org_name?: string })[]>([]);

    /* ── Stape-Lee page data (must be before early returns) ─────────── */
    const { publishPageData, clearPageData } = usePublishPageData();

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

    /* ── Extended KPI metrics (for Visual mode rings) ──────────────────── */
    const kpi = useMemo(() => {
        const total = casesMonth.length;
        const closed = casesMonth.filter(c => c.status?.toLowerCase() === 'closed');
        const now = Date.now();

        // 1. Closure within target: % of closed cases where (closed_at - submitted_at) <= target days
        // We approximate closed_at ≈ now for recently-closed cases since we don't have closed_at column
        const closedWithin = closed.filter(c => {
            const age = (now - new Date(c.submitted_at).getTime()) / 86_400_000;
            return age <= DEFAULTS.closureWithinTargetDays;
        }).length;
        const closurePct = closed.length > 0 ? Math.round((closedWithin / closed.length) * 100) : 100;
        const closureStatus = getStatusHigherBetter(closurePct, 80, 50);

        // 2. Triage within target: % of cases that moved past 'new' within target hours
        const notNew = casesMonth.filter(c => c.status?.toLowerCase() !== 'new');
        const triagedFast = notNew.filter(c => {
            const age = (now - new Date(c.submitted_at).getTime()) / 3_600_000;
            return age <= DEFAULTS.triageWithinTargetHours || c.status?.toLowerCase() !== 'new';
        }).length;
        const triagePct = total > 0 ? Math.round((triagedFast / total) * 100) : 100;
        const triageStatus = getStatusHigherBetter(triagePct, 80, 50);

        // 3. Documentation completeness: % of all cases with a decision set
        const withDecision = casesMonth.filter(c => (c.decision ?? '').trim() !== '').length;
        const docPct = total > 0 ? Math.round((withDecision / total) * 100) : 100;
        const docStatus = getStatusHigherBetter(docPct, DEFAULTS.docCompletenessGreen, DEFAULTS.docCompletenessAmber);

        // 4. Scam proportion (informational, not target-based)
        const decided = casesMonth.filter(c => (c.decision ?? '').trim() !== '');
        const scamCount = decided.filter(c => c.decision?.toLowerCase() === 'scam').length;
        const scamPct = decided.length > 0 ? Math.round((scamCount / decided.length) * 100) : 0;

        // 5. Review queue health
        const AWAITING = ['new', 'submitted', 'in_review'];
        const queueDepth = casesAll.filter(c => c.status && AWAITING.includes(c.status.toLowerCase()) && c.status.toLowerCase() !== 'closed').length;
        const queueStatus = getStatusLowerBetter(queueDepth, DEFAULTS.reviewQueueGreen, DEFAULTS.reviewQueueAmber);
        const queuePct = queueDepth <= DEFAULTS.reviewQueueGreen ? 100
            : queueDepth <= DEFAULTS.reviewQueueAmber ? Math.round(((DEFAULTS.reviewQueueAmber - queueDepth) / (DEFAULTS.reviewQueueAmber - DEFAULTS.reviewQueueGreen)) * 50 + 50)
                : Math.max(10, Math.round(30 - queueDepth));

        // 6. Overall health (weighted average)
        const weights = [0.25, 0.2, 0.2, 0.15, 0.2];
        const scores = [closurePct, triagePct, docPct, 100 - scamPct, queuePct];
        const overallPct = Math.round(scores.reduce((s, v, i) => s + v * weights[i], 0));
        const overallStatus = getStatusHigherBetter(overallPct, 75, 50);

        return {
            closurePct, closureStatus,
            triagePct, triageStatus,
            docPct, docStatus,
            scamPct,
            queueDepth, queueStatus, queuePct,
            overallPct, overallStatus,
        };
    }, [casesMonth, casesAll]);

    /* ── Calm insight ────────────────────────────────────────────────── */
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

    /* -- Stape-Lee publish -- after all useMemos, before any early return -- */
    const _sevs = execAlerts.map(e => (e.severity ?? '').toLowerCase());
    const _sysStatusLabel = _sevs.includes('critical') ? 'Immediate Attention Required'
        : _sevs.includes('high') ? 'Elevated Risk'
            : _sevs.includes('warning') ? 'Monitor Closely' : 'All Clear';
    useEffect(() => {
        if (loading || error || noOrg) return;
        publishPageData({
            section: 'overview',
            updatedAt: Date.now(),
            organisationName: orgName || undefined,
            kpis: [
                { label: 'Overall Health', value: `%`, status: kpi.overallStatus },
                { label: 'Queue', value: kpi.queueDepth, status: kpi.queueStatus },
                { label: 'Triage', value: `%`, status: kpi.triageStatus },
                { label: 'Documented', value: `%`, status: kpi.docStatus },
                { label: 'Closure', value: `%`, status: kpi.closureStatus },
                { label: 'Cases This Month', value: casesMonth.length, status: 'neutral' },
                { label: 'High Risk', value: metrics.highRisk, status: metrics.highRisk > 0 ? 'danger' : 'good' },
                { label: 'Awaiting', value: metrics.awaiting, status: metrics.awaiting > 0 ? 'warn' : 'good' },
                { label: 'Awaiting Review', value: panels.awaitingReview.length, status: panels.awaitingReview.length > 5 ? 'danger' : panels.awaitingReview.length > 0 ? 'warn' : 'good' },
            ],
            alerts: execAlerts.map(ea => ({
                severity: ea.severity,
                title: ea.title || ea.event_type.replace(/_/g, ' '),
                description: ea.description,
            })),
            tableRows: panels.awaitingReview.slice(0, 5).map(c => ({
                label: `Case `,
                status: c.status ?? 'unknown',
                risk: c.risk_level ?? 'unknown',
                type: c.category ?? 'unknown',
                submitted: c.submitted_at ? new Date(c.submitted_at).toLocaleDateString() : 'N/A',
            })),
            insights: [
                insight,
                _sysStatusLabel !== 'All Clear' ? `System status: ` : null,
                residentsAttention.length > 0 ? ` resident with repeat incidents` : null,
            ].filter(Boolean) as string[],
        });
        return () => clearPageData();
    }, [loading, error, noOrg, kpi, metrics, panels, execAlerts, insight, _sysStatusLabel, residentsAttention, orgName]);

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

    /* ── Stape-Lee publish useEffect moved above early returns — see line ~132 ── */

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
        <div style={{ maxWidth: '960px' }}>
            {/* ── A. Header ──────────────────────────────────────────────── */}
            <div className="dashboard-page-header">
                <div>
                    {orgName && (
                        <p style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500, letterSpacing: '0.02em', marginBottom: '0.1rem' }}>
                            {orgName}
                        </p>
                    )}
                    <h1 className="dashboard-page-title">Safeguarding Overview</h1>
                    <p className="dashboard-page-subtitle" style={{ color: '#94a3b8' }}>
                        Your organisation&apos;s safeguarding health at a glance.
                    </p>
                </div>
            </div>

            {/* ── A. Status Strip ─────────────────────────────────────────── */}
            <div onClick={() => { if (onNavigate) onNavigate('/dashboard/review-queue'); }} style={{
                background: sysStatusBand === 'red' ? '#fef2f2' : sysStatusBand === 'amber' ? '#fefce8' : '#f0fdf4',
                border: `1px solid ${sysStatusBand === 'red' ? '#fecaca' : sysStatusBand === 'amber' ? '#fef08a' : '#bbf7d0'}`,
                borderRadius: '10px',
                padding: '0.55rem 1rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                cursor: onNavigate ? 'pointer' : undefined,
                transition: 'opacity 0.15s ease',
            }} onMouseEnter={e => { if (onNavigate) (e.currentTarget as HTMLDivElement).style.opacity = '0.85'; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldCheck size={15} style={{ color: sysStatusBand === 'red' ? '#f87171' : sysStatusBand === 'amber' ? '#fbbf24' : '#34d399' }} />
                    <span style={{
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: sysStatusBand === 'red' ? '#991b1b' : sysStatusBand === 'amber' ? '#854d0e' : '#166534',
                    }}>
                        {sysStatusLabel}
                    </span>
                </div>
                <span style={{
                    fontSize: '0.68rem',
                    color: '#94a3b8',
                    fontWeight: 500,
                }}>{casesMonth.length} case{casesMonth.length !== 1 ? 's' : ''} this month</span>
            </div>

            {/* ── B. Health Overview ──────────────────────────────────────── */}
            <div style={{
                background: '#ffffff',
                border: '1px solid #e8ecf4',
                borderRadius: '14px',
                padding: '2rem 2rem 1.5rem',
                marginBottom: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '1.5rem',
                }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>Safeguarding Health</span>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginLeft: 'auto' }}>This month vs targets</span>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3rem',
                    flexWrap: 'wrap',
                }}>
                    {/* Main health ring */}
                    <KpiRingChart
                        percent={kpi.overallPct}
                        status={kpi.overallStatus}
                        label={`${kpi.overallPct}%`}
                        sublabel="Overall Health"
                        size={140}
                    />

                    {/* Supporting rings */}
                    <div style={{
                        display: 'flex',
                        gap: '2rem',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                    }}>
                        <div onClick={() => { if (onNavigate) onNavigate('/dashboard/cases'); }} style={{ cursor: onNavigate ? 'pointer' : undefined, transition: 'transform 0.15s ease' }} onMouseEnter={e => { if (onNavigate) (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.08)'; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }} title="View cases">
                            <KpiRingChart
                                percent={kpi.closurePct}
                                status={kpi.closureStatus}
                                label={`${kpi.closurePct}%`}
                                sublabel="Closure"
                                size={85}
                            />
                        </div>
                        <div onClick={() => { if (onNavigate) onNavigate('/dashboard/review-queue'); }} style={{ cursor: onNavigate ? 'pointer' : undefined, transition: 'transform 0.15s ease' }} onMouseEnter={e => { if (onNavigate) (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.08)'; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }} title="View review queue">
                            <KpiRingChart
                                percent={kpi.triagePct}
                                status={kpi.triageStatus}
                                label={`${kpi.triagePct}%`}
                                sublabel="Triage"
                                size={85}
                            />
                        </div>
                        <div onClick={() => { if (onNavigate) onNavigate('/dashboard/cases'); }} style={{ cursor: onNavigate ? 'pointer' : undefined, transition: 'transform 0.15s ease' }} onMouseEnter={e => { if (onNavigate) (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.08)'; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }} title="View cases">
                            <KpiRingChart
                                percent={kpi.docPct}
                                status={kpi.docStatus}
                                label={`${kpi.docPct}%`}
                                sublabel="Documented"
                                size={85}
                            />
                        </div>
                        <div onClick={() => { if (onNavigate) onNavigate('/dashboard/review-queue'); }} style={{ cursor: onNavigate ? 'pointer' : undefined, transition: 'transform 0.15s ease' }} onMouseEnter={e => { if (onNavigate) (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.08)'; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }} title="View review queue">
                            <KpiRingChart
                                percent={kpi.queuePct}
                                status={kpi.queueStatus}
                                label={`${kpi.queueDepth}`}
                                sublabel="Queue"
                                size={85}
                            />
                        </div>
                    </div>
                </div>

                {/* Calm insight line */}
                {insight && (
                    <p style={{
                        marginTop: '1.25rem',
                        padding: '0.5rem 0.75rem',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        color: '#64748b',
                        lineHeight: 1.5,
                        textAlign: 'center',
                    }}>
                        {insight}
                    </p>
                )}
            </div>

            {/* ── Executive Alerts (only when present) ────────────────────── */}
            {execAlerts.length > 0 && (
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #e8ecf4',
                    borderRadius: '12px',
                    padding: '1rem 1.25rem',
                    marginBottom: '1.5rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        marginBottom: '0.75rem',
                    }}>
                        <AlertTriangle size={14} style={{ color: '#94a3b8' }} />
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>Safeguarding Alerts</span>
                        <span style={{
                            fontSize: '0.62rem',
                            fontWeight: 600,
                            color: '#94a3b8',
                            background: '#f1f5f9',
                            padding: '1px 7px',
                            borderRadius: '10px',
                            marginLeft: 'auto',
                        }}>{execAlerts.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {execAlerts.map((ea) => {
                            const sc = sevColour(ea.severity);
                            const alertDest = /sla|overdue|queue|triage|risk/i.test(ea.event_type) ? '/dashboard/review-queue' : '/dashboard/cases';
                            return (
                                <div key={ea.id} onClick={() => { if (onNavigate) onNavigate(alertDest); }} style={{
                                    background: sc.bg,
                                    border: `1px solid ${sc.border}`,
                                    borderLeft: `3px solid ${sc.dot}`,
                                    borderRadius: '8px',
                                    padding: '0.55rem 0.75rem',
                                    cursor: onNavigate ? 'pointer' : undefined,
                                    transition: 'box-shadow 0.15s ease',
                                }} onMouseEnter={e => { if (onNavigate) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: sc.fg }}>{ea.title || plainEventType(ea.event_type)}</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.72rem', color: '#475569', lineHeight: 1.4, paddingLeft: '1rem' }}>
                                        {ea.description}
                                    </p>
                                    {ea.recommendation && (
                                        <p style={{ margin: '0.15rem 0 0', fontSize: '0.68rem', color: '#94a3b8', paddingLeft: '1rem' }}>
                                            ↳ {ea.recommendation}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── C. Action Layer ─────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* Residents Needing Attention */}
                {residentsAttention.length > 0 && (
                    <div style={{
                        background: '#ffffff',
                        border: '1px solid #e8ecf4',
                        borderRadius: '12px',
                        padding: '1rem 1.25rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            marginBottom: '0.65rem',
                        }}>
                            <Users size={14} style={{ color: '#94a3b8' }} />
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>Residents Needing Attention</span>
                            <span style={{
                                fontSize: '0.62rem',
                                fontWeight: 600,
                                color: '#94a3b8',
                                background: '#f1f5f9',
                                padding: '1px 7px',
                                borderRadius: '10px',
                                marginLeft: 'auto',
                            }}>{residentsAttention.length}</span>
                        </div>
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.68rem', color: '#94a3b8' }}>
                            Residents with two or more reported incidents.
                        </p>
                        {(() => {
                            const maxCount = Math.max(...residentsAttention.map(([, n]) => n), 1);
                            return residentsAttention.map(([ref, count]) => {
                                const pct = Math.max(8, (count / maxCount) * 100);
                                // Softer bar colours
                                const barColour = count >= 5 ? '#f87171' : count >= 3 ? '#fbbf24' : '#93c5fd';
                                const barBg = '#f8fafc';
                                return (
                                    <div key={ref} style={{ marginBottom: '0.35rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.78rem', color: '#334155' }}>{ref}</span>
                                            <span style={{ fontSize: '0.68rem', fontWeight: 500, color: '#64748b' }}>{count} incident{count !== 1 ? 's' : ''}</span>
                                        </div>
                                        <div style={{ height: '5px', background: barBg, borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: barColour, borderRadius: '3px', transition: 'width 0.5s ease' }} />
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                )}

                {/* Cases Awaiting Review */}
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #e8ecf4',
                    borderRadius: '12px',
                    padding: '1rem 1.25rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        marginBottom: '0.65rem',
                    }}>
                        <Clock size={14} style={{ color: '#94a3b8' }} />
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>Cases Awaiting Review</span>
                        <span style={{
                            fontSize: '0.62rem',
                            fontWeight: 600,
                            color: '#94a3b8',
                            background: '#f1f5f9',
                            padding: '1px 7px',
                            borderRadius: '10px',
                            marginLeft: 'auto',
                        }}>{panels.awaitingReview.length}</span>
                    </div>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.68rem', color: '#94a3b8' }}>
                        Open cases that still need an admin decision.
                    </p>
                    {panels.awaitingReview.length === 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 0', fontSize: '0.75rem', color: '#64748b' }}>
                            <ShieldCheck size={14} style={{ color: '#34d399' }} />
                            <span>No cases awaiting review — great work.</span>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
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
                                            <tr key={c.id} onClick={() => { if (onNavigate) onNavigate(`/dashboard/cases/${c.id}`); }} style={{ cursor: onNavigate ? 'pointer' : undefined, transition: 'background 0.12s ease' }} onMouseEnter={e => { if (onNavigate) (e.currentTarget as HTMLTableRowElement).style.background = '#f8fafc'; }} onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}>
                                                <td>{fmtDate(c.submitted_at)}</td>
                                                <td>
                                                    <span style={{
                                                        fontSize: '0.68rem',
                                                        fontWeight: 500,
                                                        color: ageBandC(age.band),
                                                        background: ageBandBg(age.band),
                                                        padding: '1px 7px',
                                                        borderRadius: '8px',
                                                    }}>{age.text}</span>
                                                </td>
                                                <td>{c.submission_type ? plainEventType(c.submission_type) : '–'}</td>
                                                <td>
                                                    <span className={`dashboard-status-badge status-${statusClass(c.status)}`}>
                                                        {statusLabel(c.status)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`dashboard-risk-badge risk-${riskClass(c.risk_level)}`}>
                                                        {c.risk_level ?? '–'}
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
            </div>

        </div>
    );
}
