import React, { useState, useEffect, useCallback } from 'react';
import {
    ArrowLeft, Loader2, AlertTriangle, CheckCircle2, Lock,
    FileText, Image as ImageIcon, Clock, User, Shield, Activity,
    Send, XCircle, MessageSquare, Eye,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import type { UserRole } from '../types';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface CaseRow {
    id: string;
    organisation_id: string;
    submitted_by: string | null;
    submitted_at: string;
    submission_type: string | null;
    description: string | null;
    attachment_url: string | null;
    resident_ref: string | null;
    status: string | null;
    reviewed_at: string | null;
    closed_at: string | null;
    category: string | null;
    risk_level: string | null;
    decision: string | null;
    outcome: string | null;
    channel: string | null;
}

interface CaseReview {
    id: string;
    reviewed_at: string;
    created_at: string;
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

/** Merged timeline entry */
interface TimelineEntry {
    id: string;
    timestamp: string;
    type: 'system' | 'action' | 'review';
    title: string;
    who: string;
    notes: string | null;
    badges?: { category?: string | null; risk_level?: string | null; decision?: string | null; outcome?: string | null };
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
    if (s === 'submitted' || s === 'new') return 'New';
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

function friendlyActionType(t: string): string {
    return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
    const [caseData, setCaseData] = useState<CaseRow | null>(null);
    const [reviews, setReviews] = useState<CaseReview[]>([]);
    const [actions, setActions] = useState<CaseAction[]>([]);
    const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
    const [uid, setUid] = useState<string>('');
    const [orgId, setOrgId] = useState<string>('');
    const [viewingAsOrgName, setViewingAsOrgName] = useState<string | null>(null);

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

    // Action log modal state
    const [showActionModal, setShowActionModal] = useState(false);
    const [actionType, setActionType] = useState('');
    const [actionNotes, setActionNotes] = useState('');
    const [actionAttachUrl, setActionAttachUrl] = useState('');
    const [actionSaving, setActionSaving] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);

    // Compliance notes state
    const [complianceNote, setComplianceNote] = useState('');
    const [complianceSaving, setComplianceSaving] = useState(false);
    const [complianceError, setComplianceError] = useState<string | null>(null);
    const [complianceSuccess, setComplianceSuccess] = useState<string | null>(null);

    // Mark In Review state
    const [markingReview, setMarkingReview] = useState(false);

    const canReview = userRole ? REVIEW_ROLES.includes(userRole) : false;
    const isSuperAdmin = userRole === 'super_admin';

    /* ── Build merged timeline ───────────────────────────────────────────── */
    function buildTimeline(c: CaseRow, acts: CaseAction[], revs: CaseReview[]): TimelineEntry[] {
        const entries: TimelineEntry[] = [];

        // System event: Case Submitted
        entries.push({
            id: 'system-submitted',
            timestamp: c.submitted_at,
            type: 'system',
            title: 'Case Submitted',
            who: c.submitted_by ? c.submitted_by.slice(0, 8) + '…' : 'System',
            notes: null,
        });

        // Actions
        acts.forEach((a) => {
            entries.push({
                id: `action-${a.id}`,
                timestamp: a.created_at,
                type: 'action',
                title: friendlyActionType(a.action_type),
                who: a.actor_id ? a.actor_id.slice(0, 8) + '…' : '—',
                notes: a.action_notes,
            });
        });

        // Reviews
        revs.forEach((r) => {
            entries.push({
                id: `review-${r.id}`,
                timestamp: r.created_at || r.reviewed_at,
                type: 'review',
                title: 'Review',
                who: r.reviewed_by ? r.reviewed_by.slice(0, 8) + '…' : '—',
                notes: r.notes,
                badges: { category: r.category, risk_level: r.risk_level, decision: r.decision, outcome: r.outcome },
            });
        });

        // Sort newest first
        entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return entries;
    }

    /* ── Fetch everything ─────────────────────────────────────────────────── */
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const supabase = getSupabase();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) { setError('Not authenticated'); setLoading(false); return; }
            setUid(session.user.id);

            // Resolve org context
            const { data: profile } = await supabase
                .from('profiles')
                .select('organisation_id, role')
                .eq('id', session.user.id)
                .single();

            let resolvedOrgId = profile?.organisation_id ?? '';
            if (profile?.role === 'super_admin') {
                const switcherOrg = localStorage.getItem('slp_active_org_id');
                if (switcherOrg) {
                    resolvedOrgId = switcherOrg;
                    // Fetch org name for "Viewing as" badge
                    const { data: orgRow } = await supabase
                        .from('organisations')
                        .select('name')
                        .eq('id', switcherOrg)
                        .single();
                    setViewingAsOrgName(orgRow?.name ?? null);
                }
            }
            setOrgId(resolvedOrgId);

            // 1. Fetch case
            const { data: c, error: cErr } = await supabase
                .from('cases')
                .select('*')
                .eq('id', caseId)
                .eq('organisation_id', resolvedOrgId)
                .single();

            if (cErr || !c) {
                setError('Case not found.');
                setLoading(false);
                return;
            }
            setCaseData(c as CaseRow);

            // Pre-fill review form from current values
            setRCategory(c.category ?? '');
            setRRisk(c.risk_level ?? '');
            setRDecision(c.decision ?? '');
            setROutcome(c.outcome ?? '');
            setRNotes('');

            // 2. Fetch review history
            const { data: revs } = await supabase
                .from('case_reviews')
                .select('id, created_at, reviewed_by, reviewed_at, decision, outcome, risk_level, category, notes')
                .eq('case_id', caseId)
                .eq('organisation_id', resolvedOrgId)
                .order('created_at', { ascending: false });
            const revsTyped = (revs ?? []) as CaseReview[];
            setReviews(revsTyped);

            // 3. Fetch action log
            const { data: acts } = await supabase
                .from('case_actions')
                .select('id, created_at, actor_id, action_type, action_notes')
                .eq('case_id', caseId)
                .eq('organisation_id', resolvedOrgId)
                .order('created_at', { ascending: false });
            const actsTyped = (acts ?? []) as CaseAction[];
            setActions(actsTyped);

            // 4. Build merged timeline
            setTimeline(buildTimeline(c as CaseRow, actsTyped, revsTyped));

        } catch (err: any) {
            setError(err?.message ?? 'Failed to load case');
        } finally {
            setLoading(false);
        }
    }, [caseId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    /* ── Mark In Review ───────────────────────────────────────────────────── */
    async function handleMarkInReview() {
        if (!caseData) return;
        setMarkingReview(true);
        setReviewError(null);
        setReviewSuccess(null);
        try {
            const supabase = getSupabase();
            const now = new Date().toISOString();

            const { error: updErr } = await supabase.from('cases').update({
                status: 'in_review',
                reviewed_at: now,
            }).eq('id', caseId).eq('organisation_id', orgId);
            if (updErr) throw updErr;

            const { error: actErr } = await supabase.from('case_actions').insert({
                case_id: caseId,
                organisation_id: orgId,
                actor_id: uid,
                action_type: 'marked_in_review',
                action_notes: 'Marked case as In Review',
            });
            if (actErr) throw actErr;

            setReviewSuccess('Case marked as In Review.');
            await fetchData();
        } catch (err: any) {
            setReviewError(err?.message ?? 'Failed to mark in review');
        } finally {
            setMarkingReview(false);
        }
    }

    /* ── Save Review (DUAL WRITE) ─────────────────────────────────────────── */
    async function handleSaveReview() {
        if (!caseData) return;
        setSaving(true);
        setReviewError(null);
        setReviewSuccess(null);
        try {
            const supabase = getSupabase();
            const now = new Date().toISOString();

            // 1) INSERT into case_reviews
            const { error: insErr } = await supabase.from('case_reviews').insert({
                case_id: caseId,
                organisation_id: orgId,
                reviewed_by: uid,
                reviewed_at: now,
                category: rCategory || null,
                risk_level: rRisk || null,
                decision: rDecision || null,
                outcome: rOutcome || null,
                notes: rNotes || null,
            });
            if (insErr) throw insErr;

            // 2) UPDATE cases
            const { error: updErr } = await supabase.from('cases').update({
                category: rCategory || null,
                risk_level: rRisk || null,
                decision: rDecision || null,
                outcome: rOutcome || null,
                status: 'in_review',
                reviewed_at: caseData.reviewed_at ?? now,
            }).eq('id', caseId).eq('organisation_id', orgId);
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
        if (!caseData) return;

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
                organisation_id: orgId,
                reviewed_by: uid,
                reviewed_at: now,
                category: rCategory || null,
                risk_level: rRisk || null,
                decision: rDecision || null,
                outcome: rOutcome || null,
                notes: rNotes || null,
            });
            if (insErr) throw insErr;

            // 2) UPDATE cases
            const { error: updErr } = await supabase.from('cases').update({
                category: rCategory || null,
                risk_level: rRisk || null,
                decision: rDecision || null,
                outcome: rOutcome || null,
                status: 'closed',
                closed_at: now,
                reviewed_at: caseData.reviewed_at ?? now,
            }).eq('id', caseId).eq('organisation_id', orgId);
            if (updErr) throw updErr;

            // 3) Action log entry for case closure
            await supabase.from('case_actions').insert({
                case_id: caseId,
                organisation_id: orgId,
                actor_id: uid,
                action_type: 'case_closed',
                action_notes: 'Case closed',
            });

            setReviewSuccess('Case closed successfully.');
            await fetchData();
        } catch (err: any) {
            setReviewError(err?.message ?? 'Failed to close case');
        } finally {
            setClosing(false);
        }
    }

    /* ── Log Action (modal, append-only) ──────────────────────────────────── */
    async function handleLogAction() {
        if (!caseData || !actionType) return;
        setActionSaving(true);
        setActionError(null);
        setActionSuccess(null);
        try {
            const supabase = getSupabase();
            const label = ACTION_TYPES.find((a) => a.value === actionType)?.label ?? actionType;
            let combinedNotes = actionNotes ? `${label}: ${actionNotes}` : label;
            if (actionAttachUrl.trim()) {
                combinedNotes += `\nAttachment: ${actionAttachUrl.trim()}`;
            }

            const row: Record<string, unknown> = {
                case_id: caseId,
                organisation_id: orgId,
                actor_id: uid,
                action_type: 'action_logged',
                action_notes: combinedNotes,
            };

            const { error: insErr } = await supabase.from('case_actions').insert(row);
            if (insErr) throw insErr;

            setActionSuccess('Action logged.');
            setActionType('');
            setActionNotes('');
            setActionAttachUrl('');
            setShowActionModal(false);
            await fetchData();
        } catch (err: any) {
            setActionError(err?.message ?? 'Failed to log action');
        } finally {
            setActionSaving(false);
        }
    }

    /* ── Save Compliance / Safeguarding Note ──────────────────────────────── */
    async function handleSaveComplianceNote() {
        if (!complianceNote.trim()) return;
        setComplianceSaving(true);
        setComplianceError(null);
        setComplianceSuccess(null);
        try {
            const supabase = getSupabase();
            const { error: insErr } = await supabase.from('case_actions').insert({
                case_id: caseId,
                organisation_id: orgId,
                actor_id: uid,
                action_type: 'safeguarding_note',
                action_notes: complianceNote.trim(),
            });
            if (insErr) throw insErr;

            setComplianceSuccess('Safeguarding note saved.');
            setComplianceNote('');
            await fetchData();
        } catch (err: any) {
            setComplianceError(err?.message ?? 'Failed to save note');
        } finally {
            setComplianceSaving(false);
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

    if (error || !caseData) {
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

    const isClosed = caseData.status === 'closed';
    const isNew = caseData.status === 'new' || caseData.status === 'submitted';

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
                    <span className={`dashboard-status-badge status-${statusClass(caseData.status)}`} style={{ fontSize: '0.82rem', padding: '0.3rem 0.8rem' }}>
                        {statusLabel(caseData.status)}
                    </span>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* (A) CASE SUMMARY CARD                                         */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="casedetail-section" style={{ marginBottom: '1.5rem' }}>
                <h2 className="casedetail-section-title">
                    <FileText size={16} /> Case Summary
                </h2>
                <div className="casedetail-status-grid">
                    <div className="casedetail-status-item">
                        <span className="casedetail-field-label">Status</span>
                        <span className={`dashboard-status-badge status-${statusClass(caseData.status)}`}>
                            {statusLabel(caseData.status)}
                        </span>
                    </div>
                    <div className="casedetail-status-item">
                        <span className="casedetail-field-label">Risk Level</span>
                        <span className={`dashboard-risk-badge risk-${riskClass(caseData.risk_level)}`}>
                            {caseData.risk_level ?? '—'}
                        </span>
                    </div>
                    <div className="casedetail-status-item">
                        <span className="casedetail-field-label">Type</span>
                        <span className="casedetail-field-value">{caseData.submission_type ?? caseData.channel ?? '—'}</span>
                    </div>
                    <div className="casedetail-status-item">
                        <span className="casedetail-field-label">Submitted At</span>
                        <span className="casedetail-field-value">{fmtDateTime(caseData.submitted_at)}</span>
                    </div>
                    <div className="casedetail-status-item">
                        <span className="casedetail-field-label">Decision</span>
                        <span className={`dashboard-decision-badge decision-${decisionClass(caseData.decision)}`}>
                            {caseData.decision ?? '—'}
                        </span>
                    </div>
                    <div className="casedetail-status-item">
                        <span className="casedetail-field-label">Category</span>
                        <span className="casedetail-field-value">{caseData.category ?? '—'}</span>
                    </div>
                    <div className="casedetail-status-item">
                        <span className="casedetail-field-label">Outcome</span>
                        <span className="casedetail-field-value">{caseData.outcome ?? '—'}</span>
                    </div>
                    <div className="casedetail-status-item">
                        <span className="casedetail-field-label">Reviewed At</span>
                        <span className="casedetail-field-value">{fmtDateTime(caseData.reviewed_at)}</span>
                    </div>
                    <div className="casedetail-status-item">
                        <span className="casedetail-field-label">Closed At</span>
                        <span className="casedetail-field-value">{fmtDateTime(caseData.closed_at)}</span>
                    </div>
                </div>
                {/* Viewing as banner for super_admin */}
                {isSuperAdmin && viewingAsOrgName && (
                    <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', fontSize: '0.8rem', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Eye size={14} />
                        Viewing as: <strong>{viewingAsOrgName}</strong>
                    </div>
                )}
                {/* Submission content */}
                {caseData.description && (
                    <div className="casedetail-field" style={{ marginTop: '1rem' }}>
                        <span className="casedetail-field-label">Content</span>
                        <div className="casedetail-field-value casedetail-field-content">{caseData.description}</div>
                    </div>
                )}
                {caseData.attachment_url && (
                    <div className="casedetail-field" style={{ marginTop: '0.5rem' }}>
                        <span className="casedetail-field-label">Attachment</span>
                        <div className="casedetail-field-value">
                            {isImageUrl(caseData.attachment_url) ? (
                                <img src={caseData.attachment_url} alt="Attachment" className="casedetail-attachment-img" />
                            ) : (
                                <a href={caseData.attachment_url} target="_blank" rel="noopener noreferrer" className="casedetail-attachment-link">View Attachment ↗</a>
                            )}
                        </div>
                    </div>
                )}
                {caseData.resident_ref && (
                    <div className="casedetail-field" style={{ marginTop: '0.5rem' }}>
                        <span className="casedetail-field-label">Resident Ref</span>
                        <span className="casedetail-field-value">{caseData.resident_ref}</span>
                    </div>
                )}
            </div>

            {/* ── Operational Buttons ────────────────────────────────────────── */}
            {canReview && (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                    {isNew && (
                        <button
                            className="casedetail-btn casedetail-btn-save"
                            onClick={handleMarkInReview}
                            disabled={markingReview}
                        >
                            {markingReview ? <Loader2 size={15} className="dsf-spinner" /> : <Eye size={15} />}
                            {markingReview ? 'Marking…' : 'Mark In Review'}
                        </button>
                    )}
                    <button
                        className="casedetail-btn casedetail-btn-action"
                        onClick={() => setShowActionModal(true)}
                    >
                        <Activity size={15} /> Log Action
                    </button>
                    {!isClosed && (
                        <button
                            className="casedetail-btn casedetail-btn-close"
                            onClick={handleCloseCase}
                            disabled={closing}
                        >
                            {closing ? <Loader2 size={15} className="dsf-spinner" /> : <XCircle size={15} />}
                            {closing ? 'Closing…' : 'Close Case'}
                        </button>
                    )}
                </div>
            )}

            {/* Feedback for operational actions */}
            {reviewError && (
                <div className="dsf-error" style={{ marginBottom: '1rem' }}>
                    <AlertTriangle size={14} /> <span>{reviewError}</span>
                </div>
            )}
            {reviewSuccess && (
                <div className="casedetail-success" style={{ marginBottom: '1rem' }}>
                    <CheckCircle2 size={14} /> <span>{reviewSuccess}</span>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* TWO-COLUMN GRID                                               */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="casedetail-grid">

                {/* ════ LEFT COLUMN ════ */}
                <div className="casedetail-left">

                    {/* (B) MERGED AUDIT TIMELINE */}
                    <div className="casedetail-section">
                        <h2 className="casedetail-section-title">
                            <Clock size={16} /> Audit Timeline
                        </h2>
                        {timeline.length === 0 ? (
                            <p className="casedetail-empty">No timeline entries yet.</p>
                        ) : (
                            <div className="casedetail-timeline">
                                {timeline.map((entry) => (
                                    <div key={entry.id} className="casedetail-timeline-item">
                                        <div className={`casedetail-timeline-dot${entry.type === 'action' ? ' casedetail-timeline-dot--action' : ''}`} />
                                        <div className="casedetail-timeline-content">
                                            <div className="casedetail-timeline-header">
                                                <span className="casedetail-timeline-date">{fmtDateTime(entry.timestamp)}</span>
                                                <span className="casedetail-timeline-actor">
                                                    <User size={12} /> {entry.who}
                                                </span>
                                            </div>
                                            <span className={`casedetail-timeline-tag${entry.type === 'action' ? ' casedetail-timeline-tag--action' : ''}`}>
                                                {entry.title}
                                            </span>
                                            {/* Review badges */}
                                            {entry.badges && (
                                                <div className="casedetail-timeline-badges">
                                                    {entry.badges.category && <span className="casedetail-timeline-tag">{entry.badges.category}</span>}
                                                    {entry.badges.risk_level && <span className={`dashboard-risk-badge risk-${riskClass(entry.badges.risk_level)}`}>{entry.badges.risk_level}</span>}
                                                    {entry.badges.decision && <span className={`dashboard-decision-badge decision-${decisionClass(entry.badges.decision)}`}>{entry.badges.decision}</span>}
                                                    {entry.badges.outcome && <span className="casedetail-timeline-tag">{entry.badges.outcome}</span>}
                                                </div>
                                            )}
                                            {entry.notes && <p className="casedetail-timeline-notes">{entry.notes}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ════ RIGHT COLUMN ════ */}
                <div className="casedetail-right">

                    {/* Review Panel */}
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

                    {/* (C) COMPLIANCE NOTES PANEL */}
                    <div className="casedetail-section" style={{ marginTop: '1.25rem' }}>
                        <h2 className="casedetail-section-title">
                            <MessageSquare size={16} /> Compliance Notes
                        </h2>
                        <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.75rem' }}>
                            Append-only safeguarding notes. Each note is recorded as an immutable action.
                        </p>
                        <textarea
                            className="dsf-textarea"
                            rows={3}
                            value={complianceNote}
                            onChange={(e) => setComplianceNote(e.target.value)}
                            placeholder="Enter compliance or safeguarding note…"
                        />
                        {complianceError && (
                            <div className="dsf-error" style={{ marginTop: '0.5rem' }}>
                                <AlertTriangle size={14} /> <span>{complianceError}</span>
                            </div>
                        )}
                        {complianceSuccess && (
                            <div className="casedetail-success" style={{ marginTop: '0.5rem' }}>
                                <CheckCircle2 size={14} /> <span>{complianceSuccess}</span>
                            </div>
                        )}
                        <button
                            className="casedetail-btn casedetail-btn-save"
                            onClick={handleSaveComplianceNote}
                            disabled={complianceSaving || !complianceNote.trim()}
                            style={{ marginTop: '0.75rem' }}
                        >
                            {complianceSaving ? <Loader2 size={15} className="dsf-spinner" /> : <Send size={15} />}
                            {complianceSaving ? 'Saving…' : 'Save Note'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* LOG ACTION MODAL                                              */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {showActionModal && (
                <>
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100 }} onClick={() => setShowActionModal(false)} />
                    <div style={{
                        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                        background: '#fff', borderRadius: '12px', padding: '1.5rem', width: '90%', maxWidth: '480px',
                        zIndex: 101, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                    }}>
                        <h3 style={{ margin: '0 0 1rem', fontSize: '1.05rem', fontWeight: 600 }}>
                            <Activity size={16} style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
                            Log Action
                        </h3>

                        <div className="casedetail-form-field">
                            <label className="casedetail-form-label">Action Type</label>
                            <select className="dsf-input" value={actionType} onChange={(e) => setActionType(e.target.value)}>
                                <option value="">— Select —</option>
                                {ACTION_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                            </select>
                        </div>
                        <div className="casedetail-form-field" style={{ marginTop: '0.75rem' }}>
                            <label className="casedetail-form-label">Notes</label>
                            <textarea
                                className="dsf-textarea"
                                rows={3}
                                value={actionNotes}
                                onChange={(e) => setActionNotes(e.target.value)}
                                placeholder="Describe the action taken…"
                            />
                        </div>
                        <div className="casedetail-form-field" style={{ marginTop: '0.75rem' }}>
                            <label className="casedetail-form-label">Attachment URL (optional)</label>
                            <input
                                type="text"
                                className="dsf-input"
                                value={actionAttachUrl}
                                onChange={(e) => setActionAttachUrl(e.target.value)}
                                placeholder="https://…"
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

                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                            <button
                                className="casedetail-btn casedetail-btn-save"
                                onClick={handleLogAction}
                                disabled={!actionType || actionSaving}
                            >
                                {actionSaving ? <Loader2 size={15} className="dsf-spinner" /> : <Send size={15} />}
                                {actionSaving ? 'Logging…' : 'Log Action'}
                            </button>
                            <button
                                className="casedetail-btn"
                                onClick={() => { setShowActionModal(false); setActionError(null); setActionSuccess(null); }}
                                style={{ background: '#f1f5f9', color: '#334155' }}
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
