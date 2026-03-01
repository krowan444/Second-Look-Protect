import React from 'react';
import { Building2, Plus, RefreshCcw } from 'lucide-react';
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

  return (
    <div>
      <div className="dashboard-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
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
        <div className="dashboard-placeholder-card" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
          <p className="dashboard-page-title" style={{ fontSize: '1.0rem', color: '#991b1b' }}>{error}</p>
        </div>
      )}

      {/* Create organisation */}
      <div className="dashboard-card" style={{ padding: 16, borderRadius: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Building2 size={18} />
          <div style={{ fontWeight: 650 }}>Create organisation</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
          <div style={{ gridColumn: 'span 4' }}>
            <div className="dashboard-muted-label">Name</div>
            <input
              value={newName}
              onChange={(e) => { setNewName(e.target.value); if (!newSlug) setNewSlug(safeSlug(e.target.value)); }}
              className="dashboard-input"
              style={{ height: 42, borderRadius: 12 }}
              placeholder="e.g. Rosewood Care Home"
            />
          </div>

          <div style={{ gridColumn: 'span 4' }}>
            <div className="dashboard-muted-label">Slug</div>
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              className="dashboard-input"
              style={{ height: 42, borderRadius: 12 }}
              placeholder="e.g. rosewood-care-home"
            />
          </div>

          <div style={{ gridColumn: 'span 4' }}>
            <div className="dashboard-muted-label">Primary contact email (optional)</div>
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="dashboard-input"
              style={{ height: 42, borderRadius: 12 }}
              placeholder="manager@carehome.co.uk"
            />
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
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

      {/* Organisations list */}
      {loading ? (
        <div className="dashboard-placeholder-card">
          <div className="dashboard-placeholder-icon"><Building2 /></div>
          <p className="dashboard-page-title" style={{ fontSize: '1.1rem' }}>Loading organisations…</p>
          <span className="dashboard-placeholder-label">Loading</span>
        </div>
      ) : (
        <div className="dashboard-card" style={{ padding: 16, borderRadius: 16 }}>
          <div className="dashboard-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>All organisations</span>
            <span className="dashboard-small-muted">{orgs.length} total</span>
          </div>

          <div style={{ overflowX: 'auto', marginTop: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 10px' }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th className="dashboard-table-th">Name</th>
                  <th className="dashboard-table-th">Slug</th>
                  <th className="dashboard-table-th">Status</th>
                  <th className="dashboard-table-th">Plan</th>
                  <th className="dashboard-table-th">Subscription</th>
                  <th className="dashboard-table-th">Contact</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map(o => (
                  <tr key={o.id} className="dashboard-table-row">
                    <td className="dashboard-table-td" style={{ minWidth: 220 }}>
                      <input
                        className="dashboard-input"
                        style={{ height: 40, borderRadius: 12 }}
                        value={o.name ?? ''}
                        onChange={(e) => setOrgs(prev => prev.map(x => x.id === o.id ? { ...x, name: e.target.value } : x))}
                        onBlur={() => updateOrg(o.id, { name: o.name ?? '' })}
                      />
                    </td>

                    <td className="dashboard-table-td" style={{ minWidth: 200 }}>
                      <input
                        className="dashboard-input"
                        style={{ height: 40, borderRadius: 12 }}
                        value={o.slug ?? ''}
                        onChange={(e) => setOrgs(prev => prev.map(x => x.id === o.id ? { ...x, slug: e.target.value } : x))}
                        onBlur={() => updateOrg(o.id, { slug: o.slug ?? '' })}
                      />
                    </td>

                    <td className="dashboard-table-td" style={{ minWidth: 150 }}>
                      <select
                        className="dashboard-input"
                        style={{ height: 40, borderRadius: 12 }}
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

                    <td className="dashboard-table-td" style={{ minWidth: 140 }}>
                      <select
                        className="dashboard-input"
                        style={{ height: 40, borderRadius: 12 }}
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

                    <td className="dashboard-table-td" style={{ minWidth: 160 }}>
                      <select
                        className="dashboard-input"
                        style={{ height: 40, borderRadius: 12 }}
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

                    <td className="dashboard-table-td" style={{ minWidth: 240 }}>
                      <input
                        className="dashboard-input"
                        style={{ height: 40, borderRadius: 12 }}
                        value={o.primary_contact_email ?? ''}
                        onChange={(e) => setOrgs(prev => prev.map(x => x.id === o.id ? { ...x, primary_contact_email: e.target.value } : x))}
                        onBlur={() => updateOrg(o.id, { primary_contact_email: o.primary_contact_email ?? '' })}
                        placeholder="optional"
                      />
                    </td>
                  </tr>
                ))}

                {orgs.length === 0 && (
                  <tr>
                    <td className="dashboard-table-td" colSpan={6} style={{ padding: '14px 10px' }}>
                      No organisations yet. Create the first one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="dashboard-small-muted" style={{ marginTop: 8 }}>
            Next step after this: add an “Open org” button that deep-links you into org-scoped views.
          </div>
        </div>
      )}
    </div>
  );
}
