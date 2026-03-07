import React, { useState, useEffect } from 'react';
import {
    Loader2, AlertTriangle, GitCompareArrows, TrendingUp, TrendingDown,
    AlertOctagon, Clock, DollarSign, ArrowUp, ArrowDown, Minus,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface HomeBenchmark {
    id: string;
    name: string;
    totalCases: number;
    openRate: number;
    closureRate: number;
    overdueRate: number;
    highRiskRate: number;
    totalLoss: number;
    avgLossPerCase: number;
}

interface GroupAvg {
    openRate: number;
    closureRate: number;
    overdueRate: number;
    highRiskRate: number;
    avgLossPerCase: number;
}

interface Highlight {
    label: string;
    homeName: string;
    value: string;
    icon: React.ReactNode;
    color: string;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const SLA_DAYS = 3;

function pct(n: number): string { return n.toFixed(1) + '%'; }
function currency(n: number): string { return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 0 }); }

function Indicator({ value, avg, invert }: { value: number; avg: number; invert?: boolean }) {
    const diff = value - avg;
    if (Math.abs(diff) < 0.5) return <Minus size={13} style={{ color: '#94a3b8' }} />;
    const isAbove = diff > 0;
    // For rates like overdue/high-risk, above average is bad; for closure rate, above is good
    const isGood = invert ? !isAbove : isAbove;
    const color = isGood ? '#16a34a' : '#dc2626';
    return isAbove
        ? <ArrowUp size={13} style={{ color }} />
        : <ArrowDown size={13} style={{ color }} />;
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function GroupBenchmarkPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [groupName, setGroupName] = useState('Group Benchmarking');
    const [homes, setHomes] = useState<HomeBenchmark[]>([]);
    const [avg, setAvg] = useState<GroupAvg>({ openRate: 0, closureRate: 0, overdueRate: 0, highRiskRate: 0, avgLossPerCase: 0 });

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
                if (!allowedRoles.includes(profile.role)) {
                    setError('Access denied. Group pages are only available to administrators.');
                    setLoading(false);
                    return;
                }

                let resolvedOrgId = profile.organisation_id;
                if (profile.role === 'super_admin') {
                    const s = localStorage.getItem('slp_active_org_id');
                    if (s) resolvedOrgId = s;
                }

                const { data: orgRow } = await supabase
                    .from('organisations')
                    .select('organisation_group_id')
                    .eq('id', resolvedOrgId)
                    .single();

                const groupId = orgRow?.organisation_group_id;
                if (!groupId) { setError('Your organisation is not part of a group.'); setLoading(false); return; }

                const { data: groupRow } = await supabase
                    .from('organisation_groups')
                    .select('name')
                    .eq('id', groupId)
                    .single();

                if (!cancelled && groupRow?.name) setGroupName(groupRow.name + ' — Benchmarking');

                const { data: groupOrgs } = await supabase
                    .from('organisations')
                    .select('id, name')
                    .eq('organisation_group_id', groupId)
                    .order('name');

                if (!groupOrgs || groupOrgs.length === 0) { setError('No organisations found in this group.'); setLoading(false); return; }

                const orgIds = groupOrgs.map(o => o.id);

                const { data: cases } = await supabase
                    .from('cases')
                    .select('id, organisation_id, status, risk_level, outcome, loss_amount, submitted_at')
                    .in('organisation_id', orgIds);

                const allCases = cases ?? [];
                const overdueThreshold = new Date(Date.now() - SLA_DAYS * 24 * 60 * 60 * 1000);

                const homeData: HomeBenchmark[] = groupOrgs.map(org => {
                    const oc = allCases.filter(c => c.organisation_id === org.id);
                    const total = oc.length;
                    const open = oc.filter(c => c.status !== 'closed');
                    const closed = oc.filter(c => c.status === 'closed');
                    const highRisk = open.filter(c => ['high', 'critical'].includes((c.risk_level ?? '').toLowerCase()));
                    const overdue = open.filter(c => new Date(c.submitted_at) < overdueThreshold);
                    const loss = oc
                        .filter(c => c.outcome === 'lost' && typeof c.loss_amount === 'number')
                        .reduce((s, c) => s + (c.loss_amount as number), 0);

                    return {
                        id: org.id,
                        name: org.name,
                        totalCases: total,
                        openRate: total > 0 ? (open.length / total) * 100 : 0,
                        closureRate: total > 0 ? (closed.length / total) * 100 : 0,
                        overdueRate: total > 0 ? (overdue.length / total) * 100 : 0,
                        highRiskRate: total > 0 ? (highRisk.length / total) * 100 : 0,
                        totalLoss: loss,
                        avgLossPerCase: total > 0 ? Math.round(loss / total) : 0,
                    };
                });

                // Group averages
                const withCases = homeData.filter(h => h.totalCases > 0);
                const n = withCases.length || 1;
                const groupAvg: GroupAvg = {
                    openRate: withCases.reduce((s, h) => s + h.openRate, 0) / n,
                    closureRate: withCases.reduce((s, h) => s + h.closureRate, 0) / n,
                    overdueRate: withCases.reduce((s, h) => s + h.overdueRate, 0) / n,
                    highRiskRate: withCases.reduce((s, h) => s + h.highRiskRate, 0) / n,
                    avgLossPerCase: withCases.reduce((s, h) => s + h.avgLossPerCase, 0) / n,
                };

                if (!cancelled) { setHomes(homeData); setAvg(groupAvg); }
            } catch (err: any) {
                if (!cancelled) setError(err?.message ?? 'Failed to load benchmarking data');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    /* ── Highlights ───────────────────────────────────────────────────────── */
    function buildHighlights(): Highlight[] {
        const withCases = homes.filter(h => h.totalCases > 0);
        if (withCases.length === 0) return [];
        const hl: Highlight[] = [];

        const worstOverdue = [...withCases].sort((a, b) => b.overdueRate - a.overdueRate)[0];
        if (worstOverdue.overdueRate > 0) {
            hl.push({ label: 'Highest Overdue Rate', homeName: worstOverdue.name, value: pct(worstOverdue.overdueRate), icon: <Clock size={18} />, color: '#f59e0b' });
        }

        const worstHighRisk = [...withCases].sort((a, b) => b.highRiskRate - a.highRiskRate)[0];
        if (worstHighRisk.highRiskRate > 0) {
            hl.push({ label: 'Highest High-Risk Rate', homeName: worstHighRisk.name, value: pct(worstHighRisk.highRiskRate), icon: <AlertOctagon size={18} />, color: '#dc2626' });
        }

        const worstAvgLoss = [...withCases].sort((a, b) => b.avgLossPerCase - a.avgLossPerCase)[0];
        if (worstAvgLoss.avgLossPerCase > 0) {
            hl.push({ label: 'Highest Avg Loss/Case', homeName: worstAvgLoss.name, value: currency(worstAvgLoss.avgLossPerCase), icon: <DollarSign size={18} />, color: '#ea580c' });
        }

        const bestClosure = [...withCases].sort((a, b) => b.closureRate - a.closureRate)[0];
        hl.push({ label: 'Strongest Closure Rate', homeName: bestClosure.name, value: pct(bestClosure.closureRate), icon: <TrendingUp size={18} />, color: '#16a34a' });

        if (withCases.length > 1) {
            const worstClosure = [...withCases].sort((a, b) => a.closureRate - b.closureRate)[0];
            if (worstClosure.id !== bestClosure.id) {
                hl.push({ label: 'Weakest Closure Rate', homeName: worstClosure.name, value: pct(worstClosure.closureRate), icon: <TrendingDown size={18} />, color: '#dc2626' });
            }
        }

        return hl;
    }

    const highlights = buildHighlights();

    /* ── Render ───────────────────────────────────────────────────────────── */

    if (loading) {
        return (
            <div className="dashboard-overview-loading">
                <Loader2 className="dashboard-overview-spinner-icon" />
                <p>Loading benchmarking data…</p>
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
        <div>
            {/* Header */}
            <div className="dashboard-page-header">
                <h1 className="dashboard-page-title">
                    <GitCompareArrows size={22} style={{ verticalAlign: 'text-bottom', marginRight: '6px' }} />
                    {groupName}
                </h1>
                <p className="dashboard-page-subtitle">
                    Comparing {homes.length} home{homes.length !== 1 ? 's' : ''} against group average
                </p>
            </div>

            {/* ── Highlight Cards ─────────────────────────────────────────── */}
            {highlights.length > 0 && (
                <div className="dashboard-stats-row" style={{ marginBottom: '2rem' }}>
                    {highlights.map((h, i) => (
                        <div key={i} className="dashboard-stat-card" style={{ borderLeft: `4px solid ${h.color}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.35rem', color: h.color }}>
                                {h.icon}
                                <span style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                                    {h.label}
                                </span>
                            </div>
                            <div className="dashboard-stat-value" style={{ fontSize: '1.35rem' }}>{h.value}</div>
                            <div className="dashboard-stat-label">{h.homeName}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Benchmark Table ─────────────────────────────────────────── */}
            <div className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <h2 className="dashboard-panel-title">
                        <GitCompareArrows size={16} className="dashboard-panel-title-icon" /> Home vs Group Average
                    </h2>
                </div>
                <div className="dashboard-table-wrap">
                    <table className="dashboard-table">
                        <thead>
                            <tr>
                                <th className="dashboard-table-th">Home</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Cases</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Open Rate</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Closure Rate</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Overdue Rate</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>High-Risk Rate</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Total Loss</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Avg Loss/Case</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Group Average row */}
                            <tr style={{ background: '#f8fafc', fontStyle: 'italic' }}>
                                <td className="dashboard-table-td" style={{ fontWeight: 600, color: '#64748b' }}>Group Average</td>
                                <td className="dashboard-table-td" style={{ textAlign: 'right', color: '#64748b' }}>—</td>
                                <td className="dashboard-table-td" style={{ textAlign: 'right', color: '#64748b' }}>{pct(avg.openRate)}</td>
                                <td className="dashboard-table-td" style={{ textAlign: 'right', color: '#64748b' }}>{pct(avg.closureRate)}</td>
                                <td className="dashboard-table-td" style={{ textAlign: 'right', color: '#64748b' }}>{pct(avg.overdueRate)}</td>
                                <td className="dashboard-table-td" style={{ textAlign: 'right', color: '#64748b' }}>{pct(avg.highRiskRate)}</td>
                                <td className="dashboard-table-td" style={{ textAlign: 'right', color: '#64748b' }}>—</td>
                                <td className="dashboard-table-td" style={{ textAlign: 'right', color: '#64748b' }}>{currency(Math.round(avg.avgLossPerCase))}</td>
                            </tr>
                            {homes.map(h => (
                                <tr key={h.id}>
                                    <td className="dashboard-table-td" style={{ fontWeight: 600 }}>{h.name}</td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>{h.totalCases}</td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>
                                        {pct(h.openRate)} <Indicator value={h.openRate} avg={avg.openRate} />
                                    </td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>
                                        <span style={{ color: h.closureRate >= avg.closureRate ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                                            {pct(h.closureRate)}
                                        </span>{' '}
                                        <Indicator value={h.closureRate} avg={avg.closureRate} invert />
                                    </td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>
                                        <span style={h.overdueRate > avg.overdueRate ? { color: '#f59e0b', fontWeight: 600 } : undefined}>
                                            {pct(h.overdueRate)}
                                        </span>{' '}
                                        <Indicator value={h.overdueRate} avg={avg.overdueRate} />
                                    </td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>
                                        <span style={h.highRiskRate > avg.highRiskRate ? { color: '#dc2626', fontWeight: 600 } : undefined}>
                                            {pct(h.highRiskRate)}
                                        </span>{' '}
                                        <Indicator value={h.highRiskRate} avg={avg.highRiskRate} />
                                    </td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>{currency(h.totalLoss)}</td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>
                                        {currency(h.avgLossPerCase)}{' '}
                                        <Indicator value={h.avgLossPerCase} avg={avg.avgLossPerCase} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
