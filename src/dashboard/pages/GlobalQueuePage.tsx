import { ClipboardList } from 'lucide-react';

export function GlobalQueuePage() {
    return (
        <div>
            <div className="dashboard-page-header">
                <h1 className="dashboard-page-title">Global Queue</h1>
                <p className="dashboard-page-subtitle">
                    All pending reviews across every organisation.
                </p>
            </div>
            <div className="dashboard-placeholder-card">
                <div className="dashboard-placeholder-icon">
                    <ClipboardList />
                </div>
                <p className="dashboard-page-title" style={{ fontSize: '1.1rem' }}>
                    Global queue coming soon
                </p>
                <p className="dashboard-page-subtitle" style={{ textAlign: 'center', margin: '0.5rem auto 0' }}>
                    Monitor and triage cases across all organisations from a single view.
                </p>
                <span className="dashboard-placeholder-label">Coming Soon</span>
            </div>
        </div>
    );
}
