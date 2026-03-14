import React, { useState, useEffect } from 'react';
import './dashboard.css';
import { getSupabase } from '../lib/supabaseClient';
import { LoginPage } from './LoginPage';
import { SetPasswordPage } from './SetPasswordPage';
import { DashboardLayout } from './DashboardLayout';
import type { DashboardUser, Organisation, UserRole } from './types';

/* ─── Pages ──────────────────────────────────────────────────────────────── */
import { OverviewPage } from './pages/OverviewPage';
import { SubmitCasePage } from './pages/SubmitCasePage';
import { MyCasesPage } from './pages/MyCasesPage';
import { ReviewQueuePage } from './pages/ReviewQueuePage';
import { CasesPage } from './pages/CasesPage';
import { CaseDetailPage } from './pages/CaseDetailPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { PlatformOverviewPage } from './pages/PlatformOverviewPage';
import { OrganisationsAdminPage } from './pages/OrganisationsAdminPage';
import { GlobalQueuePage } from './pages/GlobalQueuePage';
import { GlobalSearchPage } from './pages/GlobalSearchPage';
import { InspectionPage } from './pages/InspectionPage';
import { InspectionPackPage } from './pages/InspectionPackPage';
import { BillingPage } from './pages/BillingPage';
import { OrganisationUsersPage } from './pages/OrganisationUsersPage';
import { GroupDashboardPage } from './pages/GroupDashboardPage';
import { GroupHighRiskQueuePage } from './pages/GroupHighRiskQueuePage';
import { GroupActivityPage } from './pages/GroupActivityPage';
import { GroupIntelPage } from './pages/GroupIntelPage';
import { GroupMonthlyPage } from './pages/GroupMonthlyPage';
import { GroupBenchmarkPage } from './pages/GroupBenchmarkPage';
import { GroupTrendsPage } from './pages/GroupTrendsPage';
import { GroupResidentIntelPage } from './pages/GroupResidentIntelPage';
import { GroupResponseTimePage } from './pages/GroupResponseTimePage';
import { GroupPressurePage } from './pages/GroupPressurePage';
import { GroupAlertsPage } from './pages/GroupAlertsPage';

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function isSuperAdmin(role?: UserRole) {
  return role === 'super_admin';
}

/* ─── Page-level Error Boundary ──────────────────────────────────────────── */

class PageErrorBoundary extends React.Component<
  { children: React.ReactNode; fallbackNavigate?: (p: string) => void },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode; fallbackNavigate?: (p: string) => void }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error?.message || 'Unknown render error' };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[DashboardApp] PageErrorBoundary caught error:', error?.message, '\nStack:', error?.stack, '\nComponent stack:', info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem' }}>
          <div style={{ padding: '1.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', maxWidth: '600px' }}>
            <h2 style={{ color: '#dc2626', fontSize: '1rem', margin: '0 0 0.5rem' }}>⚠ This page encountered an error</h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 0.75rem' }}>
              The page could not be displayed. Your data is safe. Please try navigating back or refreshing.
            </p>
            <p style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace', margin: '0 0 1rem', wordBreak: 'break-all' }}>
              {this.state.errorMsg}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, errorMsg: '' });
                this.props.fallbackNavigate?.('/dashboard/cases');
              }}
              style={{ padding: '0.4rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem' }}
            >
              ← Back to Cases
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─── Route resolver ─────────────────────────────────────────────────────── */

