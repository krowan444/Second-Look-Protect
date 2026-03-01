import React from 'react';
import { Globe, AlertTriangle, Building2, Shield, Activity, Loader2, LayoutDashboard, Clock, ShieldAlert } from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

type OrgRow = {
  id: string;
  name: string | null;
  status: 'active' | 'paused' | 'suspended' | string | null;
  subscription_status: 'trial' | 'active' | 'past_due' | 'canceled' | string | null;
  plan_type: 'basic' | 'pro' | 'enterprise' | string | null;
  created_at: string | null;
};

type CaseRow = {
  id: string;
  organisation_id: string;
  submitted_at: string | null;
  status: 'submitted' | 'in_review' | 'closed' | string | null;
  risk_level: 'low' | 'medium' | 'high' | string | null;
  decision: 'scam' | 'legit' | 'unsure' | string | null;
  outcome: 'none' | 'prevented' | 'lost' | 'escalated' | string | null;
  loss_amount: number | null;
  category: string | null;
  submission_type: string | null;
};

function startOfMonthISO(timezone: string) {
  // Simple approach: compute in local browser time; good enough for v1.
  // Later we can align exactly to org timezone using SQL.
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return start.toISOString();
}

function fmtGBP(value: number) {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
  } catch {
    return `£${value.toFixed(2)}`;
  }
}

