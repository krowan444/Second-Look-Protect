import React, { useState, useEffect, useCallback } from 'react';
import {
    FolderOpen, Loader2, AlertTriangle, Search, X, Trash2,
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
    meta?: Record<string, any>;
    submitted_by: string | null;
}

interface Filters {
    status: string;
    risk_level: string;
    category: string;
    date_from: string;
    date_to: string;
    resident_ref: string;
}

const EMPTY_FILTERS: Filters = {
    status: '',
    risk_level: '',
    category: '',
    date_from: '',
    date_to: '',
    resident_ref: '',
};

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

function formatLabel(value: string | null | undefined): string {
    if (!value) return '—';
    return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─── Component Props ─────────────────────────────────────────────────────── */

interface CasesPageProps {
    onNavigate?: (path: string) => void;
    userRole?: UserRole;
}

/* ─── Cases Page ──────────────────────────────────────────────────────────── */

export function CasesPage({ onNavigate, userRole }: CasesPageProps) {
    const isSuperAdmin = userRole === 'super_admin';

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
    const [activeFilters, setActiveFilters] = useState<Filters>(EMPTY_FILTERS);
    const [triageFilter, setTriageFilter] = useState<'all' | 'needs_review' | 'closed'>('all');

    // Delete state (super admin only)
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    async function handleDeleteCase() {
        if (!deleteTargetId) return;
        setDeleting(true);
        setDeleteError(null);
        try {
            const supabase = getSupabase();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Not authenticated');
            const res = await fetch('/api/delete-case', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ case_id: deleteTargetId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to delete case.');
            setSubmissions(prev => prev.filter(s => s.id !== deleteTargetId));
            setDeleteTargetId(null);
            setDeleteConfirmText('');
        } catch (err: any) {
            setDeleteError(err?.message ?? 'Failed to delete case. Please try again.');
        } finally {
            setDeleting(false);
        }
    }


    /* ── Triage filtering (in-memory) ──────────────────────────────────────── */
    const filteredSubmissions = submissions.filter((s) => {
        if (triageFilter === 'needs_review') return s.status === 'new' || s.status === 'submitted';
        if (triageFilter === 'closed') return s.status === 'closed';
        return true;
    });
    const needsReviewCount = submissions.filter((s) => s.status === 'new' || s.status === 'submitted').length;
    const closedCount = submissions.filter((s) => s.status === 'closed').length;

    /* ── Fetch data ───────────────────────────────────────────────────────── */
    const fetchData = useCallback(async (f: Filters) => {
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

            if (profErr) {
                setError('Could not determine your organisation.');
                setLoading(false);
                return;
            }

            /* Resolve org id — super_admin uses the switcher */
            let resolvedOrgId = profile?.organisation_id;
            const viewingAs = localStorage.getItem('slp_viewing_as_org_id');
            const activeOrg = localStorage.getItem('slp_active_org_id');
            if (viewingAs) {
                resolvedOrgId = viewingAs;
            } else if (activeOrg) {
                resolvedOrgId = activeOrg;
            }

            if (!resolvedOrgId) {
                setError('Could not determine your organisation.');
                setLoading(false);
                return;
            }

            /* ── Build query ─────────────────────────────────────────────── */
            let query = supabase
                .from('cases')
                .select('id, submitted_at, submission_type, status, risk_level, decision, category, resident_ref, meta, submitted_by')
                .order('submitted_at', { ascending: false })
                .eq('organisation_id', resolvedOrgId);

            // Apply filters
            if (f.status) {
                query = query.eq('status', f.status);
            }
            if (f.risk_level) {
                query = query.eq('risk_level', f.risk_level);
            }
            if (f.category) {
                query = query.eq('category', f.category);
            }
            if (f.date_from) {
                query = query.gte('submitted_at', new Date(f.date_from).toISOString());
            }
            if (f.date_to) {
                // End of selected day
                const end = new Date(f.date_to);
                end.setHours(23, 59, 59, 999);
                query = query.lte('submitted_at', end.toISOString());
            }
            if (f.resident_ref) {
                query = query.ilike('resident_ref', `%${f.resident_ref}%`);
            }

            const { data: rows, error: qErr } = await query;
            if (qErr) throw qErr;

            setSubmissions(rows ?? []);
        } catch (err: any) {
            setError(err?.message ?? 'Failed to load cases');
        } finally {
            setLoading(false);
        }
    }, []);

    /* ── Initial load ─────────────────────────────────────────────────────── */
    useEffect(() => {
        fetchData(EMPTY_FILTERS);
    }, [fetchData]);

    /* ── Filter actions ───────────────────────────────────────────────────── */
    function applyFilters() {
        setActiveFilters({ ...filters });
        fetchData(filters);
    }

    function clearFilters() {
        setFilters(EMPTY_FILTERS);
        setActiveFilters(EMPTY_FILTERS);
        fetchData(EMPTY_FILTERS);
    }

    function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
        setFilters((prev) => ({ ...prev, [key]: value }));
    }

    const hasActiveFilters = Object.values(activeFilters).some((v) => v !== '');

    /* ── Render ────────────────────────────────────────────────────────────── */
    return (
        <div>
            {/* Header */}
            <div className="dashboard-page-header">
                <h1 className="dashboard-page-title">Cases</h1>
                <p className="dashboard-page-subtitle">
                    All cases within your organisation. Filter, sort, and click any row to view details.
                </p>
            </div>

            {/* ── Filter Bar ─────────────────────────────────────────────────── */}
            <div className="dashboard-filter-bar">
                <div className="dashboard-filter-row">
                    <div className="dashboard-filter-field">
                        <label className="dashboard-filter-label">Status</label>
                        <select
                            className="dashboard-filter-select"
                            value={filters.status}
                            onChange={(e) => updateFilter('status', e.target.value)}
                        >
                            <option value="">All</option>
                            <option value="new">New</option>
                            <option value="in_review">In Review</option>
                            <option value="closed">Closed</option>
                        </select>
                    </div>

                    <div className="dashboard-filter-field">
                        <label className="dashboard-filter-label">Risk Level</label>
                        <select
                            className="dashboard-filter-select"
                            value={filters.risk_level}
                            onChange={(e) => updateFilter('risk_level', e.target.value)}
                        >
                            <option value="">All</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                    </div>

                    <div className="dashboard-filter-field">
                        <label className="dashboard-filter-label">Category</label>
                        <select
                            className="dashboard-filter-select"
                            value={filters.category}
                            onChange={(e) => updateFilter('category', e.target.value)}
                        >
                            <option value="">All</option>
                            <option value="financial">Financial</option>
                            <option value="romance">Romance</option>
                            <option value="phishing">Phishing</option>
                            <option value="impersonation">Impersonation</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    <div className="dashboard-filter-field">
                        <label className="dashboard-filter-label">From</label>
                        <input
                            type="date"
                            className="dashboard-filter-input"
                            value={filters.date_from}
                            onChange={(e) => updateFilter('date_from', e.target.value)}
                        />
                    </div>

                    <div className="dashboard-filter-field">
                        <label className="dashboard-filter-label">To</label>
                        <input
                            type="date"
                            className="dashboard-filter-input"
                            value={filters.date_to}
                            onChange={(e) => updateFilter('date_to', e.target.value)}
                        />
                    </div>

                    <div className="dashboard-filter-field dashboard-filter-field--search">
                        <label className="dashboard-filter-label">Resident Ref</label>
                        <div className="dashboard-filter-search-wrap">
                            <Search size={14} className="dashboard-filter-search-icon" />
                            <input
                                type="text"
                                className="dashboard-filter-input dashboard-filter-input--search"
                                placeholder="Search…"
                                value={filters.resident_ref}
                                onChange={(e) => updateFilter('resident_ref', e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
                            />
                        </div>
                    </div>
                </div>

                <div className="dashboard-filter-actions">
                    <button className="dashboard-filter-apply" onClick={applyFilters}>
                        <Search size={14} /> Apply Filters
                    </button>
                    {hasActiveFilters && (
                        <button className="dashboard-filter-clear" onClick={clearFilters}>
                            <X size={14} /> Clear
                        </button>
                    )}
                </div>
            </div>

            {/* ── Content ────────────────────────────────────────────────────── */}
            {loading ? (
                <div className="dashboard-overview-loading">
                    <Loader2 className="dashboard-overview-spinner-icon" />
                    <p>Loading cases…</p>
                </div>
            ) : error ? (
                <div className="dashboard-overview-error">
                    <AlertTriangle size={20} />
                    <span>{error}</span>
                </div>
            ) : filteredSubmissions.length === 0 && submissions.length === 0 ? (
                <div className="dashboard-placeholder-card">
                    <div className="dashboard-placeholder-icon">
                        <FolderOpen />
                    </div>
                    <p className="dashboard-page-title" style={{ fontSize: '1.1rem' }}>
                        No cases found
                    </p>
                    <p className="dashboard-page-subtitle" style={{ textAlign: 'center', margin: '0.5rem auto 0' }}>
                        {hasActiveFilters
                            ? 'No cases match the current filters. Try adjusting your search.'
                            : 'No cases have been submitted yet.'}
                    </p>
                </div>
            ) : (
                <div className="dashboard-panel">
                    <div className="dashboard-panel-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                        <h2 className="dashboard-panel-title">
                            <FolderOpen size={16} className="dashboard-panel-title-icon" />
                            {triageFilter === 'all' ? 'All Cases' : triageFilter === 'needs_review' ? 'Needs Review' : 'Closed Cases'}
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
                            {(['all', 'needs_review', 'closed'] as const).map((key) => {
                                const label = key === 'all' ? 'All' : key === 'needs_review' ? 'Needs Review' : 'Closed';
                                const count = key === 'all' ? submissions.length : key === 'needs_review' ? needsReviewCount : closedCount;
                                const isActive = triageFilter === key;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setTriageFilter(key)}
                                        style={{
                                            padding: '0.35rem 0.85rem',
                                            fontSize: '0.78rem',
                                            fontWeight: isActive ? 600 : 400,
                                            fontFamily: "'Inter', system-ui, sans-serif",
                                            border: isActive ? '1px solid #C9A84C' : '1px solid #e2e8f0',
                                            borderRadius: '6px',
                                            background: isActive ? '#0B1E36' : '#ffffff',
                                            color: isActive ? '#C9A84C' : '#64748b',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                        }}
                                    >
                                        {label} ({count})
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    {filteredSubmissions.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
                            No cases match the "{triageFilter === 'needs_review' ? 'Needs Review' : 'Closed'}" filter.
                        </div>
                    ) : (
                        <div className="dashboard-panel-table-wrap" style={{ overflowX: 'auto' }}>
                            <table className="dashboard-panel-table dashboard-cases-table" style={{ minWidth: '1100px' }}>
                                <thead>
                                    <tr>
                                        <th style={{ minWidth: '120px' }}>Date</th>
                                        <th style={{ minWidth: '200px' }}>Type</th>
                                        <th style={{ minWidth: '120px' }}>Status</th>
                                        <th style={{ minWidth: '140px' }}>Review</th>
                                        <th style={{ minWidth: '100px' }}>Risk</th>
                                        <th style={{ minWidth: '160px' }}>Decision</th>
                                        <th style={{ minWidth: '90px' }}>Evidence</th>
                                        <th style={{ minWidth: '140px' }}>Submitted By</th>
                                        <th style={{ minWidth: '130px' }}>Resident Ref</th>
                                        {isSuperAdmin && <th style={{ minWidth: '60px', textAlign: 'center' }}>Delete</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSubmissions.map((s) => {
                                        const evidenceCount = Array.isArray(s.meta?.evidence) ? s.meta!.evidence.length : 0;
                                        const needsReview = s.status === 'new' || s.status === 'submitted';
                                        const submittedBy = s.submitted_by ? s.submitted_by.slice(0, 8) + '…' : '—';
                                        return (
                                            <tr
                                                key={s.id}
                                                className="dashboard-row-clickable"
                                                onClick={() => onNavigate?.(`/dashboard/cases/${s.id}`)}
                                            >
                                                <td>{fmtDate(s.submitted_at)}</td>
                                                <td>{formatLabel(s.submission_type)}</td>
                                                <td>
                                                    <span className={`dashboard-status-badge status-${statusClass(s.status)}`}>
                                                        {statusLabel(s.status)}
                                                    </span>
                                                </td>
                                                <td>
                                                    {needsReview ? (
                                                        <span className="dashboard-status-badge status-new" style={{ fontSize: '0.68rem' }}>Needs Review</span>
                                                    ) : (
                                                        <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>—</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className={`dashboard-risk-badge risk-${riskClass(s.risk_level)}`}>
                                                        {s.risk_level ?? '—'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`dashboard-decision-badge decision-${decisionClass(s.decision)}`}>
                                                        {formatLabel(s.decision)}
                                                    </span>
                                                </td>
                                                <td>{evidenceCount}</td>
                                                <td style={{ fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: '0.75rem', color: '#64748b' }}>{submittedBy}</td>
                                                <td>{s.resident_ref ?? '—'}</td>
                                                {isSuperAdmin && (
                                                    <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                                        <button
                                                            title="Delete case"
                                                            onClick={() => { setDeleteTargetId(s.id); setDeleteConfirmText(''); setDeleteError(null); }}
                                                            style={{
                                                                background: 'none', border: '1px solid #fecaca', borderRadius: '6px',
                                                                padding: '0.25rem 0.4rem', cursor: 'pointer', color: '#b91c1c',
                                                                display: 'inline-flex', alignItems: 'center',
                                                            }}
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Delete confirmation modal (super admin only) */}
            {deleteTargetId && isSuperAdmin && (
                <>
                    <div
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }}
                        onClick={() => { if (!deleting) { setDeleteTargetId(null); setDeleteConfirmText(''); setDeleteError(null); } }}
                    />
                    <div style={{
                        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                        background: '#fff', borderRadius: '12px', padding: '1.75rem', width: '90%', maxWidth: '460px',
                        zIndex: 201, boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                            <Trash2 size={20} style={{ color: '#b91c1c', flexShrink: 0 }} />
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>Delete Case</h3>
                        </div>
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1rem' }}>
                            <p style={{ margin: 0, fontSize: '0.88rem', color: '#991b1b', lineHeight: 1.5 }}>
                                <strong>This will permanently delete this case and all associated data</strong>,
                                including AI triage, reviews, actions, notes, and timeline entries.
                                This action cannot be undone.
                            </p>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                                Type <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '3px', color: '#b91c1c', fontWeight: 700 }}>DELETE</code> to confirm
                            </label>
                            <input
                                type="text"
                                className="dashboard-filter-input"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                placeholder="Type DELETE here"
                                autoFocus
                                disabled={deleting}
                            />
                        </div>
                        {deleteError && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#b91c1c', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                                <AlertTriangle size={14} /> {deleteError}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={handleDeleteCase}
                                disabled={deleteConfirmText !== 'DELETE' || deleting}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                    padding: '0.45rem 1rem', borderRadius: '7px', fontSize: '0.84rem', fontWeight: 600,
                                    border: 'none', cursor: deleteConfirmText === 'DELETE' && !deleting ? 'pointer' : 'not-allowed',
                                    background: deleteConfirmText === 'DELETE' && !deleting ? '#b91c1c' : '#f1f5f9',
                                    color: deleteConfirmText === 'DELETE' && !deleting ? '#fff' : '#94a3b8',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                {deleting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
                                {deleting ? 'Deleting\u2026' : 'Confirm Delete'}
                            </button>
                            <button
                                onClick={() => { setDeleteTargetId(null); setDeleteConfirmText(''); setDeleteError(null); }}
                                disabled={deleting}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                    padding: '0.45rem 1rem', borderRadius: '7px', fontSize: '0.84rem', fontWeight: 600,
                                    border: '1px solid #e2e8f0', cursor: 'pointer',
                                    background: '#f1f5f9', color: '#334155',
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

