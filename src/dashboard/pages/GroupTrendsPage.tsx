import React, { useState, useEffect } from 'react';
import {
    Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus, BarChart3,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface RankedRow {
    key: string;
    count: number;
    share: number;       // 0–100
    topHome: string;
}

interface TrendRow {
    key: string;
    current: number;
    previous: number;
    delta: number;
    direction: 'rising' | 'falling' | 'flat';
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function formatLabel(value: string | null | undefined): string {
    if (!value) return 'Unknown';
    return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function pct(n: number): string { return n.toFixed(1) + '%'; }

function TrendIcon({ direction }: { direction: string }) {
    switch (direction) {
        case 'rising': return <TrendingUp size={14} style={{ color: '#dc2626' }} />;
        case 'falling': return <TrendingDown size={14} style={{ color: '#16a34a' }} />;
        default: return <Minus size={14} style={{ color: '#94a3b8' }} />;
    }
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function GroupTrendsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [groupName, setGroupName] = useState('Group Trends');
    const [categories, setCategories] = useState<RankedRow[]>([]);
    const [channels, setChannels] = useState<RankedRow[]>([]);
    const [categoryTrends, setCategoryTrends] = useState<TrendRow[]>([]);
    const [channelTrends, setChannelTrends] = useState<TrendRow[]>([]);

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

                if (!cancelled && groupRow?.name) setGroupName(groupRow.name + ' — Scam Trends');

                const { data: groupOrgs } = await supabase
                    .from('organisations')
                    .select('id, name')
                    .eq('organisation_group_id', groupId);

                if (!groupOrgs || groupOrgs.length === 0) { setError('No organisations found in this group.'); setLoading(false); return; }

                const orgMap = new Map(groupOrgs.map(o => [o.id, o.name]));
                const orgIds = groupOrgs.map(o => o.id);

                // Fetch all cases for group
                const { data: cases } = await supabase
                    .from('cases')
                    .select('id, organisation_id, category, submission_type, channel, submitted_at')
                    .in('organisation_id', orgIds);

                const allCases = cases ?? [];
                const total = allCases.length;

                // ── Build category rankings ─────────────────────────────────
                const catMap: Record<string, { count: number; orgCounts: Record<string, number> }> = {};
                allCases.forEach(c => {
                    const cat = c.category || 'Uncategorised';
                    if (!catMap[cat]) catMap[cat] = { count: 0, orgCounts: {} };
                    catMap[cat].count++;
                    const org = c.organisation_id;
                    catMap[cat].orgCounts[org] = (catMap[cat].orgCounts[org] || 0) + 1;
                });

                const catRows: RankedRow[] = Object.entries(catMap)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([key, v]) => {
                        const topOrgId = Object.entries(v.orgCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
                        return {
                            key,
                            count: v.count,
                            share: total > 0 ? (v.count / total) * 100 : 0,
                            topHome: topOrgId ? (orgMap.get(topOrgId) ?? 'Unknown') : 'Unknown',
                        };
                    });

                // ── Build channel rankings ──────────────────────────────────
                const chMap: Record<string, { count: number; orgCounts: Record<string, number> }> = {};
                allCases.forEach(c => {
                    const ch = c.submission_type || c.channel || 'Unknown';
                    if (!chMap[ch]) chMap[ch] = { count: 0, orgCounts: {} };
                    chMap[ch].count++;
                    const org = c.organisation_id;
                    chMap[ch].orgCounts[org] = (chMap[ch].orgCounts[org] || 0) + 1;
                });

                const chRows: RankedRow[] = Object.entries(chMap)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([key, v]) => {
                        const topOrgId = Object.entries(v.orgCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
                        return {
                            key,
                            count: v.count,
                            share: total > 0 ? (v.count / total) * 100 : 0,
                            topHome: topOrgId ? (orgMap.get(topOrgId) ?? 'Unknown') : 'Unknown',
                        };
                    });

                // ── 30-day trend comparison ─────────────────────────────────
                const now = Date.now();
                const d30 = 30 * 24 * 60 * 60 * 1000;
                const currentCut = new Date(now - d30);
                const prevCut = new Date(now - d30 * 2);

                const current = allCases.filter(c => new Date(c.submitted_at) >= currentCut);
                const previous = allCases.filter(c => {
                    const d = new Date(c.submitted_at);
                    return d >= prevCut && d < currentCut;
                });

                function buildTrends(field: 'category' | 'channel'): TrendRow[] {
                    const curMap: Record<string, number> = {};
                    const prevMap: Record<string, number> = {};
                    const extractor = (c: typeof allCases[0]) =>
                        field === 'category'
                            ? (c.category || 'Uncategorised')
                            : (c.submission_type || c.channel || 'Unknown');

                    current.forEach(c => { const k = extractor(c); curMap[k] = (curMap[k] || 0) + 1; });
                    previous.forEach(c => { const k = extractor(c); prevMap[k] = (prevMap[k] || 0) + 1; });

                    const allKeys = new Set([...Object.keys(curMap), ...Object.keys(prevMap)]);
                    const rows: TrendRow[] = [];
                    allKeys.forEach(key => {
                        const cur = curMap[key] || 0;
                        const prev = prevMap[key] || 0;
                        const delta = cur - prev;
                        rows.push({
                            key,
                            current: cur,
                            previous: prev,
                            delta,
                            direction: delta > 0 ? 'rising' : delta < 0 ? 'falling' : 'flat',
                        });
                    });
                    return rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
                }

                if (!cancelled) {
                    setCategories(catRows);
                    setChannels(chRows);
                    setCategoryTrends(buildTrends('category'));
                    setChannelTrends(buildTrends('channel'));
                }
            } catch (err: any) {
                if (!cancelled) setError(err?.message ?? 'Failed to load trend data');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    /* ── Render ───────────────────────────────────────────────────────────── */

    if (loading) {
        return (
            <div className="dashboard-overview-loading">
                <Loader2 className="dashboard-overview-spinner-icon" />
                <p>Loading scam trend data…</p>
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
                    <BarChart3 size={22} style={{ verticalAlign: 'text-bottom', marginRight: '6px' }} />
                    {groupName}
                </h1>
                <p className="dashboard-page-subtitle">
                    Cross-home scam pattern intelligence
                </p>
            </div>

            {/* ── Top Categories ───────────────────────────────────────────── */}
            <div className="dashboard-panel" style={{ marginBottom: '1.5rem' }}>
                <div className="dashboard-panel-header">
                    <h2 className="dashboard-panel-title">Top Scam Categories</h2>
                </div>
                <div className="dashboard-table-wrap">
                    <table className="dashboard-table">
                        <thead>
                            <tr>
                                <th className="dashboard-table-th">Category</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Cases</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Share</th>
                                <th className="dashboard-table-th">Top Home</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.length === 0 ? (
                                <tr><td className="dashboard-table-td" colSpan={4} style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No category data</td></tr>
                            ) : categories.map(r => (
                                <tr key={r.key}>
                                    <td className="dashboard-table-td" style={{ fontWeight: 600 }}>{formatLabel(r.key)}</td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>{r.count}</td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>{pct(r.share)}</td>
                                    <td className="dashboard-table-td">{r.topHome}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Top Channels ─────────────────────────────────────────────── */}
            <div className="dashboard-panel" style={{ marginBottom: '1.5rem' }}>
                <div className="dashboard-panel-header">
                    <h2 className="dashboard-panel-title">Top Channels</h2>
                </div>
                <div className="dashboard-table-wrap">
                    <table className="dashboard-table">
                        <thead>
                            <tr>
                                <th className="dashboard-table-th">Channel</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Cases</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Share</th>
                                <th className="dashboard-table-th">Top Home</th>
                            </tr>
                        </thead>
                        <tbody>
                            {channels.length === 0 ? (
                                <tr><td className="dashboard-table-td" colSpan={4} style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No channel data</td></tr>
                            ) : channels.map(r => (
                                <tr key={r.key}>
                                    <td className="dashboard-table-td" style={{ fontWeight: 600 }}>{formatLabel(r.key)}</td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>{r.count}</td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>{pct(r.share)}</td>
                                    <td className="dashboard-table-td">{r.topHome}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Category Trends (30-day) ─────────────────────────────────── */}
            <div className="dashboard-panel" style={{ marginBottom: '1.5rem' }}>
                <div className="dashboard-panel-header">
                    <h2 className="dashboard-panel-title">Category Trends — Last 30 Days vs Previous 30 Days</h2>
                </div>
                <div className="dashboard-table-wrap">
                    <table className="dashboard-table">
                        <thead>
                            <tr>
                                <th className="dashboard-table-th">Category</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Current</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Previous</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Delta</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'center' }}>Trend</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categoryTrends.length === 0 ? (
                                <tr><td className="dashboard-table-td" colSpan={5} style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No trend data</td></tr>
                            ) : categoryTrends.map(r => (
                                <tr key={r.key}>
                                    <td className="dashboard-table-td" style={{ fontWeight: 600 }}>{formatLabel(r.key)}</td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>{r.current}</td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>{r.previous}</td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right', color: r.delta > 0 ? '#dc2626' : r.delta < 0 ? '#16a34a' : '#64748b', fontWeight: 600 }}>
                                        {r.delta > 0 ? '+' : ''}{r.delta}
                                    </td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'center' }}>
                                        <TrendIcon direction={r.direction} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Channel Trends (30-day) ──────────────────────────────────── */}
            <div className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <h2 className="dashboard-panel-title">Channel Trends — Last 30 Days vs Previous 30 Days</h2>
                </div>
                <div className="dashboard-table-wrap">
                    <table className="dashboard-table">
                        <thead>
                            <tr>
                                <th className="dashboard-table-th">Channel</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Current</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Previous</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Delta</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'center' }}>Trend</th>
                            </tr>
                        </thead>
                        <tbody>
                            {channelTrends.length === 0 ? (
                                <tr><td className="dashboard-table-td" colSpan={5} style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No trend data</td></tr>
                            ) : channelTrends.map(r => (
                                <tr key={r.key}>
                                    <td className="dashboard-table-td" style={{ fontWeight: 600 }}>{formatLabel(r.key)}</td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>{r.current}</td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>{r.previous}</td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right', color: r.delta > 0 ? '#dc2626' : r.delta < 0 ? '#16a34a' : '#64748b', fontWeight: 600 }}>
                                        {r.delta > 0 ? '+' : ''}{r.delta}
                                    </td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'center' }}>
                                        <TrendIcon direction={r.direction} />
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
