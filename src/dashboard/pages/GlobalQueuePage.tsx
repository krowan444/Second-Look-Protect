import React from 'react';
import { ClipboardList, Filter, RefreshCcw } from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

type CaseRow = {
  id: string;
  organisation_id: string;
  submitted_at: string | null;
  status: 'submitted' | 'in_review' | 'closed' | string | null;
  risk_level: 'low' | 'medium' | 'high' | string | null;
  decision: 'scam' | 'legit' | 'unsure' | string | null;
  category: string | null;
  resident_ref: string | null;
  submission_type: string | null;
};

type OrgRow = { id: string; name: string | null };

export function GlobalQueuePage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [cases, setCases] = React.useState<CaseRow[]>([]);
  const [orgNameById, setOrgNameById] = React.useState<Record<string, string>>({});

  const [statusFilter, setStatusFilter] = React.useState<'submitted' | 'in_review' | 'all'>('all');
  const [riskFilter, setRiskFilter] = React.useState<'high' | 'medium' | 'low' | 'untriaged' | 'all'>('all');
  const [orgQuery, setOrgQuery] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();

      // Pull a reasonable slice of pending cases across all orgs
      const { data, error: qErr } = await supabase
        .from('cases')
        .select('id,organisation_id,submitted_at,status,risk_level,decision,category,resident_ref,submission_type')
        .in('status', ['submitted', 'in_review'])
        .order('submitted_at', { ascending: false })
        .limit(300);

      if (qErr) throw new Error(qErr.message);

      const rows = (data ?? []) as CaseRow[];
      setCases(rows);

      // Fetch org names for all org ids seen
      const orgIds = Array.from(new Set(rows.map(r => r.organisation_id))).filter(Boolean);
      if (orgIds.length > 0) {
        const { data: orgs, error: orgErr } = await supabase
          .from('organisations')
          .select('id,name')
          .in('id', orgIds);

        if (orgErr) throw new Error(orgErr.message);

        const map: Record<string, string> = {};
        for (const o of (orgs ?? []) as OrgRow[]) map[o.id] = o.name ?? 'Unnamed organisation';
        setOrgNameById(map);
      } else {
        setOrgNameById({});
      }

      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const filtered = React.useMemo(() => {
    return cases.filter(c => {
      if (statusFilter !== 'all' && (c.status ?? '') !== statusFilter) return false;

      if (riskFilter !== 'all') {
        if (riskFilter === 'untriaged') {
          if (c.risk_level) return false;
        } else {
          if ((c.risk_level ?? '') !== riskFilter) return false;
        }
      }

      if (orgQuery.trim()) {
        const q = orgQuery.trim().toLowerCase();
        const name = (orgNameById[c.organisation_id] ?? '').toLowerCase();
        if (!name.includes(q) && !c.organisation_id.toLowerCase().includes(q)) return false;
      }

      return true;
    });
  }, [cases, statusFilter, riskFilter, orgQuery, orgNameById]);

  return (
    <div>
      <div className="dashboard-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1 className="dashboard-page-title">Global Queue</h1>
          <p className="dashboard-page-subtitle">All pending reviews across every organisation.</p>
        </div>

        <button
          onClick={load}
          className="dashboard-primary-button"
          style={{ height: 44, padding: '0 14px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <RefreshCcw size={18} />
          Refresh
        </button>
      </div>

      <div className="dashboard-card" style={{ padding: 16, borderRadius: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Filter size={18} />
          <div style={{ fontWeight: 650 }}>Filters</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
          <div style={{ gridColumn: 'span 3' }}>
            <div className="dashboard-muted-label">Status</div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="dashboard-input" style={{ height: 42, borderRadius: 12 }}>
              <option value="all">All pending</option>
              <option value="submitted">Submitted</option>
              <option value="in_review">In review</option>
            </select>
          </div>

          <div style={{ gridColumn: 'span 3' }}>
            <div className="dashboard-muted-label">Risk</div>
            <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value as any)} className="dashboard-input" style={{ height: 42, borderRadius: 12 }}>
              <option value="all">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="untriaged">Untriaged</option>
            </select>
          </div>

          <div style={{ gridColumn: 'span 6' }}>
            <div className="dashboard-muted-label">Organisation search</div>
            <input
              value={orgQuery}
              onChange={(e) => setOrgQuery(e.target.value)}
              className="dashboard-input"
              style={{ height: 42, borderRadius: 12 }}
              placeholder="Type an organisation name…"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="dashboard-placeholder-card" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
          <p className="dashboard-page-title" style={{ fontSize: '1.0rem', color: '#991b1b' }}>Unable to load global queue</p>
          <p className="dashboard-page-subtitle" style={{ textAlign: 'center', margin: '0.5rem auto 0', color: '#7f1d1d' }}>
            {error}
          </p>
        </div>
      )}

      {loading && !error && (
        <div className="dashboard-placeholder-card">
          <div className="dashboard-placeholder-icon"><ClipboardList /></div>
          <p className="dashboard-page-title" style={{ fontSize: '1.1rem' }}>Loading global queue…</p>
          <p className="dashboard-page-subtitle" style={{ textAlign: 'center', margin: '0.5rem auto 0' }}>
            Pulling pending cases from Supabase.
          </p>
          <span className="dashboard-placeholder-label">Loading</span>
        </div>
      )}

      {!loading && !error && (
        <div className="dashboard-card" style={{ padding: 16, borderRadius: 16 }}>
          <div className="dashboard-card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Pending cases</span>
            <span className="dashboard-small-muted">{filtered.length} shown</span>
          </div>

          <div style={{ overflowX: 'auto', marginTop: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 10px' }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th className="dashboard-table-th">Organisation</th>
                  <th className="dashboard-table-th">Submitted</th>
                  <th className="dashboard-table-th">Status</th>
                  <th className="dashboard-table-th">Risk</th>
                  <th className="dashboard-table-th">Decision</th>
                  <th className="dashboard-table-th">Category</th>
                  <th className="dashboard-table-th">Resident ref</th>
                  <th className="dashboard-table-th">Type</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="dashboard-table-row">
                    <td className="dashboard-table-td">{orgNameById[c.organisation_id] ?? c.organisation_id}</td>
                    <td className="dashboard-table-td">{c.submitted_at ? new Date(c.submitted_at).toLocaleString() : '-'}</td>
                    <td className="dashboard-table-td">{c.status ?? '-'}</td>
                    <td className="dashboard-table-td">{c.risk_level ?? 'untriaged'}</td>
                    <td className="dashboard-table-td">{c.decision ?? '-'}</td>
                    <td className="dashboard-table-td">{c.category ?? '-'}</td>
                    <td className="dashboard-table-td">{c.resident_ref ?? '-'}</td>
                    <td className="dashboard-table-td">{c.submission_type ?? '-'}</td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td className="dashboard-table-td" colSpan={8} style={{ padding: '14px 10px' }}>
                      No pending cases match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="dashboard-small-muted" style={{ marginTop: 8 }}>
            Next step: we wire each row click → /dashboard/cases/&lt;caseId&gt; (super_admin view).
          </div>
        </div>
      )}
    </div>
  );
}
