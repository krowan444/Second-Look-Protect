import { Globe } from 'lucide-react';

export function PlatformOverviewPage() {
    return (
        <div>
            <div className="dashboard-page-header">
                <h1 className="dashboard-page-title">Platform Overview</h1>
                <p className="dashboard-page-subtitle">
                    Global platform metrics across all organisations.
                </p>
            </div>
            <div className="dashboard-placeholder-card">
                <div className="dashboard-placeholder-icon">
                    <Globe />
                </div>
                <p className="dashboard-page-title" style={{ fontSize: '1.1rem' }}>
                    Platform overview coming soon
                </p>
                <p className="dashboard-page-subtitle" style={{ textAlign: 'center', margin: '0.5rem auto 0' }}>
                    View platform-wide statistics, active organisations, and system health.
                </p>
                <span className="dashboard-placeholder-label">Coming Soon</span>
            </div>
        </div>
    );
}
