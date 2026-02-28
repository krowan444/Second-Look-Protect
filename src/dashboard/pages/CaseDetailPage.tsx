import React, { useState, useEffect, useCallback } from 'react';
import {
    ArrowLeft, Loader2, AlertTriangle, CheckCircle2, Lock,
    FileText, Image as ImageIcon, Clock, User, Shield, Activity,
    Send, XCircle,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import type { UserRole } from '../types';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface SubmissionRow {
    id: string;
    organisation_id: string;
    submitted_by: string | null;
    submitted_at: string;
    submission_type: string | null;
    message: string | null;         // content_text lives in "message"
    attachment_url: string | null;
    resident_ref: string | null;
    status: string | null;
    reviewed_at: string | null;
    closed_at: string | null;
    category: string | null;
    risk_level: string | null;
    decision: string | null;
    outcome: string | null;
    reviewer_notes: string | null;
}

interface CaseReview {
    id: string;
    reviewed_at: string;
    reviewed_by: string | null;
    category: string | null;
    risk_level: string | null;
    decision: string | null;
    outcome: string | null;
    notes: string | null;
}

interface CaseAction {
    id: string;
    action_type: string;
    action_notes: string | null;
    actor_id: string | null;
    created_at: string;
}

/* ─── Constants ───────────────────────────────────────────────────────────── */

const REVIEW_ROLES: UserRole[] = ['org_admin', 'manager', 'safeguarding_lead', 'super_admin'];

const CATEGORY_OPTIONS = ['financial', 'romance', 'phishing', 'impersonation', 'other'];
const RISK_OPTIONS = ['low', 'medium', 'high'];
const DECISION_OPTIONS = ['scam', 'legit', 'unsure'];
const OUTCOME_OPTIONS = ['none', 'prevented', 'lost', 'escalated'];

const ACTION_TYPES = [
    { value: 'family_notified', label: 'Family Notified' },
    { value: 'bank_contacted', label: 'Bank Contacted' },
    { value: 'police_reported', label: 'Police Reported' },
    { value: 'safeguarding_review', label: 'Safeguarding Review' },
    { value: 'other', label: 'Other' },
];

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function fmtDateTime(iso: string | null): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('en-GB', {
            day: 'numeric', month: 'short', year: '2-digit',
            hour: '2-digit', minute: '2-digit',
        });
    } catch { return '—'; }
}

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
        case 'new': case 'submitted': return 'new';
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

function isImageUrl(url: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(url);
}

/* ─── Component Props ─────────────────────────────────────────────────────── */

interface CaseDetailPageProps {
    caseId: string;
    onNavigate?: (path: string) => void;
    userRole?: UserRole;
}

/* ─── Case Detail Page ────────────────────────────────────────────────────── */

