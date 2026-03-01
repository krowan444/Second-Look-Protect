import React from 'react';
import { Search, RefreshCcw } from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

type OrganisationRow = { id: string; name: string | null; slug: string | null; status: string | null };
type CaseRow = {
  id: string;
  organisation_id: string;
  submitted_at: string | null;
  status: string | null;
  risk_level: string | null;
  decision: string | null;
  category: string | null;
  resident_ref: string | null;
  external_ref: string | null;
  submission_type: string | null;
  content_text: string | null;
};

function looksLikeUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
}

export function GlobalSearchPage() {
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [orgResults, setOrgResults] = React.useState<OrganisationRow[]>([]);
  const [caseResults, setCaseResults] = React.useState<CaseRow[]>([]);
  const [orgNameById, setOrgNameById] = React.useState<Record<string, string>>({});

  async function runSearch() {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();

      // If UUID: try direct case lookup first
      if (looksLikeUuid(q)) {
        const { data: oneCase, error: oneErr } = await supabase
          .from('cases')
          .select('id,organisation_id,submitted_at,status,risk_level,decision,category,resident_ref,external_ref,submission_type,content_text')
          .eq('id', q)
          .maybeSingle();

        if (oneErr) throw new Error(oneErr.message);

        const rows = oneCase ? [oneCase as CaseRow] : [];
        setCaseResults(rows);
        setOrgResults([]);

        // org map
        const orgIds = Array.from(new Set(rows.map(r => r.organisation_id)));
        if (orgIds.length) {
          const { data: orgs, error: orgErr } = await supabase.from('organisations').select('id,name').in('id', orgIds);
          if (orgErr) throw new Error(orgErr.message);
          const map: Record<string, string> = {};
          for (const o of (orgs ?? []) as any[]) map[o.id] = o.name ?? 'Unnamed organisation';
          setOrgNameById(map);
        } else {
          setOrgNameById({});
        }

        setLoading(false);
        return;
      }

      // Normal text search: orgs + cases
      const like = `%${q}%`;

      const [orgResp, caseResp1, caseResp2, caseResp3] = await Promise.all([
        supabase.from('organisations').select('id,name,slug,status').ilike('name', like).limit(20),

        supabase.from('cases')
          .select('id,organisation_id,submitted_at,status,risk_level,decision,category,resident_ref,external_ref,submission_type,content_text')
          .ilike('resident_ref', like)
          .order('submitted_at', { ascending: false })
          .limit(25),

        supabase.from('cases')
          .select('id,organisation_id,submitted_at,status,risk_level,decision,category,resident_ref,external_ref,submission_type,content_text')
          .ilike('external_ref', like)
          .order('submitted_at', { ascending: false })
          .limit(25),

        supabase.from('cases')
          .select('id,organisation_id,submitted_at,status,risk_level,decision,category,resident_ref,external_ref,submission_type,content_text')
          .ilike('content_text', like)
          .order('submitted_at', { ascending: false })
          .limit(25),
      ]);

      if (orgResp.error) throw new Error(orgResp.error.message);
      if (caseResp1.error) throw new Error(caseResp1.error.message);
      if (caseResp2.error) throw new Error(caseResp2.error.message);
      if (caseResp3.error) throw new Error(caseResp3.error.message);

      const orgs = (orgResp.data ?? []) as OrganisationRow[];

      // Merge cases (dedupe by id)
      const allCases = [
        ...(caseResp1.data ?? []),
        ...(caseResp2.data ?? []),
        ...(caseResp3.data ?? []),
      ] as CaseRow[];

      const byId = new Map<string, CaseRow>();
      for (const c of allCases) byId.set(c.id, c);
      const merged = Array.from(byId.values()).sort((a, b) => {
        const at = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
        const bt = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
        return bt - at;
      }).slice(0, 40);

      setOrgResults(orgs);
      setCaseResults(merged);

      const orgIds = Array.from(new Set(merged.map(r => r.organisation_id)));
      if (orgIds.length) {
        const { data: orgNameRows, error: orgErr } = await supabase.from('organisations').select('id,name').in('id', orgIds);
        if (orgErr) throw new Error(orgErr.message);
        const map: Record<string, string> = {};
        for (const o of (orgNameRows ?? []) as any[]) map[o.id] = o.name ?? 'Unnamed organisation';
        setOrgNameById(map);
      } else {
        setOrgNameById({});
      }

      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setLoading(false);
    }
  }

  function clear() {
    setQuery('');
    setOrgResults([]);
    setCaseResults([]);
    setOrgNameById({});
    setError(null);
  }

  return (
    <div>
      <div className="dashboard-page-header">
        <h1 className="dashboard-page-title">Global Search</h1>
        <p className="dashboard-page-subtitle">Search across all cases and organisations.</p>
      </div>

      <div className="dashboard-card" style={{ padding: 16, borderRadius: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="dashboard-input"
            style={{ height: 44, borderRadius: 12, flex: 1 }}
            placeholder="Search org name, resident ref, external ref, content… or paste case UUID"
            onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
          />
          <button
            onClick={runSearch}
            className="dashboard-primary-button"
            style={{ height: 44, padding: '0 14px', borderRadius: 12 }}
            disabled={loading || !query.trim()}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
          <button
            onClick={clear}
            className="dashboard-secondary-button"
            style={{ height: 44, padding: '0 14px', borderRadius: 12 }}
            disabled={loading}
          >
            Clear
          </button>
        </div>

        {error && (
          <div className="dashboard-small-muted" style={{ marginTop: 10, color: '#991b1b' }}>
            {error}
          </div>
        )}
      </div>

      {loading && (
        <div className="dashboard-placeholder-card">
          <div className="dashboard-placeholder-icon"><RefreshCcw /></div>
          <p className="dashboard-page-title" style={{ fontSize: '1.1rem' }}>Searching…</p>
          <span className="dashboard-placeholder-label">Loading</span>
        </div>
      )}

      {!loading && !error && (orgResults.length > 0 || caseResults.length > 0) && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="dashboard-card" style={{ padding: 16, borderRadius: 16 }}>
            <div className="dashboard-card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Organisations</span>
              <span className="dashboard-small-muted">{orgResults.length} found</span>
            </div>

            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 10px' }}>
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    <th className="dashboard-table-th">Name</th>
                    <th className="dashboard-table-th">Slug</th>
                    <th className="dashboard-table-th">Status</th>
                    <th className="dashboard-table-th">ID</th>
                  </tr>
                </thead>
                <tbody>
                  {orgResults.map(o => (
                    <tr key={o.id} className="dashboard-table-row">
                      <td className="dashboard-table-td">{o.name ?? 'Unnamed organisation'}</td>
                      <td className="dashboard-table-td">{o.slug ?? '-'}</td>
                      <td className="dashboard-table-td">{o.status ?? '-'}</td>
                      <td className="dashboard-table-td" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{o.id}</td>
                    </tr>
                  ))}
                  {orgResults.length === 0 && (
                    <tr><td className="dashboard-table-td" colSpan={4}>No organisations found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="dashboard-card" style={{ padding: 16, borderRadius: 16 }}>
            <div className="dashboard-card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Cases</span>
              <span className="dashboard-small-muted">{caseResults.length} found</span>
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
                    <th className="dashboard-table-th">Resident ref</th>
                    <th className="dashboard-table-th">External ref</th>
                    <th className="dashboard-table-th">ID</th>
                  </tr>
                </thead>
                <tbody>
                  {caseResults.map(c => (
                    <tr key={c.id} className="dashboard-table-row">
                      <td className="dashboard-table-td">{orgNameById[c.organisation_id] ?? c.organisation_id}</td>
                      <td className="dashboard-table-td">{c.submitted_at ? new Date(c.submitted_at).toLocaleString() : '-'}</td>
                      <td className="dashboard-table-td">{c.status ?? '-'}</td>
                      <td className="dashboard-table-td">{c.risk_level ?? 'untriaged'}</td>
                      <td className="dashboard-table-td">{c.decision ?? '-'}</td>
                      <td className="dashboard-table-td">{c.resident_ref ?? '-'}</td>
                      <td className="dashboard-table-td">{c.external_ref ?? '-'}</td>
                      <td className="dashboard-table-td" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{c.id}</td>
                    </tr>
                  ))}
                  {caseResults.length === 0 && (
                    <tr><td className="dashboard-table-td" colSpan={8}>No cases found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="dashboard-small-muted" style={{ marginTop: 8 }}>
              Next step: add row click → open /dashboard/cases/&lt;id&gt; for super_admin.
            </div>
          </div>
        </div>
      )}

      {!loading && !error && orgResults.length === 0 && caseResults.length === 0 && (
        <div className="dashboard-placeholder-card">
          <div className="dashboard-placeholder-icon"><Search /></div>
          <p className="dashboard-page-title" style={{ fontSize: '1.1rem' }}>Search the platform</p>
          <p className="dashboard-page-subtitle" style={{ textAlign: 'center', margin: '0.5rem auto 0' }}>
            Try an organisation name, resident reference, external reference, or paste a case UUID.
          </p>
          <span className="dashboard-placeholder-label">Ready</span>
        </div>
      )}
    </div>
  );
}
