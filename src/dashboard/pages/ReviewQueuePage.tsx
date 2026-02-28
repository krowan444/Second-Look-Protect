import React, { useState, useEffect, useCallback } from 'react';
import {
    ClipboardList, Loader2, AlertTriangle, ExternalLink, CheckCircle2,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import type { UserRole } from '../types';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface Submission {
    id: string;
    submitted_at: string;
    submission_type: string | null;
    status: string | null;
    risk_level: string | null;
    decision: string | null;
    category: string | null;
    resident_ref: string | null;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function statusLabel(s: string | null): string {
    if (!s) return 'Unknown';
    if (s === 'submitted') return 'New';
    return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function riskClass(level: string | null): string {
    switch (level?.toLowerCase()) {
        case 'high': return 'high';
        case 'medium': return 'medium';
        case 'low': return 'low';
        default: return 'unknown';
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

/** Sort: high-risk first, then newest */
function sortQueue(rows: Submission[]): Submission[] {
    return [...rows].sort((a, b) => {
        const aHigh = a.risk_level?.toLowerCase() === 'high' ? 0 : 1;
        const bHigh = b.risk_level?.toLowerCase() === 'high' ? 0 : 1;
        if (aHigh !== bHigh) return aHigh - bHigh;
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
    });
}

const REVIEW_ROLES: UserRole[] = ['org_admin', 'manager', 'safeguarding_lead', 'super_admin'];

/* ─── Component Props ─────────────────────────────────────────────────────── */

interface ReviewQueuePageProps {
    onNavigate?: (path: string) => void;
    userRole?: UserRole;
}

/* ─── Review Queue Page ───────────────────────────────────────────────────── */

export function ReviewQueuePage({ onNavigate, userRole }: ReviewQueuePageProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const canMarkInReview = userRole ? REVIEW_ROLES.includes(userRole) : false;

    /* ── Fetch data ───────────────────────────────────────────────────────── */
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const supabase = getSupabase();

            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) { setError('Not authenticated'); setLoading(false); return; }

            const { data: profile, error: profErr } = await supabase
                .from('profiles')
                .select('organisation_id, role')
                .eq('id', session.user.id)
                .single();

            if (profErr || !profile?.organisation_id) {
                setError('Could not determine your organisation.');
                setLoading(false);
                return;
            }

            /* ── Query: non-closed submissions ───────────────────────────── */
            let query = supabase
                .from('submissions')
                .select('id, submitted_at, submission_type, status, risk_level, decision, category, resident_ref')
                .neq('status', 'closed')
                .order('submitted_at', { ascending: false });

            // Org scope (skip for super_admin)
            if (profile.role !== 'super_admin') {
                query = query.eq('organisation_id', profile.organisation_id);
            }

            const { data: rows, error: qErr } = await query;
            if (qErr) throw qErr;

            setSubmissions(sortQueue(rows ?? []));
        } catch (err: any) {
            setError(err?.message ?? 'Failed to load review queue');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    /* ── Mark In Review ───────────────────────────────────────────────────── */
    async function handleMarkInReview(id: string) {
        setUpdatingId(id);
        try {
            const supabase = getSupabase();
            const { error: uErr } = await supabase
                .from('submissions')
                .update({ status: 'in_review' })
                .eq('id', id);

            if (uErr) throw uErr;

            // Update local state
            setSubmissions((prev) =>
                sortQueue(prev.map((s) => s.id === id ? { ...s, status: 'in_review' } : s))
            );
        } catch (err: any) {
            setError(err?.message ?? 'Failed to update status');
        } finally {
            setUpdatingId(null);
        }
    }

    /* ── Render ────────────────────────────────────────────────────────────── */
    return (
        <div>
            {/* Header */}
            <div className="dashboard-page-header">
                <h1 className="dashboard-page-title">Review Queue</h1>
                <p className="dashboard-page-subtitle">
                    Cases awaiting safeguarding review and triage. High-risk cases are shown first.
                </p>
            </div>

            {/* Content */}
            {loading ? (
                <div className="dashboard-overview-loading">
                    <Loader2 className="dashboard-overview-spinner-icon" />
                    <p>Loading review queue…</p>
                </div>
            ) : error ? (
                <div className="dashboard-overview-error">
                    <AlertTriangle size={20} />
                    <span>{error}</span>
                </div>
            ) : submissions.length === 0 ? (
                <div className="dashboard-placeholder-card">
                    <div className="dashboard-placeholder-icon">
                        <ClipboardList />
                    </div>
                    <p className="dashboard-page-title" style={{ fontSize: '1.1rem' }}>
                        Queue is clear
                    </p>
                    <p className="dashboard-page-subtitle" style={{ textAlign: 'center', margin: '0.5rem auto 0' }}>
                        No open cases require review right now — looking good.
                    </p>
                </div>
            ) : (
                <div className="dashboard-panel">
                    <div className="dashboard-panel-header">
                        <h2 className="dashboard-panel-title">
                            <ClipboardList size={16} className="dashboard-panel-title-icon" />
                            Open Cases
                        </h2>
                        <span className="dashboard-panel-count">{submissions.length}</span>
                    </div>
                    <div className="dashboard-panel-table-wrap">
                        <table className="dashboard-panel-table dashboard-cases-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Status</th>
                                    <th>Risk</th>
                                    <th>Decision</th>
                                    <th>Category</th>
                                    <th>Resident Ref</th>
                                    <th className="dashboard-th-actions">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {submissions.map((s) => (
                                    <tr key={s.id}>
                                        <td>{fmtDate(s.submitted_at)}</td>
                                        <td>{s.submission_type ?? '—'}</td>
                                        <td>
                                            <span className={`dashboard-status-badge status-${statusClass(s.status)}`}>
                                                {statusLabel(s.status)}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`dashboard-risk-badge risk-${riskClass(s.risk_level)}`}>
                                                {s.risk_level ?? '—'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`dashboard-decision-badge decision-${decisionClass(s.decision)}`}>
                                                {s.decision ?? '—'}
                                            </span>
                                        </td>
                                        <td>{s.category ?? '—'}</td>
                                        <td>{s.resident_ref ?? '—'}</td>
                                        <td className="dashboard-td-actions">
                                            <button
                                                className="dashboard-action-btn dashboard-action-btn--open"
                                                onClick={() => onNavigate?.(`/dashboard/cases/${s.id}`)}
                                                title="Open case"
                                            >
                                                <ExternalLink size={13} /> Open
                                            </button>
                                            {canMarkInReview && s.status?.toLowerCase() !== 'in_review' && (
                                                <button
                                                    className="dashboard-action-btn dashboard-action-btn--review"
                                                    onClick={() => handleMarkInReview(s.id)}
                                                    disabled={updatingId === s.id}
                                                    title="Mark as In Review"
                                                >
                                                    {updatingId === s.id
                                                        ? <Loader2 size={13} className="dashboard-action-spinner" />
                                                        : <CheckCircle2 size={13} />
                                                    }
                                                    {updatingId === s.id ? 'Updating…' : 'In Review'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
