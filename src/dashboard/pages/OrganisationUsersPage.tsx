import React, { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '../../lib/supabaseClient';
import {
    Loader2,
    Users,
    UserPlus,
    ShieldCheck,
    XCircle,
    CheckCircle2,
} from 'lucide-react';

interface ProfileRow {
    id: string;
    role: string;
    is_active: boolean;
    created_at: string;
    full_name: string | null;
    email?: string;
}

function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

const ROLE_OPTIONS = ['staff', 'reviewer', 'org_admin', 'read_only', 'manager', 'safeguarding_lead'];

export function OrganisationUsersPage() {
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<ProfileRow[]>([]);
    const [orgId, setOrgId] = useState('');
    const [orgName, setOrgName] = useState('');
    const [userRole, setUserRole] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Add user form
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState('staff');
    const [adding, setAdding] = useState(false);
    const [addMsg, setAddMsg] = useState<string | null>(null);

    // Action states
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [actionMsg, setActionMsg] = useState<string | null>(null);

    const canAccess = userRole === 'super_admin' || userRole === 'org_admin';

    // Resolve context
    useEffect(() => {
        (async () => {
            const supabase = getSupabase();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) { setLoading(false); return; }

            const { data: profile } = await supabase
                .from('profiles')
                .select('role, organisation_id')
                .eq('id', session.user.id)
                .single();

            const role = profile?.role ?? '';
            setUserRole(role);

            let resolvedOrgId = '';
            if (role === 'super_admin') {
                resolvedOrgId = localStorage.getItem('slp_active_org_id') ?? '';
            } else if (profile?.organisation_id) {
                resolvedOrgId = profile.organisation_id;
            }

            setOrgId(resolvedOrgId);

            if (resolvedOrgId) {
                const { data: org } = await supabase
                    .from('organisations')
                    .select('name')
                    .eq('id', resolvedOrgId)
                    .single();
                setOrgName(org?.name ?? '');
            }

            setLoading(false);
        })();
    }, []);

    // Fetch users
    const fetchUsers = useCallback(async () => {
        if (!orgId) { setUsers([]); return; }
        try {
            const supabase = getSupabase();

            // Fetch profiles for this org
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, role, is_active, created_at, full_name')
                .eq('organisation_id', orgId)
                .order('created_at', { ascending: true });

            if (!profiles || profiles.length === 0) {
                setUsers([]);
                return;
            }

            // Fetch emails from auth.users via admin lookup
            // We can't directly query auth.users from the client, so
            // we'll use the profile data and add email from a joined query if available
            // For now, set profiles without email — the API can fill them
            const profileRows: ProfileRow[] = (profiles ?? []).map(p => ({
                ...p,
                is_active: p.is_active ?? true,
            }));

            // Try to get emails via Supabase view if available
            try {
                const { data: emailData } = await supabase
                    .from('user_emails')
                    .select('id, email')
                    .in('id', profileRows.map(p => p.id));
                if (emailData) {
                    const emailMap = new Map(emailData.map((e: any) => [e.id, e.email]));
                    profileRows.forEach(p => { p.email = emailMap.get(p.id) ?? '—'; });
                }
            } catch {
                // View may not exist — that's OK, show without emails
            }

            setUsers(profileRows);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        }
    }, [orgId]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    // Get access token
    async function getToken(): Promise<string | null> {
        const supabase = getSupabase();
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token ?? null;
    }

    // Add user
    async function handleAddUser() {
        if (!newEmail.trim() || !orgId) return;
        setAdding(true);
        setAddMsg(null);
        try {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            const resp = await fetch('/api/org-users-upsert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    email: newEmail.trim(),
                    role: newRole,
                    organisation_id: orgId,
                }),
            });
            const result = await resp.json().catch(() => null);
            if (!resp.ok) throw new Error(result?.error ?? 'Failed to add user');
            setAddMsg('User added');
            setNewEmail('');
            fetchUsers();
        } catch (err: any) {
            setAddMsg(`Error: ${err?.message ?? 'Failed'}`);
        } finally {
            setAdding(false);
        }
    }

    // Change role
    async function handleChangeRole(userId: string, newRoleVal: string) {
        setActionLoading(userId);
        setActionMsg(null);
        try {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            const resp = await fetch('/api/org-users-upsert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    user_id: userId,
                    role: newRoleVal,
                    organisation_id: orgId,
                }),
            });
            const result = await resp.json().catch(() => null);
            if (!resp.ok) throw new Error(result?.error ?? 'Failed to update role');
            setActionMsg('Role updated');
            fetchUsers();
        } catch (err: any) {
            setActionMsg(`Error: ${err?.message ?? 'Failed'}`);
        } finally {
            setActionLoading(null);
        }
    }

    // Toggle active
    async function handleToggleActive(userId: string, currentActive: boolean) {
        setActionLoading(userId);
        setActionMsg(null);
        try {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            const resp = await fetch('/api/org-users-disable', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    user_id: userId,
                    organisation_id: orgId,
                    is_active: !currentActive,
                }),
            });
            const result = await resp.json().catch(() => null);
            if (!resp.ok) throw new Error(result?.error ?? 'Failed');
            setActionMsg(currentActive ? 'User disabled' : 'User enabled');
            fetchUsers();
        } catch (err: any) {
            setActionMsg(`Error: ${err?.message ?? 'Failed'}`);
        } finally {
            setActionLoading(null);
        }
    }

    if (loading) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                <Loader2 size={24} className="dsf-spinner" /> Loading…
            </div>
        );
    }

    if (!canAccess) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                <ShieldCheck size={32} style={{ marginBottom: '0.5rem' }} />
                <p>You do not have access.</p>
            </div>
        );
    }

    if (!orgId) {
        return (
            <div>
                <div className="dashboard-page-header">
                    <h1 className="dashboard-page-title">Organisation Users</h1>
                </div>
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                    Select an organisation using the "Viewing as" switcher in the top bar.
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="dashboard-page-header">
                <h1 className="dashboard-page-title">Organisation Users</h1>
                {orgName && <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>{orgName}</p>}
            </div>

            {/* Users Table */}
            <div className="dashboard-panel" style={{ marginTop: '1rem' }}>
                <div className="dashboard-panel-header">
                    <h2 className="dashboard-panel-title"><Users size={16} className="dashboard-panel-title-icon" /> Users</h2>
                    <span className="dashboard-panel-count">{users.length}</span>
                </div>
                {users.length === 0 ? (
                    <div className="dashboard-panel-empty">No users found for this organisation.</div>
                ) : (
                    <div className="dashboard-panel-table-wrap">
                        <table className="dashboard-panel-table">
                            <thead>
                                <tr>
                                    <th>Email</th>
                                    <th>Name</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.5 }}>
                                        <td style={{ fontSize: '0.8rem' }}>{u.email ?? '—'}</td>
                                        <td style={{ fontSize: '0.8rem' }}>{u.full_name ?? '—'}</td>
                                        <td>
                                            <select
                                                value={u.role}
                                                onChange={(e) => handleChangeRole(u.id, e.target.value)}
                                                disabled={actionLoading === u.id}
                                                style={{
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    border: '1px solid #cbd5e1',
                                                    fontSize: '0.75rem',
                                                    background: '#fff',
                                                }}
                                            >
                                                {ROLE_OPTIONS.map(r => (
                                                    <option key={r} value={r}>{capitalize(r)}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <span
                                                className={`dashboard-status-badge status-${u.is_active ? 'closed' : 'new'}`}
                                                style={{ fontSize: '0.7rem' }}
                                            >
                                                {u.is_active ? 'Active' : 'Disabled'}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                            {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td>
                                            <button
                                                className="dashboard-reports-action-btn"
                                                style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                                                onClick={() => handleToggleActive(u.id, u.is_active)}
                                                disabled={actionLoading === u.id}
                                            >
                                                {actionLoading === u.id ? (
                                                    <Loader2 size={12} className="dsf-spinner" />
                                                ) : u.is_active ? (
                                                    <XCircle size={12} />
                                                ) : (
                                                    <CheckCircle2 size={12} />
                                                )}
                                                {u.is_active ? 'Disable' : 'Enable'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {actionMsg && (
                    <div style={{
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.78rem',
                        color: actionMsg.startsWith('Error') ? '#dc2626' : '#16a34a',
                        borderTop: '1px solid #e2e8f0',
                    }}>
                        {actionMsg}
                    </div>
                )}
            </div>

            {/* Add User Form */}
            <div className="dashboard-panel" style={{ marginTop: '1rem' }}>
                <div className="dashboard-panel-header">
                    <h2 className="dashboard-panel-title"><UserPlus size={16} className="dashboard-panel-title-icon" /> Add User</h2>
                </div>
                <div style={{ padding: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Email</label>
                        <input
                            type="email"
                            className="dsf-input"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="user@example.com"
                            style={{ fontSize: '0.82rem', width: '260px' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Role</label>
                        <select
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value)}
                            style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                fontSize: '0.82rem',
                                background: '#fff',
                            }}
                        >
                            {ROLE_OPTIONS.map(r => (
                                <option key={r} value={r}>{capitalize(r)}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        type="button"
                        className="dashboard-reports-action-btn"
                        onClick={handleAddUser}
                        disabled={adding || !newEmail.trim()}
                        style={{ background: '#1e40af', color: '#fff' }}
                    >
                        {adding ? <Loader2 size={14} className="dsf-spinner" /> : <UserPlus size={14} />}
                        {adding ? 'Adding…' : 'Add User'}
                    </button>
                    {addMsg && (
                        <span style={{ fontSize: '0.75rem', color: addMsg.startsWith('Error') ? '#dc2626' : '#16a34a' }}>{addMsg}</span>
                    )}
                </div>
            </div>
        </div>
    );
}
