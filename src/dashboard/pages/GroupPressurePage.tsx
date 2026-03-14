import React, { useState, useEffect, useMemo } from 'react';
import {
    Loader2, AlertTriangle, Gauge, ArrowUp, ArrowDown,
    AlertOctagon, Clock, ShieldAlert,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import { useGroupHomeFilter } from '../hooks/useGroupHomeFilter';
import { GroupHomeFilter } from '../components/GroupHomeFilter';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface HomePressure {
    id: string;
    name: string;
    openCases: number;
    overdueCases: number;
    highRiskOpen: number;
    totalLoss: number;
    repeatedResidents: number;
    // Normalised component scores (0–100)
    openScore: number;
    overdueScore: number;
    highRiskScore: number;
    lossScore: number;
    repeatScore: number;
    totalScore: number;
    band: 'Low' | 'Medium' | 'High' | 'Critical';
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

// Weights (must sum to 1)
const W_OPEN = 0.15;
const W_OVERDUE = 0.25;
const W_HIGHRISK = 0.30;
const W_LOSS = 0.15;
const W_REPEAT = 0.15;

function bandFromScore(score: number): 'Low' | 'Medium' | 'High' | 'Critical' {
    if (score >= 75) return 'Critical';
    if (score >= 50) return 'High';
    if (score >= 25) return 'Medium';
    return 'Low';
}

function bandColor(band: string): string {
    switch (band) {
        case 'Critical': return '#dc2626';
        case 'High': return '#ea580c';
        case 'Medium': return '#f59e0b';
        default: return '#16a34a';
    }
}

/** Normalise an array of raw values to 0–100; max value → 100 */
function normalise(values: number[]): number[] {
    const max = Math.max(...values);
    if (max === 0) return values.map(() => 0);
    return values.map(v => (v / max) * 100);
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function GroupPressurePage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [groupName, setGroupName] = useState('Group Pressure');
    const [homes, setHomes] = useState<HomePressure[]>([]);
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

                if (!cancelled && groupRow?.name) setGroupName(groupRow.name + ' — Pressure Score');

                const { data: groupOrgs } = await supabase
                    .from('organisations')
                    .select('id, name')
                    .eq('organisation_group_id', groupId)
                    .order('name');

                if (!groupOrgs || groupOrgs.length === 0) { setError('No organisations found in this group.'); setLoading(false); return; }

                const orgIds = groupOrgs.map(o => o.id);

                const { data: cases } = await supabase
                    .from('cases')
                    .select('id, organisation_id, status, risk_level, outcome, loss_amount, submitted_at, resident_ref')
                    .in('organisation_id', orgIds);

                const allCases = cases ?? [];
                const overdueThreshold = new Date(Date.now() - SLA_DAYS * 24 * 60 * 60 * 1000);

                // Raw metrics per home
                const rawData = groupOrgs.map(org => {
                    const oc = allCases.filter(c => c.organisation_id === org.id);
                    const open = oc.filter(c => c.status !== 'closed');
                    const highRisk = open.filter(c => ['high', 'critical'].includes((c.risk_level ?? '').toLowerCase()));
                    const overdue = open.filter(c => new Date(c.submitted_at) < overdueThreshold);
                    const loss = oc
                        .filter(c => c.outcome === 'lost' && typeof c.loss_amount === 'number')
                        .reduce((s, c) => s + (c.loss_amount as number), 0);

                    // Repeated residents (>1 incident)
                    const refCounts: Record<string, number> = {};
                    oc.forEach(c => {
                        const ref = c.resident_ref?.trim();
                        if (ref) refCounts[ref] = (refCounts[ref] || 0) + 1;
                    });
                    const repeated = Object.values(refCounts).filter(n => n > 1).length;

                    return {
                        id: org.id,
                        name: org.name,
                        openCases: open.length,
                        overdueCases: overdue.length,
                        highRiskOpen: highRisk.length,
                        totalLoss: loss,
                        repeatedResidents: repeated,
                    };
                });

                // Normalise each dimension across all homes
                const nOpen = normalise(rawData.map(d => d.openCases));
                const nOverdue = normalise(rawData.map(d => d.overdueCases));
                const nHighRisk = normalise(rawData.map(d => d.highRiskOpen));
                const nLoss = normalise(rawData.map(d => d.totalLoss));
                const nRepeat = normalise(rawData.map(d => d.repeatedResidents));

                const homeData: HomePressure[] = rawData.map((d, i) => {
                    const totalScore = Math.round(
                        nOpen[i] * W_OPEN +
                        nOverdue[i] * W_OVERDUE +
                        nHighRisk[i] * W_HIGHRISK +
                        nLoss[i] * W_LOSS +
                        nRepeat[i] * W_REPEAT
                    );
                    return {
                        ...d,
                        openScore: Math.round(nOpen[i]),
                        overdueScore: Math.round(nOverdue[i]),
                        highRiskScore: Math.round(nHighRisk[i]),
                        lossScore: Math.round(nLoss[i]),
                        repeatScore: Math.round(nRepeat[i]),
                        totalScore,
                        band: bandFromScore(totalScore),
                    };
                });

                homeData.sort((a, b) => b.totalScore - a.totalScore);

                if (!cancelled) setHomes(homeData);
            } catch (err: any) {
                if (!cancelled) setError(err?.message ?? 'Failed to load pressure data');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    const displayHomes = useMemo(
        () => filterHomeId ? homes.filter(h => h.id === filterHomeId) : homes,
        [homes, filterHomeId]
    );

    /* ── Highlights ──────────────────────────────────────────────────────── */
    function buildHighlights(): Highlight[] {
        if (displayHomes.length === 0) return [];
        const hl: Highlight[] = [];

        const highest = displayHomes[0];
        hl.push({ label: 'Highest Pressure', homeName: highest.name, value: `${highest.totalScore} — ${highest.band}`, color: bandColor(highest.band), icon: <ArrowUp size={18} /> });

        if (displayHomes.length > 1) {
            const lowest = displayHomes[displayHomes.length - 1];
            hl.push({ label: 'Lowest Pressure', homeName: lowest.name, value: `${lowest.totalScore} — ${lowest.band}`, color: bandColor(lowest.band), icon: <ArrowDown size={18} /> });
        }

        const worstOverdue = [...displayHomes].sort((a, b) => b.overdueScore - a.overdueScore)[0];
        if (worstOverdue.overdueScore > 0) {
            hl.push({ label: 'Highest Overdue Pressure', homeName: worstOverdue.name, value: `${worstOverdue.overdueCases} overdue`, color: '#f59e0b', icon: <Clock size={18} /> });
        }

        const worstHighRisk = [...displayHomes].sort((a, b) => b.highRiskScore - a.highRiskScore)[0];
        if (worstHighRisk.highRiskScore > 0) {
            hl.push({ label: 'Highest High-Risk Pressure', homeName: worstHighRisk.name, value: `${worstHighRisk.highRiskOpen} high-risk`, color: '#dc2626', icon: <ShieldAlert size={18} /> });
        }

        return hl;
    }

    const highlights = buildHighlights();

    /* ── Render ───────────────────────────────────────────────────────────── */

    if (loading) {
        return (
            <div className="dashboard-overview-loading">
                <Loader2 className="dashboard-overview-spinner-icon" />
                <p>Calculating pressure scores…</p>
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
                    <h1 className="gp-title"><Gauge size={20} /> {groupName}</h1>
                    <p className="gp-subtitle">Operational risk pressure across {displayHomes.length} home{displayHomes.length !== 1 ? 's' : ''}</p>
                </div>
                {allOrgs.length > 0 && (
                    <GroupHomeFilter homes={allOrgs} selectedHomeId={filterHomeId} onSelect={setFilterHomeId} />
                )}
            </div>

            {/* Highlight Cards */}
            {highlights.length > 0 && (
                <div className="gp-highlights">
                    {highlights.map((h, i) => (
                        <div key={i} className="gp-highlight">
                            <div className="gp-highlight-icon" style={{ background: h.color + '14', color: h.color }}>
                                {h.icon}
                            </div>
                            <div>
                                <div className="gp-highlight-label">{h.label}</div>
                                <div className="gp-highlight-home">{h.homeName}</div>
                                <div className="gp-highlight-value">{h.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pressure Table */}
            <div className="gp-card">
                <div className="gp-card-header">
                    <h2 className="gp-card-title"><Gauge size={15} /> Pressure Comparison</h2>
                </div>
                <div className="gp-table-wrap">
                    <table className="gp-table">
                        <thead>
                            <tr>
                                <th>Home</th>
                                <th style={{ textAlign: 'center' }}>Score</th>
                                <th style={{ textAlign: 'center' }}>Band</th>
                                <th className="text-right">Open ({Math.round(W_OPEN * 100)}%)</th>
                                <th className="text-right">Overdue ({Math.round(W_OVERDUE * 100)}%)</th>
                                <th className="text-right">High-Risk ({Math.round(W_HIGHRISK * 100)}%)</th>
                                <th className="text-right">Loss ({Math.round(W_LOSS * 100)}%)</th>
                                <th className="text-right">Repeat ({Math.round(W_REPEAT * 100)}%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayHomes.length === 0 ? (
                                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No data available</td></tr>
                            ) : displayHomes.map(h => (
                                <tr key={h.id} className="gp-row-click" onClick={() => setFilterHomeId(filterHomeId === h.id ? null : h.id)}>
                                    <td className="gp-home-name">{h.name}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '1.1rem', color: bandColor(h.band) }}>{h.totalScore}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span className="gp-tag" style={{ background: bandColor(h.band) + '18', color: bandColor(h.band), border: `1px solid ${bandColor(h.band)}40` }}>
                                            {h.band}
                                        </span>
                                    </td>
                                    <td className="text-right">
                                        {h.openScore}
                                        <span className="gp-val-muted" style={{ fontSize: '0.7rem', marginLeft: '4px' }}>({h.openCases})</span>
                                    </td>
                                    <td className="text-right">
                                        <span className={h.overdueScore > 50 ? 'gp-val-warn' : ''}>{h.overdueScore}</span>
                                        <span className="gp-val-muted" style={{ fontSize: '0.7rem', marginLeft: '4px' }}>({h.overdueCases})</span>
                                    </td>
                                    <td className="text-right">
                                        <span className={h.highRiskScore > 50 ? 'gp-val-danger' : ''}>{h.highRiskScore}</span>
                                        <span className="gp-val-muted" style={{ fontSize: '0.7rem', marginLeft: '4px' }}>({h.highRiskOpen})</span>
                                    </td>
                                    <td className="text-right">
                                        {h.lossScore}
                                        <span className="gp-val-muted" style={{ fontSize: '0.7rem', marginLeft: '4px' }}>(£{h.totalLoss.toLocaleString()})</span>
                                    </td>
                                    <td className="text-right">
                                        {h.repeatScore}
                                        <span className="gp-val-muted" style={{ fontSize: '0.7rem', marginLeft: '4px' }}>({h.repeatedResidents})</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Explainability */}
            <div className="gp-card">
                <div className="gp-card-header">
                    <h2 className="gp-card-title"><AlertOctagon size={15} /> How Pressure is Calculated</h2>
                </div>
                <div className="gp-card-body" style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.7 }}>
                    <p style={{ marginBottom: '0.75rem' }}>
                        The pressure score (0–100) is derived from five current operational signals, each normalised against the group maximum and combined with the following weights:
                    </p>
                    <table style={{ fontSize: '0.8rem', borderCollapse: 'collapse', marginBottom: '0.75rem' }}>
                        <tbody>
                            <tr><td style={{ padding: '0.2rem 1rem 0.2rem 0' }}><strong>Open Cases</strong></td><td>{Math.round(W_OPEN * 100)}%</td></tr>
                            <tr><td style={{ padding: '0.2rem 1rem 0.2rem 0' }}><strong>Overdue Cases</strong></td><td>{Math.round(W_OVERDUE * 100)}%</td></tr>
                            <tr><td style={{ padding: '0.2rem 1rem 0.2rem 0' }}><strong>High-Risk Open Cases</strong></td><td>{Math.round(W_HIGHRISK * 100)}%</td></tr>
                            <tr><td style={{ padding: '0.2rem 1rem 0.2rem 0' }}><strong>Total Financial Loss</strong></td><td>{Math.round(W_LOSS * 100)}%</td></tr>
                            <tr><td style={{ padding: '0.2rem 1rem 0.2rem 0' }}><strong>Repeated Residents</strong></td><td>{Math.round(W_REPEAT * 100)}%</td></tr>
                        </tbody>
                    </table>
                    <p style={{ marginBottom: '0.5rem' }}>
                        Each component is normalised so the home with the highest raw value in that dimension scores 100, and others scale proportionally. The weighted sum produces the final score.
                    </p>
                    <p>
                        <strong>Bands:</strong> Low (0–24) · Medium (25–49) · High (50–74) · Critical (75–100)
                    </p>
                </div>
            </div>
        </div>
    );
}

