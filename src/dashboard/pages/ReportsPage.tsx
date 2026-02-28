import { BarChart3 } from 'lucide-react';

export function ReportsPage() {
    return (
        <div>
            <div className="dashboard-page-header">
                <h1 className="dashboard-page-title">Reports</h1>
                <p className="dashboard-page-subtitle">
                    Safeguarding activity reports and compliance summaries.
                </p>
            </div>
            <div className="dashboard-placeholder-card">
                <div className="dashboard-placeholder-icon">
                    <BarChart3 />
                </div>
                <p className="dashboard-page-title" style={{ fontSize: '1.1rem' }}>
                    Reporting coming soon
                </p>
                <p className="dashboard-page-subtitle" style={{ textAlign: 'center', margin: '0.5rem auto 0' }}>
                    Generate and export safeguarding reports for your organisation.
                </p>
                <span className="dashboard-placeholder-label">Coming Soon</span>
            </div>
        </div>
    );
}
