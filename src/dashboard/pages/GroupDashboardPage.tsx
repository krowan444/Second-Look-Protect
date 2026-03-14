import React, { useState, useEffect, useMemo } from 'react';
import {
    Loader2, AlertTriangle, Building2, Shield, Activity, Clock, Download,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import { usePublishPageData } from '../assistant/StapeLeeDataContext';
import { useGroupHomeFilter, groupNavigate } from '../hooks/useGroupHomeFilter';
import { GroupHomeFilter } from '../components/GroupHomeFilter';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface OrgStats {
    id: string;
    name: string;
    totalCases: number;
    openCases: number;
    highRiskOpen: number;
    overdueCases: number;
    totalLoss: number;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const SLA_DAYS = 3;

function currency(n: number): string {
    return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 0 });
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function GroupDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [groupName, setGroupName] = useState('Group Dashboard');
    const [orgStats, setOrgStats] = useState<OrgStats[]>([]);
    const [allOrgs, setAllOrgs] = useState<{ id: string; name: string }[]>([]);
    const [filterHomeId, setFilterHomeId] = useGroupHomeFilter();

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const supabase = getSupabase();
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) { setError('Not authenticated'); setLoading(false); return; }

                // Resolve user's org
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('organisation_id, role')
                    .eq('id', session.user.id)
                    .single();

                if (!profile?.organisation_id) {
                    setError('No organisation linked to your account.');
                    setLoading(false);
                    return;
                }

                const allowedRoles = ['org_admin', 'super_admin'];
                if (!allowedRoles.includes(profile.role)) {
                    setError('Access denied. Group pages are only available to administrators.');
                    setLoading(false);
                    return;
                }

                // Allow super_admin org switcher
                let resolvedOrgId = profile.organisation_id;
                if (profile.role === 'super_admin') {
                    const switcherOrg = localStorage.getItem('slp_active_org_id');
                    if (switcherOrg) resolvedOrgId = switcherOrg;
                }

                // Get the group_id for this org
                const { data: orgRow } = await supabase
                    .from('organisations')
                    .select('organisation_group_id')
                    .eq('id', resolvedOrgId)
                    .single();

                const groupId = orgRow?.organisation_group_id;
                if (!groupId) {
                    setError('Your organisation is not part of a group.');
                    setLoading(false);
                    return;
                }

                // Get group name
                const { data: groupRow } = await supabase
                    .from('organisation_groups')
                    .select('name')
                    .eq('id', groupId)
                    .single();

                if (!cancelled && groupRow?.name) setGroupName(groupRow.name);

                // Get all orgs in the group
                const { data: groupOrgs } = await supabase
                    .from('organisations')
                    .select('id, name')
                    .eq('organisation_group_id', groupId)
                    .order('name');

                if (!groupOrgs || groupOrgs.length === 0) {
                    setError('No organisations found in this group.');
                    setLoading(false);
                    return;
                }

                const orgIds = groupOrgs.map(o => o.id);
                if (!cancelled) setAllOrgs(groupOrgs);

                // Fetch ALL cases for these orgs in one query
                const { data: cases } = await supabase
                    .from('cases')
                    .select('id, organisation_id, status, risk_level, outcome, loss_amount, submitted_at')
                    .in('organisation_id', orgIds);

                const allCases = cases ?? [];
                const overdueThreshold = new Date(Date.now() - SLA_DAYS * 24 * 60 * 60 * 1000);

                // Build stats per org
                const stats: OrgStats[] = groupOrgs.map(org => {
                    const orgCases = allCases.filter(c => c.organisation_id === org.id);
                    const open = orgCases.filter(c => c.status !== 'closed');
                    const highRisk = open.filter(c => ['high', 'critical'].includes((c.risk_level ?? '').toLowerCase()));
                    const overdue = open.filter(c => new Date(c.submitted_at) < overdueThreshold);
                    const loss = orgCases
                        .filter(c => c.outcome === 'lost' && typeof c.loss_amount === 'number')
                        .reduce((sum, c) => sum + (c.loss_amount as number), 0);

                    return {
                        id: org.id,
                        name: org.name,
                        totalCases: orgCases.length,
                        openCases: open.length,
                        highRiskOpen: highRisk.length,
                        overdueCases: overdue.length,
                        totalLoss: loss,
                    };
                });

                if (!cancelled) setOrgStats(stats);
            } catch (err: any) {
                if (!cancelled) setError(err?.message ?? 'Failed to load group data');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    /* ── Filtered data ────────────────────────────────────────────────────── */
    const displayStats = useMemo(
        () => filterHomeId ? orgStats.filter(o => o.id === filterHomeId) : orgStats,
        [orgStats, filterHomeId]
    );

    const totals = {
        homes: displayStats.length,
        totalCases: displayStats.reduce((s, o) => s + o.totalCases, 0),
        openCases: displayStats.reduce((s, o) => s + o.openCases, 0),
        highRisk: displayStats.reduce((s, o) => s + o.highRiskOpen, 0),
        overdue: displayStats.reduce((s, o) => s + o.overdueCases, 0),
        totalLoss: displayStats.reduce((s, o) => s + o.totalLoss, 0),
    };

    /* ── Publish live data to Stape-Lee ─────────────────────────────── */
    const { publishPageData, clearPageData } = usePublishPageData();
    useEffect(() => {
        if (loading) return;
        publishPageData({
            section: 'group-dashboard',
            updatedAt: Date.now(),
            organisationName: groupName,
            activeFilters: filterHomeId ? displayStats[0]?.name : 'All homes',
            kpis: [
                { label: 'Homes', value: totals.homes, status: 'neutral' },
                { label: 'Total Cases', value: totals.totalCases, status: 'neutral' },
                { label: 'Open Cases', value: totals.openCases, status: totals.openCases > 10 ? 'warn' : 'good' },
                { label: 'High Risk', value: totals.highRisk, status: totals.highRisk > 0 ? 'danger' : 'good' },
                { label: 'Overdue', value: totals.overdue, status: totals.overdue > 0 ? 'danger' : 'good' },
                { label: 'Total Loss', value: currency(totals.totalLoss), status: totals.totalLoss > 0 ? 'warn' : 'neutral' },
            ],
            tableRows: displayStats.slice(0, 10).map(o => ({
                label: o.name,
                cases: o.totalCases,
                open: o.openCases,
                'high risk': o.highRiskOpen,
                overdue: o.overdueCases,
            })),
        });
        return () => clearPageData();
    }, [loading, totals, displayStats, groupName, filterHomeId]);

    /* ── Render ───────────────────────────────────────────────────────────── */

    if (loading) {
        return (
            <div className="dashboard-overview-loading">
                <Loader2 className="dashboard-overview-spinner-icon" />
                <p>Loading group dashboard…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-overview-error">
                <AlertTriangle size={20} />
                <span>{error}</span>
            </div>
        );
    }

    return (
        <div className="gp-page">
            {/* Header */}
            <div className="gp-header">
                <div>
                    <h1 className="gp-title">
                        <Building2 size={20} /> {groupName}
                    </h1>
                    <p className="gp-subtitle">
                        Multi-site group overview — {totals.homes} home{totals.homes !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className="gp-actions">
                    {allOrgs.length > 0 && (
                        <GroupHomeFilter homes={allOrgs} selectedHomeId={filterHomeId} onSelect={setFilterHomeId} />
                    )}
                    {displayStats.length > 0 && (
                        <button
                            className="gp-export-btn"
                            onClick={() => downloadCsv(
                                'group-dashboard.csv',
                                ['Home', 'Total Cases', 'Open Cases', 'High-Risk Open', 'Overdue Cases', 'Total Loss'],
                                displayStats.map(o => [o.name, String(o.totalCases), String(o.openCases), String(o.highRiskOpen), String(o.overdueCases), String(o.totalLoss)])
                            )}
                        >
                            <Download size={13} /> Export CSV
                        </button>
                    )}
                </div>
            </div>

            {/* KPI strip */}
            <div className="gp-kpi-strip">
                <div className="gp-kpi">
                    <div className="gp-kpi-value">{totals.homes}</div>
                    <div className="gp-kpi-label">Homes</div>
                </div>
                <div className="gp-kpi">
                    <div className="gp-kpi-value">{totals.totalCases}</div>
                    <div className="gp-kpi-label">Total Cases</div>
                </div>
                <div className="gp-kpi">
                    <div className="gp-kpi-value">{totals.openCases}</div>
                    <div className="gp-kpi-label">Open Cases</div>
                </div>
                <div className="gp-kpi gp-kpi--clickable" onClick={() => groupNavigate('/dashboard/group-high-risk')}>
                    <div className={`gp-kpi-value${totals.highRisk > 0 ? ' gp-val-danger' : ''}`}>{totals.highRisk}</div>
                    <div className="gp-kpi-label">High-Risk Open →</div>
                </div>
                <div className="gp-kpi gp-kpi--clickable" onClick={() => groupNavigate('/dashboard/group-response')}>
                    <div className={`gp-kpi-value${totals.overdue > 0 ? ' gp-val-warn' : ''}`}>{totals.overdue}</div>
                    <div className="gp-kpi-label">Overdue ({SLA_DAYS}+ days) →</div>
                </div>
                <div className="gp-kpi gp-kpi--clickable" onClick={() => groupNavigate('/dashboard/group-pressure')}>
                    <div className="gp-kpi-value">{currency(totals.totalLoss)}</div>
                    <div className="gp-kpi-label">Total Loss →</div>
                </div>
            </div>

            {/* Home Comparison */}
            <div className="gp-card">
                <div className="gp-card-header">
                    <h2 className="gp-card-title"><Activity size={15} /> Home Comparison</h2>
                    <span className="gp-card-count">{displayStats.length}</span>
                </div>
                <div className="gp-table-wrap">
                    <table className="gp-table">
                        <thead>
                            <tr>
                                <th>Home</th>
                                <th className="text-right">Total Cases</th>
                                <th className="text-right">Open</th>
                                <th className="text-right">High-Risk Open</th>
                                <th className="text-right"><Clock size={12} style={{ verticalAlign: 'text-bottom', marginRight: '2px' }} />Overdue</th>
                                <th className="text-right">Total Loss</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayStats.map(org => (
                                <tr key={org.id} className="gp-row-click" onClick={() => setFilterHomeId(filterHomeId === org.id ? null : org.id)}>
                                    <td className="gp-home-name">{org.name}</td>
                                    <td className="text-right">{org.totalCases}</td>
                                    <td className="text-right">{org.openCases}</td>
                                    <td className="text-right">
                                        <span className={org.highRiskOpen > 0 ? 'gp-val-danger' : ''}>{org.highRiskOpen}</span>
                                    </td>
                                    <td className="text-right">
                                        <span className={org.overdueCases > 0 ? 'gp-val-warn' : ''}>{org.overdueCases}</span>
                                    </td>
                                    <td className="text-right">{currency(org.totalLoss)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
