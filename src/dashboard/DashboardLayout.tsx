import React, { useState } from 'react';
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
                            {organisation?.name ?? 'Dashboard'}
                        </span>
                    </div>

                    <div className="dashboard-topbar-right">
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
                                    <div className="dashboard-user-dropdown-item" style={{ cursor: 'default', color: '#64748b', fontSize: '0.75rem' }}>
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
                <main className="dashboard-main">
                    {children}
                </main>
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
