import React from 'react';
import { Building2, Plus, RefreshCcw, Loader2, ExternalLink } from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

type OrganisationRow = {
  id: string;
  name: string | null;
  slug: string | null;
  status: 'active' | 'paused' | 'suspended' | string | null;
  subscription_status: 'trial' | 'active' | 'past_due' | 'canceled' | string | null;
  plan_type: 'basic' | 'pro' | 'enterprise' | string | null;
  primary_contact_email: string | null;
  created_at: string | null;
};

function safeSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function OrganisationsAdminPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [orgs, setOrgs] = React.useState<OrganisationRow[]>([]);

  // Create form
  const [newName, setNewName] = React.useState('');
  const [newSlug, setNewSlug] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data, error: err } = await supabase
        .from('organisations')
        .select('id,name,slug,status,subscription_status,plan_type,primary_contact_email,created_at')
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

  async function createOrg() {
    const name = newName.trim();
    const slug = safeSlug(newSlug.trim() || newName);

    if (!name) {
      setError('Organisation name is required.');
      return;
    }
    if (!slug) {
      setError('Organisation slug is required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const supabase = getSupabase();
      const { error: insErr } = await supabase.from('organisations').insert({
        name,
        slug,
        primary_contact_email: newEmail.trim() || null,
        status: 'active',
        subscription_status: 'trial',
        plan_type: 'basic',
        timezone: 'Europe/London',
      });

      if (insErr) throw new Error(insErr.message);

      setNewName('');
      setNewSlug('');
      setNewEmail('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create organisation');
    } finally {
      setSaving(false);
    }
  }

  async function updateOrg(id: string, patch: Partial<OrganisationRow>) {
    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error: upErr } = await supabase
        .from('organisations')
        .update({
          name: patch.name ?? undefined,
          slug: patch.slug ?? undefined,
          status: patch.status ?? undefined,
          subscription_status: patch.subscription_status ?? undefined,
          plan_type: patch.plan_type ?? undefined,
          primary_contact_email: patch.primary_contact_email ?? undefined,
        })
        .eq('id', id);

      if (upErr) throw new Error(upErr.message);

      setOrgs(prev => prev.map(o => (o.id === id ? { ...o, ...patch } : o)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update organisation');
    } finally {
      setSaving(false);
    }
  }

  function handleOpenOrg(orgId: string) {
    localStorage.setItem('slp_active_org_id', orgId);
    window.location.href = '/dashboard/overview';
  }

  return (
    <div>
      <div className="dashboard-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <h1 className="dashboard-page-title">Organisations</h1>
          <p className="dashboard-page-subtitle">Manage all organisations on the platform.</p>
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
        <div className="dashboard-overview-error" style={{ marginBottom: '1rem' }}>
          <span>{error}</span>
        </div>
      )}

      {/* Create organisation */}
      <div className="dashboard-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="dashboard-panel-header">
          <h2 className="dashboard-panel-title">
            <Building2 size={16} className="dashboard-panel-title-icon" />
            Create Organisation
          </h2>
        </div>

        <div style={{ padding: '0 1rem 1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Name</div>
              <input
                value={newName}
                onChange={(e) => { setNewName(e.target.value); if (!newSlug) setNewSlug(safeSlug(e.target.value)); }}
                className="dsf-input"
                placeholder="e.g. Rosewood Care Home"
              />
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Slug</div>
              <input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                className="dsf-input"
                placeholder="e.g. rosewood-care-home"
              />
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Primary contact email (optional)</div>
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="dsf-input"
                placeholder="manager@carehome.co.uk"
              />
            </div>
          </div>

          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={createOrg}
              disabled={saving}
              className="dashboard-primary-button"
              style={{ height: 44, padding: '0 14px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 8, opacity: saving ? 0.7 : 1 }}
            >
              <Plus size={18} />
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </div>

      {/* Organisations list */}
      {loading ? (
        <div className="dashboard-overview-loading">
          <Loader2 className="dashboard-overview-spinner-icon" />
          <p>Loading organisations…</p>
        </div>
      ) : (
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h2 className="dashboard-panel-title">
              <Building2 size={16} className="dashboard-panel-title-icon" />
              All Organisations
            </h2>
            <span className="dashboard-panel-count">{orgs.length}</span>
          </div>

          {orgs.length === 0 ? (
            <div className="dashboard-panel-empty">No organisations yet. Create the first one above.</div>
          ) : (
            <div className="dashboard-panel-table-wrap">
              <table className="dashboard-panel-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Slug</th>
                    <th>Status</th>
                    <th>Plan</th>
                    <th>Subscription</th>
                    <th>Contact</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map(o => (
                    <tr key={o.id}>
                      <td style={{ minWidth: 200 }}>
                        <input
                          className="dsf-input"
                          style={{ width: '100%' }}
                          value={o.name ?? ''}
                          onChange={(e) => setOrgs(prev => prev.map(x => x.id === o.id ? { ...x, name: e.target.value } : x))}
                          onBlur={() => updateOrg(o.id, { name: o.name ?? '' })}
                        />
                      </td>

                      <td>
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{o.slug ?? '—'}</span>
                      </td>

                      <td>
                        <select
                          className="dsf-input"
                          value={o.status ?? 'active'}
                          onChange={(e) => {
                            const v = e.target.value;
                            setOrgs(prev => prev.map(x => x.id === o.id ? { ...x, status: v } : x));
                            updateOrg(o.id, { status: v });
                          }}
                        >
                          <option value="active">active</option>
                          <option value="paused">paused</option>
                          <option value="suspended">suspended</option>
                        </select>
                      </td>

                      <td>
                        <select
                          className="dsf-input"
                          value={o.plan_type ?? 'basic'}
                          onChange={(e) => {
                            const v = e.target.value;
                            setOrgs(prev => prev.map(x => x.id === o.id ? { ...x, plan_type: v } : x));
                            updateOrg(o.id, { plan_type: v });
                          }}
                        >
                          <option value="basic">basic</option>
                          <option value="pro">pro</option>
                          <option value="enterprise">enterprise</option>
                        </select>
                      </td>

                      <td>
                        <select
                          className="dsf-input"
                          value={o.subscription_status ?? 'trial'}
                          onChange={(e) => {
                            const v = e.target.value;
                            setOrgs(prev => prev.map(x => x.id === o.id ? { ...x, subscription_status: v } : x));
                            updateOrg(o.id, { subscription_status: v });
                          }}
                        >
                          <option value="trial">trial</option>
                          <option value="active">active</option>
                          <option value="past_due">past_due</option>
                          <option value="canceled">canceled</option>
                        </select>
                      </td>

                      <td>
                        <input
                          className="dsf-input"
                          style={{ width: '100%' }}
                          value={o.primary_contact_email ?? ''}
                          onChange={(e) => setOrgs(prev => prev.map(x => x.id === o.id ? { ...x, primary_contact_email: e.target.value } : x))}
                          onBlur={() => updateOrg(o.id, { primary_contact_email: o.primary_contact_email ?? '' })}
                          placeholder="optional"
                        />
                      </td>

                      <td>
                        <button
                          type="button"
                          onClick={() => handleOpenOrg(o.id)}
                          className="dashboard-primary-button"
                          style={{ height: 32, padding: '0 10px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                        >
                          <ExternalLink size={14} />
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
