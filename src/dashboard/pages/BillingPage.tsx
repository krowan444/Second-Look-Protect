import React from 'react';
import { CreditCard, RefreshCcw } from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

type OrganisationRow = {
  id: string;
  name: string | null;
  slug: string | null;
  subscription_status: 'trial' | 'active' | 'past_due' | 'canceled' | string | null;
  plan_type: 'basic' | 'pro' | 'enterprise' | string | null;
  created_at: string | null;
};

function daysSince(iso: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

export function BillingPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [orgs, setOrgs] = React.useState<OrganisationRow[]>([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();
      const { data, error: err } = await supabase
        .from('organisations')
        .select('id,name,slug,subscription_status,plan_type,created_at')
        .order('created_at', { ascending: false });

      if (err) throw new Error(err.message);

      setOrgs((data ?? []) as OrganisationRow[]);
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const summary = React.useMemo(() => {
    const total = orgs.length;
    const trial = orgs.filter(o => (o.subscription_status ?? 'trial') === 'trial').length;
    const active = orgs.filter(o => o.subscription_status === 'active').length;
    const pastDue = orgs.filter(o => o.subscription_status === 'past_due').length;
    const canceled = orgs.filter(o => o.subscription_status === 'canceled').length;

    const trialAging = orgs
      .filter(o => (o.subscription_status ?? 'trial') === 'trial')
      .map(o => ({ id: o.id, name: o.name ?? 'Unnamed organisation', days: daysSince(o.created_at) ?? 0 }))
      .sort((a, b) => b.days - a.days)
      .slice(0, 8);

    const trialEndingSoon = trialAging.filter(x => x.days >= 10);

    return { total, trial, active, pastDue, canceled, trialAging, trialEndingSoon };
  }, [orgs]);

  return (
    <div>
      <div className="dashboard-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1 className="dashboard-page-title">Billing</h1>
          <p className="dashboard-page-subtitle">Subscription overview (v1). Stripe deep billing can be added later.</p>
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

      {error && (
        <div className="dashboard-placeholder-card" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
          <p className="dashboard-page-title" style={{ fontSize: '1.0rem', color: '#991b1b' }}>Unable to load billing overview</p>
          <p className="dashboard-page-subtitle" style={{ textAlign: 'center', margin: '0.5rem auto 0', color: '#7f1d1d' }}>
            {error}
          </p>
        </div>
      )}

      {loading && !error && (
        <div className="dashboard-placeholder-card">
          <div className="dashboard-placeholder-icon"><CreditCard /></div>
          <p className="dashboard-page-title" style={{ fontSize: '1.1rem' }}>Loading billing overview…</p>
          <span className="dashboard-placeholder-label">Loading</span>
        </div>
      )}

      {!loading && !error && (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
            <div className="dashboard-card" style={{ gridColumn: 'span 3', padding: 16, borderRadius: 16 }}>
              <div className="dashboard-muted-label">Total organisations</div>
              <div className="dashboard-metric">{summary.total}</div>
            </div>
            <div className="dashboard-card" style={{ gridColumn: 'span 3', padding: 16, borderRadius: 16 }}>
              <div className="dashboard-muted-label">Trials</div>
              <div className="dashboard-metric">{summary.trial}</div>
            </div>
            <div className="dashboard-card" style={{ gridColumn: 'span 3', padding: 16, borderRadius: 16 }}>
              <div className="dashboard-muted-label">Active</div>
              <div className="dashboard-metric">{summary.active}</div>
            </div>
            <div className="dashboard-card" style={{ gridColumn: 'span 3', padding: 16, borderRadius: 16 }}>
              <div className="dashboard-muted-label">Past due</div>
              <div className="dashboard-metric">{summary.pastDue}</div>
              <div className="dashboard-small-muted">Canceled {summary.canceled}</div>
            </div>
          </div>

          {/* Trial aging */}
          <div className="dashboard-card" style={{ padding: 16, borderRadius: 16 }}>
            <div className="dashboard-card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Trials aging</span>
              <span className="dashboard-small-muted">Older trials need follow-up</span>
            </div>

            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 10px' }}>
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    <th className="dashboard-table-th">Organisation</th>
                    <th className="dashboard-table-th">Days since created</th>
                    <th className="dashboard-table-th">Plan</th>
                    <th className="dashboard-table-th">Subscription status</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.trialAging.map(t => {
                    const org = orgs.find(o => o.id === t.id);
                    const highlight = t.days >= 10;
                    return (
                      <tr key={t.id} className="dashboard-table-row">
                        <td className="dashboard-table-td" style={{ fontWeight: 650 }}>{t.name}</td>
                        <td className="dashboard-table-td" style={{ color: highlight ? '#92400e' : undefined }}>
                          {t.days} days
                          {highlight ? ' · follow-up' : ''}
                        </td>
                        <td className="dashboard-table-td">{org?.plan_type ?? 'basic'}</td>
                        <td className="dashboard-table-td">{org?.subscription_status ?? 'trial'}</td>
                      </tr>
                    );
                  })}

                  {summary.trialAging.length === 0 && (
                    <tr>
                      <td className="dashboard-table-td" colSpan={4} style={{ padding: '14px 10px' }}>
                        No trials currently.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="dashboard-small-muted" style={{ marginTop: 8 }}>
              Next step: wire Stripe data (customer/subscription IDs) into organisations when you’re ready.
            </div>
          </div>

          {/* Full list */}
          <div className="dashboard-card" style={{ padding: 16, borderRadius: 16 }}>
            <div className="dashboard-card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>All organisations (billing fields)</span>
              <span className="dashboard-small-muted">{orgs.length} total</span>
            </div>

            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 10px' }}>
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    <th className="dashboard-table-th">Name</th>
                    <th className="dashboard-table-th">Slug</th>
                    <th className="dashboard-table-th">Plan</th>
                    <th className="dashboard-table-th">Subscription</th>
                    <th className="dashboard-table-th">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map(o => (
                    <tr key={o.id} className="dashboard-table-row">
                      <td className="dashboard-table-td">{o.name ?? 'Unnamed organisation'}</td>
                      <td className="dashboard-table-td">{o.slug ?? '-'}</td>
                      <td className="dashboard-table-td">{o.plan_type ?? 'basic'}</td>
                      <td className="dashboard-table-td">{o.subscription_status ?? 'trial'}</td>
                      <td className="dashboard-table-td">{o.created_at ? new Date(o.created_at).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}

                  {orgs.length === 0 && (
                    <tr>
                      <td className="dashboard-table-td" colSpan={5} style={{ padding: '14px 10px' }}>
                        No organisations yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
