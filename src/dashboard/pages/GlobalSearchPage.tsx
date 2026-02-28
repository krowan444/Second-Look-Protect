import { Search } from 'lucide-react';

export function GlobalSearchPage() {
    return (
        <div>
            <div className="dashboard-page-header">
                <h1 className="dashboard-page-title">Global Search</h1>
                <p className="dashboard-page-subtitle">
                    Search across all cases, submissions, and organisations.
                </p>
            </div>
            <div className="dashboard-placeholder-card">
                <div className="dashboard-placeholder-icon">
                    <Search />
                </div>
                <p className="dashboard-page-title" style={{ fontSize: '1.1rem' }}>
                    Global search coming soon
                </p>
                <p className="dashboard-page-subtitle" style={{ textAlign: 'center', margin: '0.5rem auto 0' }}>
                    Find any case, user, or organisation across the entire platform.
                </p>
                <span className="dashboard-placeholder-label">Coming Soon</span>
            </div>
        </div>
    );
}
