import React from 'react';
import { ClipboardCheck, RefreshCcw, Loader2 } from 'lucide-react';
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

  // Joined via FK: inspection_snapshots.organisation_id -> organisations.id
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

export function InspectionPage() {
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<SnapshotRow[]>([]);
  const [isSuper, setIsSuper] = React.useState<boolean | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();

      // Check role
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profileErr) throw new Error(profileErr.message);

      if (profile?.role !== 'super_admin') {
        setIsSuper(false);
        setRows([]);
        return;
      }
      setIsSuper(true);

      // IMPORTANT:
      // inspection_snapshots does NOT have organisation_name.
      // We fetch organisation name via FK join: organisations(name)
      const { data, error: err } = await supabase
        .from('inspection_snapshots')
        .select(
          `
            id,
            snapshot_month,
            organisation_id,
            total_open_cases,
            overdue_open_cases,
            sla_compliance_percent,
            safeguarding_score,
            generated_at,
            organisations ( name )
          `
        )
        .order('generated_at', { ascending: false })
        .limit(50);

      if (err) throw new Error(err.message);

      setRows((data ?? []) as SnapshotRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function generateSnapshot() {
    setGenerating(true);
    setError(null);

    try {
      const supabase = getSupabase();
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

      const { error: rpcErr } = await supabase.rpc('generate_all_org_monthly_snapshots', { p_month: month });
      if (rpcErr) throw new Error(rpcErr.message);

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate snapshot');
    } finally {
      setGenerating(false);
    }
  }

  // Access denied
  if (isSuper === false) {
    return (
      <div>
        <div className="dashboard-page-header">
          <h1 className="dashboard-page-title">Access Denied</h1>
          <p className="dashboard-page-subtitle">This page is restricted to super administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        className="dashboard-page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
        }}
      >
        <div>
          <h1 className="dashboard-page-title">Inspection Mode</h1>
          <p className="dashboard-page-subtitle">Monthly inspection snapshots for audit and CQC evidence.</p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={generateSnapshot}
            disabled={generating || loading}
            className="dashboard-primary-button"
            style={{
              height: 44,
              padding: '0 14px',
              borderRadius: 12,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              opacity: generating ? 0.7 : 1,
            }}
          >
            {generating ? <Loader2 size={18} className="dashboard-overview-spinner-icon" /> : <ClipboardCheck size={18} />}
            {generating ? 'Generating…' : 'Generate Snapshot (This Month)'}
          </button>

          <button
            type="button"
            onClick={load}
            className="dashboard-primary-button"
            style={{
              height: 44,
              padding: '0 14px',
              borderRadius: 12,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <RefreshCcw size={18} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="dashboard-overview-error" style={{ marginBottom: '1rem' }}>
          <span>{error}</span>
        </div>
      )}

      {/* ── Inspection Summary (current month) ──────────────────────── */}
      {!loading && isSuper && (() => {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const monthSnapshots = rows.filter(r => r.snapshot_month === currentMonth);
        const latest = monthSnapshots.length > 0 ? monthSnapshots[0] : null;
        const status = latest ? 'Generated' : 'Missing';

        return (
          <div className="dashboard-panel" style={{ marginBottom: '1.5rem' }}>
            <div className="dashboard-panel-header">
              <h2 className="dashboard-panel-title">
                <ClipboardCheck size={16} className="dashboard-panel-title-icon" />
                Inspection Summary — {currentMonth.slice(0, 7)}
              </h2>
              <span className="dashboard-panel-count" style={{ fontSize: '0.72rem' }}>
                {status === 'Generated' ? '✓ Generated' : '⚠ Missing'}
              </span>
            </div>
            <div style={{ padding: '0.75rem 1rem' }}>
              {latest ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Month</div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{latest.snapshot_month}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Open Cases</div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{latest.total_open_cases ?? '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Overdue</div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{latest.overdue_open_cases ?? '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>SLA Compliance</div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{latest.sla_compliance_percent != null ? `${latest.sla_compliance_percent}%` : '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Safeguarding Score</div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{latest.safeguarding_score ?? '—'}</div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.82rem', color: '#64748b' }}>No snapshot for this month yet.</span>
                  <button
                    type="button"
                    onClick={generateSnapshot}
                    disabled={generating}
                    className="dashboard-primary-button"
                    style={{ height: 32, padding: '0 10px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', opacity: generating ? 0.7 : 1 }}
                  >
                    {generating ? <Loader2 size={14} className="dashboard-overview-spinner-icon" /> : <ClipboardCheck size={14} />}
                    Generate this month snapshot
                  </button>
                </div>
              )}
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>Runs automatically on the 1st at 02:00 UTC</p>
            </div>
          </div>
        );
      })()}

      {loading ? (
        <div className="dashboard-overview-loading">
          <Loader2 className="dashboard-overview-spinner-icon" />
          <p>Loading inspection snapshots…</p>
        </div>
      ) : (
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h2 className="dashboard-panel-title">
              <ClipboardCheck size={16} className="dashboard-panel-title-icon" />
              Inspection Snapshots
            </h2>
            <span className="dashboard-panel-count">{rows.length}</span>
          </div>

          {rows.length === 0 ? (
            <div className="dashboard-panel-empty">No snapshots generated yet.</div>
          ) : (
            <div className="dashboard-panel-table-wrap">
              <table className="dashboard-panel-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Organisation</th>
                    <th>Open Cases</th>
                    <th>Overdue</th>
                    <th>SLA %</th>
                    <th>Safeguarding Score</th>
                    <th>Generated</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const orgName = r.organisations?.name ?? 'Unknown organisation';
                    return (
                      <tr key={r.id}>
                        <td>{r.snapshot_month ?? '—'}</td>
                        <td>{orgName}</td>
                        <td>{r.total_open_cases ?? '—'}</td>
                        <td>{r.overdue_open_cases ?? '—'}</td>
                        <td>{r.sla_compliance_percent != null ? `${r.sla_compliance_percent}%` : '—'}</td>
                        <td>{r.safeguarding_score ?? '—'}</td>
                        <td>{fmtDate(r.generated_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
