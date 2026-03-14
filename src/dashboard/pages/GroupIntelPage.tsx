import React, { useState, useEffect, useMemo } from 'react';
import {
    Loader2, AlertTriangle, BarChart3, TrendingUp, TrendingDown,
    AlertOctagon, Clock, DollarSign,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import { useGroupHomeFilter } from '../hooks/useGroupHomeFilter';
import { GroupHomeFilter } from '../components/GroupHomeFilter';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface OrgMetrics {
    id: string;
    name: string;
    totalCases: number;
    openCases: number;
    closedCases: number;
    overdueCases: number;
    highRiskOpen: number;
    totalLoss: number;
    closureRate: number;       // 0–100
    avgLossPerCase: number;
}

interface Insight {
    label: string;
    homeName: string;
    value: string;
    icon: React.ReactNode;
    color: string;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const SLA_DAYS = 3;

function currency(n: number): string {
    return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 0 });
}

function pct(n: number): string {
    return n.toFixed(0) + '%';
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function GroupIntelPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [groupName, setGroupName] = useState('Group Intelligence');
    const [metrics, setMetrics] = useState<OrgMetrics[]>([]);
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

                let resolvedOrgId = profile.organisation_id;
                if (profile.role === 'super_admin') {
                    const switcherOrg = localStorage.getItem('slp_active_org_id');
                    if (switcherOrg) resolvedOrgId = switcherOrg;
                }

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

                const { data: groupRow } = await supabase
                    .from('organisation_groups')
                    .select('name')
                    .eq('id', groupId)
                    .single();

                if (!cancelled && groupRow?.name) setGroupName(groupRow.name + ' — Comparison Intelligence');

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

                const { data: cases } = await supabase
                    .from('cases')
                    .select('id, organisation_id, status, risk_level, outcome, loss_amount, submitted_at')
                    .in('organisation_id', orgIds);

                const allCases = cases ?? [];
                const overdueThreshold = new Date(Date.now() - SLA_DAYS * 24 * 60 * 60 * 1000);

                const stats: OrgMetrics[] = groupOrgs.map(org => {
                    const orgCases = allCases.filter(c => c.organisation_id === org.id);
                    const closed = orgCases.filter(c => c.status === 'closed');
                    const open = orgCases.filter(c => c.status !== 'closed');
                    const highRisk = open.filter(c => ['high', 'critical'].includes((c.risk_level ?? '').toLowerCase()));
                    const overdue = open.filter(c => new Date(c.submitted_at) < overdueThreshold);
                    const loss = orgCases
                        .filter(c => c.outcome === 'lost' && typeof c.loss_amount === 'number')
                        .reduce((sum, c) => sum + (c.loss_amount as number), 0);

                    const total = orgCases.length;
                    return {
                        id: org.id,
                        name: org.name,
                        totalCases: total,
                        openCases: open.length,
                        closedCases: closed.length,
                        overdueCases: overdue.length,
                        highRiskOpen: highRisk.length,
                        totalLoss: loss,
                        closureRate: total > 0 ? Math.round((closed.length / total) * 100) : 0,
                        avgLossPerCase: total > 0 ? Math.round(loss / total) : 0,
                    };
                });

                if (!cancelled) setMetrics(stats);
            } catch (err: any) {
                if (!cancelled) setError(err?.message ?? 'Failed to load group intelligence');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    const displayMetrics = useMemo(
        () => filterHomeId ? metrics.filter(m => m.id === filterHomeId) : metrics,
        [metrics, filterHomeId]
    );

    /* ── Derive insights ─────────────────────────────────────────────────── */

    function buildInsights(): Insight[] {
        if (metrics.length === 0) return [];
        const insights: Insight[] = [];

        const highestLoss = [...metrics].sort((a, b) => b.totalLoss - a.totalLoss)[0];
        if (highestLoss.totalLoss > 0) {
            insights.push({
                label: 'Highest Loss',
                homeName: highestLoss.name,
                value: currency(highestLoss.totalLoss),
                icon: <DollarSign size={18} />,
                color: '#dc2626',
            });
        }

        const mostOverdue = [...metrics].sort((a, b) => b.overdueCases - a.overdueCases)[0];
        if (mostOverdue.overdueCases > 0) {
            insights.push({
                label: 'Most Overdue',
                homeName: mostOverdue.name,
                value: `${mostOverdue.overdueCases} case${mostOverdue.overdueCases !== 1 ? 's' : ''}`,
                icon: <Clock size={18} />,
                color: '#f59e0b',
            });
        }

        const mostHighRisk = [...metrics].sort((a, b) => b.highRiskOpen - a.highRiskOpen)[0];
        if (mostHighRisk.highRiskOpen > 0) {
            insights.push({
                label: 'Most High-Risk Open',
                homeName: mostHighRisk.name,
                value: `${mostHighRisk.highRiskOpen} case${mostHighRisk.highRiskOpen !== 1 ? 's' : ''}`,
                icon: <AlertOctagon size={18} />,
                color: '#dc2626',
            });
        }

        const withCases = metrics.filter(m => m.totalCases > 0);
        if (withCases.length > 0) {
            const best = [...withCases].sort((a, b) => b.closureRate - a.closureRate)[0];
            insights.push({
                label: 'Best Closure Rate',
                homeName: best.name,
                value: pct(best.closureRate),
                icon: <TrendingUp size={18} />,
                color: '#16a34a',
            });

            const worst = [...withCases].sort((a, b) => a.closureRate - b.closureRate)[0];
            insights.push({
                label: 'Worst Closure Rate',
                homeName: worst.name,
                value: pct(worst.closureRate),
                icon: <TrendingDown size={18} />,
                color: '#ea580c',
            });
        }

        return insights;
    }

    const insights = buildInsights();

    /* ── Render ───────────────────────────────────────────────────────────── */

    if (loading) {
        return (
            <div className="dashboard-overview-loading">
                <Loader2 className="dashboard-overview-spinner-icon" />
                <p>Loading comparison intelligence…</p>
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
                    <h1 className="gp-title"><BarChart3 size={20} /> {groupName}</h1>
                    <p className="gp-subtitle">Cross-home risk and performance comparison — {displayMetrics.length} home{displayMetrics.length !== 1 ? 's' : ''}</p>
                </div>
                {allOrgs.length > 0 && (
                    <GroupHomeFilter homes={allOrgs} selectedHomeId={filterHomeId} onSelect={setFilterHomeId} />
                )}
            </div>

            {/* Insight Cards */}
            {insights.length > 0 && (
                <div className="gp-highlights">
                    {insights.map((ins, i) => (
                        <div key={i} className="gp-highlight">
                            <div className="gp-highlight-icon" style={{ background: ins.color + '14', color: ins.color }}>
                                {ins.icon}
                            </div>
                            <div>
                                <div className="gp-highlight-label">{ins.label}</div>
                                <div className="gp-highlight-home">{ins.homeName}</div>
                                <div className="gp-highlight-value">{ins.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Detailed Comparison Table */}
            <div className="gp-card">
                <div className="gp-card-header">
                    <h2 className="gp-card-title"><BarChart3 size={15} /> Detailed Comparison</h2>
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
                                <th className="text-right">Closure Rate</th>
                                <th className="text-right">Total Loss</th>
                                <th className="text-right">Avg Loss/Case</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayMetrics.map(m => (
                                <tr key={m.id} className="gp-row-click" onClick={() => setFilterHomeId(filterHomeId === m.id ? null : m.id)}>
                                    <td className="gp-home-name">{m.name}</td>
                                    <td className="text-right">{m.totalCases}</td>
                                    <td className="text-right">{m.openCases}</td>
                                    <td className="text-right">{m.closedCases}</td>
                                    <td className="text-right">
                                        <span className={m.overdueCases > 0 ? 'gp-val-warn' : ''}>{m.overdueCases}</span>
                                    </td>
                                    <td className="text-right">
                                        <span className={m.highRiskOpen > 0 ? 'gp-val-danger' : ''}>{m.highRiskOpen}</span>
                                    </td>
                                    <td className="text-right">
                                        <span className={m.closureRate >= 80 ? 'gp-val-good' : m.closureRate >= 50 ? 'gp-val-warn' : 'gp-val-danger'}>
                                            {pct(m.closureRate)}
                                        </span>
                                    </td>
                                    <td className="text-right">{currency(m.totalLoss)}</td>
                                    <td className="text-right">{currency(m.avgLossPerCase)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