export function CaseDetailPage({ caseId, onNavigate, userRole }: CaseDetailPageProps) {
    /* ── State ────────────────────────────────────────────────────────────── */
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submission, setSubmission] = useState<SubmissionRow | null>(null);
    const [reviews, setReviews] = useState<CaseReview[]>([]);
    const [actions, setActions] = useState<CaseAction[]>([]);
    const [uid, setUid] = useState<string>('');

    // Review form state
    const [rCategory, setRCategory] = useState('');
    const [rRisk, setRRisk] = useState('');
    const [rDecision, setRDecision] = useState('');
    const [rOutcome, setROutcome] = useState('');
    const [rNotes, setRNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [closing, setClosing] = useState(false);
    const [reviewError, setReviewError] = useState<string | null>(null);
    const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);

    // Action log state
    const [actionType, setActionType] = useState('');
    const [actionNotes, setActionNotes] = useState('');
    const [actionSaving, setActionSaving] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);

    const canReview = userRole ? REVIEW_ROLES.includes(userRole) : false;

    /* ── Fetch everything ─────────────────────────────────────────────────── */
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const supabase = getSupabase();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) { setError('Not authenticated'); setLoading(false); return; }
            setUid(session.user.id);

            // 1. Fetch submission
            const { data: sub, error: subErr } = await supabase
                .from('submissions')
                .select('*')
                .eq('id', caseId)
                .single();

            if (subErr || !sub) {
                setError('Case not found.');
                setLoading(false);
                return;
            }
            setSubmission(sub as SubmissionRow);

            // Pre-fill review form from current values
            setRCategory(sub.category ?? '');
            setRRisk(sub.risk_level ?? '');
            setRDecision(sub.decision ?? '');
            setROutcome(sub.outcome ?? '');
            setRNotes(sub.reviewer_notes ?? '');

            // 2. Fetch review history
            const { data: revs } = await supabase
                .from('case_reviews')
                .select('id, reviewed_at, reviewed_by, category, risk_level, decision, outcome, notes')
                .eq('case_id', caseId)
                .order('reviewed_at', { ascending: false });
            setReviews((revs ?? []) as CaseReview[]);

            // 3. Fetch action log
            const { data: acts } = await supabase
                .from('case_actions')
                .select('id, action_type, action_notes, actor_id, created_at')
                .eq('case_id', caseId)
                .order('created_at', { ascending: false });
            setActions((acts ?? []) as CaseAction[]);

        } catch (err: any) {
            setError(err?.message ?? 'Failed to load case');
        } finally {
            setLoading(false);
        }
    }, [caseId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    /* ── Save Review (DUAL WRITE) ─────────────────────────────────────────── */
    async function handleSaveReview() {
        if (!submission) return;
        setSaving(true);
        setReviewError(null);
        setReviewSuccess(null);
        try {
            const supabase = getSupabase();
            const now = new Date().toISOString();

            // 1) INSERT into case_reviews
            const { error: insErr } = await supabase.from('case_reviews').insert({
                case_id: caseId,
                organisation_id: submission.organisation_id,
                reviewed_by: uid,
                reviewed_at: now,
                category: rCategory || null,
                risk_level: rRisk || null,
                decision: rDecision || null,
                outcome: rOutcome || null,
                notes: rNotes || null,
            });
            if (insErr) throw insErr;

            // 2) UPDATE submissions current fields
            const { error: updErr } = await supabase.from('submissions').update({
                category: rCategory || null,
                risk_level: rRisk || null,
                decision: rDecision || null,
                outcome: rOutcome || null,
                reviewer_notes: rNotes || null,
                status: 'in_review',
                reviewed_at: submission.reviewed_at ?? now,
            }).eq('id', caseId);
            if (updErr) throw updErr;

            setReviewSuccess('Review saved successfully.');
            await fetchData();
        } catch (err: any) {
            setReviewError(err?.message ?? 'Failed to save review');
        } finally {
            setSaving(false);
        }
    }

    /* ── Close Case (DUAL WRITE) ──────────────────────────────────────────── */
    async function handleCloseCase() {
        if (!submission) return;

        // Client-side validation: decision must not be null
        if (!rDecision) {
            setReviewError('A decision is required before closing the case.');
            return;
        }

        setClosing(true);
        setReviewError(null);
        setReviewSuccess(null);
        try {
            const supabase = getSupabase();
            const now = new Date().toISOString();

            // 1) INSERT snapshot into case_reviews
            const { error: insErr } = await supabase.from('case_reviews').insert({
                case_id: caseId,
                organisation_id: submission.organisation_id,
                reviewed_by: uid,
                reviewed_at: now,
                category: rCategory || null,
                risk_level: rRisk || null,
                decision: rDecision || null,
                outcome: rOutcome || null,
                notes: rNotes || null,
            });
            if (insErr) throw insErr;

            // 2) UPDATE submissions
            const { error: updErr } = await supabase.from('submissions').update({
                category: rCategory || null,
                risk_level: rRisk || null,
                decision: rDecision || null,
                outcome: rOutcome || null,
                reviewer_notes: rNotes || null,
                status: 'closed',
                closed_at: now,
                reviewed_at: submission.reviewed_at ?? now,
            }).eq('id', caseId);
            if (updErr) throw updErr;

            setReviewSuccess('Case closed successfully.');
            await fetchData();
        } catch (err: any) {
            setReviewError(err?.message ?? 'Failed to close case');
        } finally {
            setClosing(false);
        }
    }

    /* ── Log Action (append-only) ─────────────────────────────────────────── */
    async function handleLogAction() {
        if (!submission || !actionType) return;
        setActionSaving(true);
        setActionError(null);
        setActionSuccess(null);
        try {
            const supabase = getSupabase();
            const { error: insErr } = await supabase.from('case_actions').insert({
                case_id: caseId,
                organisation_id: submission.organisation_id,
                actor_id: uid,
                action_type: actionType,
                action_notes: actionNotes || null,
                created_at: new Date().toISOString(),
            });
            if (insErr) throw insErr;

            setActionSuccess('Action logged.');
            setActionType('');
            setActionNotes('');
            await fetchData();
        } catch (err: any) {
            setActionError(err?.message ?? 'Failed to log action');
        } finally {
            setActionSaving(false);
        }
    }

    /* ── Render ────────────────────────────────────────────────────────────── */

    if (loading) {
        return (
            <div className="dashboard-overview-loading">
                <Loader2 className="dashboard-overview-spinner-icon" />
                <p>Loading case…</p>
            </div>
        );
    }

    if (error || !submission) {
        return (
            <div>
                <button className="casedetail-back" onClick={() => onNavigate?.('/dashboard/cases')}>
                    <ArrowLeft size={16} /> Back to Cases
                </button>
                <div className="dashboard-overview-error" style={{ marginTop: '1rem' }}>
                    <AlertTriangle size={20} />
                    <span>{error ?? 'Case not found'}</span>
                </div>
            </div>
        );
    }

    const isClosed = submission.status === 'closed';

    return (
        <div>
            {/* Header */}
            <div className="casedetail-header">
                <button className="casedetail-back" onClick={() => onNavigate?.('/dashboard/cases')}>
                    <ArrowLeft size={16} /> Back to Cases
                </button>
                <div className="casedetail-header-row">
                    <div>
                        <h1 className="dashboard-page-title">Case Detail</h1>
                        <p className="dashboard-page-subtitle">
                            <span className="casedetail-id-label">ID:</span>{' '}
                            <code className="casedetail-id-code">{caseId.slice(0, 8)}…</code>
                        </p>
                    </div>
                    <span className={`dashboard-status-badge status-${statusClass(submission.status)}`} style={{ fontSize: '0.82rem', padding: '0.3rem 0.8rem' }}>
                        {statusLabel(submission.status)}
                    </span>
                </div>
            </div>

            {/* ── Two-column grid ──────────────────────────────────────────── */}
            <div className="casedetail-grid">

                {/* ════ LEFT COLUMN ════ */}
                <div className="casedetail-left">

                    {/* A) Submission */}
                    <div className="casedetail-section">
                        <h2 className="casedetail-section-title">
                            <FileText size={16} /> Submission
                        </h2>
                        <div className="casedetail-fields">
                            <div className="casedetail-field">
                                <span className="casedetail-field-label">Content</span>
                                <div className="casedetail-field-value casedetail-field-content">
                                    {submission.message || '—'}
                                </div>
                            </div>
                            {submission.attachment_url && (
                                <div className="casedetail-field">
                                    <span className="casedetail-field-label">Attachment</span>
                                    <div className="casedetail-field-value">
                                        {isImageUrl(submission.attachment_url) ? (
                                            <img
                                                src={submission.attachment_url}
                                                alt="Attachment"
                                                className="casedetail-attachment-img"
                                            />
                                        ) : (
                                            <a href={submission.attachment_url} target="_blank" rel="noopener noreferrer" className="casedetail-attachment-link">
                                                View Attachment ↗
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}
                            <div className="casedetail-field-row-inline">
                                <div className="casedetail-field">
                                    <span className="casedetail-field-label">Type</span>
                                    <span className="casedetail-field-value">{submission.submission_type ?? '—'}</span>
                                </div>
                                <div className="casedetail-field">
                                    <span className="casedetail-field-label">Resident Ref</span>
                                    <span className="casedetail-field-value">{submission.resident_ref ?? '—'}</span>
                                </div>
                            </div>
                            <div className="casedetail-field-row-inline">
                                <div className="casedetail-field">
                                    <span className="casedetail-field-label">Submitted By</span>
                                    <span className="casedetail-field-value casedetail-field-mono">{submission.submitted_by ? submission.submitted_by.slice(0, 8) + '…' : '—'}</span>
                                </div>
                                <div className="casedetail-field">
                                    <span className="casedetail-field-label">Submitted At</span>
                                    <span className="casedetail-field-value">{fmtDateTime(submission.submitted_at)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* B) Current Status */}
                    <div className="casedetail-section">
                        <h2 className="casedetail-section-title">
                            <Shield size={16} /> Current Status
                        </h2>
                        <div className="casedetail-status-grid">
                            <div className="casedetail-status-item">
                                <span className="casedetail-field-label">Status</span>
                                <span className={`dashboard-status-badge status-${statusClass(submission.status)}`}>
                                    {statusLabel(submission.status)}
                                </span>
                            </div>
                            <div className="casedetail-status-item">
                                <span className="casedetail-field-label">Risk Level</span>
                                <span className={`dashboard-risk-badge risk-${riskClass(submission.risk_level)}`}>
                                    {submission.risk_level ?? '—'}
                                </span>
                            </div>
                            <div className="casedetail-status-item">
                                <span className="casedetail-field-label">Decision</span>
                                <span className={`dashboard-decision-badge decision-${decisionClass(submission.decision)}`}>
                                    {submission.decision ?? '—'}
                                </span>
                            </div>
                            <div className="casedetail-status-item">
                                <span className="casedetail-field-label">Category</span>
                                <span className="casedetail-field-value">{submission.category ?? '—'}</span>
                            </div>
                            <div className="casedetail-status-item">
                                <span className="casedetail-field-label">Outcome</span>
                                <span className="casedetail-field-value">{submission.outcome ?? '—'}</span>
                            </div>
                            <div className="casedetail-status-item">
                                <span className="casedetail-field-label">Reviewed At</span>
                                <span className="casedetail-field-value">{fmtDateTime(submission.reviewed_at)}</span>
                            </div>
                            <div className="casedetail-status-item">
                                <span className="casedetail-field-label">Closed At</span>
                                <span className="casedetail-field-value">{fmtDateTime(submission.closed_at)}</span>
                            </div>
                        </div>
                    </div>

                    {/* E) Review History */}
                    <div className="casedetail-section">
                        <h2 className="casedetail-section-title">
                            <Clock size={16} /> Review History
                        </h2>
                        {reviews.length === 0 ? (
                            <p className="casedetail-empty">No reviews recorded yet.</p>
                        ) : (
                            <div className="casedetail-timeline">
                                {reviews.map((r) => (
                                    <div key={r.id} className="casedetail-timeline-item">
                                        <div className="casedetail-timeline-dot" />
                                        <div className="casedetail-timeline-content">
                                            <div className="casedetail-timeline-header">
                                                <span className="casedetail-timeline-date">{fmtDateTime(r.reviewed_at)}</span>
                                                <span className="casedetail-timeline-actor">
                                                    <User size={12} /> {r.reviewed_by ? r.reviewed_by.slice(0, 8) + '…' : '—'}
                                                </span>
                                            </div>
                                            <div className="casedetail-timeline-badges">
                                                {r.category && <span className="casedetail-timeline-tag">{r.category}</span>}
                                                {r.risk_level && <span className={`dashboard-risk-badge risk-${riskClass(r.risk_level)}`}>{r.risk_level}</span>}
                                                {r.decision && <span className={`dashboard-decision-badge decision-${decisionClass(r.decision)}`}>{r.decision}</span>}
                                                {r.outcome && <span className="casedetail-timeline-tag">{r.outcome}</span>}
                                            </div>
                                            {r.notes && <p className="casedetail-timeline-notes">{r.notes}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ════ RIGHT COLUMN ════ */}
                <div className="casedetail-right">

                    {/* C) Review Panel */}
                    {canReview ? (
                        <div className="casedetail-section casedetail-review-panel">
                            <h2 className="casedetail-section-title">
                                <Shield size={16} /> Review Panel
                            </h2>

                            {isClosed && (
                                <div className="casedetail-closed-notice">
                                    <Lock size={14} /> This case is closed. You may still save a new review snapshot.
                                </div>
                            )}

                            <div className="casedetail-review-form">
                                <div className="casedetail-form-field">
                                    <label className="casedetail-form-label">Category</label>
                                    <select className="dsf-input" value={rCategory} onChange={(e) => setRCategory(e.target.value)}>
                                        <option value="">— Select —</option>
                                        {CATEGORY_OPTIONS.map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                                    </select>
                                </div>
                                <div className="casedetail-form-field">
                                    <label className="casedetail-form-label">Risk Level</label>
                                    <select className="dsf-input" value={rRisk} onChange={(e) => setRRisk(e.target.value)}>
                                        <option value="">— Select —</option>
                                        {RISK_OPTIONS.map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                                    </select>
                                </div>
                                <div className="casedetail-form-field">
                                    <label className="casedetail-form-label">Decision</label>
                                    <select className="dsf-input" value={rDecision} onChange={(e) => setRDecision(e.target.value)}>
                                        <option value="">— Select —</option>
                                        {DECISION_OPTIONS.map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                                    </select>
                                </div>
                                <div className="casedetail-form-field">
                                    <label className="casedetail-form-label">Outcome</label>
                                    <select className="dsf-input" value={rOutcome} onChange={(e) => setROutcome(e.target.value)}>
                                        <option value="">— Select —</option>
                                        {OUTCOME_OPTIONS.map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                                    </select>
                                </div>
                                <div className="casedetail-form-field">
                                    <label className="casedetail-form-label">Reviewer Notes</label>
                                    <textarea
                                        className="dsf-textarea"
                                        rows={3}
                                        value={rNotes}
                                        onChange={(e) => setRNotes(e.target.value)}
                                        placeholder="Add review notes…"
                                    />
                                </div>

                                {/* Feedback */}
                                {reviewError && (
                                    <div className="dsf-error">
                                        <AlertTriangle size={14} /> <span>{reviewError}</span>
                                    </div>
                                )}
                                {reviewSuccess && (
                                    <div className="casedetail-success">
                                        <CheckCircle2 size={14} /> <span>{reviewSuccess}</span>
                                    </div>
                                )}

                                {/* Buttons */}
                                <div className="casedetail-review-actions">
                                    <button
                                        className="casedetail-btn casedetail-btn-save"
                                        onClick={handleSaveReview}
                                        disabled={saving || closing}
                                    >
                                        {saving ? <Loader2 size={15} className="dsf-spinner" /> : <CheckCircle2 size={15} />}
                                        {saving ? 'Saving…' : 'Save Review'}
                                    </button>
                                    <button
                                        className="casedetail-btn casedetail-btn-close"
                                        onClick={handleCloseCase}
                                        disabled={saving || closing}
                                    >
                                        {closing ? <Loader2 size={15} className="dsf-spinner" /> : <XCircle size={15} />}
                                        {closing ? 'Closing…' : 'Close Case'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="casedetail-section casedetail-review-locked">
                            <h2 className="casedetail-section-title">
                                <Lock size={16} /> Review Panel
                            </h2>
                            <p className="casedetail-empty">
                                You do not have permission to review cases. Contact your administrator for access.
                            </p>
                        </div>
                    )}

                    {/* D) Action Log */}
                    <div className="casedetail-section">
                        <h2 className="casedetail-section-title">
                            <Activity size={16} /> Action Log
                        </h2>

                        {/* Log new action form */}
                        <div className="casedetail-action-form">
                            <label className="casedetail-form-label">Action Type</label>
                            <div className="casedetail-action-btn-grid">
                                {ACTION_TYPES.map((a) => (
                                    <button
                                        key={a.value}
                                        type="button"
                                        className={`casedetail-action-type-btn${actionType === a.value ? ' casedetail-action-type-btn--active' : ''}`}
                                        onClick={() => setActionType(a.value)}
                                    >
                                        {a.label}
                                    </button>
                                ))}
                            </div>
                            <div className="casedetail-form-field" style={{ marginTop: '0.75rem' }}>
                                <label className="casedetail-form-label">Notes</label>
                                <textarea
                                    className="dsf-textarea"
                                    rows={2}
                                    value={actionNotes}
                                    onChange={(e) => setActionNotes(e.target.value)}
                                    placeholder="Optional notes…"
                                />
                            </div>

                            {actionError && (
                                <div className="dsf-error" style={{ marginTop: '0.5rem' }}>
                                    <AlertTriangle size={14} /> <span>{actionError}</span>
                                </div>
                            )}
                            {actionSuccess && (
                                <div className="casedetail-success" style={{ marginTop: '0.5rem' }}>
                                    <CheckCircle2 size={14} /> <span>{actionSuccess}</span>
                                </div>
                            )}

                            <button
                                className="casedetail-btn casedetail-btn-action"
                                onClick={handleLogAction}
                                disabled={!actionType || actionSaving}
                                style={{ marginTop: '0.75rem' }}
                            >
                                {actionSaving ? <Loader2 size={15} className="dsf-spinner" /> : <Send size={15} />}
                                {actionSaving ? 'Logging…' : 'Log Action'}
                            </button>
                        </div>

                        {/* Previous actions timeline */}
                        {actions.length > 0 && (
                            <div className="casedetail-timeline" style={{ marginTop: '1.25rem' }}>
                                {actions.map((a) => (
                                    <div key={a.id} className="casedetail-timeline-item">
                                        <div className="casedetail-timeline-dot casedetail-timeline-dot--action" />
                                        <div className="casedetail-timeline-content">
                                            <div className="casedetail-timeline-header">
                                                <span className="casedetail-timeline-date">{fmtDateTime(a.created_at)}</span>
                                                <span className="casedetail-timeline-actor">
                                                    <User size={12} /> {a.actor_id ? a.actor_id.slice(0, 8) + '…' : '—'}
                                                </span>
                                            </div>
                                            <span className="casedetail-timeline-tag casedetail-timeline-tag--action">
                                                {a.action_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                                            </span>
                                            {a.action_notes && <p className="casedetail-timeline-notes">{a.action_notes}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