function getPage(
  path: string,
  navigate: (p: string) => void,
  userRole?: UserRole
): React.ReactNode {
  const segments = path.replace('/dashboard', '').replace(/^\//, '') || 'overview';
  const parts = segments.split('/');
  const topSegment = parts[0];
  const subSegment = parts[1] || '';

  // 🔐 Super-admin-only routes
  const superAdminOnly = new Set([
    'platform',
    'organisations',
    'global-queue',
    'global-search',
    'billing',
  ]);

  // If a non-super user tries a protected URL, bounce them safely
  if (superAdminOnly.has(topSegment) && !isSuperAdmin(userRole)) {
    window.history.replaceState(null, '', '/dashboard/overview');
    return <OverviewPage onNavigate={navigate} />;
  }

  switch (topSegment) {
    case 'overview':
      return <OverviewPage onNavigate={navigate} />;

    case 'submit':
      return <SubmitCasePage onNavigate={navigate} />;

    case 'my-cases':
      return <MyCasesPage onNavigate={navigate} />;

    case 'review-queue':
      return <ReviewQueuePage onNavigate={navigate} userRole={userRole} />;

    case 'cases':
      if (subSegment) {
        return (
          <PageErrorBoundary fallbackNavigate={navigate}>
            <CaseDetailPage
              caseId={subSegment}
              onNavigate={navigate}
              userRole={userRole}
            />
          </PageErrorBoundary>
        );
      }
      return <CasesPage onNavigate={navigate} userRole={userRole} />;

    case 'reports':
      return <ReportsPage />;

    case 'settings':
      return <SettingsPage />;

    // ✅ These exist, but only super_admin can reach them due to guard above
    case 'platform':
      return <PlatformOverviewPage />;

    case 'organisations':
      return <OrganisationsAdminPage />;

    case 'global-queue':
      return <GlobalQueuePage />;

    case 'global-search':
      return <GlobalSearchPage />;

    case 'inspection':
      return <InspectionPage />;

    case 'inspection-pack':
      return <InspectionPackPage />;

    case 'billing':
      return <BillingPage />;

    case 'org-users':
      return <OrganisationUsersPage />;

    case 'group-dashboard':
      return <GroupDashboardPage />;

    case 'group-high-risk':
      return <GroupHighRiskQueuePage onNavigate={navigate} />;

    case 'group-activity':
      return <GroupActivityPage onNavigate={navigate} />;

    case 'group-intel':
      return <GroupIntelPage />;

    case 'group-monthly':
      return <GroupMonthlyPage />;

    case 'group-benchmark':
      return <GroupBenchmarkPage />;

    case 'group-trends':
      return <GroupTrendsPage />;

    case 'group-residents':
      return <GroupResidentIntelPage />;

    case 'group-response':
      return <GroupResponseTimePage />;

    case 'group-pressure':
      return <GroupPressurePage />;

    case 'group-alerts':
      return <GroupAlertsPage />;

    default:
      return <OverviewPage onNavigate={navigate} />;
  }
}

/* ─── Default landing path per role ──────────────────────────────────────── */

function defaultPathForRole(role: UserRole): string {
  switch (role) {
    case 'super_admin':
      return '/dashboard/platform';
    default:
      return '/dashboard/overview';
  }
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export function DashboardApp() {
  const [authState, setAuthState] = useState<
    'loading' | 'unauthenticated' | 'authenticated'
  >('loading');

  const [user, setUser] = useState<DashboardUser | null>(null);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [needsPasswordSet, setNeedsPasswordSet] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [error, setError] = useState<string | null>(null);

  /* ── Listen for auth state changes ─────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) {
        loadProfile(session.user.id, session.user.email ?? '');
      } else {
        setAuthState('unauthenticated');
      }
    });

    // Subscribe to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return;
        if (event === 'PASSWORD_RECOVERY') {
          console.log('[Dashboard] PASSWORD_RECOVERY event — showing set-password form');
          setNeedsPasswordSet(true);
          // Still load profile so we have user context ready
          if (session?.user) {
            loadProfile(session.user.id, session.user.email ?? '');
          }
          return;
        }
        if (session?.user) {
          loadProfile(session.user.id, session.user.email ?? '');
        } else {
          setAuthState('unauthenticated');
          setUser(null);
          setOrganisation(null);
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Load profile + organisation ───────────────────────────────────────── */

  async function loadProfile(uid: string, email: string) {
    try {
      const supabase = getSupabase();
      console.log('[Dashboard] loadProfile called for uid:', uid, 'email:', email);

      // One-time super-admin bootstrap for designated email
      if (email === 'kierandrowan@gmail.com') {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const bsRes = await fetch('/api/bootstrap-super-admin', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
            });
            const bsData = await bsRes.json().catch(() => null);
            if (bsData?.changed) {
              console.log('[Dashboard] Super-admin bootstrap applied');
            }
          }
        } catch (bsErr) {
          console.warn('[Dashboard] Super-admin bootstrap failed (non-blocking):', bsErr);
        }
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, organisation_id, full_name, is_active')
        .eq('id', uid)
        .maybeSingle();

      console.log('[Dashboard] profile query result:', { profile, profileError });

      if (profileError) {
        console.error('[Dashboard] Profile query error:', profileError);
        setError('Unable to load profile. Please try again.');
        setAuthState('unauthenticated');
        return;
      }

      // Profile row not found — attempt auto-create fallback
      if (!profile) {
        console.warn(
          '[Dashboard] No profile row found for uid:',
          uid,
          '— attempting auto-create'
        );

        const { error: insertErr } = await supabase
          .from('profiles')
          .insert({ id: uid, role: 'staff', is_active: true });

        if (insertErr) {
          console.error('[Dashboard] Auto-create profile failed:', insertErr);
          setError('Profile not found. Please contact your administrator.');
          setAuthState('unauthenticated');
          return;
        }

        // Re-fetch after insert
        const { data: newProfile, error: refetchErr } = await supabase
          .from('profiles')
          .select('id, role, organisation_id, full_name, is_active')
          .eq('id', uid)
          .maybeSingle();

        if (refetchErr || !newProfile) {
          console.error('[Dashboard] Re-fetch after auto-create failed:', refetchErr);
          setError('Profile not found. Please contact your administrator.');
          setAuthState('unauthenticated');
          return;
        }

        return applyProfile(newProfile, email, supabase);
      }

      // Check if account is deactivated
      if (profile.is_active === false) {
        console.warn('[Dashboard] Account deactivated for uid:', uid);
        await supabase.auth.signOut();
        setError('Your account has been disabled. Please contact your administrator.');
        setAuthState('unauthenticated');
        return;
      }

      // Profile exists — apply it
      return applyProfile(profile, email, supabase);
    } catch (err) {
      console.error('[Dashboard] Unexpected error in loadProfile:', err);
      setError('Unable to load profile. Please try again.');
      setAuthState('unauthenticated');
    }
  }

  /* ── Apply a fetched profile to state ──────────────────────────────────── */

  async function applyProfile(
    profile: {
      id: string;
      role: string;
      organisation_id: string | null;
      full_name: string | null;
    },
    email: string,
    supabase: ReturnType<typeof getSupabase>
  ) {
    const dashUser: DashboardUser = {
      id: profile.id,
      email,
      role: profile.role as UserRole,
      organisation_id: profile.organisation_id,
      full_name: profile.full_name,
    };

    setUser(dashUser);

    // Fetch organisation name only if organisation_id is set
    if (profile.organisation_id) {
      const { data: org } = await supabase
        .from('organisations')
        .select('id, name')
        .eq('id', profile.organisation_id)
        .maybeSingle();

      if (org) setOrganisation(org);
    } else {
      setOrganisation(null);
    }

    setError(null);
    setAuthState('authenticated');

    // Navigate to default if at bare /dashboard
    if (window.location.pathname === '/dashboard' || window.location.pathname === '/dashboard/') {
      const defaultPath = defaultPathForRole(dashUser.role);
      window.history.replaceState(null, '', defaultPath);
      setCurrentPath(defaultPath);
    }
  }

  /* ── Navigate ──────────────────────────────────────────────────────────── */

  function navigate(path: string) {
    window.history.pushState(null, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* ── Sign out ─────────────────────────────────────────────────────────── */

  async function handleSignOut() {
    try {
      const supabase = getSupabase();
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[SLP] Sign-out error:', err);
    }
    setUser(null);
    setOrganisation(null);
    setAuthState('unauthenticated');
    localStorage.removeItem('slp_active_org_id');
    localStorage.removeItem('slp_active_org_name');
    localStorage.removeItem('slp_viewing_as_org_id');
    localStorage.removeItem('slp_viewing_as');
    window.history.replaceState(null, '', '/dashboard');
    setCurrentPath('/dashboard');
  }

  /* ── Handle browser back/forward ───────────────────────────────────────── */

  useEffect(() => {
    function onPopState() {
      setCurrentPath(window.location.pathname);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);



  /* ── Render ────────────────────────────────────────────────────────────── */

  if (authState === 'loading') {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading-content">
          <div className="dashboard-spinner" />
          <p className="dashboard-loading-text">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (needsPasswordSet) {
    return (
      <SetPasswordPage
        onComplete={() => {
          setNeedsPasswordSet(false);
          // Profile should already be loaded; if not, re-trigger
          if (!user) {
            const supabase = getSupabase();
            supabase.auth.getSession().then(({ data: { session } }) => {
              if (session?.user) loadProfile(session.user.id, session.user.email ?? '');
            });
          }
        }}
      />
    );
  }

  if (authState === 'unauthenticated' || !user) {
    return (
      <>
        <LoginPage />
        {error && (
          <div
            style={{
              position: 'fixed',
              bottom: '1.5rem',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              zIndex: 100,
            }}
          >
            {error}
          </div>
        )}
      </>
    );
  }

  return (
    <DashboardLayout
      user={user}
      organisation={organisation}
      currentPath={currentPath}
      onNavigate={navigate}
      onSignOut={handleSignOut}
    >
      {getPage(currentPath, navigate, user?.role)}
    </DashboardLayout>
  );
}
