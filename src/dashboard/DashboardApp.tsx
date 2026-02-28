import React, { useState, useEffect } from 'react';
import './dashboard.css';
import { getSupabase } from '../lib/supabaseClient';
import { LoginPage } from './LoginPage';
import { DashboardLayout } from './DashboardLayout';
import type { DashboardUser, Organisation, UserRole } from './types';

/* ─── Pages ──────────────────────────────────────────────────────────────── */
import { OverviewPage } from './pages/OverviewPage';
import { SubmitCasePage } from './pages/SubmitCasePage';
import { MyCasesPage } from './pages/MyCasesPage';
import { ReviewQueuePage } from './pages/ReviewQueuePage';
import { CasesPage } from './pages/CasesPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { PlatformOverviewPage } from './pages/PlatformOverviewPage';
import { OrganisationsAdminPage } from './pages/OrganisationsAdminPage';
import { GlobalQueuePage } from './pages/GlobalQueuePage';
import { GlobalSearchPage } from './pages/GlobalSearchPage';
import { BillingPage } from './pages/BillingPage';

/* ─── Route resolver ─────────────────────────────────────────────────────── */

function getPage(path: string): React.ReactNode {
    const segments = path.replace('/dashboard', '').replace(/^\//, '') || 'overview';
    switch (segments) {
        case 'overview': return <OverviewPage />;
        case 'submit': return <SubmitCasePage />;
        case 'my-cases': return <MyCasesPage />;
        case 'review-queue': return <ReviewQueuePage />;
        case 'cases': return <CasesPage />;
        case 'reports': return <ReportsPage />;
        case 'settings': return <SettingsPage />;
        case 'platform': return <PlatformOverviewPage />;
        case 'organisations': return <OrganisationsAdminPage />;
        case 'global-queue': return <GlobalQueuePage />;
        case 'global-search': return <GlobalSearchPage />;
        case 'billing': return <BillingPage />;
        default: return <OverviewPage />;
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
    const [authState, setAuthState] = useState<'loading' | 'unauthenticated' | 'authenticated'>('loading');
    const [user, setUser] = useState<DashboardUser | null>(null);
    const [organisation, setOrganisation] = useState<Organisation | null>(null);
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
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (cancelled) return;
            if (session?.user) {
                loadProfile(session.user.id, session.user.email ?? '');
            } else {
                setAuthState('unauthenticated');
                setUser(null);
                setOrganisation(null);
            }
        });

        return () => {
            cancelled = true;
            subscription.unsubscribe();
        };
    }, []);

    /* ── Load profile + organisation ───────────────────────────────────────── */
    async function loadProfile(uid: string, email: string) {
        try {
            const supabase = getSupabase();

            // Fetch profile
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id, role, organisation_id, full_name')
                .eq('id', uid)
                .single();

            if (profileError || !profile) {
                setError('Profile not found. Please contact your administrator.');
                setAuthState('unauthenticated');
                return;
            }

            const dashUser: DashboardUser = {
                id: profile.id,
                email,
                role: profile.role as UserRole,
                organisation_id: profile.organisation_id,
                full_name: profile.full_name,
            };

            setUser(dashUser);

            // Fetch organisation name
            if (profile.organisation_id) {
                const { data: org } = await supabase
                    .from('organisations')
                    .select('id, name')
                    .eq('id', profile.organisation_id)
                    .single();

                if (org) {
                    setOrganisation(org);
                }
            }

            setAuthState('authenticated');

            // Navigate to default if at bare /dashboard
            if (window.location.pathname === '/dashboard' || window.location.pathname === '/dashboard/') {
                const defaultPath = defaultPathForRole(dashUser.role);
                window.history.replaceState(null, '', defaultPath);
                setCurrentPath(defaultPath);
            }
        } catch {
            setError('Failed to load profile. Please try again.');
            setAuthState('unauthenticated');
        }
    }

    /* ── Navigate ──────────────────────────────────────────────────────────── */
    function navigate(path: string) {
        window.history.pushState(null, '', path);
        setCurrentPath(path);
        window.scrollTo({ top: 0, behavior: 'instant' });
    }

    /* ── Handle browser back/forward ───────────────────────────────────────── */
    useEffect(() => {
        function onPopState() {
            setCurrentPath(window.location.pathname);
        }
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    /* ── Sign out ──────────────────────────────────────────────────────────── */
    async function handleSignOut() {
        const supabase = getSupabase();
        await supabase.auth.signOut();
        setAuthState('unauthenticated');
        setUser(null);
        setOrganisation(null);
        window.history.replaceState(null, '', '/dashboard');
        setCurrentPath('/dashboard');
    }

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

    if (authState === 'unauthenticated' || !user) {
        return (
            <>
                <LoginPage />
                {error && (
                    <div style={{
                        position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
                        background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
                        padding: '0.6rem 1.2rem', borderRadius: '8px', fontSize: '0.82rem',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 100,
                    }}>
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
            {getPage(currentPath)}
        </DashboardLayout>
    );
}
