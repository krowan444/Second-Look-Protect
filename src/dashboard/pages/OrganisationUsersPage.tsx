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

interface OrgUser {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    is_active: boolean;
    created_at: string;
}

function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

const ROLE_OPTIONS = ['staff', 'reviewer', 'org_admin', 'read_only', 'manager', 'safeguarding_lead'];

export function OrganisationUsersPage() {
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<OrgUser[]>([]);
    const [orgId, setOrgId] = useState('');
    const [orgName, setOrgName] = useState('');
    const [userRole, setUserRole] = useState('');

    // Invite form
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [inviteRole, setInviteRole] = useState('staff');
    const [inviting, setInviting] = useState(false);
    const [inviteMsg, setInviteMsg] = useState<string | null>(null);

    // Action states
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [actionMsg, setActionMsg] = useState<string | null>(null);

    const canAccess = userRole === 'super_admin' || userRole === 'org_admin';

    // Get access token
    async function getToken(): Promise<string | null> {
        const supabase = getSupabase();
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token ?? null;
    }

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

    // Fetch users via API
    const fetchUsers = useCallback(async () => {
        if (!orgId) { setUsers([]); return; }
        try {
            const token = await getToken();
            if (!token) return;
            const resp = await fetch(`/api/org-users-list?organisation_id=${encodeURIComponent(orgId)}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const result = await resp.json();
            if (result?.ok && Array.isArray(result.users)) {
                setUsers(result.users);
            }
        } catch (err) {
            console.error('Failed to fetch users:', err);
        }
    }, [orgId]);

    useEffect(() => { if (canAccess) fetchUsers(); }, [fetchUsers, canAccess]);

    // Invite user
    async function handleInvite() {
        if (!inviteEmail.trim() || !orgId) return;
        setInviting(true);
        setInviteMsg(null);
        try {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            const resp = await fetch('/api/org-users-invite', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    organisation_id: orgId,
                    email: inviteEmail.trim(),
                    full_name: inviteName.trim() || null,
                    role: inviteRole,
                }),
            });
            const result = await resp.json().catch(() => null);
            if (!resp.ok) throw new Error(result?.error ?? 'Failed to invite');
            setInviteMsg('Invite sent');
            setInviteEmail('');
            setInviteName('');
            fetchUsers();
        } catch (err: any) {
            setInviteMsg(`Error: ${err?.message ?? 'Failed'}`);
        } finally {
            setInviting(false);
        }
    }

    // Update role
    async function handleChangeRole(userId: string, newRole: string) {
        setActionLoading(userId);
        setActionMsg(null);
        try {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            const resp = await fetch('/api/org-users-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    user_id: userId,
                    organisation_id: orgId,
                    role: newRole,
                }),
            });
            const result = await resp.json().catch(() => null);
            if (!resp.ok) throw new Error(result?.error ?? 'Failed');
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
            const resp = await fetch('/api/org-users-update', {
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
                                        <td style={{ fontSize: '0.8rem' }}>{u.email}</td>
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

            {/* Invite User Form */}
            <div className="dashboard-panel" style={{ marginTop: '1rem' }}>
                <div className="dashboard-panel-header">
                    <h2 className="dashboard-panel-title"><UserPlus size={16} className="dashboard-panel-title-icon" /> Invite User</h2>
                </div>
                <div style={{ padding: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Email</label>
                        <input
                            type="email"
                            className="dsf-input"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="user@example.com"
                            style={{ fontSize: '0.82rem', width: '220px' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Full Name</label>
                        <input
                            type="text"
                            className="dsf-input"
                            value={inviteName}
                            onChange={(e) => setInviteName(e.target.value)}
                            placeholder="Jane Smith"
                            style={{ fontSize: '0.82rem', width: '180px' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Role</label>
                        <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value)}
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
                        onClick={handleInvite}
                        disabled={inviting || !inviteEmail.trim()}
                        style={{ background: '#1e40af', color: '#fff' }}
                    >
                        {inviting ? <Loader2 size={14} className="dsf-spinner" /> : <UserPlus size={14} />}
                        {inviting ? 'Sending…' : 'Send Invite'}
                    </button>
                    {inviteMsg && (
                        <span style={{ fontSize: '0.75rem', color: inviteMsg.startsWith('Error') ? '#dc2626' : '#16a34a' }}>{inviteMsg}</span>
                    )}
                </div>
            </div>
        </div>
    );
}
