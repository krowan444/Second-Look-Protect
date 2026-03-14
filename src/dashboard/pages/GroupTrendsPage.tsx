import React, { useState, useEffect, useMemo } from 'react';
import {
    Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus, BarChart3,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import { usePublishPageData } from '../assistant/StapeLeeDataContext';
import { useGroupHomeFilter } from '../hooks/useGroupHomeFilter';
import { GroupHomeFilter } from '../components/GroupHomeFilter';

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
    const [rawCases, setRawCases] = useState<any[]>([]);
    const [orgMap, setOrgMap] = useState<Map<string, string>>(new Map());
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

                if (!cancelled && groupRow?.name) setGroupName(groupRow.name + ' — Scam Trends');

                const { data: groupOrgs } = await supabase
                    .from('organisations')
                    .select('id, name')
                    .eq('organisation_group_id', groupId);

                if (!groupOrgs || groupOrgs.length === 0) { setError('No organisations found in this group.'); setLoading(false); return; }

                if (!cancelled) setAllOrgs(groupOrgs);
                const orgMapLocal = new Map(groupOrgs.map(o => [o.id, o.name]));
                const orgIds = groupOrgs.map(o => o.id);

                const { data: cases } = await supabase
                    .from('cases')
                    .select('id, organisation_id, category, submission_type, channel, submitted_at')
                    .in('organisation_id', orgIds);

                if (!cancelled) { setRawCases(cases ?? []); setOrgMap(orgMapLocal); }
            } catch (err: any) {
                if (!cancelled) setError(err?.message ?? 'Failed to load trend data');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    /* ── Derived filtered data ────────────────────────────────────────────── */
    const { categories, channels, categoryTrends, channelTrends } = useMemo(() => {
        const allCases = filterHomeId ? rawCases.filter(c => c.organisation_id === filterHomeId) : rawCases;
        const total = allCases.length;

        const catMap: Record<string, { count: number; orgCounts: Record<string, number> }> = {};
        allCases.forEach(c => {
            const cat = c.category || 'Uncategorised';
            if (!catMap[cat]) catMap[cat] = { count: 0, orgCounts: {} };
            catMap[cat].count++;
            catMap[cat].orgCounts[c.organisation_id] = (catMap[cat].orgCounts[c.organisation_id] || 0) + 1;
        });
        const cats: RankedRow[] = Object.entries(catMap).sort((a, b) => b[1].count - a[1].count).map(([key, v]) => {
            const topOrgId = Object.entries(v.orgCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
            return { key, count: v.count, share: total > 0 ? (v.count / total) * 100 : 0, topHome: topOrgId ? (orgMap.get(topOrgId) ?? 'Unknown') : 'Unknown' };
        });

        const chMap: Record<string, { count: number; orgCounts: Record<string, number> }> = {};
        allCases.forEach(c => {
            const ch = c.submission_type || c.channel || 'Unknown';
            if (!chMap[ch]) chMap[ch] = { count: 0, orgCounts: {} };
            chMap[ch].count++;
            chMap[ch].orgCounts[c.organisation_id] = (chMap[ch].orgCounts[c.organisation_id] || 0) + 1;
        });
        const chs: RankedRow[] = Object.entries(chMap).sort((a, b) => b[1].count - a[1].count).map(([key, v]) => {
            const topOrgId = Object.entries(v.orgCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
            return { key, count: v.count, share: total > 0 ? (v.count / total) * 100 : 0, topHome: topOrgId ? (orgMap.get(topOrgId) ?? 'Unknown') : 'Unknown' };
        });

        const now = Date.now();
        const d30 = 30 * 24 * 60 * 60 * 1000;
        const currentCut = new Date(now - d30);
        const prevCut = new Date(now - d30 * 2);
        const current = allCases.filter(c => new Date(c.submitted_at) >= currentCut);
        const previous = allCases.filter(c => { const d = new Date(c.submitted_at); return d >= prevCut && d < currentCut; });

        function buildTrends(field: 'category' | 'channel'): TrendRow[] {
            const curMap: Record<string, number> = {};
            const prevMap: Record<string, number> = {};
            const extractor = (c: any) => field === 'category' ? (c.category || 'Uncategorised') : (c.submission_type || c.channel || 'Unknown');
            current.forEach(c => { const k = extractor(c); curMap[k] = (curMap[k] || 0) + 1; });
            previous.forEach(c => { const k = extractor(c); prevMap[k] = (prevMap[k] || 0) + 1; });
            const allKeys = new Set([...Object.keys(curMap), ...Object.keys(prevMap)]);
            const rows: TrendRow[] = [];
            allKeys.forEach(key => { const cur = curMap[key] || 0; const prev = prevMap[key] || 0; const delta = cur - prev; rows.push({ key, current: cur, previous: prev, delta, direction: delta > 0 ? 'rising' : delta < 0 ? 'falling' : 'flat' }); });
            return rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
        }

        return { categories: cats, channels: chs, categoryTrends: buildTrends('category'), channelTrends: buildTrends('channel') };
    }, [rawCases, orgMap, filterHomeId]);

    /* ── Publish live data to Stape-Lee ─────────────────────────────── */
    const { publishPageData, clearPageData } = usePublishPageData();
    useEffect(() => {
        if (loading || categories.length === 0) return;
        publishPageData({
            section: 'group-trends',
            updatedAt: Date.now(),
            organisationName: groupName,
            activeFilters: filterHomeId ? (orgMap.get(filterHomeId) ?? 'Filtered') : 'All homes',
            kpis: [
                { label: 'Top Category', value: `${formatLabel(categories[0]?.key)} (${categories[0]?.count ?? 0})`, status: 'neutral' },
                { label: 'Top Channel', value: `${formatLabel(channels[0]?.key)} (${channels[0]?.count ?? 0})`, status: 'neutral' },
            ],
            tableRows: categories.slice(0, 5).map(cat => ({
                label: formatLabel(cat.key),
                count: cat.count,
                share: pct(cat.share),
                'top home': cat.topHome,
            })),
            insights: categoryTrends.slice(0, 3).filter(t => t.direction !== 'flat').map(t =>
                `${formatLabel(t.key)}: ${t.direction === 'rising' ? '↑' : '↓'} ${Math.abs(t.delta)} (${t.previous}→${t.current})`
            ),
        });
        return () => clearPageData();
    }, [loading, categories, channels, categoryTrends, groupName, filterHomeId, orgMap]);

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
        <div className="gp-page">
            {/* Header */}
            <div className="gp-header">
                <div>
                    <h1 className="gp-title"><BarChart3 size={20} /> {groupName}</h1>
                    <p className="gp-subtitle">Cross-home scam pattern intelligence</p>
                </div>
                {allOrgs.length > 0 && (
                    <GroupHomeFilter homes={allOrgs} selectedHomeId={filterHomeId} onSelect={setFilterHomeId} />
                )}
            </div>

            {/* Top Categories */}
            <div className="gp-card">
                <div className="gp-card-header">
                    <h2 className="gp-card-title">Top Scam Categories</h2>
                    <span className="gp-card-count">{categories.length}</span>
                </div>
                <div className="gp-table-wrap">
                    <table className="gp-table">
                        <thead><tr><th>Category</th><th className="text-right">Cases</th><th className="text-right">Share</th><th>Top Home</th></tr></thead>
                        <tbody>
                            {categories.length === 0 ? (
                                <tr><td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No category data</td></tr>
                            ) : categories.map(r => (
                                <tr key={r.key}>
                                    <td className="gp-home-name">{formatLabel(r.key)}</td>
                                    <td className="text-right">{r.count}</td>
                                    <td className="text-right">{pct(r.share)}</td>
                                    <td>{r.topHome}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Top Channels */}
            <div className="gp-card">
                <div className="gp-card-header">
                    <h2 className="gp-card-title">Top Channels</h2>
                    <span className="gp-card-count">{channels.length}</span>
                </div>
                <div className="gp-table-wrap">
                    <table className="gp-table">
                        <thead><tr><th>Channel</th><th className="text-right">Cases</th><th className="text-right">Share</th><th>Top Home</th></tr></thead>
                        <tbody>
                            {channels.length === 0 ? (
                                <tr><td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No channel data</td></tr>
                            ) : channels.map(r => (
                                <tr key={r.key}>
                                    <td className="gp-home-name">{formatLabel(r.key)}</td>
                                    <td className="text-right">{r.count}</td>
                                    <td className="text-right">{pct(r.share)}</td>
                                    <td>{r.topHome}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Category Trends */}
            <div className="gp-card">
                <div className="gp-card-header">
                    <h2 className="gp-card-title">Category Trends — 30 Days vs Previous</h2>
                </div>
                <div className="gp-table-wrap">
                    <table className="gp-table">
                        <thead><tr><th>Category</th><th className="text-right">Current</th><th className="text-right">Previous</th><th className="text-right">Delta</th><th style={{ textAlign: 'center' }}>Trend</th></tr></thead>
                        <tbody>
                            {categoryTrends.length === 0 ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No trend data</td></tr>
                            ) : categoryTrends.map(r => (
                                <tr key={r.key}>
                                    <td className="gp-home-name">{formatLabel(r.key)}</td>
                                    <td className="text-right">{r.current}</td>
                                    <td className="text-right">{r.previous}</td>
                                    <td className="text-right">
                                        <span className={r.delta > 0 ? 'gp-val-danger' : r.delta < 0 ? 'gp-val-good' : 'gp-val-muted'}>
                                            {r.delta > 0 ? '+' : ''}{r.delta}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}><TrendIcon direction={r.direction} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Channel Trends */}
            <div className="gp-card">
                <div className="gp-card-header">
                    <h2 className="gp-card-title">Channel Trends — 30 Days vs Previous</h2>
                </div>
                <div className="gp-table-wrap">
                    <table className="gp-table">
                        <thead><tr><th>Channel</th><th className="text-right">Current</th><th className="text-right">Previous</th><th className="text-right">Delta</th><th style={{ textAlign: 'center' }}>Trend</th></tr></thead>
                        <tbody>
                            {channelTrends.length === 0 ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No trend data</td></tr>
                            ) : channelTrends.map(r => (
                                <tr key={r.key}>
                                    <td className="gp-home-name">{formatLabel(r.key)}</td>
                                    <td className="text-right">{r.current}</td>
                                    <td className="text-right">{r.previous}</td>
                                    <td className="text-right">
                                        <span className={r.delta > 0 ? 'gp-val-danger' : r.delta < 0 ? 'gp-val-good' : 'gp-val-muted'}>
                                            {r.delta > 0 ? '+' : ''}{r.delta}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}><TrendIcon direction={r.direction} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
