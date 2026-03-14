import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Loader2, AlertTriangle, Calendar, Clock, Download,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import { useGroupHomeFilter } from '../hooks/useGroupHomeFilter';
import { GroupHomeFilter } from '../components/GroupHomeFilter';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface OrgMonthly {
    id: string;
    name: string;
    totalCases: number;
    openCases: number;
    closedCases: number;
    overdueCases: number;
    highRiskOpen: number;
    totalLoss: number;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const SLA_DAYS = 3;

function currency(n: number): string {
    return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 0 });
}

function recentMonths(): { value: string; label: string }[] {
    const out: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
        out.push({ value, label });
    }
    return out;
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

export function GroupMonthlyPage() {
    const months = recentMonths();
    const [selectedMonth, setSelectedMonth] = useState(months[0].value);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [groupName, setGroupName] = useState('Group Monthly Report');
    const [orgMetrics, setOrgMetrics] = useState<OrgMonthly[]>([]);
    const [groupOrgIds, setGroupOrgIds] = useState<{ id: string; name: string }[] | null>(null);
    const [allOrgs, setAllOrgs] = useState<{ id: string; name: string }[]>([]);
    const [filterHomeId, setFilterHomeId] = useGroupHomeFilter();

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const supabase = getSupabase();
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) { setError('Not authenticated'); setLoading(false); return; }

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('organisation_id, role')
                    .eq('id', session.user.id)
                    .single();

                if (!profile?.organisation_id) { setError('No organisation linked to your account.'); setLoading(false); return; }

                const allowedRoles = ['org_admin', 'super_admin'];
                if (!allowedRoles.includes(profile.role)) { setError('Access denied.'); setLoading(false); return; }

                let resolvedOrgId = profile.organisation_id;
                if (profile.role === 'super_admin') {
                    const switcherOrg = localStorage.getItem('slp_active_org_id');
                    if (switcherOrg) resolvedOrgId = switcherOrg;
                }

                const { data: orgRow } = await supabase.from('organisations').select('organisation_group_id').eq('id', resolvedOrgId).single();
                const groupId = orgRow?.organisation_group_id;
                if (!groupId) { setError('Your organisation is not part of a group.'); setLoading(false); return; }

                const { data: groupRow } = await supabase.from('organisation_groups').select('name').eq('id', groupId).single();
                if (!cancelled && groupRow?.name) setGroupName(groupRow.name + ' — Monthly Report');

                const { data: groupOrgs } = await supabase.from('organisations').select('id, name').eq('organisation_group_id', groupId).order('name');
                if (!groupOrgs || groupOrgs.length === 0) { setError('No organisations found in this group.'); setLoading(false); return; }

                if (!cancelled) { setGroupOrgIds(groupOrgs); setAllOrgs(groupOrgs); }
            } catch (err: any) {
                if (!cancelled) setError(err?.message ?? 'Failed to resolve group');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const fetchMonth = useCallback(async () => {
        if (!groupOrgIds || groupOrgIds.length === 0) return;
        setLoading(true);
        try {
            const supabase = getSupabase();
            const [year, month] = selectedMonth.split('-').map(Number);
            const startOfMonth = new Date(year, month - 1, 1).toISOString();
            const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
            const orgIds = groupOrgIds.map(o => o.id);

            const { data: cases } = await supabase
                .from('cases')
                .select('id, organisation_id, status, risk_level, outcome, loss_amount, submitted_at')
                .in('organisation_id', orgIds)
                .gte('submitted_at', startOfMonth)
                .lte('submitted_at', endOfMonth);

            const allCases = cases ?? [];
            const overdueThreshold = new Date(Date.now() - SLA_DAYS * 24 * 60 * 60 * 1000);

            const stats: OrgMonthly[] = groupOrgIds.map(org => {
                const orgCases = allCases.filter(c => c.organisation_id === org.id);
                const closed = orgCases.filter(c => c.status === 'closed');
                const open = orgCases.filter(c => c.status !== 'closed');
                const highRisk = open.filter(c => ['high', 'critical'].includes((c.risk_level ?? '').toLowerCase()));
                const overdue = open.filter(c => new Date(c.submitted_at) < overdueThreshold);
                const loss = orgCases.filter(c => c.outcome === 'lost' && typeof c.loss_amount === 'number').reduce((sum, c) => sum + (c.loss_amount as number), 0);

                return { id: org.id, name: org.name, totalCases: orgCases.length, openCases: open.length, closedCases: closed.length, overdueCases: overdue.length, highRiskOpen: highRisk.length, totalLoss: loss };
            });

            setOrgMetrics(stats);
        } catch (err: any) {
            setError(err?.message ?? 'Failed to load monthly data');
        } finally {
            setLoading(false);
        }
    }, [groupOrgIds, selectedMonth]);

    useEffect(() => { fetchMonth(); }, [fetchMonth]);

    const displayMetrics = useMemo(
        () => filterHomeId ? orgMetrics.filter(m => m.id === filterHomeId) : orgMetrics,
        [orgMetrics, filterHomeId]
    );

    const totals = {
        totalCases: displayMetrics.reduce((s, o) => s + o.totalCases, 0),
        openCases: displayMetrics.reduce((s, o) => s + o.openCases, 0),
        closedCases: displayMetrics.reduce((s, o) => s + o.closedCases, 0),
        overdue: displayMetrics.reduce((s, o) => s + o.overdueCases, 0),
        highRisk: displayMetrics.reduce((s, o) => s + o.highRiskOpen, 0),
        totalLoss: displayMetrics.reduce((s, o) => s + o.totalLoss, 0),
    };

    if (loading && !groupOrgIds) {
        return (<div className="dashboard-overview-loading"><Loader2 className="dashboard-overview-spinner-icon" /><p>Loading group monthly report…</p></div>);
    }
    if (error) {
        return (<div className="dashboard-overview-error"><AlertTriangle size={20} /><span>{error}</span></div>);
    }

    const monthLabel = months.find(m => m.value === selectedMonth)?.label ?? selectedMonth;

    return (
        <div className="gp-page">
            {/* Header */}
            <div className="gp-header">
                <div>
                    <h1 className="gp-title"><Calendar size={20} /> {groupName}</h1>
                </div>
                <div className="gp-actions">
                    {allOrgs.length > 0 && (
                        <GroupHomeFilter homes={allOrgs} selectedHomeId={filterHomeId} onSelect={setFilterHomeId} />
                    )}
                    <select className="dsf-input" style={{ width: 'auto', minWidth: '180px' }} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                        {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    {displayMetrics.length > 0 && (
                        <button className="gp-export-btn"
                            onClick={() => downloadCsv(`group-monthly-${selectedMonth}.csv`, ['Home', 'Total Cases', 'Open', 'Closed', 'Overdue', 'High-Risk Open', 'Total Loss'],
                                displayMetrics.map(o => [o.name, String(o.totalCases), String(o.openCases), String(o.closedCases), String(o.overdueCases), String(o.highRiskOpen), String(o.totalLoss)]))}>
                            <Download size={13} /> Export CSV
                        </button>
                    )}
                    {loading && <Loader2 size={16} className="dsf-spinner" />}
                </div>
            </div>

            {/* KPI Strip */}
            <div className="gp-kpi-strip">
                <div className="gp-kpi"><div className="gp-kpi-value">{totals.totalCases}</div><div className="gp-kpi-label">Total Cases</div><div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{monthLabel}</div></div>
                <div className="gp-kpi"><div className="gp-kpi-value">{totals.openCases}</div><div className="gp-kpi-label">Open</div></div>
                <div className="gp-kpi"><div className="gp-kpi-value">{totals.closedCases}</div><div className="gp-kpi-label">Closed</div></div>
                <div className="gp-kpi"><div className="gp-kpi-value" style={totals.overdue > 0 ? { color: '#f59e0b' } : undefined}>{totals.overdue}</div><div className="gp-kpi-label">Overdue</div></div>
                <div className="gp-kpi"><div className="gp-kpi-value" style={totals.highRisk > 0 ? { color: '#dc2626' } : undefined}>{totals.highRisk}</div><div className="gp-kpi-label">High-Risk Open</div></div>
                <div className="gp-kpi"><div className="gp-kpi-value">{currency(totals.totalLoss)}</div><div className="gp-kpi-label">Total Loss</div></div>
            </div>

            {/* Monthly Table */}
            <div className="gp-card">
                <div className="gp-card-header">
                    <h2 className="gp-card-title"><Clock size={15} /> Home Breakdown — {monthLabel}</h2>
                </div>
                <div className="gp-table-wrap">
                    <table className="gp-table">
                        <thead>
                            <tr>
                                <th>Home</th>
                                <th className="text-right">Total</th>
                                <th className="text-right">Open</th>
                                <th className="text-right">Closed</th>
                                <th className="text-right">Overdue</th>
                                <th className="text-right">High-Risk</th>
                                <th className="text-right">Total Loss</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayMetrics.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No cases submitted in {monthLabel}</td></tr>
                            ) : displayMetrics.map(m => (
                                <tr key={m.id} className="gp-row-click" onClick={() => setFilterHomeId(filterHomeId === m.id ? null : m.id)}>
                                    <td className="gp-home-name">{m.name}</td>
                                    <td className="text-right">{m.totalCases}</td>
                                    <td className="text-right">{m.openCases}</td>
                                    <td className="text-right">{m.closedCases}</td>
                                    <td className="text-right"><span className={m.overdueCases > 0 ? 'gp-val-warn' : ''}>{m.overdueCases}</span></td>
                                    <td className="text-right"><span className={m.highRiskOpen > 0 ? 'gp-val-danger' : ''}>{m.highRiskOpen}</span></td>
                                    <td className="text-right">{currency(m.totalLoss)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
