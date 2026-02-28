import React, { useState, useEffect, useCallback } from 'react';
import {
    FolderOpen, Loader2, AlertTriangle, Search, X,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

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

/* ─── Component Props ─────────────────────────────────────────────────────── */

interface CasesPageProps {
    onNavigate?: (path: string) => void;
}

/* ─── Cases Page ──────────────────────────────────────────────────────────── */

export function CasesPage({ onNavigate }: CasesPageProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
    const [activeFilters, setActiveFilters] = useState<Filters>(EMPTY_FILTERS);

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

            if (profErr || !profile?.organisation_id) {
                setError('Could not determine your organisation.');
                setLoading(false);
                return;
            }

            /* ── Build query ─────────────────────────────────────────────── */
            let query = supabase
                .from('submissions')
                .select('id, submitted_at, submission_type, status, risk_level, decision, category, resident_ref')
                .order('submitted_at', { ascending: false });

            // Org scope (skip for super_admin)
            if (profile.role !== 'super_admin') {
                query = query.eq('organisation_id', profile.organisation_id);
            }

            // Apply filters
            if (f.status) {
                const dbStatus = f.status === 'new' ? 'submitted' : f.status;
                query = query.eq('status', dbStatus);
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
            ) : submissions.length === 0 ? (
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
                    <div className="dashboard-panel-header">
                        <h2 className="dashboard-panel-title">
                            <FolderOpen size={16} className="dashboard-panel-title-icon" />
                            All Cases
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
                                </tr>
                            </thead>
                            <tbody>
                                {submissions.map((s) => (
                                    <tr
                                        key={s.id}
                                        className="dashboard-row-clickable"
                                        onClick={() => onNavigate?.(`/dashboard/cases/${s.id}`)}
                                    >
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
