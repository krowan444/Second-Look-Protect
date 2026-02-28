/* ─── Dashboard Types ──────────────────────────────────────────────────── */

export type UserRole =
    | 'staff'
    | 'org_admin'
    | 'manager'
    | 'safeguarding_lead'
    | 'super_admin';

export interface DashboardUser {
    id: string;
    email: string;
    role: UserRole;
    organisation_id: string | null;
    full_name: string | null;
}

export interface Organisation {
    id: string;
    name: string;
}

export interface NavItem {
    label: string;
    path: string;
    icon: string; // lucide icon name
}

/** Role → visible nav items */
export const ROLE_NAV: Record<UserRole, NavItem[]> = {
    staff: [
        { label: 'Overview', path: '/dashboard/overview', icon: 'LayoutDashboard' },
        { label: 'Submit Case', path: '/dashboard/submit', icon: 'Upload' },
        { label: 'My Cases', path: '/dashboard/my-cases', icon: 'FolderOpen' },
    ],
    org_admin: [
        { label: 'Overview', path: '/dashboard/overview', icon: 'LayoutDashboard' },
        { label: 'Review Queue', path: '/dashboard/review-queue', icon: 'ClipboardList' },
        { label: 'Cases', path: '/dashboard/cases', icon: 'FolderOpen' },
        { label: 'Reports', path: '/dashboard/reports', icon: 'BarChart3' },
        { label: 'Settings', path: '/dashboard/settings', icon: 'Settings' },
    ],
    manager: [
        { label: 'Overview', path: '/dashboard/overview', icon: 'LayoutDashboard' },
        { label: 'Review Queue', path: '/dashboard/review-queue', icon: 'ClipboardList' },
        { label: 'Cases', path: '/dashboard/cases', icon: 'FolderOpen' },
        { label: 'Reports', path: '/dashboard/reports', icon: 'BarChart3' },
        { label: 'Settings', path: '/dashboard/settings', icon: 'Settings' },
    ],
    safeguarding_lead: [
        { label: 'Overview', path: '/dashboard/overview', icon: 'LayoutDashboard' },
        { label: 'Review Queue', path: '/dashboard/review-queue', icon: 'ClipboardList' },
        { label: 'Cases', path: '/dashboard/cases', icon: 'FolderOpen' },
        { label: 'Reports', path: '/dashboard/reports', icon: 'BarChart3' },
        { label: 'Settings', path: '/dashboard/settings', icon: 'Settings' },
    ],
    super_admin: [
        { label: 'Platform Overview', path: '/dashboard/platform', icon: 'Globe' },
        { label: 'Organisations', path: '/dashboard/organisations', icon: 'Building2' },
        { label: 'Global Queue', path: '/dashboard/global-queue', icon: 'ClipboardList' },
        { label: 'Global Search', path: '/dashboard/global-search', icon: 'Search' },
        { label: 'Billing', path: '/dashboard/billing', icon: 'CreditCard' },
    ],
};
