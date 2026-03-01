import React from 'react';
import { Loader2, FileText, Download } from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

type SnapshotRow = {
    id: string;
    snapshot_month: string | null;
    organisation_id: string | null;
    total_open_cases: number | null;
    overdue_open_cases: number | null;
    sla_compliance_percent: number | null;
    safeguarding_score: number | null;
    generated_at: string | null;
    organisations?: { name: string | null } | null;
};

function fmtDate(iso: string | null) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
        return iso;
    }
}

export function InspectionPackPage() {
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [snapshot, setSnapshot] = React.useState<SnapshotRow | null>(null);
    const [orgName, setOrgName] = React.useState<string>('');
    const [isSuper, setIsSuper] = React.useState<boolean | null>(null);
    const [month, setMonth] = React.useState('');
    const [orgId, setOrgId] = React.useState<string>('');
    const [generating, setGenerating] = React.useState(false);
    const [availableMonths, setAvailableMonths] = React.useState<string[]>([]);
    const [inspectorNotes, setInspectorNotes] = React.useState('');
    const [userId, setUserId] = React.useState<string>('');
    const [saving, setSaving] = React.useState(false);
    const [saveStatus, setSaveStatus] = React.useState<string>('');
    const notesKey = orgId && month ? `slp_inspection_notes_${orgId}_${month}` : '';

    // Fetch notes from DB when org + month resolve
    React.useEffect(() => {
        if (!orgId || !month) return;
        (async () => {
            try {
                const supabase = getSupabase();
                const { data, error: err } = await supabase
                    .from('inspection_pack_notes')
                    .select('notes')
                    .eq('organisation_id', orgId)
                    .eq('snapshot_month', month)
                    .maybeSingle();
                if (!err && data) {
                    setInspectorNotes(data.notes ?? '');
                } else {
                    // Fallback to localStorage
                    try { setInspectorNotes(localStorage.getItem(notesKey) ?? ''); } catch { /* ignore */ }
                }
            } catch {
                try { setInspectorNotes(localStorage.getItem(notesKey) ?? ''); } catch { /* ignore */ }
            }
        })();
    }, [orgId, month, notesKey]);

    React.useEffect(() => {
        (async () => {
            setLoading(true);
            setError(null);

            try {
                const supabase = getSupabase();

                // Parse month from URL
                const params = new URLSearchParams(window.location.search);
                const now = new Date();
                const monthParam = params.get('month') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
                setMonth(monthParam);

                // Auth + role check
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('Not authenticated');
                setUserId(user.id);

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role, organisation_id')
                    .eq('id', user.id)
                    .maybeSingle();

                if (profile?.role !== 'super_admin') {
                    setIsSuper(false);
                    setLoading(false);
                    return;
                }
                setIsSuper(true);

                // Resolve org: super_admin uses the active org switcher
                const activeOrgId = localStorage.getItem('slp_active_org_id') || profile.organisation_id;

                if (!activeOrgId) {
                    setError('No organisation selected.');
                    setLoading(false);
                    return;
                }
                setOrgId(activeOrgId);

                // Fetch org name
                const { data: orgRow } = await supabase
                    .from('organisations')
                    .select('name')
                    .eq('id', activeOrgId)
                    .maybeSingle();
                setOrgName(orgRow?.name ?? 'Unknown organisation');

                // Fetch snapshot
                const { data, error: err } = await supabase
                    .from('inspection_snapshots')
                    .select('id, snapshot_month, organisation_id, total_open_cases, overdue_open_cases, sla_compliance_percent, safeguarding_score, generated_at')
                    .eq('organisation_id', activeOrgId)
                    .eq('snapshot_month', monthParam)
                    .order('generated_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (err) throw new Error(err.message);
                setSnapshot(data as SnapshotRow | null);

                // Fetch available months for dropdown
                const { data: monthRows } = await supabase
                    .from('inspection_snapshots')
                    .select('snapshot_month')
                    .eq('organisation_id', activeOrgId)
                    .order('snapshot_month', { ascending: false });
                if (monthRows) {
                    const unique = [...new Set(monthRows.map((r: { snapshot_month: string }) => r.snapshot_month).filter(Boolean))] as string[];
                    setAvailableMonths(unique);
                }
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    async function refetchSnapshot() {
        if (!orgId || !month) return;
        try {
            const supabase = getSupabase();
            const { data, error: err } = await supabase
                .from('inspection_snapshots')
                .select('id, snapshot_month, organisation_id, total_open_cases, overdue_open_cases, sla_compliance_percent, safeguarding_score, generated_at')
                .eq('organisation_id', orgId)
                .eq('snapshot_month', month)
                .order('generated_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (!err) setSnapshot(data as SnapshotRow | null);
        } catch { /* non-blocking */ }
    }

    async function handleGenerate() {
        setGenerating(true);
        setError(null);
        try {
            const supabase = getSupabase();
            const { error: rpcErr } = await supabase.rpc('generate_all_org_monthly_snapshots', { p_month: month });
            if (rpcErr) throw new Error(rpcErr.message);
            await refetchSnapshot();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to generate snapshot');
        } finally {
            setGenerating(false);
        }
    }

    // Access denied
    if (isSuper === false) {
        return (
            <div style={{ padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif' }}>
                <h1>Access Denied</h1>
                <p>This page is restricted to super administrators.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="dashboard-overview-loading">
                <Loader2 className="dashboard-overview-spinner-icon" />
                <p>Loading inspection pack…</p>
            </div>
        );
    }

    if (!snapshot) {
        return (
            <div style={{ padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif' }}>
                <h1>Inspection Pack</h1>
                {error && <p style={{ color: '#991b1b' }}>{error}</p>}
                <p>No snapshot found for this month. Generate it from the Inspection page.</p>
                {isSuper && orgId && month && (
                    <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={generating}
                        className="dashboard-primary-button"
                        style={{ height: 36, padding: '0 12px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', marginTop: '0.75rem', opacity: generating ? 0.7 : 1 }}
                    >
                        {generating ? <Loader2 size={16} className="dashboard-overview-spinner-icon" /> : <FileText size={16} />}
                        {generating ? 'Generating…' : 'Generate snapshot for this month'}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 800, margin: '0 auto' }}>
            {error && <p style={{ color: '#991b1b', marginBottom: '1rem' }}>{error}</p>}

            {/* Header */}
            <div style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <FileText size={20} />
                    <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Inspection Pack</h1>
                </div>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#64748b' }}>
                    {orgName} — {month.slice(0, 7)}
                </p>
                {availableMonths.length > 1 && (
                    <div style={{ marginTop: '0.5rem' }}>
                        <label style={{ fontSize: '0.72rem', color: '#94a3b8', marginRight: '0.35rem' }}>Month</label>
                        <select
                            value={month}
                            style={{ fontSize: '0.82rem', padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}
                            onChange={(e) => {
                                const newMonth = e.target.value;
                                const url = new URL(window.location.href);
                                url.searchParams.set('month', newMonth);
                                window.history.replaceState({}, '', url.toString());
                                setMonth(newMonth);
                                setSnapshot(null);
                                setInspectorNotes('');
                                setSaveStatus('');
                                setLoading(true);
                                setError(null);
                                // Refetch snapshot for new month
                                (async () => {
                                    try {
                                        const supabase = getSupabase();
                                        const { data, error: err } = await supabase
                                            .from('inspection_snapshots')
                                            .select('id, snapshot_month, organisation_id, total_open_cases, overdue_open_cases, sla_compliance_percent, safeguarding_score, generated_at')
                                            .eq('organisation_id', orgId)
                                            .eq('snapshot_month', newMonth)
                                            .order('generated_at', { ascending: false })
                                            .limit(1)
                                            .maybeSingle();
                                        if (err) throw new Error(err.message);
                                        setSnapshot(data as SnapshotRow | null);
                                    } catch (e) {
                                        setError(e instanceof Error ? e.message : 'Unknown error');
                                    } finally {
                                        setLoading(false);
                                    }
                                })();
                            }}
                        >
                            {availableMonths.map((m) => (
                                <option key={m} value={m}>{m.slice(0, 7)}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Download PDF */}
            {isSuper && orgId && month && (
                <div style={{ marginBottom: '1.5rem' }}>
                    <button
                        type="button"
                        className="dashboard-primary-button"
                        style={{ height: 36, padding: '0 12px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}
                        onClick={async () => {
                            try {
                                const supabase = getSupabase();
                                const { data: { session } } = await supabase.auth.getSession();
                                const token = session?.access_token;
                                if (!token) { alert('Not authenticated'); return; }
                                const r = await fetch(`/api/inspection-pack-pdf?org_id=${orgId}&month=${month}`, {
                                    headers: { Authorization: `Bearer ${token}` },
                                });
                                if (!r.ok) { const j = await r.json().catch(() => null); alert(j?.error ?? 'PDF generation failed'); return; }
                                const blob = await r.blob();
                                const url = URL.createObjectURL(blob);
                                window.open(url, '_blank');
                            } catch (e) { alert(e instanceof Error ? e.message : 'Failed to download PDF'); }
                        }}
                    >
                        <Download size={16} />
                        Download PDF
                    </button>
                </div>
            )}

            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
                <div style={{ padding: '1rem', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}>Total Open Cases</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{snapshot.total_open_cases ?? '—'}</div>
                </div>
                <div style={{ padding: '1rem', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}>Overdue Open Cases</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{snapshot.overdue_open_cases ?? '—'}</div>
                </div>
                <div style={{ padding: '1rem', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}>SLA Compliance</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{snapshot.sla_compliance_percent != null ? `${snapshot.sla_compliance_percent}%` : '—'}</div>
                </div>
                <div style={{ padding: '1rem', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}>Safeguarding Score</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{snapshot.safeguarding_score ?? '—'}</div>
                </div>
            </div>

            {/* Evidence & Governance */}
            {(() => {
                const open = snapshot.total_open_cases ?? 0;
                const overdue = snapshot.overdue_open_cases ?? 0;
                const sla = snapshot.sla_compliance_percent;
                const sg = snapshot.safeguarding_score;
                const genDate = fmtDate(snapshot.generated_at);

                // Risks
                const risks: string[] = [];
                if (overdue > 0) risks.push(`${overdue} case${overdue > 1 ? 's' : ''} remain overdue, requiring timely escalation to prevent safeguarding gaps.`);
                if (sla != null && sla < 90) risks.push(`SLA compliance is at ${sla}%, below the recommended 90% threshold. Response times should be reviewed.`);
                if (sg != null && sg < 70) risks.push(`Safeguarding score of ${sg} indicates areas for improvement in the organisation's safeguarding posture.`);
                if (risks.length === 0) risks.push('No significant risk spikes detected in this snapshot period.');

                // Actions
                const actions: string[] = [];
                if (overdue > 0) actions.push('Prioritise resolution of overdue cases and confirm escalation pathways are active.');
                if (sla != null && sla < 90) actions.push('Review SLA performance with the safeguarding team to identify bottlenecks.');
                if (sg != null && sg < 70) actions.push('Schedule a safeguarding review meeting to address score improvement areas.');
                if (actions.length === 0) actions.push('Continue current monitoring cadence.', 'Ensure monthly snapshots remain generated for audit continuity.');
                if (actions.length < 2) actions.push('Maintain regular snapshot generation for ongoing compliance evidence.');

                return (
                    <div style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem' }}>Evidence &amp; Governance</h2>

                        {/* Narrative */}
                        <p style={{ fontSize: '0.84rem', lineHeight: 1.65, color: '#334155', marginBottom: '1rem' }}>
                            As of the snapshot generated on {genDate}, the organisation has {open} open case{open !== 1 ? 's' : ''}
                            {overdue > 0 ? `, of which ${overdue} ${overdue > 1 ? 'are' : 'is'} overdue` : ''}.
                            {sla != null ? ` SLA compliance stands at ${sla}%.` : ''}
                            {sg != null ? ` The current safeguarding score is ${sg}.` : ''}
                            {' '}This data represents an immutable point-in-time record suitable for inspection and regulatory evidence.
                        </p>

                        {/* Key risks */}
                        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.4rem' }}>Key risks observed</h3>
                        <ul style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.6, paddingLeft: '1.25rem', marginBottom: '1rem' }}>
                            {risks.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>

                        {/* Recommended actions */}
                        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.4rem' }}>Recommended actions</h3>
                        <ul style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.6, paddingLeft: '1.25rem', marginBottom: '1rem' }}>
                            {actions.map((a, i) => <li key={i}>{a}</li>)}
                        </ul>

                        {/* Audit note */}
                        <p style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic', marginBottom: '1.25rem' }}>
                            This pack is generated from an immutable monthly snapshot for audit integrity.
                        </p>

                        {/* Inspector notes */}
                        {isSuper && orgId && month && (() => {
                            const nowDate = new Date();
                            const currentYM = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}`;
                            const viewedYM = month.slice(0, 7);
                            const isClosedSnapshot = viewedYM !== currentYM;

                            return (
                                <div>
                                    <h3 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        Notes for inspector (optional)
                                        {isClosedSnapshot && (
                                            <span style={{ fontSize: '0.65rem', fontWeight: 500, background: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: 4 }}>Closed snapshot</span>
                                        )}
                                    </h3>
                                    {isClosedSnapshot && (
                                        <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0 0 0.4rem' }}>Past months are locked for audit integrity.</p>
                                    )}
                                    <textarea
                                        className="dsf-input"
                                        rows={4}
                                        value={inspectorNotes}
                                        readOnly={isClosedSnapshot}
                                        placeholder="Add any notes for the inspector here…"
                                        style={{ width: '100%', resize: 'vertical', fontSize: '0.82rem', marginBottom: '0.5rem', opacity: isClosedSnapshot ? 0.6 : 1 }}
                                        onChange={(e) => {
                                            if (!isClosedSnapshot) {
                                                setInspectorNotes(e.target.value);
                                                setSaveStatus('');
                                            }
                                        }}
                                    />
                                    {!isClosedSnapshot && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <button
                                                type="button"
                                                disabled={saving}
                                                className="dashboard-primary-button"
                                                style={{ height: 32, padding: '0 10px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', opacity: saving ? 0.7 : 1 }}
                                                onClick={async () => {
                                                    setSaving(true);
                                                    setSaveStatus('');
                                                    try {
                                                        const supabase = getSupabase();
                                                        const { error: upsertErr } = await supabase
                                                            .from('inspection_pack_notes')
                                                            .upsert(
                                                                {
                                                                    organisation_id: orgId,
                                                                    snapshot_month: month,
                                                                    notes: inspectorNotes,
                                                                    updated_by: userId,
                                                                    created_by: userId,
                                                                },
                                                                { onConflict: 'organisation_id,snapshot_month' }
                                                            );
                                                        if (upsertErr) throw new Error(upsertErr.message);
                                                        try { localStorage.setItem(notesKey, inspectorNotes); } catch { /* ignore */ }
                                                        setSaveStatus('Saved');
                                                    } catch (e) {
                                                        setSaveStatus(e instanceof Error ? e.message : 'Failed to save');
                                                    } finally {
                                                        setSaving(false);
                                                    }
                                                }}
                                            >
                                                {saving ? <Loader2 size={14} className="dashboard-overview-spinner-icon" /> : null}
                                                {saving ? 'Saving…' : 'Save notes'}
                                            </button>
                                            {saveStatus && (
                                                <span style={{ fontSize: '0.75rem', color: saveStatus === 'Saved' ? '#16a34a' : '#dc2626' }}>{saveStatus}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                );
            })()}

            {/* Meta */}
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                Snapshot generated: {fmtDate(snapshot.generated_at)}
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '2rem', fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center' }}>
                Generated by Second Look Protect
            </div>
        </div>
    );
}
