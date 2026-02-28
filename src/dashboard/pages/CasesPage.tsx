import { FolderOpen } from 'lucide-react';

export function CasesPage() {
    return (
        <div>
            <div className="dashboard-page-header">
                <h1 className="dashboard-page-title">Cases</h1>
                <p className="dashboard-page-subtitle">
                    All cases within your organisation, filterable by status and assignee.
                </p>
            </div>
            <div className="dashboard-placeholder-card">
                <div className="dashboard-placeholder-icon">
                    <FolderOpen />
                </div>
                <p className="dashboard-page-title" style={{ fontSize: '1.1rem' }}>
                    Case management coming soon
                </p>
                <p className="dashboard-page-subtitle" style={{ textAlign: 'center', margin: '0.5rem auto 0' }}>
                    Search, filter, and manage all organisation cases in one place.
                </p>
                <span className="dashboard-placeholder-label">Coming Soon</span>
            </div>
        </div>
    );
}
