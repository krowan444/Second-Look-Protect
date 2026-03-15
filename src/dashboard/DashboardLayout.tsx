import React, { useState, useEffect, useMemo } from 'react';
import { getSupabase } from '../lib/supabaseClient';
import { Upload, LogOut, User, Menu, Eye, ChevronDown } from 'lucide-react';
import { PresetSvg, findPreset } from './orgLogoPresets';
import { DashboardSidebar } from './DashboardSidebar';
import { StapeLeeChat } from './assistant/StapeLeeChat';
import { StapeLeeDataProvider } from './assistant/StapeLeeDataContext';
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

  // Fetch branding for the currently viewed org (super admin view-as)
  const [activeOrgBranding, setActiveOrgBranding] = useState<{
    logo_url: string | null;
    logo_preset: string | null;
  } | null>(null);

  useEffect(() => {
    if (!isSuperAdmin || !activeOrgId) { setActiveOrgBranding(null); return; }
    const supabase = getSupabase();
    supabase
      .from('organisations')
      .select('logo_url, logo_preset')
      .eq('id', activeOrgId)
      .single()
      .then(({ data }) => {
        setActiveOrgBranding(data ? { logo_url: data.logo_url ?? null, logo_preset: data.logo_preset ?? null } : null);
      });
  }, [isSuperAdmin, activeOrgId]);

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
      handleExitViewAs();
      return;
    }

    setActiveOrgId(id);
    localStorage.setItem('slp_active_org_id', id);
    localStorage.setItem('slp_viewing_as_org_id', id);
    console.log('[DashboardLayout] Org switch → id:', id);

    // Audit log the switch
    const orgName = allOrgs.find(o => o.id === id)?.name ?? id;
    try {
      const supabase = getSupabase();
      supabase.from('alert_log').insert({
        event_type: 'view_as_switch',
        entity_type: 'organisation',
        severity: 'info',
        organisation_id: id,
        meta: { admin_email: user.email, admin_id: user.id, target_org: orgName },
      }).then(() => console.log('[ViewAs] Audit logged:', orgName));
    } catch { /* non-blocking */ }

    window.location.reload();
  }

  function handleExitViewAs() {
    setActiveOrgId('');
    localStorage.removeItem('slp_active_org_id');
    localStorage.removeItem('slp_active_org_name');
    localStorage.removeItem('slp_viewing_as_org_id');
    localStorage.removeItem('slp_viewing_as');
    console.log('[DashboardLayout] Exited View As mode');
    window.location.href = '/dashboard/platform';
  }

  /* ── Display name in top bar ───────────────────────────────────────── */

  const activeOrgName = useMemo(() => {
    if (isSuperAdmin && activeOrgId) {
      const found = allOrgs.find((o) => o.id === activeOrgId);
      return found?.name ?? 'Second Look Protect';
    }

    return organisation?.name ?? 'Second Look Protect';
  }, [isSuperAdmin, activeOrgId, allOrgs, organisation]);

  // Eyebrow label: 'Organisation' when an org is in context, 'Platform' for global super admin view
  const topbarEyebrow = useMemo(() => {
    if (isSuperAdmin && !activeOrgId) return 'Platform';
    return 'Organisation';
  }, [isSuperAdmin, activeOrgId]);

  const initials = user.full_name
    ? user.full_name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    : user.email.slice(0, 2).toUpperCase();

  return (
    <StapeLeeDataProvider>
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

              <div className="dashboard-topbar-org-block">
                <span className="dashboard-topbar-org-label">{topbarEyebrow}</span>
                <span className="dashboard-topbar-org">{activeOrgName}</span>
              </div>
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
                  style={{
                    padding: '0.28rem 0.6rem 0.28rem 0.32rem',
                    background: '#0B1E36',
                    border: '1px solid rgba(201,168,76,0.28)',
                    borderRadius: '40px',
                    color: '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    height: '36px',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#16324F';
                    e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#0B1E36';
                    e.currentTarget.style.borderColor = 'rgba(201,168,76,0.28)';
                  }}
                >
                  {/* Avatar — shows viewed org logo (super admin) or own org logo, preset, or user initials */}
                  {(() => {
                    // For super admin viewing an org, prefer that org's branding
                    const logoUrl = (isSuperAdmin && activeOrgId && activeOrgBranding?.logo_url)
                      ? activeOrgBranding.logo_url
                      : organisation?.logo_url;
                    const presetKey = (isSuperAdmin && activeOrgId && activeOrgBranding?.logo_preset)
                      ? activeOrgBranding.logo_preset
                      : organisation?.logo_preset;
                    const preset = findPreset(presetKey);
                    if (logoUrl) {
                      return (
                        <div style={{
                          width: 28, height: 28, borderRadius: '6px',
                          overflow: 'hidden', flexShrink: 0,
                          background: '#1e3a5f',
                        }}>
                          <img
                            src={logoUrl}
                            alt="Organisation logo"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        </div>
                      );
                    }
                    if (preset) {
                      return (
                        <div style={{
                          width: 28, height: 28, borderRadius: '6px',
                          background: 'rgba(201,168,76,0.15)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <PresetSvg preset={preset} color="#C9A84C" size={17} />
                        </div>
                      );
                    }
                    return <div className="dashboard-user-avatar">{initials}</div>;
                  })()}
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    color: '#e2e8f0',
                    maxWidth: '110px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    letterSpacing: '-0.01em',
                  }}>
                    {user.full_name?.split(' ')[0] ?? 'Account'}
                  </span>
                  <ChevronDown
                    size={13}
                    style={{
                      color: '#94a3b8',
                      flexShrink: 0,
                      transition: 'transform 0.18s ease',
                      transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  />
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

          {/* View As banner */}
          {isSuperAdmin && activeOrgId && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
              padding: '8px 16px', background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#fff', fontSize: '0.82rem', fontWeight: 600,
              borderBottom: '1px solid rgba(0,0,0,0.1)',
              flexWrap: 'wrap',
            }}>
              <Eye size={16} style={{ flexShrink: 0 }} />
              <span>Viewing as: <strong>{activeOrgName}</strong> · Role: Org Admin (simulated)</span>
              <button
                onClick={handleExitViewAs}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
                  color: '#fff', padding: '3px 12px', borderRadius: '6px', cursor: 'pointer',
                  fontSize: '0.75rem', fontWeight: 600, transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.35)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
              >
                ✕ Exit View As
              </button>
            </div>
          )}

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
    </StapeLeeDataProvider>
  );
}
