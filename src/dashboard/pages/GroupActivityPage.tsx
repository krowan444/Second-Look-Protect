import React, { useState, useEffect } from 'react';
import {
    Loader2, AlertTriangle, Activity,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

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

/* ─── Component ───────────────────────────────────────────────────────────── */

interface GroupActivityPageProps {
    onNavigate?: (path: string) => void;
}

export function GroupActivityPage({ onNavigate }: GroupActivityPageProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [groupName, setGroupName] = useState('Group Recent Activity');
    const [items, setItems] = useState<ActivityItem[]>([]);

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
        <div>
            {/* Header */}
            <div className="dashboard-page-header">
                <h1 className="dashboard-page-title">
                    <Activity size={22} style={{ verticalAlign: 'text-bottom', marginRight: '6px' }} />
                    {groupName}
                </h1>
                <p className="dashboard-page-subtitle">
                    Latest {items.length} event{items.length !== 1 ? 's' : ''} across all homes
                </p>
            </div>

            {/* Activity table */}
            <div className="dashboard-panel">
                <div className="dashboard-table-wrap">
                    <table className="dashboard-table">
                        <thead>
                            <tr>
                                <th className="dashboard-table-th">Home</th>
                                <th className="dashboard-table-th">Event</th>
                                <th className="dashboard-table-th">Type</th>
                                <th className="dashboard-table-th">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 ? (
                                <tr>
                                    <td className="dashboard-table-td" colSpan={4} style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                                        No recent activity across the group
                                    </td>
                                </tr>
                            ) : items.map(item => (
                                <tr
                                    key={item.id}
                                    style={{ cursor: item.case_id && onNavigate ? 'pointer' : undefined }}
                                    onClick={() => item.case_id && onNavigate?.(`/dashboard/cases/${item.case_id}`)}
                                >
                                    <td className="dashboard-table-td" style={{ fontWeight: 600 }}>{item.orgName}</td>
                                    <td className="dashboard-table-td">{item.message}</td>
                                    <td className="dashboard-table-td">
                                        <span style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '4px', color: '#475569' }}>
                                            {friendlyType(item.type)}
                                        </span>
                                    </td>
                                    <td className="dashboard-table-td" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(item.created_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
