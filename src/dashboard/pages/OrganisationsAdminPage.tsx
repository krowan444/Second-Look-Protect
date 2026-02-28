import { Building2 } from 'lucide-react';

export function OrganisationsAdminPage() {
    return (
        <div>
            <div className="dashboard-page-header">
                <h1 className="dashboard-page-title">Organisations</h1>
                <p className="dashboard-page-subtitle">
                    Manage all organisations on the platform.
                </p>
            </div>
            <div className="dashboard-placeholder-card">
                <div className="dashboard-placeholder-icon">
                    <Building2 />
                </div>
                <p className="dashboard-page-title" style={{ fontSize: '1.1rem' }}>
                    Organisation management coming soon
                </p>
                <p className="dashboard-page-subtitle" style={{ textAlign: 'center', margin: '0.5rem auto 0' }}>
                    Create, edit, and manage organisations and their settings.
                </p>
                <span className="dashboard-placeholder-label">Coming Soon</span>
            </div>
        </div>
    );
}
