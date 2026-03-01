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
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

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
