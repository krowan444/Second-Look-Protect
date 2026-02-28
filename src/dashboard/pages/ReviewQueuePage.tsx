import { ClipboardList } from 'lucide-react';

export function ReviewQueuePage() {
    return (
        <div>
            <div className="dashboard-page-header">
                <h1 className="dashboard-page-title">Review Queue</h1>
                <p className="dashboard-page-subtitle">
                    Cases awaiting safeguarding review and triage.
                </p>
            </div>
            <div className="dashboard-placeholder-card">
                <div className="dashboard-placeholder-icon">
                    <ClipboardList />
                </div>
                <p className="dashboard-page-title" style={{ fontSize: '1.1rem' }}>
                    Review queue coming soon
                </p>
                <p className="dashboard-page-subtitle" style={{ textAlign: 'center', margin: '0.5rem auto 0' }}>
                    Triage, review, and assign cases from this queue.
                </p>
                <span className="dashboard-placeholder-label">Coming Soon</span>
            </div>
        </div>
    );
}
