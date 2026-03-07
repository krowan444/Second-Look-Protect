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
        <div>
            <div className="dashboard-page-header">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                        <h1 className="dashboard-page-title">
                            <Calendar size={22} style={{ verticalAlign: 'text-bottom', marginRight: '6px' }} />
                            {groupName}
                        </h1>
                    </div>
                    {allOrgs.length > 0 && (
                        <GroupHomeFilter homes={allOrgs} selectedHomeId={filterHomeId} onSelect={setFilterHomeId} />
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    <select className="dsf-input" style={{ width: 'auto', minWidth: '180px' }} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                        {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    {displayMetrics.length > 0 && (
                        <button className="casedetail-btn casedetail-btn-action" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                            onClick={() => downloadCsv(`group-monthly-${selectedMonth}.csv`, ['Home', 'Total Cases', 'Open', 'Closed', 'Overdue', 'High-Risk Open', 'Total Loss'],
                                displayMetrics.map(o => [o.name, String(o.totalCases), String(o.openCases), String(o.closedCases), String(o.overdueCases), String(o.highRiskOpen), String(o.totalLoss)]))}>
                            <Download size={13} /> Export CSV
                        </button>
                    )}
                    {loading && <Loader2 size={16} className="dsf-spinner" />}
                </div>
            </div>

            <div className="dashboard-stats-row" style={{ marginBottom: '2rem' }}>
                <div className="dashboard-stat-card"><div className="dashboard-stat-value">{totals.totalCases}</div><div className="dashboard-stat-label">Total Cases</div><div className="dashboard-stat-period">{monthLabel}</div></div>
                <div className="dashboard-stat-card"><div className="dashboard-stat-value">{totals.openCases}</div><div className="dashboard-stat-label">Open</div></div>
                <div className="dashboard-stat-card"><div className="dashboard-stat-value">{totals.closedCases}</div><div className="dashboard-stat-label">Closed</div></div>
                <div className="dashboard-stat-card"><div className="dashboard-stat-value" style={totals.overdue > 0 ? { color: '#f59e0b' } : undefined}>{totals.overdue}</div><div className="dashboard-stat-label">Overdue</div></div>
                <div className="dashboard-stat-card"><div className="dashboard-stat-value" style={totals.highRisk > 0 ? { color: '#dc2626' } : undefined}>{totals.highRisk}</div><div className="dashboard-stat-label">High-Risk Open</div></div>
                <div className="dashboard-stat-card"><div className="dashboard-stat-value">{currency(totals.totalLoss)}</div><div className="dashboard-stat-label">Total Loss</div></div>
            </div>

            <div className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <h2 className="dashboard-panel-title"><Clock size={16} className="dashboard-panel-title-icon" /> Home Breakdown — {monthLabel}</h2>
                </div>
                <div className="dashboard-table-wrap">
                    <table className="dashboard-table">
                        <thead>
                            <tr>
                                <th className="dashboard-table-th">Home</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Total</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Open</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Closed</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Overdue</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>High-Risk</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Total Loss</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayMetrics.length === 0 ? (
                                <tr><td className="dashboard-table-td" colSpan={7} style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No cases submitted in {monthLabel}</td></tr>
                            ) : displayMetrics.map(m => (
                                <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => setFilterHomeId(filterHomeId === m.id ? null : m.id)}>
                                    <td className="dashboard-table-td" style={{ fontWeight: 600, color: '#C9A84C' }}>{m.name}</td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>{m.totalCases}</td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>{m.openCases}</td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>{m.closedCases}</td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}><span style={m.overdueCases > 0 ? { color: '#f59e0b', fontWeight: 600 } : undefined}>{m.overdueCases}</span></td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}><span style={m.highRiskOpen > 0 ? { color: '#dc2626', fontWeight: 600 } : undefined}>{m.highRiskOpen}</span></td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>{currency(m.totalLoss)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
