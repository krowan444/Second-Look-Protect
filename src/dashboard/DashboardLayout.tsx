import React, { useState, useEffect, useMemo } from 'react';
import { getSupabase } from '../lib/supabaseClient';
import { Upload, LogOut, User, Menu } from 'lucide-react';
import { DashboardSidebar } from './DashboardSidebar';
import { StapeLeeChat } from './assistant/StapeLeeChat';
import { NotificationBell } from './components/NotificationBell';
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

  /* ── Close user-menu on Escape ─────────────────────────────────────── */
  useEffect(() => {
    if (!userMenuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setUserMenuOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [userMenuOpen]);

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
          const viewingAs = localStorage.getItem('slp_viewing_as_org_id');
          console.log('[DashboardLayout] Mount — slp_active_org_id:', stored, 'slp_viewing_as_org_id:', viewingAs, 'activeOrgId state:', stored || '');
          if (stored && !data.some((o) => o.id === stored)) {
            localStorage.removeItem('slp_active_org_id');
            localStorage.removeItem('slp_viewing_as_org_id');
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
      console.log('[DashboardLayout] Org switch → Global (all keys cleared)');
      window.location.href = '/dashboard/platform';
      return;
    }

    setActiveOrgId(id);
    // Write both keys so all pages resolve the same org consistently
    localStorage.setItem('slp_active_org_id', id);
    localStorage.setItem('slp_viewing_as_org_id', id);
    console.log('[DashboardLayout] Org switch → id:', id, '(wrote slp_active_org_id + slp_viewing_as_org_id)');
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
            {/* Notification bell */}
            {user.id && (
              <NotificationBell userId={user.id} onNavigate={onNavigate} />
            )}

            {/* User menu */}
            <div className="dashboard-user-menu">
              <button
                className="dashboard-user-btn"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                aria-label="Account menu"
                style={{ padding: '4px' }}
              >
                <div className="dashboard-user-avatar">{initials}</div>
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
                    Profile &amp; Settings
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

          {/* Mobile-stackable row: org switcher + submit CTA */}
          <div className="dashboard-topbar-mobile-row">
            {/* Super-admin org switcher */}
            {isSuperAdmin && allOrgs.length > 0 && (
              <div className="dashboard-topbar-switcher">
                <span className="dashboard-topbar-switcher-label">
                  Viewing as
                </span>

                <select
                  className="dashboard-topbar-switcher-select"
                  value={activeOrgId || '__global__'}
                  onChange={handleOrgSwitch}
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
          </div>
        </header>

        {/* Main content */}
        <main className="dashboard-main">{children}</main>
      </div>

      {/* Stape-Lee floating assistant */}
      <StapeLeeChat currentPath={currentPath} />

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
