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
  icon: string; // lucide icon name (must match keys in ICON_MAP in DashboardSidebar)
}

/** Role → visible nav items */
export const ROLE_NAV: Record<UserRole, NavItem[]> = {
  staff: [
    { label: 'Overview', path: '/dashboard/overview', icon: 'LayoutDashboard' },
    { label: 'Submit', path: '/dashboard/submit', icon: 'Upload' },
    { label: 'My Cases', path: '/dashboard/my-cases', icon: 'FolderOpen' },
    { label: 'Cases', path: '/dashboard/cases', icon: 'ClipboardList' },
    { label: 'Reports', path: '/dashboard/reports', icon: 'BarChart3' },
    { label: 'Settings', path: '/dashboard/settings', icon: 'Settings' },
  ],

  org_admin: [
    { label: 'Overview', path: '/dashboard/overview', icon: 'LayoutDashboard' },
    { label: 'Submit', path: '/dashboard/submit', icon: 'Upload' },
    { label: 'Review Queue', path: '/dashboard/review-queue', icon: 'ClipboardList' },
    { label: 'Cases', path: '/dashboard/cases', icon: 'FolderOpen' },
    { label: 'Reports', path: '/dashboard/reports', icon: 'BarChart3' },
    { label: 'Org Users', path: '/dashboard/org-users', icon: 'Users' },
    { label: 'Settings', path: '/dashboard/settings', icon: 'Settings' },
    { label: 'Group Dashboard', path: '/dashboard/group-dashboard', icon: 'Building2' },
    { label: 'Group High-Risk', path: '/dashboard/group-high-risk', icon: 'ShieldAlert' },
    { label: 'Group Activity', path: '/dashboard/group-activity', icon: 'Activity' },
    { label: 'Group Intel', path: '/dashboard/group-intel', icon: 'BarChart3' },
    { label: 'Group Monthly', path: '/dashboard/group-monthly', icon: 'Calendar' },
    { label: 'Group Benchmark', path: '/dashboard/group-benchmark', icon: 'GitCompareArrows' },
    { label: 'Group Trends', path: '/dashboard/group-trends', icon: 'TrendingUp' },
    { label: 'Group Residents', path: '/dashboard/group-residents', icon: 'UserSearch' },
    { label: 'Group Response', path: '/dashboard/group-response', icon: 'Timer' },
    { label: 'Group Pressure', path: '/dashboard/group-pressure', icon: 'Gauge' },
    { label: 'Group Alerts', path: '/dashboard/group-alerts', icon: 'BellRing' },
  ],

  manager: [
    { label: 'Overview', path: '/dashboard/overview', icon: 'LayoutDashboard' },
    { label: 'Submit', path: '/dashboard/submit', icon: 'Upload' },
    { label: 'Review Queue', path: '/dashboard/review-queue', icon: 'ClipboardList' },
    { label: 'Cases', path: '/dashboard/cases', icon: 'FolderOpen' },
    { label: 'Reports', path: '/dashboard/reports', icon: 'BarChart3' },
    { label: 'Settings', path: '/dashboard/settings', icon: 'Settings' },
  ],

  safeguarding_lead: [
    { label: 'Overview', path: '/dashboard/overview', icon: 'LayoutDashboard' },
    { label: 'Submit', path: '/dashboard/submit', icon: 'Upload' },
    { label: 'Review Queue', path: '/dashboard/review-queue', icon: 'ClipboardList' },
    { label: 'Cases', path: '/dashboard/cases', icon: 'FolderOpen' },
    { label: 'Reports', path: '/dashboard/reports', icon: 'BarChart3' },
    { label: 'Settings', path: '/dashboard/settings', icon: 'Settings' },
  ],

  super_admin: [
    // Normal dashboard links (so super admin can use the product like an org user)
    { label: 'Overview', path: '/dashboard/overview', icon: 'LayoutDashboard' },
    { label: 'Submit', path: '/dashboard/submit', icon: 'Upload' },
    { label: 'Review Queue', path: '/dashboard/review-queue', icon: 'ClipboardList' },
    { label: 'Cases', path: '/dashboard/cases', icon: 'FolderOpen' },
    { label: 'Reports', path: '/dashboard/reports', icon: 'BarChart3' },
    { label: 'Settings', path: '/dashboard/settings', icon: 'Settings' },
    { label: 'Group Dashboard', path: '/dashboard/group-dashboard', icon: 'Building2' },
    { label: 'Group High-Risk', path: '/dashboard/group-high-risk', icon: 'ShieldAlert' },
    { label: 'Group Activity', path: '/dashboard/group-activity', icon: 'Activity' },
    { label: 'Group Intel', path: '/dashboard/group-intel', icon: 'BarChart3' },
    { label: 'Group Monthly', path: '/dashboard/group-monthly', icon: 'Calendar' },
    { label: 'Group Benchmark', path: '/dashboard/group-benchmark', icon: 'GitCompareArrows' },
    { label: 'Group Trends', path: '/dashboard/group-trends', icon: 'TrendingUp' },
    { label: 'Group Residents', path: '/dashboard/group-residents', icon: 'UserSearch' },
    { label: 'Group Response', path: '/dashboard/group-response', icon: 'Timer' },
    { label: 'Group Pressure', path: '/dashboard/group-pressure', icon: 'Gauge' },
    { label: 'Group Alerts', path: '/dashboard/group-alerts', icon: 'BellRing' },

    // Platform (super-admin only)
    { label: 'Platform Overview', path: '/dashboard/platform', icon: 'Globe' },
    { label: 'Organisations', path: '/dashboard/organisations', icon: 'Building2' },
    { label: 'Global Queue', path: '/dashboard/global-queue', icon: 'ClipboardList' },
    { label: 'Global Search', path: '/dashboard/global-search', icon: 'Search' },
    { label: 'Org Users', path: '/dashboard/org-users', icon: 'Users' },
    { label: 'Billing', path: '/dashboard/billing', icon: 'CreditCard' },
    { label: 'Inspection Mode', path: '/dashboard/inspection', icon: 'ClipboardCheck' },
  ],
};
