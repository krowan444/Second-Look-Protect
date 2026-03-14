import React, { useState, useEffect, useMemo } from 'react';
import {
    Loader2, AlertTriangle, Bell, CheckCircle2,
    TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import { useGroupHomeFilter } from '../hooks/useGroupHomeFilter';
import { GroupHomeFilter } from '../components/GroupHomeFilter';

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Severity = 'critical' | 'warning' | 'info';

interface Alert {
    title: string;
    home: string;
    orgId: string;
    current: number;
    previous: number;
    delta: number;
    severity: Severity;
    explanation: string;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function formatLabel(value: string | null | undefined): string {
    if (!value) return 'Unknown';
    return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function severityOrder(s: Severity): number {
    switch (s) { case 'critical': return 0; case 'warning': return 1; default: return 2; }
}

function severityColor(s: Severity): string {
    switch (s) { case 'critical': return '#dc2626'; case 'warning': return '#f59e0b'; default: return '#3b82f6'; }
}

function severityBg(s: Severity): string {
    switch (s) { case 'critical': return '#fef2f2'; case 'warning': return '#fffbeb'; default: return '#eff6ff'; }
}

function severityBorder(s: Severity): string {
    switch (s) { case 'critical': return '#fecaca'; case 'warning': return '#fde68a'; default: return '#bfdbfe'; }
}

function DeltaIcon({ delta }: { delta: number }) {
    if (delta > 0) return <TrendingUp size={14} style={{ color: '#dc2626' }} />;
    if (delta < 0) return <TrendingDown size={14} style={{ color: '#16a34a' }} />;
    return <Minus size={14} style={{ color: '#94a3b8' }} />;
}

/* ─── Thresholds ──────────────────────────────────────────────────────────── */
// Absolute increase thresholds (simple, transparent)
const SPIKE_CRITICAL = 5;   // ≥5 more cases → critical
const SPIKE_WARNING = 3;    // ≥3 more cases → warning
const SPIKE_INFO = 2;       // ≥2 more cases → info (only for important dimensions)
const LOSS_CRITICAL = 5000;
const LOSS_WARNING = 2000;

/* ─── Component ───────────────────────────────────────────────────────────── */

export function GroupAlertsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [groupName, setGroupName] = useState('Group Alerts');
    const [alerts, setAlerts] = useState<Alert[]>([]);
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

                if (!cancelled && groupRow?.name) setGroupName(groupRow.name + ' — Alerts');

                const { data: groupOrgs } = await supabase
                    .from('organisations')
                    .select('id, name')
                    .eq('organisation_group_id', groupId);

                if (!groupOrgs || groupOrgs.length === 0) { setError('No organisations found in this group.'); setLoading(false); return; }

                const orgMap = new Map(groupOrgs.map(o => [o.id, o.name]));
                const orgIds = groupOrgs.map(o => o.id);

                const { data: cases } = await supabase
                    .from('cases')
                    .select('id, organisation_id, category, submission_type, channel, risk_level, outcome, loss_amount, submitted_at, resident_ref')
                    .in('organisation_id', orgIds);

                const allCases = cases ?? [];

                // Period splits
                const now = Date.now();
                const d30 = 30 * 24 * 60 * 60 * 1000;
                const currentCut = new Date(now - d30);
                const prevCut = new Date(now - d30 * 2);

                const current = allCases.filter(c => new Date(c.submitted_at) >= currentCut);
                const previous = allCases.filter(c => { const d = new Date(c.submitted_at); return d >= prevCut && d < currentCut; });

                const detected: Alert[] = [];

                // ── A) Category spikes per home ─────────────────────────────
                for (const org of groupOrgs) {
                    const curOrg = current.filter(c => c.organisation_id === org.id);
                    const prevOrg = previous.filter(c => c.organisation_id === org.id);

                    const curCats: Record<string, number> = {};
                    const prevCats: Record<string, number> = {};
                    curOrg.forEach(c => { const k = c.category || 'Uncategorised'; curCats[k] = (curCats[k] || 0) + 1; });
                    prevOrg.forEach(c => { const k = c.category || 'Uncategorised'; prevCats[k] = (prevCats[k] || 0) + 1; });

                    for (const cat of new Set([...Object.keys(curCats), ...Object.keys(prevCats)])) {
                        const cur = curCats[cat] || 0;
                        const prev = prevCats[cat] || 0;
                        const delta = cur - prev;
                        if (delta >= SPIKE_CRITICAL) {
                            detected.push({ title: `${formatLabel(cat)} spike`, home: org.name, orgId: org.id, current: cur, previous: prev, delta, severity: 'critical', explanation: `${formatLabel(cat)} cases at ${org.name} increased by ${delta} compared to the previous 30 days.` });
                        } else if (delta >= SPIKE_WARNING) {
                            detected.push({ title: `${formatLabel(cat)} increase`, home: org.name, orgId: org.id, current: cur, previous: prev, delta, severity: 'warning', explanation: `${formatLabel(cat)} cases at ${org.name} rose by ${delta}.` });
                        }
                    }
                }

                // ── B) Channel spikes per home ──────────────────────────────
                for (const org of groupOrgs) {
                    const curOrg = current.filter(c => c.organisation_id === org.id);
                    const prevOrg = previous.filter(c => c.organisation_id === org.id);

                    const curCh: Record<string, number> = {};
                    const prevCh: Record<string, number> = {};
                    curOrg.forEach(c => { const k = c.submission_type || c.channel || 'Unknown'; curCh[k] = (curCh[k] || 0) + 1; });
                    prevOrg.forEach(c => { const k = c.submission_type || c.channel || 'Unknown'; prevCh[k] = (prevCh[k] || 0) + 1; });

                    for (const ch of new Set([...Object.keys(curCh), ...Object.keys(prevCh)])) {
                        const cur = curCh[ch] || 0;
                        const prev = prevCh[ch] || 0;
                        const delta = cur - prev;
                        if (delta >= SPIKE_CRITICAL) {
                            detected.push({ title: `${formatLabel(ch)} channel spike`, home: org.name, orgId: org.id, current: cur, previous: prev, delta, severity: 'critical', explanation: `${formatLabel(ch)} submissions at ${org.name} increased by ${delta}.` });
                        } else if (delta >= SPIKE_WARNING) {
                            detected.push({ title: `${formatLabel(ch)} channel increase`, home: org.name, orgId: org.id, current: cur, previous: prev, delta, severity: 'warning', explanation: `${formatLabel(ch)} submissions at ${org.name} rose by ${delta}.` });
                        }
                    }
                }

                // ── C) High-risk spikes per home ────────────────────────────
                for (const org of groupOrgs) {
                    const curHR = current.filter(c => c.organisation_id === org.id && ['high', 'critical'].includes((c.risk_level ?? '').toLowerCase())).length;
                    const prevHR = previous.filter(c => c.organisation_id === org.id && ['high', 'critical'].includes((c.risk_level ?? '').toLowerCase())).length;
                    const delta = curHR - prevHR;
                    if (delta >= SPIKE_CRITICAL) {
                        detected.push({ title: 'High-risk case spike', home: org.name, orgId: org.id, current: curHR, previous: prevHR, delta, severity: 'critical', explanation: `High-risk cases at ${org.name} increased by ${delta}.` });
                    } else if (delta >= SPIKE_WARNING) {
                        detected.push({ title: 'High-risk case increase', home: org.name, orgId: org.id, current: curHR, previous: prevHR, delta, severity: 'warning', explanation: `High-risk cases at ${org.name} rose by ${delta}.` });
                    } else if (delta >= SPIKE_INFO) {
                        detected.push({ title: 'High-risk case uptick', home: org.name, orgId: org.id, current: curHR, previous: prevHR, delta, severity: 'info', explanation: `High-risk cases at ${org.name} rose by ${delta}.` });
                    }
                }

                // ── D) Loss spikes per home ─────────────────────────────────
                for (const org of groupOrgs) {
                    const curLoss = current.filter(c => c.organisation_id === org.id && c.outcome === 'lost' && typeof c.loss_amount === 'number').reduce((s, c) => s + (c.loss_amount as number), 0);
                    const prevLoss = previous.filter(c => c.organisation_id === org.id && c.outcome === 'lost' && typeof c.loss_amount === 'number').reduce((s, c) => s + (c.loss_amount as number), 0);
                    const delta = curLoss - prevLoss;
                    if (delta >= LOSS_CRITICAL) {
                        detected.push({ title: 'Financial loss spike', home: org.name, orgId: org.id, current: curLoss, previous: prevLoss, delta, severity: 'critical', explanation: `Financial loss at ${org.name} increased by £${delta.toLocaleString()}.` });
                    } else if (delta >= LOSS_WARNING) {
                        detected.push({ title: 'Financial loss increase', home: org.name, orgId: org.id, current: curLoss, previous: prevLoss, delta, severity: 'warning', explanation: `Financial loss at ${org.name} rose by £${delta.toLocaleString()}.` });
                    }
                }

                // ── E) Repeat-targeting spikes per home ─────────────────────
                for (const org of groupOrgs) {
                    const countRepeats = (arr: typeof allCases) => {
                        const refs: Record<string, number> = {};
                        arr.filter(c => c.organisation_id === org.id).forEach(c => { const r = c.resident_ref?.trim(); if (r) refs[r] = (refs[r] || 0) + 1; });
                        return Object.values(refs).filter(n => n > 1).length;
                    };
                    const curRep = countRepeats(current);
                    const prevRep = countRepeats(previous);
                    const delta = curRep - prevRep;
                    if (delta >= SPIKE_WARNING) {
                        detected.push({ title: 'Repeat targeting spike', home: org.name, orgId: org.id, current: curRep, previous: prevRep, delta, severity: 'warning', explanation: `Repeated resident targeting at ${org.name} increased by ${delta} resident(s).` });
                    } else if (delta >= SPIKE_INFO) {
                        detected.push({ title: 'Repeat targeting uptick', home: org.name, orgId: org.id, current: curRep, previous: prevRep, delta, severity: 'info', explanation: `Repeated resident targeting at ${org.name} rose by ${delta}.` });
                    }
                }

                // Sort: severity → absolute delta
                detected.sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity) || Math.abs(b.delta) - Math.abs(a.delta));

                if (!cancelled) setAlerts(detected);
            } catch (err: any) {
                if (!cancelled) setError(err?.message ?? 'Failed to load alert data');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    const displayAlerts = useMemo(
        () => filterHomeId ? alerts.filter(a => a.orgId === filterHomeId) : alerts,
        [alerts, filterHomeId]
    );

    /* ── Render ───────────────────────────────────────────────────────────── */

    if (loading) {
        return (
            <div className="dashboard-overview-loading">
                <Loader2 className="dashboard-overview-spinner-icon" />
                <p>Scanning for anomalies…</p>
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
                    <h1 className="gp-title"><Bell size={20} /> {groupName}</h1>
                    <p className="gp-subtitle">
                        {alerts.length > 0
                            ? `${displayAlerts.length} alert${displayAlerts.length !== 1 ? 's' : ''} detected — last 30 days vs previous 30 days`
                            : 'Last 30 days vs previous 30 days'}
                    </p>
                </div>
                {allOrgs.length > 0 && (
                    <GroupHomeFilter homes={allOrgs} selectedHomeId={filterHomeId} onSelect={setFilterHomeId} />
                )}
            </div>

            {/* No alerts */}
            {displayAlerts.length === 0 && (
                <div className="gp-card">
                    <div className="gp-empty">
                        <CheckCircle2 size={36} className="gp-empty-icon" />
                        <div className="gp-empty-title">No significant anomalies detected</div>
                        <div className="gp-empty-desc">All homes are operating within normal ranges compared to the previous 30-day period.</div>
                    </div>
                </div>
            )}

            {/* Alert cards */}
            {alerts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {displayAlerts.map((a, i) => (
                        <div key={i} className={`gp-alert gp-alert--${a.severity}`}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span className="gp-alert-sev" style={{ background: severityColor(a.severity) + '18', color: severityColor(a.severity) }}>
                                    {a.severity}
                                </span>
                                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>{a.home}</span>
                            </div>
                            <div className="gp-alert-title">{a.title}</div>
                            <div className="gp-alert-desc">{a.explanation}</div>
                            <div className="gp-alert-meta">
                                <span>Current: <strong style={{ color: '#1e293b' }}>{a.current.toLocaleString()}</strong></span>
                                <span>Previous: <strong style={{ color: '#1e293b' }}>{a.previous.toLocaleString()}</strong></span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    Delta: <strong className={a.delta > 0 ? 'gp-val-danger' : 'gp-val-good'}>{a.delta > 0 ? '+' : ''}{a.delta.toLocaleString()}</strong>
                                    <DeltaIcon delta={a.delta} />
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