function daysAgo(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '';
  const diff = Date.now() - d;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export function PlatformOverviewPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [orgs, setOrgs] = React.useState<OrgRow[]>([]);
  const [recentCases, setRecentCases] = React.useState<CaseRow[]>([]);
  const [orgNameById, setOrgNameById] = React.useState<Record<string, string>>({});
  const [topRiskOrgs, setTopRiskOrgs] = React.useState<{ name: string; count: number }[]>([]);

  type IntelTopOrg = {
    organisation_name: string;
    open_cases: number;
    high_critical_7d: number;
    confirmed_scams_7d: number;
    overdue: number;
    risk_score: number;
    safeguarding_score: number | null;
  };
  type IntelOverview = {
    total_open_cases: number;
    high_or_critical_last_7_days: number;
    confirmed_scams_last_7_days: number;
    overdue_open_cases: number;
    sla_compliance_percent: number;
    top_risk_organisations: IntelTopOrg[];
  } | null;
  const [intel, setIntel] = React.useState<IntelOverview>(null);
  const [intelLoading, setIntelLoading] = React.useState(true);

  const [metrics, setMetrics] = React.useState<{
    orgTotal: number;
    orgActive: number;
    orgPaused: number;
    orgSuspended: number;

    casesThisMonth: number;
    openCases: number;
    highRiskOpen: number;
    untriagedOpen: number;

    scamCountThisMonth: number;
    legitCountThisMonth: number;
    unsureCountThisMonth: number;

    preventedThisMonth: number;
    lostThisMonth: number;
    escalatedThisMonth: number;

    lossTotalThisMonth: number;

    lastCaseAt: string | null;
    lastReviewAt: string | null;
    lastActionAt: string | null;
  }>({
    orgTotal: 0,
    orgActive: 0,
    orgPaused: 0,
    orgSuspended: 0,

    casesThisMonth: 0,
    openCases: 0,
    highRiskOpen: 0,
    untriagedOpen: 0,

    scamCountThisMonth: 0,
    legitCountThisMonth: 0,
    unsureCountThisMonth: 0,

    preventedThisMonth: 0,
    lostThisMonth: 0,
    escalatedThisMonth: 0,

    lossTotalThisMonth: 0,

    lastCaseAt: null,
    lastReviewAt: null,
    lastActionAt: null,
  });

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();
      const monthStart = startOfMonthISO('Europe/London');

      // 1) Organisations (small list, safe to fetch + reduce)
      const { data: orgRows, error: orgErr } = await supabase
        .from('organisations')
        .select('id,name,status,subscription_status,plan_type,created_at')
        .order('created_at', { ascending: false });

      if (orgErr) throw new Error(orgErr.message);
      const safeOrgs = (orgRows ?? []) as OrgRow[];
      setOrgs(safeOrgs);

      const nameMap: Record<string, string> = {};
      for (const o of safeOrgs) nameMap[o.id] = o.name ?? 'Unnamed organisation';
      setOrgNameById(nameMap);

      const orgActive = safeOrgs.filter(o => (o.status ?? 'active') === 'active').length;
      const orgPaused = safeOrgs.filter(o => o.status === 'paused').length;
      const orgSuspended = safeOrgs.filter(o => o.status === 'suspended').length;

      // 2) Cases this month (light columns)
      const { data: monthCases, error: casesErr } = await supabase
        .from('cases')
        .select('id,organisation_id,submitted_at,status,risk_level,decision,outcome,loss_amount,category,submission_type')
        .gte('submitted_at', monthStart);

      if (casesErr) throw new Error(casesErr.message);

      const monthCaseRows = (monthCases ?? []) as CaseRow[];
      const casesThisMonth = monthCaseRows.length;

      const scamCountThisMonth = monthCaseRows.filter(c => c.decision === 'scam').length;
      const legitCountThisMonth = monthCaseRows.filter(c => c.decision === 'legit').length;
      const unsureCountThisMonth = monthCaseRows.filter(c => c.decision === 'unsure').length;

      const preventedThisMonth = monthCaseRows.filter(c => c.outcome === 'prevented').length;
      const lostThisMonth = monthCaseRows.filter(c => c.outcome === 'lost').length;
      const escalatedThisMonth = monthCaseRows.filter(c => c.outcome === 'escalated').length;

      const lossTotalThisMonth = monthCaseRows.reduce((sum, c) => {
        if (c.outcome === 'lost' && typeof c.loss_amount === 'number') return sum + c.loss_amount;
        return sum;
      }, 0);

      // 3) Open cases snapshot (all orgs)
      const { data: openCasesRows, error: openErr } = await supabase
        .from('cases')
        .select('id,organisation_id,submitted_at,status,risk_level,decision,outcome,loss_amount,category,submission_type')
        .in('status', ['submitted', 'in_review'])
        .order('submitted_at', { ascending: false })
        .limit(500);

      if (openErr) throw new Error(openErr.message);

      const openRows = (openCasesRows ?? []) as CaseRow[];
      const openCases = openRows.length;
      const highRiskOpen = openRows.filter(c => ['high', 'critical'].includes((c.risk_level ?? '').toLowerCase())).length;
      const untriagedOpen = openRows.filter(c => !c.risk_level).length;

      // Compute top risk orgs (orgs with most open high/critical cases)
      const riskByOrg: Record<string, number> = {};
      for (const c of openRows) {
        if (['high', 'critical'].includes((c.risk_level ?? '').toLowerCase())) {
          riskByOrg[c.organisation_id] = (riskByOrg[c.organisation_id] || 0) + 1;
        }
      }
      const topRisk = Object.entries(riskByOrg)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([orgId, count]) => ({ name: nameMap[orgId] ?? orgId, count }));
      setTopRiskOrgs(topRisk);

      // 4) Recent cases (top 10)
      const { data: recent, error: recentErr } = await supabase
        .from('cases')
        .select('id,organisation_id,submitted_at,status,risk_level,decision,outcome,loss_amount,category,submission_type')
        .order('submitted_at', { ascending: false })
        .limit(10);

      if (recentErr) throw new Error(recentErr.message);
      setRecentCases((recent ?? []) as CaseRow[]);

      // 5) System health timestamps
      const { data: lastCase } = await supabase
        .from('cases')
        .select('submitted_at')
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: lastReview } = await supabase
        .from('case_reviews')
        .select('reviewed_at')
        .order('reviewed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: lastAction } = await supabase
        .from('case_actions')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setMetrics({
        orgTotal: safeOrgs.length,
        orgActive,
        orgPaused,
        orgSuspended,

        casesThisMonth,
        openCases,
        highRiskOpen,
        untriagedOpen,

        scamCountThisMonth,
        legitCountThisMonth,
        unsureCountThisMonth,

        preventedThisMonth,
        lostThisMonth,
        escalatedThisMonth,

        lossTotalThisMonth,

        lastCaseAt: (lastCase?.submitted_at ?? null) as string | null,
        lastReviewAt: (lastReview?.reviewed_at ?? null) as string | null,
        lastActionAt: (lastAction?.created_at ?? null) as string | null,
      });

      setLoading(false);

      // 6) Platform Intelligence RPC (super_admin only — page is route-guarded)
      setIntelLoading(true);
      try {
        const { data: intelData } = await supabase.rpc('get_platform_intelligence_overview_v2');
        const platform = (intelData as any)?.platform ?? intelData;
        setIntel((platform ?? null) as IntelOverview);
      } catch { /* non-blocking */ }
      setIntelLoading(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div>
      <div className="dashboard-page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1 className="dashboard-page-title">Platform Overview</h1>
          <p className="dashboard-page-subtitle">Global platform metrics across all organisations.</p>
        </div>
        <button
          onClick={reload}
          className="dashboard-primary-button"
          style={{ height: 44, padding: '0 14px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <Activity size={18} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="dashboard-placeholder-card" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
          <p className="dashboard-page-title" style={{ fontSize: '1.0rem', color: '#991b1b' }}>Unable to load platform metrics</p>
          <p className="dashboard-page-subtitle" style={{ textAlign: 'center', margin: '0.5rem auto 0', color: '#7f1d1d' }}>
            {error}
          </p>
        </div>
      )}

      {loading && !error && (
        <div className="dashboard-overview-loading">
          <Loader2 className="dashboard-overview-spinner-icon" />
          <p>Loading platform overview…</p>
        </div>
      )}

      {!loading && !error && (
        <div style={{ display: 'grid', gap: '1.5rem' }}>

          {/* Platform Status */}
          {(() => {
            const platStatus = metrics.highRiskOpen > 0 ? 'Elevated Risk'
              : metrics.openCases > 0 ? 'Monitor'
                : 'Stable';
            return <p style={{ margin: 0, fontSize: '0.82rem' }}><strong>Platform Status:</strong> {platStatus}</p>;
          })()}

          {/* Stat Cards */}
          <div className="dashboard-overview-cards">
            <div className="dashboard-stat-card">
              <div className="dashboard-stat-card-accent accent-blue" />
              <div className="dashboard-stat-card-body">
                <div className="dashboard-stat-icon blue"><Building2 size={20} /></div>
                <div className="dashboard-stat-value">{metrics.orgTotal}</div>
                <div className="dashboard-stat-label">Organisations</div>
                <div className="dashboard-stat-period">Active {metrics.orgActive} · Paused {metrics.orgPaused} · Suspended {metrics.orgSuspended}</div>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-card-accent accent-gold" />
              <div className="dashboard-stat-card-body">
                <div className="dashboard-stat-icon gold"><LayoutDashboard size={20} /></div>
                <div className="dashboard-stat-value">{metrics.casesThisMonth}</div>
                <div className="dashboard-stat-label">Cases This Month</div>
                <div className="dashboard-stat-period">Scam {metrics.scamCountThisMonth} · Legit {metrics.legitCountThisMonth} · Unsure {metrics.unsureCountThisMonth}</div>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-card-accent accent-red" />
              <div className="dashboard-stat-card-body">
                <div className="dashboard-stat-icon red"><AlertTriangle size={20} /></div>
                <div className="dashboard-stat-value">{metrics.openCases}</div>
                <div className="dashboard-stat-label">Open Queue</div>
                <div className="dashboard-stat-period">High risk {metrics.highRiskOpen} · Untriaged {metrics.untriagedOpen}</div>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-card-accent accent-amber" />
              <div className="dashboard-stat-card-body">
                <div className="dashboard-stat-icon amber"><Shield size={20} /></div>
                <div className="dashboard-stat-value">{fmtGBP(metrics.lossTotalThisMonth)}</div>
                <div className="dashboard-stat-label">Loss Recorded</div>
                <div className="dashboard-stat-period">Prevented {metrics.preventedThisMonth} · Lost {metrics.lostThisMonth} · Escalated {metrics.escalatedThisMonth}</div>
              </div>
            </div>
          </div>

          {/* Top Risk Organisations */}
          <div className="dashboard-panel">
            <div className="dashboard-panel-header">
              <h2 className="dashboard-panel-title">
                <AlertTriangle size={16} className="dashboard-panel-title-icon" />
                Top Risk Organisations
              </h2>
            </div>
            {topRiskOrgs.length === 0 ? (
              <div className="dashboard-panel-empty">No high-risk organisations currently flagged.</div>
            ) : (
              <div className="dashboard-panel-table-wrap">
                <table className="dashboard-panel-table">
                  <thead>
                    <tr><th>Organisation</th><th>Open High/Critical Cases</th></tr>
                  </thead>
                  <tbody>
                    {topRiskOrgs.map((o, i) => (
                      <tr key={i}><td>{o.name}</td><td>{o.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Platform Intelligence ────────────────────────────────── */}
          {intelLoading ? (
            <div className="dashboard-panel">
              <div className="dashboard-panel-header">
                <h2 className="dashboard-panel-title">
                  <ShieldAlert size={16} className="dashboard-panel-title-icon" />
                  Platform Intelligence
                </h2>
              </div>
              <div className="dashboard-panel-empty">
                <Loader2 size={16} className="dashboard-overview-spinner-icon" style={{ display: 'inline-block', marginRight: 6 }} />
                Loading intelligence…
              </div>
            </div>
          ) : intel ? (
            <>
              {/* Intelligence Stat Cards */}
              <div className="dashboard-overview-cards">
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-card-accent accent-blue" />
                  <div className="dashboard-stat-card-body">
                    <div className="dashboard-stat-icon blue"><LayoutDashboard size={20} /></div>
                    <div className="dashboard-stat-value">{intel.total_open_cases}</div>
                    <div className="dashboard-stat-label">Total Open Cases</div>
                    <div className="dashboard-stat-period">All organisations</div>
                  </div>
                </div>

                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-card-accent accent-red" />
                  <div className="dashboard-stat-card-body">
                    <div className="dashboard-stat-icon red"><AlertTriangle size={20} /></div>
                    <div className="dashboard-stat-value">{intel.high_or_critical_last_7_days}</div>
                    <div className="dashboard-stat-label">High/Critical (7d)</div>
                    <div className="dashboard-stat-period">Last 7 days</div>
                  </div>
                </div>

                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-card-accent accent-amber" />
                  <div className="dashboard-stat-card-body">
                    <div className="dashboard-stat-icon amber"><Shield size={20} /></div>
                    <div className="dashboard-stat-value">{intel.confirmed_scams_last_7_days}</div>
                    <div className="dashboard-stat-label">Confirmed Scams (7d)</div>
                    <div className="dashboard-stat-period">Last 7 days</div>
                  </div>
                </div>

                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-card-accent accent-red" />
                  <div className="dashboard-stat-card-body">
                    <div className="dashboard-stat-icon red"><Clock size={20} /></div>
                    <div className="dashboard-stat-value">{intel.overdue_open_cases}</div>
                    <div className="dashboard-stat-label">Overdue Open</div>
                    <div className="dashboard-stat-period">Past SLA</div>
                  </div>
                </div>

                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-card-accent accent-gold" />
                  <div className="dashboard-stat-card-body">
                    <div className="dashboard-stat-icon gold"><ShieldAlert size={20} /></div>
                    <div className="dashboard-stat-value">{intel.sla_compliance_percent}%</div>
                    <div className="dashboard-stat-label">SLA Compliance</div>
                    <div className="dashboard-stat-period">Platform-wide</div>
                  </div>
                </div>
              </div>

              {/* Intelligence — Top Risk Organisations */}
              <div className="dashboard-panel">
                <div className="dashboard-panel-header">
                  <h2 className="dashboard-panel-title">
                    <ShieldAlert size={16} className="dashboard-panel-title-icon" />
                    Intelligence — Top Risk Organisations
                  </h2>
                </div>
                {(intel.top_risk_organisations ?? []).length === 0 ? (
                  <div className="dashboard-panel-empty">No risk data available.</div>
                ) : (
                  <div className="dashboard-panel-table-wrap">
                    <table className="dashboard-panel-table">
                      <thead>
                        <tr>
                          <th>Organisation</th>
                          <th>Open Cases</th>
                          <th>High/Critical 7d</th>
                          <th>Scams 7d</th>
                          <th>Overdue</th>
                          <th>Risk Score</th>
                          <th>Safeguarding Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {intel.top_risk_organisations.map((o, i) => (
                          <tr key={i}>
                            <td>{o.organisation_name}</td>
                            <td>{o.open_cases}</td>
                            <td>{o.high_critical_7d}</td>
                            <td>{o.confirmed_scams_7d}</td>
                            <td>{o.overdue}</td>
                            <td>{o.risk_score}</td>
                            <td>{o.safeguarding_score ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="dashboard-panel">
              <div className="dashboard-panel-header">
                <h2 className="dashboard-panel-title">
                  <ShieldAlert size={16} className="dashboard-panel-title-icon" />
                  Platform Intelligence
                </h2>
              </div>
              <div className="dashboard-panel-empty">Intelligence data unavailable.</div>
            </div>
          )}

          {/* System health + Recent cases */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
            <div className="dashboard-card" style={{ gridColumn: 'span 4', padding: 16, borderRadius: 16 }}>
              <div className="dashboard-card-title">System health</div>
              <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                <div>
                  <div className="dashboard-muted-label">Last case received</div>
                  <div className="dashboard-small-muted">{metrics.lastCaseAt ? `${new Date(metrics.lastCaseAt).toLocaleString()} (${daysAgo(metrics.lastCaseAt)})` : 'No cases yet'}</div>
                </div>
                <div>
                  <div className="dashboard-muted-label">Last review saved</div>
                  <div className="dashboard-small-muted">{metrics.lastReviewAt ? `${new Date(metrics.lastReviewAt).toLocaleString()} (${daysAgo(metrics.lastReviewAt)})` : 'No reviews yet'}</div>
                </div>
                <div>
                  <div className="dashboard-muted-label">Last action logged</div>
                  <div className="dashboard-small-muted">{metrics.lastActionAt ? `${new Date(metrics.lastActionAt).toLocaleString()} (${daysAgo(metrics.lastActionAt)})` : 'No actions yet'}</div>
                </div>
              </div>
            </div>

            <div className="dashboard-card" style={{ gridColumn: 'span 8', padding: 16, borderRadius: 16 }}>
              <div className="dashboard-card-title">Recent cases (all organisations)</div>

              <div style={{ overflowX: 'auto', marginTop: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 10px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left' }}>
                      <th className="dashboard-table-th">Organisation</th>
                      <th className="dashboard-table-th">Submitted</th>
                      <th className="dashboard-table-th">Status</th>
                      <th className="dashboard-table-th">Risk</th>
                      <th className="dashboard-table-th">Decision</th>
                      <th className="dashboard-table-th">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCases.map(c => (
                      <tr key={c.id} className="dashboard-table-row">
                        <td className="dashboard-table-td">{orgNameById[c.organisation_id] ?? c.organisation_id}</td>
                        <td className="dashboard-table-td">{c.submitted_at ? new Date(c.submitted_at).toLocaleString() : '-'}</td>
                        <td className="dashboard-table-td">{c.status ?? '-'}</td>
                        <td className="dashboard-table-td">{c.risk_level ?? 'untriaged'}</td>
                        <td className="dashboard-table-td">{c.decision ?? '-'}</td>
                        <td className="dashboard-table-td">{c.submission_type ?? '-'}</td>
                      </tr>
                    ))}
                    {recentCases.length === 0 && (
                      <tr>
                        <td className="dashboard-table-td" colSpan={6} style={{ padding: '14px 10px' }}>
                          No cases yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="dashboard-small-muted" style={{ marginTop: 8 }}>
                Tip: Global Queue is best for triage; this list is for “what just happened”.
              </div>
            </div>
          </div>

          {/* Organisations quick list */}
          <div className="dashboard-card" style={{ padding: 16, borderRadius: 16 }}>
            <div className="dashboard-card-title">Organisations</div>
            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              {orgs.slice(0, 8).map(o => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.6)' }}>
                  <div>
                    <div style={{ fontWeight: 650 }}>{o.name ?? 'Unnamed organisation'}</div>
                    <div className="dashboard-small-muted">
                      Status: {o.status ?? 'active'} · Plan: {o.plan_type ?? 'basic'} · Subscription: {o.subscription_status ?? 'trial'}
                    </div>
                  </div>
                  <div className="dashboard-small-muted">{o.created_at ? daysAgo(o.created_at) : ''}</div>
                </div>
              ))}
              {orgs.length === 0 && (
                <div className="dashboard-small-muted">No organisations yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
