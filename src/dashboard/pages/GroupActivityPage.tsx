import React, { useState, useEffect, useMemo } from 'react';
import {
    Loader2, AlertTriangle, Activity, Download,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import { useGroupHomeFilter } from '../hooks/useGroupHomeFilter';
import { GroupHomeFilter } from '../components/GroupHomeFilter';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface ActivityItem {
    id: string;
    organisation_id: string;
    orgName: string;
    type: string;
    message: string;
    case_id: string | null;
    created_at: string;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function fmtDateTime(iso: string): string {
    try {
        return new Date(iso).toLocaleString('en-GB', {
            day: 'numeric', month: 'short', year: '2-digit',
            hour: '2-digit', minute: '2-digit',
        });
    } catch { return '—'; }
}

function friendlyType(t: string): string {
    return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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

interface GroupActivityPageProps {
    onNavigate?: (path: string) => void;
}

export function GroupActivityPage({ onNavigate }: GroupActivityPageProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [groupName, setGroupName] = useState('Group Recent Activity');
    const [items, setItems] = useState<ActivityItem[]>([]);
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

                // Resolve group
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

                if (!cancelled && groupRow?.name) setGroupName(groupRow.name + ' — Recent Activity');

                // All orgs in the group
                const { data: groupOrgs } = await supabase
                    .from('organisations')
                    .select('id, name')
                    .eq('organisation_group_id', groupId);

                if (!groupOrgs || groupOrgs.length === 0) {
                    setError('No organisations found in this group.');
                    setLoading(false);
                    return;
                }

                const orgMap = new Map(groupOrgs.map(o => [o.id, o.name]));
                const orgIds = groupOrgs.map(o => o.id);
                if (!cancelled) setAllOrgs(groupOrgs);

                // Fetch latest 50 notifications across group
                const { data: rows } = await supabase
                    .from('notifications')
                    .select('id, organisation_id, type, message, case_id, created_at')
                    .in('organisation_id', orgIds)
                    .order('created_at', { ascending: false })
                    .limit(50);

                const mapped: ActivityItem[] = (rows ?? []).map(r => ({
                    ...r,
                    orgName: orgMap.get(r.organisation_id) ?? r.organisation_id.slice(0, 8),
                }));

                if (!cancelled) setItems(mapped);
            } catch (err: any) {
                if (!cancelled) setError(err?.message ?? 'Failed to load group activity');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    const displayItems = useMemo(
        () => filterHomeId ? items.filter(i => i.organisation_id === filterHomeId) : items,
        [items, filterHomeId]
    );

    /* ── Render ───────────────────────────────────────────────────────────── */

    if (loading) {
        return (
            <div className="dashboard-overview-loading">
                <Loader2 className="dashboard-overview-spinner-icon" />
                <p>Loading recent activity…</p>
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
                    <h1 className="gp-title"><Activity size={20} /> {groupName}</h1>
                    <p className="gp-subtitle">
                        Latest {displayItems.length} event{displayItems.length !== 1 ? 's' : ''}{filterHomeId ? '' : ' across all homes'}
                    </p>
                </div>
                <div className="gp-actions">
                    {allOrgs.length > 0 && (
                        <GroupHomeFilter homes={allOrgs} selectedHomeId={filterHomeId} onSelect={setFilterHomeId} />
                    )}
                    {displayItems.length > 0 && (
                        <button
                            className="gp-export-btn"
                            onClick={() => downloadCsv(
                                'group-activity.csv',
                                ['Home', 'Event Message', 'Event Type', 'Created At', 'Case ID'],
                                displayItems.map(i => [i.orgName, i.message, i.type, i.created_at, i.case_id ?? ''])
                            )}
                        >
                            <Download size={13} /> Export CSV
                        </button>
                    )}
                </div>
            </div>

            {/* Activity table */}
            <div className="gp-card">
                <div className="gp-table-wrap">
                    <table className="gp-table">
                        <thead>
                            <tr>
                                <th>Home</th>
                                <th>Event</th>
                                <th>Type</th>
                                <th>Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayItems.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                                        No recent activity{filterHomeId ? ' for this home' : ' across the group'}
                                    </td>
                                </tr>
                            ) : displayItems.map(item => (
                                <tr
                                    key={item.id}
                                    className={item.case_id && onNavigate ? 'gp-row-click' : ''}
                                    onClick={() => item.case_id && onNavigate?.(`/dashboard/cases/${item.case_id}`)}
                                >
                                    <td className="gp-home-name">{item.orgName}</td>
                                    <td>{item.message}</td>
                                    <td><span className="gp-tag">{friendlyType(item.type)}</span></td>
                                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(item.created_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
