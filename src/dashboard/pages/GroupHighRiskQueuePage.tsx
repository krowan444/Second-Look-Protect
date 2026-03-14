import React, { useState, useEffect, useMemo } from 'react';
import {
    Loader2, AlertTriangle, ShieldAlert, Clock, Download,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import { usePublishPageData } from '../assistant/StapeLeeDataContext';
import { useGroupHomeFilter } from '../hooks/useGroupHomeFilter';
import { GroupHomeFilter } from '../components/GroupHomeFilter';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface HighRiskCase {
    id: string;
    organisation_id: string;
    orgName: string;
    submission_type: string | null;
    risk_level: string;
    status: string | null;
    submitted_at: string;
    resident_ref: string | null;
    loss_amount: number | null;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function fmtDate(iso: string): string {
    try {
        return new Date(iso).toLocaleString('en-GB', {
            day: 'numeric', month: 'short', year: '2-digit',
            hour: '2-digit', minute: '2-digit',
        });
    } catch { return '—'; }
}

function riskOrder(level: string): number {
    switch (level.toLowerCase()) {
        case 'critical': return 0;
        case 'high': return 1;
        default: return 2;
    }
}

function statusLabel(s: string | null): string {
    if (!s) return 'Unknown';
    if (s === 'submitted' || s === 'new') return 'New';
    return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function riskClass(level: string | null): string {
    switch (level?.toLowerCase()) {
        case 'high': return 'high';
        case 'critical': return 'high';
        default: return 'medium';
    }
}

function statusClass(s: string | null): string {
    switch (s?.toLowerCase()) {
        case 'new': case 'submitted': return 'new';
        case 'in_review': return 'review';
        case 'closed': return 'closed';
        default: return 'default';
    }
}

function formatLabel(value: string | null | undefined): string {
    if (!value) return '—';
    return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function currency(n: number | null): string {
    if (n === null || n === undefined) return '—';
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

interface GroupHighRiskQueuePageProps {
    onNavigate?: (path: string) => void;
}

export function GroupHighRiskQueuePage({ onNavigate }: GroupHighRiskQueuePageProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [groupName, setGroupName] = useState('Group High-Risk Queue');
    const [cases, setCases] = useState<HighRiskCase[]>([]);
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

                if (!cancelled && groupRow?.name) setGroupName(groupRow.name + ' — High-Risk Queue');

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

                // Fetch high/critical open cases
                const { data: rows } = await supabase
                    .from('cases')
                    .select('id, organisation_id, submission_type, risk_level, status, submitted_at, resident_ref, loss_amount')
                    .in('organisation_id', orgIds)
                    .in('risk_level', ['high', 'critical'])
                    .neq('status', 'closed')
                    .order('submitted_at', { ascending: true });

                const mapped: HighRiskCase[] = (rows ?? []).map(r => ({
                    ...r,
                    risk_level: r.risk_level ?? 'high',
                    orgName: orgMap.get(r.organisation_id) ?? r.organisation_id.slice(0, 8),
                }));

                // Sort: critical first, then oldest
                mapped.sort((a, b) => {
                    const rDiff = riskOrder(a.risk_level) - riskOrder(b.risk_level);
                    if (rDiff !== 0) return rDiff;
                    return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
                });

                if (!cancelled) setCases(mapped);
            } catch (err: any) {
                if (!cancelled) setError(err?.message ?? 'Failed to load group queue');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    const displayCases = useMemo(
        () => filterHomeId ? cases.filter(c => c.organisation_id === filterHomeId) : cases,
        [cases, filterHomeId]
    );

    /* ── Publish live data to Stape-Lee ─────────────────────────────── */
    const { publishPageData, clearPageData } = usePublishPageData();
    useEffect(() => {
        if (loading) return;
        const critCount = displayCases.filter(c => c.risk_level === 'critical').length;
        const highCount = displayCases.filter(c => c.risk_level === 'high').length;
        // Count per home
        const homeCount: Record<string, number> = {};
        displayCases.forEach(c => { homeCount[c.orgName] = (homeCount[c.orgName] || 0) + 1; });
        publishPageData({
            section: 'group-high-risk',
            updatedAt: Date.now(),
            organisationName: groupName.replace(' — High-Risk Queue', ''),
            activeFilters: filterHomeId ? displayCases[0]?.orgName || 'Filtered' : 'All homes',
            kpis: [
                { label: 'Total High-Risk', value: displayCases.length, status: displayCases.length > 0 ? 'danger' : 'good' },
                { label: 'Critical', value: critCount, status: critCount > 0 ? 'danger' : 'good' },
                { label: 'High', value: highCount, status: highCount > 0 ? 'warn' : 'good' },
            ],
            tableRows: Object.entries(homeCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({
                label: name, 'high-risk cases': count,
            })),
        });
        return () => clearPageData();
    }, [loading, displayCases, groupName, filterHomeId]);

    /* ── Render ───────────────────────────────────────────────────────────── */

    if (loading) {
        return (
            <div className="dashboard-overview-loading">
                <Loader2 className="dashboard-overview-spinner-icon" />
                <p>Loading high-risk queue…</p>
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
                    <h1 className="gp-title"><ShieldAlert size={20} /> {groupName}</h1>
                    <p className="gp-subtitle">
                        {displayCases.length} open high-risk case{displayCases.length !== 1 ? 's' : ''}{filterHomeId ? '' : ' across all homes'}
                    </p>
                </div>
                <div className="gp-actions">
                    {allOrgs.length > 0 && (
                        <GroupHomeFilter homes={allOrgs} selectedHomeId={filterHomeId} onSelect={setFilterHomeId} />
                    )}
                    {displayCases.length > 0 && (
                        <button
                            className="gp-export-btn"
                            onClick={() => downloadCsv(
                                'group-high-risk.csv',
                                ['Home', 'Case Type', 'Risk Level', 'Status', 'Submitted At', 'Resident Ref', 'Loss Amount'],
                                displayCases.map(c => [c.orgName, c.submission_type ?? '', c.risk_level, c.status ?? '', c.submitted_at, c.resident_ref ?? '', c.loss_amount != null ? String(c.loss_amount) : ''])
                            )}
                        >
                            <Download size={13} /> Export CSV
                        </button>
                    )}
                </div>
            </div>

            {/* Queue table */}
            <div className="gp-card">
                <div className="gp-card-header">
                    <h2 className="gp-card-title"><ShieldAlert size={15} /> High-Risk Cases</h2>
                    <span className="gp-card-count">{displayCases.length}</span>
                </div>
                <div className="gp-table-wrap">
                    <table className="gp-table">
                        <thead>
                            <tr>
                                <th>Home</th>
                                <th>Type</th>
                                <th>Risk</th>
                                <th>Status</th>
                                <th>Submitted</th>
                                <th>Resident Ref</th>
                                <th className="text-right">Loss</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayCases.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                                        No open high-risk cases{filterHomeId ? ' for this home' : ' across the group'}
                                    </td>
                                </tr>
                            ) : displayCases.map(c => (
                                <tr
                                    key={c.id}
                                    className={onNavigate ? 'gp-row-click' : ''}
                                    onClick={() => onNavigate?.(`/dashboard/cases/${c.id}`)}
                                >
                                    <td className="gp-home-name">{c.orgName}</td>
                                    <td>{formatLabel(c.submission_type)}</td>
                                    <td><span className={`dashboard-risk-badge risk-${riskClass(c.risk_level)}`}>{c.risk_level}</span></td>
                                    <td><span className={`dashboard-status-badge status-${statusClass(c.status)}`}>{statusLabel(c.status)}</span></td>
                                    <td>{fmtDate(c.submitted_at)}</td>
                                    <td>{c.resident_ref ?? '—'}</td>
                                    <td className="text-right">{currency(c.loss_amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
