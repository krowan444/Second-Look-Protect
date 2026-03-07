import React, { useState, useEffect, useCallback } from 'react';
import { FolderOpen, Loader2, AlertTriangle, Eye } from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface MyCase {
    id: string;
    submitted_at: string;
    submission_type: string | null;
    status: string | null;
    decision: string | null;
    meta?: Record<string, any>;
}

interface MyCasesPageProps {
    onNavigate?: (path: string) => void;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function statusLabel(s: string | null): string {
    if (!s) return 'Unknown';
    switch (s.toLowerCase()) {
        case 'new':
        case 'submitted': return 'Needs Review';
        case 'in_review': return 'In Review';
        case 'closed': return 'Closed';
        default: return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
}

function statusClass(s: string | null): string {
    switch (s?.toLowerCase()) {
        case 'new':
        case 'submitted': return 'new';
        case 'in_review': return 'review';
        case 'closed': return 'closed';
        default: return 'default';
    }
}

function decisionClass(d: string | null): string {
    switch (d?.toLowerCase()) {
        case 'scam': return 'scam';
        case 'legit': return 'legit';
        default: return 'default';
    }
}

function fmtDate(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
    } catch {
        return '—';
    }
}

function formatLabel(value: string | null | undefined): string {
    if (!value) return '—';
    return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─── My Cases Page ──────────────────────────────────────────────────────── */

export function MyCasesPage({ onNavigate }: MyCasesPageProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cases, setCases] = useState<MyCase[]>([]);

    const fetchMyCases = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const supabase = getSupabase();

            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) { setError('Not authenticated'); setLoading(false); return; }

            const { data: rows, error: qErr } = await supabase
                .from('cases')
                .select('id, submitted_at, submission_type, status, decision, meta')
                .eq('submitted_by', session.user.id)
                .order('submitted_at', { ascending: false });

            if (qErr) throw qErr;
            setCases(rows ?? []);
        } catch (err: any) {
            setError(err?.message ?? 'Failed to load your cases');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchMyCases(); }, [fetchMyCases]);

    return (
        <div>
            <div className="dashboard-page-header">
                <h1 className="dashboard-page-title">My Cases</h1>
                <p className="dashboard-page-subtitle">
                    Track the status of cases you've submitted.
                </p>
            </div>

            {loading ? (
                <div className="dashboard-overview-loading">
                    <Loader2 className="dashboard-overview-spinner-icon" />
                    <p>Loading your cases…</p>
                </div>
            ) : error ? (
                <div className="dashboard-overview-error">
                    <AlertTriangle size={20} />
                    <span>{error}</span>
                </div>
            ) : cases.length === 0 ? (
                <div className="dashboard-placeholder-card">
                    <div className="dashboard-placeholder-icon">
                        <FolderOpen />
                    </div>
                    <p className="dashboard-page-title" style={{ fontSize: '1.1rem' }}>
                        No cases submitted yet
                    </p>
                    <p className="dashboard-page-subtitle" style={{ textAlign: 'center', margin: '0.5rem auto 0' }}>
                        Cases you submit will appear here so you can track their status.
                    </p>
                </div>
            ) : (
                <div className="dashboard-panel">
                    <div className="dashboard-panel-header">
                        <h2 className="dashboard-panel-title">
                            <FolderOpen size={16} className="dashboard-panel-title-icon" />
                            My Submitted Cases
                        </h2>
                        <span className="dashboard-panel-count">{cases.length}</span>
                    </div>
                    <div className="dashboard-panel-table-wrap">
                        <table className="dashboard-panel-table dashboard-cases-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Status</th>
                                    <th>Decision</th>
                                    <th>Evidence</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cases.map((c) => {
                                    const evidenceCount = Array.isArray(c.meta?.evidence) ? c.meta!.evidence.length : 0;
                                    return (
                                        <tr key={c.id} className="dashboard-row-clickable" onClick={() => onNavigate?.(`/dashboard/cases/${c.id}`)}>
                                            <td>{fmtDate(c.submitted_at)}</td>
                                            <td>{formatLabel(c.submission_type)}</td>
                                            <td>
                                                <span className={`dashboard-status-badge status-${statusClass(c.status)}`}>
                                                    {statusLabel(c.status)}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`dashboard-decision-badge decision-${decisionClass(c.decision)}`}>
                                                    {formatLabel(c.decision)}
                                                </span>
                                            </td>
                                            <td>{evidenceCount}</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="casedetail-evidence-btn"
                                                    onClick={(e) => { e.stopPropagation(); onNavigate?.(`/dashboard/cases/${c.id}`); }}
                                                >
                                                    <Eye size={13} /> View
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
