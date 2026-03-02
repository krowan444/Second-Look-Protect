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
    generation_method: string | null;
    generated_via: string | null;
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
    const [previousSnapshot, setPreviousSnapshot] = React.useState<SnapshotRow | null>(null);
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
    const [noteVersions, setNoteVersions] = React.useState<{ created_at: string; notes: string }[]>([]);
    const [showVersions, setShowVersions] = React.useState(false);
    const [inspectionMode, setInspectionMode] = React.useState(false);
    const notesKey = orgId && month ? `slp_inspection_notes_${orgId}_${month}` : '';

    // Default inspectionMode to true for closed/past snapshots
    React.useEffect(() => {
        if (!month) return;
        const nowDate = new Date();
        const currentYM = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}`;
        const viewedYM = month.slice(0, 7);
        setInspectionMode(viewedYM !== currentYM);
    }, [month]);

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

    // Fetch note versions when org + month resolve
    React.useEffect(() => {
        if (!orgId || !month) return;
        (async () => {
            try {
                const supabase = getSupabase();
                const { data } = await supabase
                    .from('inspection_pack_note_versions')
                    .select('created_at, notes')
                    .eq('organisation_id', orgId)
                    .eq('snapshot_month', month)
                    .order('created_at', { ascending: false })
                    .limit(5);
                setNoteVersions(data ?? []);
            } catch { setNoteVersions([]); }
        })();
        setShowVersions(false);
    }, [orgId, month]);

    React.useEffect(() => {
        (async () => {
            setLoading(true);
            setError(null);

            try {
                const supabase = getSupabase();

                // Parse month from URL (do NOT fall back to current calendar month yet)
                const params = new URLSearchParams(window.location.search);
                const urlMonth = params.get('month') || '';

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
                    .select('id, snapshot_month, organisation_id, total_open_cases, overdue_open_cases, sla_compliance_percent, safeguarding_score, generated_at, generation_method, generated_via')
                    .eq('organisation_id', activeOrgId)
                    .order('generated_at', { ascending: false });

                if (err) throw new Error(err.message);

                // Build unique months list from all rows
                const allRows = (data ?? []) as SnapshotRow[];
                const unique = [...new Set(allRows.map((r) => r.snapshot_month).filter(Boolean))] as string[];
                unique.sort((a, b) => b.localeCompare(a)); // newest first
                setAvailableMonths(unique);

                // Determine which month to use: URL param first, else latest available
                const resolvedMonth = (urlMonth && unique.includes(urlMonth)) ? urlMonth
                    : urlMonth ? urlMonth  // keep invalid URL month so we can show "no snapshot" message
                        : unique[0] || '';
                setMonth(resolvedMonth);

                // Update URL if it was missing a month param
                if (!urlMonth && resolvedMonth) {
                    const u = new URL(window.location.href);
                    u.searchParams.set('month', resolvedMonth);
                    window.history.replaceState({}, '', u.toString());
                }

                // Find snapshot for the resolved month
                const matchedSnapshot = allRows.find((r) => r.snapshot_month === resolvedMonth) ?? null;
                setSnapshot(matchedSnapshot);

                // Find previous snapshot (the one with the highest month < resolvedMonth)
                const prevSnapshot = resolvedMonth
                    ? allRows.find((r) => r.snapshot_month && r.snapshot_month < resolvedMonth) ?? null
                    : null;
                setPreviousSnapshot(prevSnapshot);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Compute deltas between selected and previous snapshot
    const deltas = React.useMemo(() => {
        if (!snapshot || !previousSnapshot) return null;
        const d = (a: number | null, b: number | null) => (a != null && b != null) ? a - b : null;
        return {
            total_open_cases: d(snapshot.total_open_cases, previousSnapshot.total_open_cases),
            overdue_open_cases: d(snapshot.overdue_open_cases, previousSnapshot.overdue_open_cases),
            sla_compliance_percent: d(snapshot.sla_compliance_percent, previousSnapshot.sla_compliance_percent),
            safeguarding_score: d(snapshot.safeguarding_score, previousSnapshot.safeguarding_score),
        };
    }, [snapshot, previousSnapshot]);

    async function refetchSnapshot() {
        if (!orgId || !month) return;
        try {
            const supabase = getSupabase();
            const { data, error: err } = await supabase
                .from('inspection_snapshots')
                .select('id, snapshot_month, organisation_id, total_open_cases, overdue_open_cases, sla_compliance_percent, safeguarding_score, generated_at, generation_method, generated_via')
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
                    <button
                        type="button"
                        onClick={() => setInspectionMode((v) => !v)}
                        style={{ marginLeft: 'auto', height: 30, padding: '0 10px', borderRadius: 8, border: inspectionMode ? '1px solid #dc2626' : '1px solid #e2e8f0', background: inspectionMode ? '#fef2f2' : '#f8fafc', color: inspectionMode ? '#dc2626' : '#64748b', fontSize: '0.72rem', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                        {inspectionMode ? 'Exit Inspection Mode' : 'Enter Inspection Mode'}
                    </button>
                </div>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#64748b' }}>
                    {orgName} — {month.slice(0, 7)}
                </p>
                {availableMonths.length >= 1 && (
                    <div style={{ marginTop: '0.5rem' }}>
                        <label style={{ fontSize: '0.72rem', color: '#94a3b8', marginRight: '0.35rem' }}>Month</label>
                        <select
                            value={month}
                            disabled={availableMonths.length === 1}
                            style={{ fontSize: '0.82rem', padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', opacity: availableMonths.length === 1 ? 0.6 : 1 }}
                            onChange={(e) => {
                                const newMonth = e.target.value;
                                const url = new URL(window.location.href);
                                url.searchParams.set('month', newMonth);
                                window.history.replaceState({}, '', url.toString());
                                setMonth(newMonth);
                                setSnapshot(null);
                                setPreviousSnapshot(null);
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
                                            .select('id, snapshot_month, organisation_id, total_open_cases, overdue_open_cases, sla_compliance_percent, safeguarding_score, generated_at, generation_method, generated_via')
                                            .eq('organisation_id', orgId)
                                            .eq('snapshot_month', newMonth)
                                            .order('generated_at', { ascending: false })
                                            .limit(1)
                                            .maybeSingle();
                                        if (err) throw new Error(err.message);
                                        setSnapshot(data as SnapshotRow | null);
                                        // Fetch previous snapshot for deltas
                                        try {
                                            const { data: prevData } = await supabase
                                                .from('inspection_snapshots')
                                                .select('id, snapshot_month, organisation_id, total_open_cases, overdue_open_cases, sla_compliance_percent, safeguarding_score, generated_at, generation_method, generated_via')
                                                .eq('organisation_id', orgId)
                                                .lt('snapshot_month', newMonth)
                                                .order('snapshot_month', { ascending: false })
                                                .limit(1)
                                                .maybeSingle();
                                            setPreviousSnapshot(prevData as SnapshotRow | null);
                                        } catch { setPreviousSnapshot(null); }
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
                        {month && !availableMonths.includes(month) && (
                            <span style={{ display: 'block', fontSize: '0.72rem', color: '#b45309', marginTop: '0.25rem' }}>No snapshot exists for this month.</span>
                        )}
                    </div>
                )}
            </div>

            {/* Inspection Mode banner */}
            {inspectionMode && (
                <div style={{ padding: '0.5rem 0.75rem', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', fontSize: '0.78rem', fontWeight: 500, marginBottom: '1rem' }}>
                    Inspection Mode Active (Read-only)
                </div>
            )}

            {/* Snapshot metadata */}
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '1rem', lineHeight: 1.6 }}>
                <span>Generated: {fmtDate(snapshot.generated_at)}</span>
                {snapshot.generation_method && <span> · Method: {snapshot.generation_method}</span>}
                {snapshot.generated_via && <span> · Via: {snapshot.generated_via}</span>}
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
                    {deltas && deltas.total_open_cases != null && <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.15rem' }}>vs prev: {deltas.total_open_cases > 0 ? '+' : ''}{deltas.total_open_cases}</div>}
                </div>
                <div style={{ padding: '1rem', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}>Overdue Open Cases</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{snapshot.overdue_open_cases ?? '—'}</div>
                    {deltas && deltas.overdue_open_cases != null && <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.15rem' }}>vs prev: {deltas.overdue_open_cases > 0 ? '+' : ''}{deltas.overdue_open_cases}</div>}
                </div>
                <div style={{ padding: '1rem', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}>SLA Compliance</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{snapshot.sla_compliance_percent != null ? `${snapshot.sla_compliance_percent}%` : '—'}</div>
                    {deltas && deltas.sla_compliance_percent != null && <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.15rem' }}>vs prev: {deltas.sla_compliance_percent > 0 ? '+' : ''}{Math.round(deltas.sla_compliance_percent * 100) / 100} pp</div>}
                </div>
                <div style={{ padding: '1rem', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}>Safeguarding Score</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{snapshot.safeguarding_score ?? '—'}</div>
                    {deltas && deltas.safeguarding_score != null && <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.15rem' }}>vs prev: {deltas.safeguarding_score > 0 ? '+' : ''}{deltas.safeguarding_score}</div>}
                </div>
                {/* Inspection Ready indicator */}
                {(() => {
                    const slaOk = (snapshot.sla_compliance_percent ?? 0) >= 90;
                    const overdueOk = (snapshot.overdue_open_cases ?? 0) === 0;
                    const ready = slaOk && overdueOk;
                    return (
                        <div style={{ padding: '1rem', borderRadius: 12, border: `1px solid ${ready ? '#bbf7d0' : '#fde68a'}`, background: ready ? '#f0fdf4' : '#fffbeb', gridColumn: 'span 2' }}>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}>Inspection Readiness</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: ready ? '#16a34a' : '#d97706' }}>{ready ? '✓ Inspection Ready' : '⚠ Attention Required'}</div>
                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.25rem' }}>Based on SLA compliance and overdue cases in this snapshot.</div>
                        </div>
                    );
                })()}
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
                            const notesReadOnly = isClosedSnapshot || inspectionMode;

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
                                        readOnly={notesReadOnly}
                                        placeholder="Add any notes for the inspector here…"
                                        style={{ width: '100%', resize: 'vertical', fontSize: '0.82rem', marginBottom: '0.5rem', opacity: notesReadOnly ? 0.6 : 1 }}
                                        onChange={(e) => {
                                            if (!notesReadOnly) {
                                                setInspectorNotes(e.target.value);
                                                setSaveStatus('');
                                            }
                                        }}
                                    />
                                    {!notesReadOnly && (
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
                                    {noteVersions.length > 0 && (
                                        <div style={{ marginTop: '0.75rem' }}>
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => setShowVersions((v) => !v)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') setShowVersions((v) => !v); }}
                                                style={{ fontSize: '0.72rem', color: '#64748b', cursor: 'pointer', textDecoration: 'underline' }}
                                            >
                                                {showVersions ? 'Hide' : 'View'} previous versions ({noteVersions.length})
                                            </span>
                                            {showVersions && (
                                                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                    {noteVersions.map((v, i) => (
                                                        <div key={i} style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginBottom: '0.2rem' }}>{fmtDate(v.created_at)}</div>
                                                            <div style={{ fontSize: '0.78rem', color: '#334155', whiteSpace: 'pre-wrap' }}>
                                                                {v.notes.length > 200 ? v.notes.slice(0, 200) + '…' : v.notes}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
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
