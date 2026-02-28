import { Settings } from 'lucide-react';

export function SettingsPage() {
    return (
        <div>
            <div className="dashboard-page-header">
                <h1 className="dashboard-page-title">Settings</h1>
                <p className="dashboard-page-subtitle">
                    Organisation settings, team management, and notification preferences.
                </p>
            </div>
            <div className="dashboard-placeholder-card">
                <div className="dashboard-placeholder-icon">
                    <Settings />
                </div>
                <p className="dashboard-page-title" style={{ fontSize: '1.1rem' }}>
                    Settings coming soon
                </p>
                <p className="dashboard-page-subtitle" style={{ textAlign: 'center', margin: '0.5rem auto 0' }}>
                    Manage your organisation profile, team members, and alert preferences.
                </p>
                <span className="dashboard-placeholder-label">Coming Soon</span>
            </div>
        </div>
    );
}
