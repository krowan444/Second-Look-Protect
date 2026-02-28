import React from 'react';
import {
    LayoutDashboard, Upload, FolderOpen, ClipboardList,
    BarChart3, Settings, Globe, Building2, Search,
    CreditCard, Shield,
} from 'lucide-react';
import { ROLE_NAV, type UserRole, type NavItem } from './types';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
    LayoutDashboard, Upload, FolderOpen, ClipboardList,
    BarChart3, Settings, Globe, Building2, Search, CreditCard,
};

interface DashboardSidebarProps {
    role: UserRole;
    currentPath: string;
    onNavigate: (path: string) => void;
    isOpen: boolean;
    onClose: () => void;
}

export function DashboardSidebar({
    role,
    currentPath,
    onNavigate,
    isOpen,
    onClose,
}: DashboardSidebarProps) {
    const navItems = ROLE_NAV[role] ?? [];

    function handleNavClick(path: string) {
        onNavigate(path);
        onClose();
    }

    return (
        <>
            {/* Mobile overlay */}
            <div
                className={`dashboard-sidebar-overlay ${isOpen ? 'open' : ''}`}
                onClick={onClose}
            />

            {/* Sidebar */}
            <aside className={`dashboard-sidebar ${isOpen ? 'open' : ''}`}>
                {/* Brand */}
                <div className="dashboard-sidebar-brand">
                    <div className="dashboard-sidebar-brand-icon">
                        <Shield size={20} color="#0B1E36" />
                    </div>
                    <div>
                        <div className="dashboard-sidebar-brand-text">Second Look</div>
                        <div className="dashboard-sidebar-brand-sub">Dashboard</div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="dashboard-sidebar-nav">
                    <div className="dashboard-sidebar-section-label">Navigation</div>
                    {navItems.map((item: NavItem) => {
                        const IconComp = ICON_MAP[item.icon];
                        const isActive = currentPath === item.path;
                        return (
                            <button
                                key={item.path}
                                className={`dashboard-nav-link ${isActive ? 'active' : ''}`}
                                onClick={() => handleNavClick(item.path)}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                {IconComp && <IconComp size={18} />}
                                {item.label}
                            </button>
                        );
                    })}
                </nav>
            </aside>
        </>
    );
}
