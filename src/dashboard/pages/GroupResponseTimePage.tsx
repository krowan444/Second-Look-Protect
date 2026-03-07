import React, { useState, useEffect, useMemo } from 'react';
import {
    Loader2, AlertTriangle, Timer, ArrowUp, ArrowDown, Minus,
    Zap, Clock,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import { useGroupHomeFilter } from '../hooks/useGroupHomeFilter';
import { GroupHomeFilter } from '../components/GroupHomeFilter';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface HomeSpeed {
    id: string;
    name: string;
    avgReviewHours: number | null;   // null if no reviewed cases
    avgCloseHours: number | null;    // null if no closed cases
    avgOpenAgeHours: number | null;  // null if no open cases
    overdueOpen: number;
    reviewedCount: number;
    closedCount: number;
    openCount: number;
}

interface Highlight {
    label: string;
    homeName: string;
    value: string;
    color: string;
    icon: React.ReactNode;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const SLA_DAYS = 3;

function hoursBetween(a: string, b: string): number {
    return (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60);
}

function fmtDuration(hours: number | null): string {
    if (hours === null) return '—';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 48) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
}

function Indicator({ value, avg, lower }: { value: number | null; avg: number | null; lower?: boolean }) {
    if (value === null || avg === null) return null;
    const diff = value - avg;
    if (Math.abs(diff) < 0.5) return <Minus size={13} style={{ color: '#94a3b8' }} />;
    const isAbove = diff > 0;
    // For response time, lower is better unless `lower` is false
    const isGood = lower ? !isAbove : isAbove;
    const color = isGood ? '#16a34a' : '#dc2626';
    return isAbove
        ? <ArrowUp size={13} style={{ color }} />
        : <ArrowDown size={13} style={{ color }} />;
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function GroupResponseTimePage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [groupName, setGroupName] = useState('Group Response-Time');
    const [homes, setHomes] = useState<HomeSpeed[]>([]);
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

                if (!cancelled && groupRow?.name) setGroupName(groupRow.name + ' — Response-Time');

                const { data: groupOrgs } = await supabase
                    .from('organisations')
                    .select('id, name')
                    .eq('organisation_group_id', groupId)
                    .order('name');

                if (!groupOrgs || groupOrgs.length === 0) { setError('No organisations found in this group.'); setLoading(false); return; }

                const orgIds = groupOrgs.map(o => o.id);

                const { data: cases } = await supabase
                    .from('cases')
                    .select('id, organisation_id, status, submitted_at, reviewed_at, closed_at')
                    .in('organisation_id', orgIds);

                const allCases = cases ?? [];
                const now = Date.now();
                const overdueThreshold = new Date(now - SLA_DAYS * 24 * 60 * 60 * 1000);

                const homeData: HomeSpeed[] = groupOrgs.map(org => {
                    const oc = allCases.filter(c => c.organisation_id === org.id);
                    const reviewed = oc.filter(c => c.reviewed_at && c.submitted_at);
                    const closed = oc.filter(c => c.closed_at && c.submitted_at);
                    const open = oc.filter(c => c.status !== 'closed');
                    const overdue = open.filter(c => new Date(c.submitted_at) < overdueThreshold);

                    const avgReview = reviewed.length > 0
                        ? reviewed.reduce((s, c) => s + hoursBetween(c.submitted_at, c.reviewed_at!), 0) / reviewed.length
                        : null;

                    const avgClose = closed.length > 0
                        ? closed.reduce((s, c) => s + hoursBetween(c.submitted_at, c.closed_at!), 0) / closed.length
                        : null;

                    const avgOpenAge = open.length > 0
                        ? open.reduce((s, c) => s + (now - new Date(c.submitted_at).getTime()) / (1000 * 60 * 60), 0) / open.length
                        : null;

                    return {
                        id: org.id,
                        name: org.name,
                        avgReviewHours: avgReview,
                        avgCloseHours: avgClose,
                        avgOpenAgeHours: avgOpenAge,
                        overdueOpen: overdue.length,
                        reviewedCount: reviewed.length,
                        closedCount: closed.length,
                        openCount: open.length,
                    };
                });

                if (!cancelled) setHomes(homeData);
            } catch (err: any) {
                if (!cancelled) setError(err?.message ?? 'Failed to load response-time data');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    /* ── Group averages ──────────────────────────────────────────────────── */
    const withReview = homes.filter(h => h.avgReviewHours !== null);
    const withClose = homes.filter(h => h.avgCloseHours !== null);
    const withOpen = homes.filter(h => h.avgOpenAgeHours !== null);

    const avgGroupReview = withReview.length > 0
        ? withReview.reduce((s, h) => s + h.avgReviewHours!, 0) / withReview.length
        : null;
    const avgGroupClose = withClose.length > 0
        ? withClose.reduce((s, h) => s + h.avgCloseHours!, 0) / withClose.length
        : null;
    const avgGroupOpenAge = withOpen.length > 0
        ? withOpen.reduce((s, h) => s + h.avgOpenAgeHours!, 0) / withOpen.length
        : null;

    /* ── Highlights ──────────────────────────────────────────────────────── */
    function buildHighlights(): Highlight[] {
        const hl: Highlight[] = [];

        if (withReview.length > 0) {
            const fastest = [...withReview].sort((a, b) => a.avgReviewHours! - b.avgReviewHours!)[0];
            hl.push({ label: 'Fastest Review', homeName: fastest.name, value: fmtDuration(fastest.avgReviewHours), color: '#16a34a', icon: <Zap size={18} /> });

            if (withReview.length > 1) {
                const slowest = [...withReview].sort((a, b) => b.avgReviewHours! - a.avgReviewHours!)[0];
                if (slowest.id !== fastest.id) {
                    hl.push({ label: 'Slowest Review', homeName: slowest.name, value: fmtDuration(slowest.avgReviewHours), color: '#dc2626', icon: <Clock size={18} /> });
                }
            }
        }

        if (withClose.length > 0) {
            const fastest = [...withClose].sort((a, b) => a.avgCloseHours! - b.avgCloseHours!)[0];
            hl.push({ label: 'Fastest Closure', homeName: fastest.name, value: fmtDuration(fastest.avgCloseHours), color: '#16a34a', icon: <Zap size={18} /> });

            if (withClose.length > 1) {
                const slowest = [...withClose].sort((a, b) => b.avgCloseHours! - a.avgCloseHours!)[0];
                if (slowest.id !== fastest.id) {
                    hl.push({ label: 'Slowest Closure', homeName: slowest.name, value: fmtDuration(slowest.avgCloseHours), color: '#dc2626', icon: <Clock size={18} /> });
                }
            }
        }

        if (withOpen.length > 0) {
            const oldest = [...withOpen].sort((a, b) => b.avgOpenAgeHours! - a.avgOpenAgeHours!)[0];
            if (oldest.avgOpenAgeHours! > 0) {
                hl.push({ label: 'Highest Avg Open Age', homeName: oldest.name, value: fmtDuration(oldest.avgOpenAgeHours), color: '#f59e0b', icon: <Timer size={18} /> });
            }
        }

        return hl;
    }

    const highlights = buildHighlights();

    const displayHomes = useMemo(
        () => filterHomeId ? homes.filter(h => h.id === filterHomeId) : homes,
        [homes, filterHomeId]
    );

    /* ── Render ───────────────────────────────────────────────────────────── */

    if (loading) {
        return (
            <div className="dashboard-overview-loading">
                <Loader2 className="dashboard-overview-spinner-icon" />
                <p>Loading response-time data…</p>
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
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                        <h1 className="dashboard-page-title">
                            <Timer size={22} style={{ verticalAlign: 'text-bottom', marginRight: '6px' }} />
                            {groupName}
                        </h1>
                        <p className="dashboard-page-subtitle">
                            Operational speed comparison across {displayHomes.length} home{displayHomes.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    {allOrgs.length > 0 && (
                        <GroupHomeFilter homes={allOrgs} selectedHomeId={filterHomeId} onSelect={setFilterHomeId} />
                    )}
                </div>
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

            {/* ── Comparison Table ────────────────────────────────────────── */}
            <div className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <h2 className="dashboard-panel-title">
                        <Timer size={16} className="dashboard-panel-title-icon" /> Home Response Comparison
                    </h2>
                </div>
                <div className="dashboard-table-wrap">
                    <table className="dashboard-table">
                        <thead>
                            <tr>
                                <th className="dashboard-table-th">Home</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Avg Review Time</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Avg Closure Time</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Avg Open Age</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Overdue Open</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Group average row */}
                            <tr style={{ background: '#f8fafc', fontStyle: 'italic' }}>
                                <td className="dashboard-table-td" style={{ fontWeight: 600, color: '#64748b' }}>Group Average</td>
                                <td className="dashboard-table-td" style={{ textAlign: 'right', color: '#64748b' }}>{fmtDuration(avgGroupReview)}</td>
                                <td className="dashboard-table-td" style={{ textAlign: 'right', color: '#64748b' }}>{fmtDuration(avgGroupClose)}</td>
                                <td className="dashboard-table-td" style={{ textAlign: 'right', color: '#64748b' }}>{fmtDuration(avgGroupOpenAge)}</td>
                                <td className="dashboard-table-td" style={{ textAlign: 'right', color: '#64748b' }}>—</td>
                            </tr>
                            {displayHomes.map(h => (
                                <tr key={h.id} style={{ cursor: 'pointer' }} onClick={() => setFilterHomeId(filterHomeId === h.id ? null : h.id)}>
                                    <td className="dashboard-table-td" style={{ fontWeight: 600 }}>{h.name}</td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>
                                        <span style={h.avgReviewHours !== null && avgGroupReview !== null && h.avgReviewHours > avgGroupReview ? { color: '#dc2626', fontWeight: 600 } : undefined}>
                                            {fmtDuration(h.avgReviewHours)}
                                        </span>
                                        {' '}<Indicator value={h.avgReviewHours} avg={avgGroupReview} lower />
                                        {h.reviewedCount > 0 && (
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '4px' }}>({h.reviewedCount})</span>
                                        )}
                                    </td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>
                                        <span style={h.avgCloseHours !== null && avgGroupClose !== null && h.avgCloseHours > avgGroupClose ? { color: '#dc2626', fontWeight: 600 } : undefined}>
                                            {fmtDuration(h.avgCloseHours)}
                                        </span>
                                        {' '}<Indicator value={h.avgCloseHours} avg={avgGroupClose} lower />
                                        {h.closedCount > 0 && (
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '4px' }}>({h.closedCount})</span>
                                        )}
                                    </td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>
                                        <span style={h.avgOpenAgeHours !== null && avgGroupOpenAge !== null && h.avgOpenAgeHours > avgGroupOpenAge ? { color: '#f59e0b', fontWeight: 600 } : undefined}>
                                            {fmtDuration(h.avgOpenAgeHours)}
                                        </span>
                                        {' '}<Indicator value={h.avgOpenAgeHours} avg={avgGroupOpenAge} lower />
                                    </td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>
                                        <span style={h.overdueOpen > 0 ? { color: '#f59e0b', fontWeight: 600 } : undefined}>
                                            {h.overdueOpen}
                                        </span>
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
