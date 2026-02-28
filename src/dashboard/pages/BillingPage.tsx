import { CreditCard } from 'lucide-react';

export function BillingPage() {
    return (
        <div>
            <div className="dashboard-page-header">
                <h1 className="dashboard-page-title">Billing</h1>
                <p className="dashboard-page-subtitle">
                    Subscription management and payment history.
                </p>
            </div>
            <div className="dashboard-placeholder-card">
                <div className="dashboard-placeholder-icon">
                    <CreditCard />
                </div>
                <p className="dashboard-page-title" style={{ fontSize: '1.1rem' }}>
                    Billing coming soon
                </p>
                <p className="dashboard-page-subtitle" style={{ textAlign: 'center', margin: '0.5rem auto 0' }}>
                    Manage organisation subscriptions, invoices, and payment methods.
                </p>
                <span className="dashboard-placeholder-label">Coming Soon</span>
            </div>
        </div>
    );
}
