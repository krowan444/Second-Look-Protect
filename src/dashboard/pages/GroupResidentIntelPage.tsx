import React, { useState, useEffect } from 'react';
import {
    Loader2, AlertTriangle, UserSearch, AlertOctagon, Repeat,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface ResidentRow {
    residentRef: string;
    homeName: string;
    orgId: string;
    incidents: number;
    openCount: number;
    highRiskOpen: number;
    totalLoss: number;
}

interface HomeRepeatRow {
    orgId: string;
    homeName: string;
    repeatedResidents: number;
    totalRepeatIncidents: number;
    totalRepeatLoss: number;
    topResident: string;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function currency(n: number): string {
    return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 0 });
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function GroupResidentIntelPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [groupName, setGroupName] = useState('Group Resident Intelligence');
    const [residents, setResidents] = useState<ResidentRow[]>([]);
    const [homeRepeats, setHomeRepeats] = useState<HomeRepeatRow[]>([]);

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

                if (!cancelled && groupRow?.name) setGroupName(groupRow.name + ' — Resident Intelligence');

                const { data: groupOrgs } = await supabase
                    .from('organisations')
                    .select('id, name')
                    .eq('organisation_group_id', groupId)
                    .order('name');

                if (!groupOrgs || groupOrgs.length === 0) { setError('No organisations found in this group.'); setLoading(false); return; }

                const orgMap = new Map(groupOrgs.map(o => [o.id, o.name]));
                const orgIds = groupOrgs.map(o => o.id);

                const { data: cases } = await supabase
                    .from('cases')
                    .select('id, organisation_id, resident_ref, status, risk_level, outcome, loss_amount')
                    .in('organisation_id', orgIds);

                const allCases = cases ?? [];

                // ── Build per-resident stats ────────────────────────────────
                // Key = orgId::resident_ref to keep per-home uniqueness
                const resMap: Record<string, {
                    residentRef: string; orgId: string; incidents: number;
                    openCount: number; highRiskOpen: number; totalLoss: number;
                }> = {};

                allCases.forEach(c => {
                    const ref = c.resident_ref?.trim();
                    if (!ref) return; // skip cases without a resident ref
                    const key = `${c.organisation_id}::${ref}`;
                    if (!resMap[key]) {
                        resMap[key] = { residentRef: ref, orgId: c.organisation_id, incidents: 0, openCount: 0, highRiskOpen: 0, totalLoss: 0 };
                    }
                    const r = resMap[key];
                    r.incidents++;
                    if (c.status !== 'closed') {
                        r.openCount++;
                        if (['high', 'critical'].includes((c.risk_level ?? '').toLowerCase())) r.highRiskOpen++;
                    }
                    if (c.outcome === 'lost' && typeof c.loss_amount === 'number') r.totalLoss += c.loss_amount;
                });

                // Filter to residents with > 1 incident
                const repeatedResidents: ResidentRow[] = Object.values(resMap)
                    .filter(r => r.incidents > 1)
                    .map(r => ({ ...r, homeName: orgMap.get(r.orgId) ?? 'Unknown' }))
                    .sort((a, b) => b.incidents - a.incidents || b.highRiskOpen - a.highRiskOpen || b.totalLoss - a.totalLoss);

                // ── Build per-home repeat summary ───────────────────────────
                const homeMap: Record<string, { orgId: string; residents: Set<string>; incidents: number; loss: number; topResident: string; topCount: number }> = {};
                repeatedResidents.forEach(r => {
                    if (!homeMap[r.orgId]) {
                        homeMap[r.orgId] = { orgId: r.orgId, residents: new Set(), incidents: 0, loss: 0, topResident: '', topCount: 0 };
                    }
                    const h = homeMap[r.orgId];
                    h.residents.add(r.residentRef);
                    h.incidents += r.incidents;
                    h.loss += r.totalLoss;
                    if (r.incidents > h.topCount) { h.topCount = r.incidents; h.topResident = r.residentRef; }
                });

                const homeRows: HomeRepeatRow[] = groupOrgs.map(org => {
                    const h = homeMap[org.id];
                    return {
                        orgId: org.id,
                        homeName: org.name,
                        repeatedResidents: h ? h.residents.size : 0,
                        totalRepeatIncidents: h ? h.incidents : 0,
                        totalRepeatLoss: h ? h.loss : 0,
                        topResident: h ? h.topResident : '—',
                    };
                }).sort((a, b) => b.repeatedResidents - a.repeatedResidents);

                if (!cancelled) { setResidents(repeatedResidents); setHomeRepeats(homeRows); }
            } catch (err: any) {
                if (!cancelled) setError(err?.message ?? 'Failed to load resident data');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    /* ── Priority hotspots (top 5) ───────────────────────────────────────── */
    const hotspots = residents.slice(0, 5);

    /* ── Render ───────────────────────────────────────────────────────────── */

    if (loading) {
        return (
            <div className="dashboard-overview-loading">
                <Loader2 className="dashboard-overview-spinner-icon" />
                <p>Loading resident intelligence…</p>
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
                    <UserSearch size={22} style={{ verticalAlign: 'text-bottom', marginRight: '6px' }} />
                    {groupName}
                </h1>
                <p className="dashboard-page-subtitle">
                    Repeat resident targeting across all homes — {residents.length} repeated resident{residents.length !== 1 ? 's' : ''} identified
                </p>
            </div>

            {/* ── Priority Hotspots ───────────────────────────────────────── */}
            {hotspots.length > 0 && (
                <div className="dashboard-stats-row" style={{ marginBottom: '2rem' }}>
                    {hotspots.map((r, i) => (
                        <div key={i} className="dashboard-stat-card" style={{ borderLeft: `4px solid ${r.highRiskOpen > 0 ? '#dc2626' : '#f59e0b'}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.35rem' }}>
                                <AlertOctagon size={16} style={{ color: r.highRiskOpen > 0 ? '#dc2626' : '#f59e0b' }} />
                                <span style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                                    Priority #{i + 1}
                                </span>
                            </div>
                            <div className="dashboard-stat-value" style={{ fontSize: '1.1rem' }}>{r.residentRef}</div>
                            <div className="dashboard-stat-label">{r.homeName}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>
                                {r.incidents} incidents · {r.openCount} open · {currency(r.totalLoss)} loss
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Repeat Targeting by Home ─────────────────────────────────── */}
            <div className="dashboard-panel" style={{ marginBottom: '1.5rem' }}>
                <div className="dashboard-panel-header">
                    <h2 className="dashboard-panel-title">
                        <Repeat size={16} className="dashboard-panel-title-icon" /> Repeat Targeting by Home
                    </h2>
                </div>
                <div className="dashboard-table-wrap">
                    <table className="dashboard-table">
                        <thead>
                            <tr>
                                <th className="dashboard-table-th">Home</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Repeated Residents</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Total Incidents</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Total Loss</th>
                                <th className="dashboard-table-th">Top Resident</th>
                            </tr>
                        </thead>
                        <tbody>
                            {homeRepeats.every(h => h.repeatedResidents === 0) ? (
                                <tr>
                                    <td className="dashboard-table-td" colSpan={5} style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                                        No repeat targeting detected across the group
                                    </td>
                                </tr>
                            ) : homeRepeats.map(h => (
                                <tr key={h.orgId}>
                                    <td className="dashboard-table-td" style={{ fontWeight: 600 }}>{h.homeName}</td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>
                                        <span style={h.repeatedResidents > 0 ? { color: '#dc2626', fontWeight: 600 } : undefined}>
                                            {h.repeatedResidents}
                                        </span>
                                    </td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>{h.totalRepeatIncidents}</td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>{currency(h.totalRepeatLoss)}</td>
                                    <td className="dashboard-table-td">{h.topResident}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── All Repeated Residents ───────────────────────────────────── */}
            <div className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <h2 className="dashboard-panel-title">
                        <UserSearch size={16} className="dashboard-panel-title-icon" /> All Repeated Residents
                    </h2>
                </div>
                <div className="dashboard-table-wrap">
                    <table className="dashboard-table">
                        <thead>
                            <tr>
                                <th className="dashboard-table-th">Resident Ref</th>
                                <th className="dashboard-table-th">Home</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Incidents</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Open</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>High-Risk Open</th>
                                <th className="dashboard-table-th" style={{ textAlign: 'right' }}>Total Loss</th>
                            </tr>
                        </thead>
                        <tbody>
                            {residents.length === 0 ? (
                                <tr>
                                    <td className="dashboard-table-td" colSpan={6} style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                                        No repeated residents identified
                                    </td>
                                </tr>
                            ) : residents.map((r, i) => (
                                <tr key={i}>
                                    <td className="dashboard-table-td" style={{ fontWeight: 600 }}>{r.residentRef}</td>
                                    <td className="dashboard-table-td">{r.homeName}</td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>
                                        <span style={{ color: '#dc2626', fontWeight: 600 }}>{r.incidents}</span>
                                    </td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>{r.openCount}</td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>
                                        <span style={r.highRiskOpen > 0 ? { color: '#dc2626', fontWeight: 600 } : undefined}>
                                            {r.highRiskOpen}
                                        </span>
                                    </td>
                                    <td className="dashboard-table-td" style={{ textAlign: 'right' }}>{currency(r.totalLoss)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
