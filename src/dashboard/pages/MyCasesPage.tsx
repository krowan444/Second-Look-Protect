import { FolderOpen } from 'lucide-react';

export function MyCasesPage() {
    return (
        <div>
            <div className="dashboard-page-header">
                <h1 className="dashboard-page-title">My Cases</h1>
                <p className="dashboard-page-subtitle">
                    Track the status of cases you've submitted.
                </p>
            </div>
            <div className="dashboard-placeholder-card">
                <div className="dashboard-placeholder-icon">
                    <FolderOpen />
                </div>
                <p className="dashboard-page-title" style={{ fontSize: '1.1rem' }}>
                    Case tracking coming soon
                </p>
                <p className="dashboard-page-subtitle" style={{ textAlign: 'center', margin: '0.5rem auto 0' }}>
                    View your submitted cases, their review status, and any actions taken.
                </p>
                <span className="dashboard-placeholder-label">Coming Soon</span>
            </div>
        </div>
    );
}
