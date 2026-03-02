import React, { useState, useEffect, useMemo } from 'react';
import { getSupabase } from '../lib/supabaseClient';
import { Upload, ChevronDown, LogOut, User, Menu } from 'lucide-react';
import { DashboardSidebar } from './DashboardSidebar';
import type { DashboardUser, Organisation } from './types';

interface DashboardLayoutProps {
  user: DashboardUser;
  organisation: Organisation | null;
  currentPath: string;
  onNavigate: (path: string) => void;
  onSignOut: () => void;
  children: React.ReactNode;
}

export function DashboardLayout({
  user,
  organisation,
  currentPath,
  onNavigate,
  onSignOut,
  children,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  /* ── Super-admin org switcher state ─────────────────────────────────── */
  const isSuperAdmin = user.role === 'super_admin';
  const [allOrgs, setAllOrgs] = useState<{ id: string; name: string }[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string>(
    () => localStorage.getItem('slp_active_org_id') ?? '',
  );

  useEffect(() => {
    if (!isSuperAdmin) return;

    const supabase = getSupabase();
    supabase
      .from('organisations')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        if (data) {
          setAllOrgs(data);

          const stored = localStorage.getItem('slp_active_org_id');
          if (stored && !data.some((o) => o.id === stored)) {
            localStorage.removeItem('slp_active_org_id');
            setActiveOrgId('');
          }
        }
      });
  }, [isSuperAdmin]);

  function handleOrgSwitch(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;

    if (id === '__global__' || id === '') {
      setActiveOrgId('');
      localStorage.removeItem('slp_active_org_id');
      localStorage.removeItem('slp_active_org_name');
      localStorage.removeItem('slp_viewing_as_org_id');
      localStorage.removeItem('slp_viewing_as');
      window.location.href = '/dashboard/platform';
      return;
    }

    setActiveOrgId(id);
    localStorage.setItem('slp_active_org_id', id);
    window.location.reload();
  }

  /* ── Display name in top bar ───────────────────────────────────────── */

  const activeOrgName = useMemo(() => {
    if (isSuperAdmin && activeOrgId) {
      const found = allOrgs.find((o) => o.id === activeOrgId);
      return found?.name ?? 'Dashboard';
    }

    return organisation?.name ?? 'Dashboard';
  }, [isSuperAdmin, activeOrgId, allOrgs, organisation]);

  const initials = user.full_name
    ? user.full_name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    : user.email.slice(0, 2).toUpperCase();

  return (
    <div className="dashboard-shell">
      {/* Sidebar */}
      <DashboardSidebar
        role={user.role}
        currentPath={currentPath}
        onNavigate={onNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Content */}
      <div className="dashboard-content">
        {/* Top Bar */}
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-left">
            <button
              className="dashboard-sidebar-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>

            <span className="dashboard-topbar-org">
              {activeOrgName}
            </span>
          </div>

          <div className="dashboard-topbar-right">
            {/* Super-admin org switcher */}
            {isSuperAdmin && allOrgs.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginRight: '8px',
                  fontSize: '0.8rem',
                }}
              >
                <span style={{ color: '#64748b', whiteSpace: 'nowrap' }}>
                  Viewing as
                </span>

                <select
                  value={activeOrgId || '__global__'}
                  onChange={handleOrgSwitch}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    fontSize: '0.8rem',
                    color: '#0f172a',
                    maxWidth: '220px',
                  }}
                >
                  <option value="__global__">Super Admin (Global)</option>
                  {allOrgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Submit Case button */}
            <button
              className="dashboard-submit-btn"
              onClick={() => onNavigate('/dashboard/submit')}
            >
              <Upload size={16} />
              Submit Case
            </button>

            {/* User menu */}
            <div className="dashboard-user-menu">
              <button
                className="dashboard-user-btn"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                <div className="dashboard-user-avatar">{initials}</div>
                <span>{user.full_name ?? user.email}</span>
                <ChevronDown size={14} />
              </button>

              {userMenuOpen && (
                <div className="dashboard-user-dropdown">
                  <div
                    className="dashboard-user-dropdown-item"
                    style={{
                      cursor: 'default',
                      color: '#64748b',
                      fontSize: '0.75rem',
                    }}
                  >
                    {user.email}
                  </div>

                  <div className="dashboard-user-dropdown-divider" />

                  <button
                    className="dashboard-user-dropdown-item"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onNavigate('/dashboard/settings');
                    }}
                  >
                    <User size={14} />
                    Profile & Settings
                  </button>

                  <div className="dashboard-user-dropdown-divider" />

                  <button
                    className="dashboard-user-dropdown-item"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onSignOut();
                    }}
                    style={{ color: '#991b1b' }}
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="dashboard-main">{children}</main>
      </div>

      {/* Close user menu on outside click */}
      {userMenuOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 25 }}
          onClick={() => setUserMenuOpen(false)}
        />
      )}
    </div>
  );
}
