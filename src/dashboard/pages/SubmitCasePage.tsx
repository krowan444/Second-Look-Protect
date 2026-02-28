import { Upload } from 'lucide-react';

export function SubmitCasePage() {
    return (
        <div>
            <div className="dashboard-page-header">
                <h1 className="dashboard-page-title">Submit Case</h1>
                <p className="dashboard-page-subtitle">
                    Upload a suspicious message, link, or screenshot for expert review.
                </p>
            </div>
            <div className="dashboard-placeholder-card">
                <div className="dashboard-placeholder-icon">
                    <Upload />
                </div>
                <p className="dashboard-page-title" style={{ fontSize: '1.1rem' }}>
                    Case submission form coming soon
                </p>
                <p className="dashboard-page-subtitle" style={{ textAlign: 'center', margin: '0.5rem auto 0' }}>
                    You'll be able to submit images, URLs, and descriptions for safeguarding review.
                </p>
                <span className="dashboard-placeholder-label">Coming Soon</span>
            </div>
        </div>
    );
}
