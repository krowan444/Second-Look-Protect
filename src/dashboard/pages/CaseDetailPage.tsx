import React, { useState, useEffect, useCallback } from 'react';
import {
    ArrowLeft, Loader2, AlertTriangle, CheckCircle2, Lock,
    FileText, Image as ImageIcon, Clock, User, Shield, Activity,
    Send, XCircle, MessageSquare, Eye, Download, UserPlus, Bot,
    Phone, Search,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import type { UserRole } from '../types';

/* â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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
    assigned_to: string | null;
    meta?: Record<string, any>;
}

interface EvidenceItem {
    filename: string;
    signedUrl: string | null;
    path: string;
    isImage: boolean;
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

interface AiTriageResult {
    id: string;
    case_id: string;
    organisation_id: string;
    model: string | null;
    risk_level: string | null;
    summary: string | null;
    actions: any;
    indicators: any;
    confidence: number | null;
    suggested_category: string | null;
    suggested_urgency: string | null;
    likely_scam_pattern: string | null;
    repeat_targeting_suspected: boolean | null;
    financial_harm_indicator: boolean | null;
    human_review_required: boolean | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    accepted: boolean | null;
    human_final_risk_level: string | null;
    human_final_category: string | null;
    human_final_urgency: string | null;
    human_final_notes: string | null;
    raw_response: any;
    created_at: string;
    updated_at: string | null;
}

/** Merged timeline entry */
interface TimelineEntry {
    id: string;
    timestamp: string;
    type: 'system' | 'action' | 'review' | 'note' | 'timeline_event';
    title: string;
    who: string;
    notes: string | null;
    badges?: { category?: string | null; risk_level?: string | null; decision?: string | null; outcome?: string | null };
    event_type?: string;
    meta?: Record<string, any> | null;
    before_data?: Record<string, any> | null;
    after_data?: Record<string, any> | null;
}

/* â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const REVIEW_ROLES: UserRole[] = ['org_admin', 'manager', 'safeguarding_lead', 'super_admin'];

const CATEGORY_OPTIONS = ['financial', 'romance', 'phishing', 'impersonation', 'other'];
const STATUS_OPTIONS = ['new', 'in_review', 'closed'];
const RISK_OPTIONS = ['low', 'medium', 'high', 'critical'];
const DECISION_OPTIONS = ['scam', 'not_scam', 'unsure'];
const OUTCOME_OPTIONS = ['none', 'prevented', 'lost', 'escalated'];

const ACTION_TYPES = [
    { value: 'family_notified', label: 'Family Notified' },
    { value: 'bank_contacted', label: 'Bank Contacted' },
    { value: 'police_reported', label: 'Police Reported' },
    { value: 'safeguarding_review', label: 'Safeguarding Review' },
    { value: 'other', label: 'Other' },
];

/* â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function fmtDateTime(iso: string | null): string {
    if (!iso) return 'â€”';
    try {
        return new Date(iso).toLocaleString('en-GB', {
            day: 'numeric', month: 'short', year: '2-digit',
            hour: '2-digit', minute: '2-digit',
        });
    } catch { return 'â€”'; }
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

function formatLabel(value: string | null | undefined): string {
    if (!value) return '\u2014';
    return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* â”€â”€â”€ Component Props â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

interface CaseDetailPageProps {
    caseId: string;
    onNavigate?: (path: string) => void;
    userRole?: UserRole;
}

/* â”€â”€â”€ Case Detail Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export function CaseDetailPage({ caseId, onNavigate, userRole }: CaseDetailPageProps) {
    /* â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

    // Review controls - status
    const [rStatus, setRStatus] = useState('');

    // Case history (collapsible)
    const [caseHistory, setCaseHistory] = useState<{ id: string; source: string; action: string; actor_type?: string | null; created_at: string }[]>([]);
    const [historyOpen, setHistoryOpen] = useState(false);

    const canReview = userRole ? REVIEW_ROLES.includes(userRole) : false;
    const isSuperAdmin = userRole === 'super_admin';

    // Escalation form state
    const [escType, setEscType] = useState('');
    const [escRef, setEscRef] = useState('');
    const [escNotes, setEscNotes] = useState('');
    const [escSaving, setEscSaving] = useState(false);
    const [escMsg, setEscMsg] = useState<string | null>(null);

    // Internal note state
    const [noteText, setNoteText] = useState('');
    const [noteSaving, setNoteSaving] = useState(false);
    const [noteMsg, setNoteMsg] = useState<string | null>(null);

    // Evidence / Attachments state
    const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
    const [evidenceError, setEvidenceError] = useState<string | null>(null);
    const [evidenceLoading, setEvidenceLoading] = useState(false);

    // Assignment state
    const [orgStaff, setOrgStaff] = useState<{ id: string; full_name: string | null; email?: string }[]>([]);
    const [assignTo, setAssignTo] = useState('');
    const [assigning, setAssigning] = useState(false);
    const [assignMsg, setAssignMsg] = useState<string | null>(null);

    // AI Triage Assist state
    const [aiTriage, setAiTriage] = useState<AiTriageResult | null>(null);
    const [aiTriageLoading, setAiTriageLoading] = useState(false);
    const [aiAccepting, setAiAccepting] = useState(false);
    const [aiSaving, setAiSaving] = useState(false);
    const [aiHumanRisk, setAiHumanRisk] = useState('');
    const [aiHumanCategory, setAiHumanCategory] = useState('');
    const [aiHumanUrgency, setAiHumanUrgency] = useState('');
    const [aiHumanNotes, setAiHumanNotes] = useState('');
    const [aiMsg, setAiMsg] = useState<string | null>(null);

    // Number Intelligence state
    const [numberIntelLoading, setNumberIntelLoading] = useState(false);
    const [numberIntelMsg, setNumberIntelMsg] = useState<string | null>(null);

    /* â”€â”€ Build merged timeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    function buildTimeline(c: CaseRow, acts: CaseAction[], revs: CaseReview[], timelineEvents?: any[]): TimelineEntry[] {
        const entries: TimelineEntry[] = [];

        // System event: Case Submitted
        entries.push({
            id: 'system-submitted',
            timestamp: c.submitted_at,
            type: 'system',
            title: 'Case Submitted',
            who: c.submitted_by ? c.submitted_by.slice(0, 8) + 'â€¦' : 'System',
            notes: null,
        });

        // Actions
        acts.forEach((a) => {
            entries.push({
                id: `action-${a.id}`,
                timestamp: a.created_at,
                type: 'action',
                title: friendlyActionType(a.action_type),
                who: a.actor_id ? a.actor_id.slice(0, 8) + 'â€¦' : 'â€”',
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
                who: r.reviewed_by ? r.reviewed_by.slice(0, 8) + 'â€¦' : 'â€”',
                notes: r.notes,
                badges: { category: r.category, risk_level: r.risk_level, decision: r.decision, outcome: r.outcome },
            });
        });

        // Timeline events from case_timeline_events
        (timelineEvents ?? []).forEach((te: any) => {
            let title = friendlyActionType(te.event_type ?? 'event');
            let notes: string | null = null;
            const meta = te.meta ?? {};
            const before = te.before ?? {};
            const after = te.after ?? {};

            switch (te.event_type) {
                case 'status_changed':
                    title = 'Status Changed';
                    notes = `${before.status ?? 'â€”'} â†’ ${after.status ?? 'â€”'}`;
                    break;
                case 'decision_changed':
                    title = 'Decision Changed';
                    notes = `${before.decision ?? 'â€”'} â†’ ${after.decision ?? 'â€”'}`;
                    break;
                case 'note_added':
                    title = 'Internal Note';
                    notes = meta.note ?? null;
                    break;
                case 'escalation_recorded':
                    title = 'Escalation Recorded';
                    notes = `${friendlyActionType(meta.type ?? '')}${meta.reference ? ' â€” Ref: ' + meta.reference : ''}${meta.notes ? '\n' + meta.notes : ''}`;
                    break;
                default:
                    notes = meta.note ?? meta.notes ?? null;
                    break;
            }

            entries.push({
                id: `te-${te.id}`,
                timestamp: te.created_at,
                type: 'timeline_event',
                title,
                who: te.created_by ? te.created_by.slice(0, 8) + 'â€¦' : 'System',
                notes,
                event_type: te.event_type,
                meta: te.meta,
                before_data: te.before,
                after_data: te.after,
            });
        });

        // Sort newest first
        entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return entries;
    }

    /* â”€â”€ Fetch everything â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
            setRStatus(c.status ?? 'new');
            setRNotes('');
            setAssignTo(c.assigned_to ?? '');

            // Fetch staff users for assignment dropdown
            const { data: staffRows } = await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('organisation_id', resolvedOrgId)
                .eq('is_active', true)
                .order('full_name');
            setOrgStaff((staffRows ?? []) as { id: string; full_name: string | null }[]);

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

            // 4. Fetch case_timeline_events
            const { data: timelineEvts } = await supabase
                .from('case_timeline_events')
                .select('id, case_id, event_type, before, after, meta, created_by, actor_type, created_at')
                .eq('case_id', caseId)
                .order('created_at', { ascending: false });

            // 5. Build merged timeline
            setTimeline(buildTimeline(c as CaseRow, actsTyped, revsTyped, timelineEvts ?? []));

            // 6. Fetch AI triage result
            setAiTriageLoading(true);
            try {
                const { data: aiRow } = await supabase
                    .from('ai_triage_results')
                    .select('*')
                    .eq('case_id', caseId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                const typed = aiRow as AiTriageResult | null;
                setAiTriage(typed);
                if (typed) {
                    setAiHumanRisk(typed.human_final_risk_level ?? typed.risk_level ?? '');
                    setAiHumanCategory(typed.human_final_category ?? typed.suggested_category ?? '');
                    setAiHumanUrgency(typed.human_final_urgency ?? typed.suggested_urgency ?? '');
                    setAiHumanNotes(typed.human_final_notes ?? '');
                }
            } catch { /* non-critical */ }
            setAiTriageLoading(false);

        } catch (err: any) {
            setError(err?.message ?? 'Failed to load case');
        } finally {
            setLoading(false);
        }
    }, [caseId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    /* â”€â”€ Auto-poll while number intelligence is still running â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    useEffect(() => {
        const pending = aiTriage?.raw_response?.number_intel_pending === true;
        if (!pending) return;
        const interval = setInterval(() => { fetchData(); }, 4_000);
        // Safety: stop polling after 2 minutes regardless
        const timeout = setTimeout(() => clearInterval(interval), 120_000);
        return () => { clearInterval(interval); clearTimeout(timeout); };
    }, [aiTriage?.raw_response?.number_intel_pending, fetchData]);

    /* â”€â”€ Generate signed URLs for evidence files â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    useEffect(() => {
        if (!caseData) return;
        const evidence: { path: string; url: string }[] = caseData.meta?.evidence ?? [];
        if (evidence.length === 0) {
            setEvidenceItems([]);
            setEvidenceError(null);
            return;
        }
        let cancelled = false;
        setEvidenceLoading(true);
        (async () => {
            try {
                const supabase = getSupabase();
                const items: EvidenceItem[] = await Promise.all(
                    evidence.map(async (ev) => {
                        const filename = ev.path.split('/').pop() ?? 'file';
                        // Strip timestamp prefix for display (e.g. "1709123456789-photo.jpg" â†’ "photo.jpg")
                        const displayName = filename.replace(/^\d+-/, '');
                        const isImage = /\.(jpg|jpeg|png|webp)$/i.test(filename);
                        try {
                            const { data, error: signErr } = await supabase.storage
                                .from('evidence')
                                .createSignedUrl(ev.path, 60);
                            return { filename: displayName, signedUrl: signErr ? null : data!.signedUrl, path: ev.path, isImage };
                        } catch {
                            return { filename: displayName, signedUrl: null, path: ev.path, isImage };
                        }
                    }),
                );
                if (cancelled) return;
                const anyFailed = items.some((i) => !i.signedUrl);
                setEvidenceError(anyFailed ? 'Unable to load attachment preview. Please refresh.' : null);
                setEvidenceItems(items);
            } catch {
                if (!cancelled) setEvidenceError('Unable to load attachment preview. Please refresh.');
            } finally {
                if (!cancelled) setEvidenceLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [caseData]);

    /* â”€â”€ Notify submitter on review completion (best-effort, deduplicated) â”€â”€ */
    async function notifySubmitter(reviewCaseId: string, reviewerUid: string) {
        try {
            if (!caseData?.submitted_by) return;
            if (caseData.submitted_by === reviewerUid) return; // don't notify yourself
            const supabase = getSupabase();

            // Deduplicate: skip if a review_completed notification for this case+user
            // was already created in the last 60 seconds (covers rapid multi-handler flows)
            const cutoff = new Date(Date.now() - 60_000).toISOString();
            const { data: existing } = await supabase
                .from('notifications')
                .select('id')
                .eq('user_id', caseData.submitted_by)
                .eq('case_id', reviewCaseId)
                .eq('type', 'review_completed')
                .gte('created_at', cutoff)
                .limit(1);
            if (existing && existing.length > 0) return; // already notified

            await supabase.from('notifications').insert({
                user_id: caseData.submitted_by,
                type: 'review_completed',
                case_id: reviewCaseId,
                message: 'A manager/admin has reviewed your case. Open to view the latest guidance and outcome.',
                read: false,
            });
        } catch { /* best-effort â€” never block the review */ }
    }

    /* â”€â”€ Mark In Review â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

    /* â”€â”€ Assign Case â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    async function handleAssignCase() {
        if (!caseData) return;
        setAssigning(true);
        setAssignMsg(null);
        try {
            const supabase = getSupabase();
            const { error: updErr } = await supabase
                .from('cases')
                .update({ assigned_to: assignTo || null })
                .eq('id', caseId)
                .eq('organisation_id', orgId);
            if (updErr) throw updErr;

            setAssignMsg(assignTo ? 'Case assigned.' : 'Assignment removed.');
            await fetchData();
        } catch (err: any) {
            setAssignMsg(`Error: ${err?.message ?? 'Failed to assign case'}`);
        } finally {
            setAssigning(false);
        }
    }

    /* â”€â”€ Save Review (DUAL WRITE) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    async function handleSaveReview() {
        if (!caseData) return;

        // Dirty check - prevent save if nothing changed
        const statusUnchanged = (rStatus || 'new') === (caseData.status || 'new');
        const categoryUnchanged = (rCategory || null) === (caseData.category || null);
        const riskUnchanged = (rRisk || null) === (caseData.risk_level || null);
        const decisionUnchanged = (rDecision || null) === (caseData.decision || null);
        const outcomeUnchanged = (rOutcome || null) === (caseData.outcome || null);
        const noNotes = !rNotes.trim();

        if (statusUnchanged && categoryUnchanged && riskUnchanged && decisionUnchanged && outcomeUnchanged && noNotes) {
            setReviewError('No changes to save.');
            return;
        }

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
            const updatePayload: Record<string, any> = {
                category: rCategory || null,
                risk_level: rRisk || null,
                decision: rDecision || null,
                outcome: rOutcome || null,
                reviewed_at: caseData.reviewed_at ?? now,
            };
            // Apply status from dropdown
            if (rStatus) updatePayload.status = rStatus;
            if (rStatus === 'closed' && !caseData.closed_at) updatePayload.closed_at = now;

            const { error: updErr } = await supabase.from('cases').update(updatePayload)
                .eq('id', caseId).eq('organisation_id', orgId);
            if (updErr) throw updErr;

            setReviewSuccess('Review saved successfully.');
            notifySubmitter(caseId, uid);
            await fetchData();
            fetchCaseHistory();
        } catch (err: any) {
            setReviewError(err?.message ?? 'Failed to save review');
        } finally {
            setSaving(false);
        }
    }

    /* â”€â”€ Close Case (DUAL WRITE) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

    /* â”€â”€ Log Action (modal, append-only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

    /* â”€â”€ Save Compliance / Safeguarding Note â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

    /* â”€â”€ Fetch case history (status changes + audit logs) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    const fetchCaseHistory = useCallback(async () => {
        if (!caseId || !orgId) return;
        try {
            const supabase = getSupabase();
            const combined: { id: string; source: string; action: string; actor_type?: string | null; created_at: string }[] = [];

            // A) case_status_history
            const { data: statusRows } = await supabase
                .from('case_status_history')
                .select('id, new_status, changed_by, created_at')
                .eq('submission_id', caseId)
                .order('created_at', { ascending: false })
                .limit(20);
            (statusRows ?? []).forEach((r: any) => combined.push({
                id: `sh-${r.id}`,
                source: 'Status Change',
                action: `Status â†’ ${r.new_status ?? 'â€”'}`,
                actor_type: r.changed_by ?? null,
                created_at: r.created_at,
            }));

            // B) audit_logs
            const { data: auditRows } = await supabase
                .from('audit_logs')
                .select('id, action, actor_type, created_at')
                .or('entity_type.eq.submission,entity_type.eq.case')
                .eq('entity_id', caseId)
                .order('created_at', { ascending: false })
                .limit(20);
            (auditRows ?? []).forEach((r: any) => combined.push({
                id: `al-${r.id}`,
                source: 'Audit Log',
                action: r.action,
                actor_type: r.actor_type ?? null,
                created_at: r.created_at,
            }));

            combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setCaseHistory(combined);
        } catch { setCaseHistory([]); }
    }, [caseId, orgId]);

    useEffect(() => { if (orgId) fetchCaseHistory(); }, [orgId, fetchCaseHistory]);

    /* â”€â”€ Accept AI Triage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    async function handleAcceptAi() {
        if (!aiTriage) return;
        setAiAccepting(true);
        setAiMsg(null);
        try {
            const supabase = getSupabase();
            const now = new Date().toISOString();
            const { error: updErr } = await supabase
                .from('ai_triage_results')
                .update({
                    accepted: true,
                    reviewed_by: uid,
                    reviewed_at: now,
                    human_final_risk_level: aiTriage.risk_level,
                    human_final_category: aiTriage.suggested_category,
                    human_final_urgency: aiTriage.suggested_urgency,
                })
                .eq('id', aiTriage.id);
            if (updErr) throw updErr;

            /* Record audit timeline entry */
            await supabase.from('case_actions').insert({
                case_id: caseId,
                organisation_id: orgId,
                actor_id: uid,
                action_type: 'ai_review_accepted',
                action_notes: `AI review accepted â€” risk: ${formatLabel(aiTriage.risk_level)}, category: ${formatLabel(aiTriage.suggested_category)}, urgency: ${formatLabel(aiTriage.suggested_urgency)}`,
            });

            setAiMsg('AI suggestions accepted.');
            notifySubmitter(caseId, uid);
            await fetchData();
        } catch (err: any) {
            setAiMsg(`Error: ${err?.message ?? 'Failed to accept AI triage'}`);
        } finally {
            setAiAccepting(false);
        }
    }

    /* â”€â”€ Save AI Triage Human Review â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    async function handleSaveAiReview() {
        if (!aiTriage) return;
        setAiSaving(true);
        setAiMsg(null);
        try {
            const supabase = getSupabase();
            const now = new Date().toISOString();
            const { error: updErr } = await supabase
                .from('ai_triage_results')
                .update({
                    reviewed_by: uid,
                    reviewed_at: now,
                    human_final_risk_level: aiHumanRisk || null,
                    human_final_category: aiHumanCategory || null,
                    human_final_urgency: aiHumanUrgency || null,
                    human_final_notes: aiHumanNotes || null,
                })
                .eq('id', aiTriage.id);
            if (updErr) throw updErr;

            /* Record audit timeline entry */
            const overrideParts: string[] = [];
            if (aiHumanRisk) overrideParts.push(`risk: ${formatLabel(aiHumanRisk)}`);
            if (aiHumanCategory) overrideParts.push(`category: ${formatLabel(aiHumanCategory)}`);
            if (aiHumanUrgency) overrideParts.push(`urgency: ${formatLabel(aiHumanUrgency)}`);
            if (aiHumanNotes) overrideParts.push('notes added');
            const overrideSummary = overrideParts.length > 0 ? ` â€” ${overrideParts.join(', ')}` : '';
            await supabase.from('case_actions').insert({
                case_id: caseId,
                organisation_id: orgId,
                actor_id: uid,
                action_type: 'ai_assessment_override',
                action_notes: `Final assessment saved${overrideSummary}`,
            });

            setAiMsg('AI triage review saved.');
            notifySubmitter(caseId, uid);
            await fetchData();
        } catch (err: any) {
            setAiMsg(`Error: ${err?.message ?? 'Failed to save AI review'}`);
        } finally {
            setAiSaving(false);
        }
    }

    /* â”€â”€ Run Number Intelligence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    async function handleRunNumberIntel() {
        if (!aiTriage || !caseData) return;
        const details = caseData.meta?.details;
        const phoneNumber = details?.phone_number || details?.sender || null;
        if (!phoneNumber) { setNumberIntelMsg('No phone number found in case details.'); return; }

        setNumberIntelLoading(true);
        setNumberIntelMsg(null);
        try {
            const resp = await fetch('/api/number-intel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    triage_id: aiTriage.id,
                    case_id: caseData.id,
                    phone_number: phoneNumber,
                }),
            });
            const result = await resp.json();
            if (!result.ok) {
                setNumberIntelMsg(`Error: ${result.error || 'Failed to run number intelligence'}`);
            } else {
                setNumberIntelMsg('Number intelligence completed.');
                await fetchData();
            }
        } catch (err: any) {
            setNumberIntelMsg(`Error: ${err?.message || 'Failed'}`);
        } finally {
            setNumberIntelLoading(false);
        }
    }

    /* â”€â”€ Record Escalation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    async function handleRecordEscalation() {
        if (!escType || !caseData) return;
        setEscSaving(true);
        setEscMsg(null);
        try {
            const supabase = getSupabase();
            const { error: rpcErr } = await supabase.rpc('add_case_timeline_event', {
                p_case_id: caseId,
                p_event_type: 'escalation_recorded',
                p_before: null,
                p_after: null,
                p_meta: { type: escType, reference: escRef || null, notes: escNotes || null },
            });
            if (rpcErr) throw rpcErr;
            setEscType('');
            setEscRef('');
            setEscNotes('');
            setEscMsg('Escalation recorded.');
            await fetchData();
        } catch (err: any) {
            setEscMsg(`Error: ${err?.message ?? 'Failed to record escalation'}`);
        } finally {
            setEscSaving(false);
        }
    }

    /* â”€â”€ Add Internal Note â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    async function handleAddNote() {
        if (!noteText.trim() || !caseData) return;
        setNoteSaving(true);
        setNoteMsg(null);
        try {
            const supabase = getSupabase();
            const { error: rpcErr } = await supabase.rpc('add_case_timeline_event', {
                p_case_id: caseId,
                p_event_type: 'note_added',
                p_before: null,
                p_after: null,
                p_meta: { note: noteText.trim(), visibility: 'internal' },
            });
            if (rpcErr) throw rpcErr;
            setNoteText('');
            setNoteMsg('Note added.');
            await fetchData();
        } catch (err: any) {
            setNoteMsg(`Error: ${err?.message ?? 'Failed to add note'}`);
        } finally {
            setNoteSaving(false);
        }
    }

    /* â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

    if (loading) {
        return (
            <div className="dashboard-overview-loading">
                <Loader2 className="dashboard-overview-spinner-icon" />
                <p>Loading caseâ€¦</p>
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
                            <code className="casedetail-id-code">{caseId.slice(0, 8)}â€¦</code>
                        </p>
                    </div>
                    <span className={`dashboard-status-badge status-${statusClass(caseData.status)}`} style={{ fontSize: '0.82rem', padding: '0.3rem 0.8rem' }}>
                        {statusLabel(caseData.status)}
                    </span>
                </div>
            </div>

            {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            {/* (A) CASE SUMMARY CARD                                         */}
            {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <div className="casedetail-section" style={{ marginBottom: '1.5rem' }}>
                <h2 className="casedetail-section-title">
                    <FileText size={16} /> Case Summary
                </h2>
                <div className="casedetail-status-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.25rem' }}>
                    <div className="casedetail-status-item">
                        <span className="casedetail-field-label">Status</span>
                        <span className={`dashboard-status-badge status-${statusClass(caseData.status)}`}>
                            {statusLabel(caseData.status)}
                        </span>
                    </div>
                    <div className="casedetail-status-item">
                        <span className="casedetail-field-label">Risk Level</span>
                        <span className={`dashboard-risk-badge risk-${riskClass(caseData.risk_level)}`}>
                            {caseData.risk_level ?? 'â€”'}
                        </span>
                    </div>
                    <div className="casedetail-status-item" style={{ minWidth: '220px' }}>
                        <span className="casedetail-field-label">Type</span>
                        <span className="casedetail-field-value" style={{ wordBreak: 'break-word' }}>{formatLabel(caseData.submission_type ?? caseData.channel)}</span>
                    </div>
                    <div className="casedetail-status-item">
                        <span className="casedetail-field-label">Submitted At</span>
                        <span className="casedetail-field-value">{fmtDateTime(caseData.submitted_at)}</span>
                    </div>
                    <div className="casedetail-status-item">
                        <span className="casedetail-field-label">Decision</span>
                        <span className={`dashboard-decision-badge decision-${decisionClass(caseData.decision)}`}>
                            {formatLabel(caseData.decision)}
                        </span>
                    </div>
                    <div className="casedetail-status-item">
                        <span className="casedetail-field-label">Category</span>
                        <span className="casedetail-field-value">{formatLabel(caseData.category)}</span>
                    </div>
                    <div className="casedetail-status-item">
                        <span className="casedetail-field-label">Outcome</span>
                        <span className="casedetail-field-value">{formatLabel(caseData.outcome)}</span>
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
                {/* â”€â”€ Evidence / Attachments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                <div className="casedetail-field" style={{ marginTop: '0.75rem' }}>
                    <span className="casedetail-field-label">
                        <ImageIcon size={14} style={{ verticalAlign: 'text-bottom', marginRight: '4px' }} />
                        Evidence / Attachments
                    </span>
                    {evidenceLoading && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '0.5rem', color: '#64748b', fontSize: '0.82rem' }}>
                            <Loader2 size={14} className="dsf-spinner" /> Loading attachmentsâ€¦
                        </div>
                    )}
                    {evidenceError && (
                        <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.8rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertTriangle size={14} />
                            {evidenceError}
                        </div>
                    )}
                    {!evidenceLoading && evidenceItems.length === 0 && !caseData.attachment_url && (
                        <p className="casedetail-empty" style={{ marginTop: '0.35rem' }}>No evidence uploaded for this case.</p>
                    )}
                    {/* Legacy fallback: attachment_url exists but no meta.evidence */}
                    {!evidenceLoading && evidenceItems.length === 0 && caseData.attachment_url && (
                        <div className="casedetail-evidence-list" style={{ marginTop: '0.5rem' }}>
                            <div className="casedetail-evidence-item">
                                {isImageUrl(caseData.attachment_url) && (
                                    <img src={caseData.attachment_url} alt="Attachment" className="casedetail-evidence-thumb" />
                                )}
                                <div className="casedetail-evidence-info">
                                    <span className="casedetail-evidence-filename">Attachment</span>
                                    <div className="casedetail-evidence-actions">
                                        <a href={caseData.attachment_url} target="_blank" rel="noopener noreferrer" className="casedetail-evidence-btn">
                                            <Eye size={13} /> View
                                        </a>
                                        <a href={caseData.attachment_url} download className="casedetail-evidence-btn">
                                            <Download size={13} /> Download
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Signed-URL evidence items */}
                    {!evidenceLoading && evidenceItems.length > 0 && (
                        <div className="casedetail-evidence-list" style={{ marginTop: '0.5rem' }}>
                            {evidenceItems.map((ev, idx) => (
                                <div key={idx} className="casedetail-evidence-item">
                                    {ev.isImage && ev.signedUrl && (
                                        <img src={ev.signedUrl} alt={ev.filename} className="casedetail-evidence-thumb" />
                                    )}
                                    <div className="casedetail-evidence-info">
                                        <span className="casedetail-evidence-filename">{ev.filename}</span>
                                        {ev.signedUrl ? (
                                            <div className="casedetail-evidence-actions">
                                                <a href={ev.signedUrl} target="_blank" rel="noopener noreferrer" className="casedetail-evidence-btn">
                                                    <Eye size={13} /> View
                                                </a>
                                                <a href={ev.signedUrl} download={ev.filename} className="casedetail-evidence-btn">
                                                    <Download size={13} /> Download
                                                </a>
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>Unavailable</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                {/* â”€â”€ Suspicious Contact Details â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                {(() => {
                    const d = caseData.meta?.details;
                    if (!d || typeof d !== 'object') return null;
                    const contacts: { label: string; value: string }[] = [];
                    if (d.phone_number) contacts.push({ label: 'Reported phone number', value: d.phone_number });
                    if (d.sender_email) contacts.push({ label: 'Reported email', value: d.sender_email });
                    if (d.url) contacts.push({ label: 'Reported website / link', value: d.url });
                    if (d.sender) contacts.push({ label: 'Reported sender / contact', value: d.sender });
                    if (d.claimed_sender) contacts.push({ label: 'Claimed sender', value: d.claimed_sender });
                    if (d.claimed_organisation) contacts.push({ label: 'Claimed organisation', value: d.claimed_organisation });
                    if (contacts.length === 0) return null;
                    return (
                        <div className="casedetail-field" style={{ marginTop: '0.75rem' }}>
                            <span className="casedetail-field-label">
                                <Phone size={14} style={{ verticalAlign: 'text-bottom', marginRight: '4px' }} />
                                Suspicious Contact Details
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.35rem' }}>
                                {contacts.map((c, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem' }}>
                                        <span style={{ color: '#64748b', minWidth: '160px', flexShrink: 0 }}>{c.label}:</span>
                                        <span style={{ color: '#1e293b', fontWeight: 500, wordBreak: 'break-all' }}>{c.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}
                {caseData.resident_ref && (
                    <div className="casedetail-field" style={{ marginTop: '0.5rem' }}>
                        <span className="casedetail-field-label">Resident Ref</span>
                        <span className="casedetail-field-value">{caseData.resident_ref}</span>
                    </div>
                )}
                {/* Actions Taken from meta */}
                {(() => {
                    const act = caseData.meta?.actions_taken;
                    if (!act || typeof act !== 'object') return null;
                    const items: { key: string; label: string }[] = [
                        { key: 'family_informed', label: 'Family informed' },
                        { key: 'bank_contacted', label: 'Bank contacted' },
                        { key: 'police_informed', label: 'Police informed' },
                        { key: 'safeguarding_lead_informed', label: 'Safeguarding lead informed' },
                        { key: 'resident_advised', label: 'Resident advised / reassured' },
                        { key: 'device_secured', label: 'Device / account secured' },
                        { key: 'escalated_internally', label: 'Escalated internally' },
                    ];
                    const hasAny = items.some(i => act[i.key] === true);
                    if (!hasAny) return null;
                    return (
                        <div className="casedetail-field" style={{ marginTop: '0.75rem' }}>
                            <span className="casedetail-field-label">Actions Taken</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                                {items.map(i => act[i.key] === true && (
                                    <span key={i.key} style={{ fontSize: '0.85rem', color: '#334155' }}>âœ“ {i.label}</span>
                                ))}
                                {act.police_reference && (
                                    <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '1rem' }}>Police ref: {act.police_reference}</span>
                                )}
                                {act.bank_reference && (
                                    <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '1rem' }}>Bank ref: {act.bank_reference}</span>
                                )}
                                {act.escalation_notes && (
                                    <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '0.25rem', marginLeft: '1rem', padding: '0.4rem 0.6rem', background: '#f8fafc', borderRadius: '6px', borderLeft: '3px solid #C9A84C' }}>
                                        <strong style={{ fontSize: '0.78rem', color: '#64748b' }}>Escalation notes:</strong><br />
                                        {act.escalation_notes}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* â”€â”€ Operational Buttons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {canReview && (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                    {isNew && (
                        <button
                            className="casedetail-btn casedetail-btn-save"
                            onClick={handleMarkInReview}
                            disabled={markingReview}
                        >
                            {markingReview ? <Loader2 size={15} className="dsf-spinner" /> : <Eye size={15} />}
                            {markingReview ? 'Markingâ€¦' : 'Mark In Review'}
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
                            {closing ? 'Closingâ€¦' : 'Close Case'}
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

            {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            {/* TWO-COLUMN GRID                                               */}
            {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <div className="casedetail-grid">

                {/* â•â•â•â• LEFT COLUMN â•â•â•â• */}
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
                                            <span className={`casedetail-timeline-tag${entry.type === 'action' ? ' casedetail-timeline-tag--action' : ''}${entry.event_type === 'note_added' ? ' casedetail-timeline-tag--action' : ''}${entry.event_type === 'escalation_recorded' ? ' casedetail-timeline-tag--action' : ''}`}>
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
                                            {entry.notes && <p className="casedetail-timeline-notes" style={entry.event_type === 'note_added' ? { fontStyle: 'italic', background: '#fefce8', padding: '0.4rem 0.6rem', borderRadius: '4px', borderLeft: '3px solid #facc15' } : {}}>{entry.notes}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* â”€â”€ Internal Notes Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                    <div className="dashboard-panel" style={{ marginTop: '1.5rem' }}>
                        <div className="dashboard-panel-header">
                            <h2 className="dashboard-panel-title">
                                <MessageSquare size={16} className="dashboard-panel-title-icon" /> Internal Notes
                            </h2>
                        </div>
                        {isClosed ? (
                            <p style={{ padding: '1rem', color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>Disabled in Inspection Mode</p>
                        ) : (
                            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#475569' }}>Add internal note</label>
                                <textarea
                                    className="dsf-textarea"
                                    rows={3}
                                    placeholder="Type your note hereâ€¦"
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value)}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                    <button
                                        type="button"
                                        className="casedetail-btn casedetail-btn-save"
                                        onClick={handleAddNote}
                                        disabled={noteSaving || !noteText.trim()}
                                    >
                                        {noteSaving ? <Loader2 size={15} className="dsf-spinner" /> : <MessageSquare size={15} />}
                                        {noteSaving ? 'Addingâ€¦' : 'Add Note'}
                                    </button>
                                    {noteMsg && (
                                        <span style={{ fontSize: '0.75rem', color: noteMsg.startsWith('Error') ? '#dc2626' : '#16a34a' }}>{noteMsg}</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* â”€â”€ Escalation Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                    <div className="casedetail-section" style={{ marginTop: '1.5rem' }}>
                        <h2 className="casedetail-section-title">
                            <AlertTriangle size={16} /> Escalation
                        </h2>
                        {isClosed ? (
                            <p style={{ padding: '0.75rem', color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>Disabled in Inspection Mode</p>
                        ) : (
                            <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                <div className="casedetail-form-field">
                                    <label className="casedetail-form-label">Escalation Type</label>
                                    <select className="dsf-input" value={escType} onChange={(e) => setEscType(e.target.value)}>
                                        <option value="">â€” Select â€”</option>
                                        <option value="family_notified">Family Notified</option>
                                        <option value="bank_contacted">Bank Contacted</option>
                                        <option value="police_reference">Police Reference</option>
                                        <option value="telco_contacted">Telco Contacted</option>
                                        <option value="resident_advised">Resident Advised</option>
                                    </select>
                                </div>
                                <div className="casedetail-form-field">
                                    <label className="casedetail-form-label">Reference</label>
                                    <input className="dsf-input" type="text" placeholder="Optional reference" value={escRef} onChange={(e) => setEscRef(e.target.value)} />
                                </div>
                                <div className="casedetail-form-field">
                                    <label className="casedetail-form-label">Notes</label>
                                    <textarea className="dsf-textarea" rows={3} placeholder="Escalation notesâ€¦" value={escNotes} onChange={(e) => setEscNotes(e.target.value)} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <button
                                        type="button"
                                        className="casedetail-btn casedetail-btn-action"
                                        onClick={handleRecordEscalation}
                                        disabled={escSaving || !escType}
                                    >
                                        {escSaving ? <Loader2 size={15} className="dsf-spinner" /> : <Send size={15} />}
                                        {escSaving ? 'Savingâ€¦' : 'Record Escalation'}
                                    </button>
                                    {escMsg && (
                                        <span style={{ fontSize: '0.75rem', color: escMsg.startsWith('Error') ? '#dc2626' : '#16a34a' }}>{escMsg}</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Review Panel */}
                    {canReview ? (
                        <div className="casedetail-section casedetail-review-panel" style={{ marginTop: '1.5rem' }}>
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
                                    <label className="casedetail-form-label">Status</label>
                                    <select className="dsf-input" value={rStatus} onChange={(e) => setRStatus(e.target.value)}>
                                        {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{statusLabel(o)}</option>)}
                                    </select>
                                </div>
                                {/* Assign To */}
                                <div className="casedetail-form-field">
                                    <label className="casedetail-form-label">Assign To</label>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <select className="dsf-input" style={{ flex: 1 }} value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                                            <option value="">â€” Unassigned â€”</option>
                                            {orgStaff.map((u) => (
                                                <option key={u.id} value={u.id}>{u.full_name ?? u.id.slice(0, 8)}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            className="casedetail-btn casedetail-btn-action"
                                            style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
                                            disabled={assigning || assignTo === (caseData?.assigned_to ?? '')}
                                            onClick={handleAssignCase}
                                        >
                                            {assigning ? <Loader2 size={13} className="dsf-spinner" /> : <UserPlus size={13} />}
                                            {assigning ? 'Savingâ€¦' : 'Assign'}
                                        </button>
                                    </div>
                                    {assignMsg && (
                                        <span style={{ fontSize: '0.75rem', marginTop: '0.25rem', display: 'block', color: assignMsg.startsWith('Error') ? '#dc2626' : '#16a34a' }}>{assignMsg}</span>
                                    )}
                                </div>
                                <div className="casedetail-form-field">
                                    <label className="casedetail-form-label">Category</label>
                                    <select className="dsf-input" value={rCategory} onChange={(e) => setRCategory(e.target.value)}>
                                        <option value="">â€” Select â€”</option>
                                        {CATEGORY_OPTIONS.map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                                    </select>
                                </div>
                                <div className="casedetail-form-field">
                                    <label className="casedetail-form-label">Risk Level</label>
                                    <select className="dsf-input" value={rRisk} onChange={(e) => setRRisk(e.target.value)}>
                                        <option value="">â€” Select â€”</option>
                                        {RISK_OPTIONS.map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                                    </select>
                                </div>
                                <div className="casedetail-form-field">
                                    <label className="casedetail-form-label">Decision</label>
                                    <select className="dsf-input" value={rDecision} onChange={(e) => setRDecision(e.target.value)}>
                                        <option value="">â€” Select â€”</option>
                                        {DECISION_OPTIONS.map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                                    </select>
                                </div>
                                <div className="casedetail-form-field">
                                    <label className="casedetail-form-label">Outcome</label>
                                    <select className="dsf-input" value={rOutcome} onChange={(e) => setROutcome(e.target.value)}>
                                        <option value="">â€” Select â€”</option>
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
                                        placeholder="Add review notesâ€¦"
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
                                        {saving ? 'Savingâ€¦' : 'Save Review'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="casedetail-section casedetail-review-locked" style={{ marginTop: '1.5rem' }}>
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
                            placeholder="Enter compliance or safeguarding noteâ€¦"
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
                            {complianceSaving ? 'Savingâ€¦' : 'Save Note'}
                        </button>
                    </div>

                </div>

                {/* ════ RIGHT COLUMN ════ */}
                <div className="casedetail-right">

                    {/* â”€â”€ AI Triage Assist â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                    <div className="casedetail-section aitriage-card">
                        <h2 className="casedetail-section-title">
                            <Bot size={16} /> AI Triage Assist
                        </h2>
                        <div className="aitriage-advisory">
                            <AlertTriangle size={13} />
                            AI suggestions are advisory only and require human review.
                        </div>

                        {aiTriageLoading && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.82rem', padding: '0.5rem 0' }}>
                                <Loader2 size={14} className="dsf-spinner" /> Loading AI triageâ€¦
                            </div>
                        )}

                        {!aiTriageLoading && !aiTriage && (
                            <p className="casedetail-empty">AI triage not generated yet.</p>
                        )}

                        {!aiTriageLoading && aiTriage && (
                            <>
                                {/* AI Summary */}
                                {aiTriage.summary && (
                                    <div className="aitriage-field">
                                        <span className="aitriage-label">AI Summary</span>
                                        <div className="aitriage-value aitriage-summary">{aiTriage.summary}</div>
                                    </div>
                                )}

                                {/* Grid of key fields */}
                                <div className="aitriage-grid">
                                    <div className="aitriage-field">
                                        <span className="aitriage-label">Suggested Risk</span>
                                        {(() => {
                                            const numIntel = aiTriage.raw_response?.number_intel;
                                            const calibratedLabel = numIntel?.scam_likelihood?.label;
                                            if (calibratedLabel) {
                                                // Map calibrated label to risk class
                                                const calibratedClass = calibratedLabel.toLowerCase().includes('very high') ? 'high' : calibratedLabel.toLowerCase().includes('high') ? 'high' : calibratedLabel.toLowerCase().includes('suspicious') ? 'medium' : calibratedLabel.toLowerCase().includes('uncertain') ? 'medium' : 'low';
                                                return (
                                                    <span className={`dashboard-risk-badge risk-${calibratedClass}`}>
                                                        {calibratedLabel}
                                                    </span>
                                                );
                                            }
                                            return (
                                                <span className={`dashboard-risk-badge risk-${riskClass(aiTriage.risk_level)}`}>
                                                    {formatLabel(aiTriage.risk_level)}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <div className="aitriage-field">
                                        <span className="aitriage-label">Suggested Category</span>
                                        <span className="aitriage-value">{formatLabel(aiTriage.suggested_category)}</span>
                                    </div>
                                    <div className="aitriage-field">
                                        <span className="aitriage-label">Suggested Urgency</span>
                                        <span className={`aitriage-urgency-badge aitriage-urgency-${(aiTriage.suggested_urgency ?? 'unknown').toLowerCase()}`}>
                                            {formatLabel(aiTriage.suggested_urgency)}
                                        </span>
                                    </div>
                                    <div className="aitriage-field">
                                        <span className="aitriage-label">Likely Scam Pattern</span>
                                        <span className="aitriage-value">{formatLabel(aiTriage.likely_scam_pattern)}</span>
                                    </div>
                                </div>

                                {/* Indicators (bullet list) */}
                                {(() => {
                                    const items = Array.isArray(aiTriage.indicators) ? aiTriage.indicators : [];
                                    if (items.length === 0) return null;
                                    return (
                                        <div className="aitriage-field">
                                            <span className="aitriage-label">Indicators</span>
                                            <ul className="aitriage-bullets">
                                                {items.map((ind: any, i: number) => (
                                                    <li key={i}>{typeof ind === 'string' ? ind : JSON.stringify(ind)}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    );
                                })()}

                                {/* Recommended Next Actions (bullet list) */}
                                {(() => {
                                    const items = Array.isArray(aiTriage.actions) ? aiTriage.actions : [];
                                    if (items.length === 0) return null;
                                    return (
                                        <div className="aitriage-field">
                                            <span className="aitriage-label">Recommended Next Actions</span>
                                            <ul className="aitriage-bullets">
                                                {items.map((act: any, i: number) => (
                                                    <li key={i}>{typeof act === 'string' ? act : JSON.stringify(act)}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    );
                                })()}

                                {(() => {
                                    const numIntel = aiTriage.raw_response?.number_intel;
                                    const calibratedScore = numIntel?.scam_likelihood?.score;
                                    const calibratedLabel = numIntel?.scam_likelihood?.label;
                                    const calibratedExplanation = numIntel?.scam_likelihood?.explanation;

                                    if (calibratedScore != null) {
                                        // Use calibrated score as primary
                                        const pct = Math.min(100, Math.max(0, calibratedScore));
                                        const barColor = pct >= 80 ? '#dc2626' : pct >= 60 ? '#ea580c' : pct >= 40 ? '#d97706' : pct >= 20 ? '#65a30d' : '#16a34a';
                                        return (
                                            <div className="aitriage-field">
                                                <span className="aitriage-label">Scam Likelihood (Evidence-weighted)</span>
                                                <div className="aitriage-confidence-wrap">
                                                    <div className="aitriage-confidence-bar">
                                                        <div
                                                            className="aitriage-confidence-fill"
                                                            style={{ width: `${pct}%`, background: barColor }}
                                                        />
                                                    </div>
                                                    <span className="aitriage-confidence-text">
                                                        {pct}% â€” {calibratedLabel || 'Unknown'}
                                                    </span>
                                                </div>
                                                {calibratedExplanation && (
                                                    <span style={{ display: 'block', fontSize: '0.76rem', color: '#475569', marginTop: '4px', lineHeight: 1.45 }}>
                                                        {calibratedExplanation}
                                                    </span>
                                                )}
                                                <span style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px', lineHeight: 1.4 }}>
                                                    Based on IPQS technical data, complaint source checks, web corroboration, and case context. Requires human review.
                                                </span>
                                            </div>
                                        );
                                    }

                                    // Fallback: original confidence if no calibrated score
                                    if (aiTriage.confidence != null) {
                                        return (
                                            <div className="aitriage-field">
                                                <span className="aitriage-label">Scam Likelihood Confidence</span>
                                                <div className="aitriage-confidence-wrap">
                                                    <div className="aitriage-confidence-bar">
                                                        <div
                                                            className="aitriage-confidence-fill"
                                                            style={{ width: `${Math.round(aiTriage.confidence * 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="aitriage-confidence-text">
                                                        {Math.round(aiTriage.confidence * 100)}% â€” {aiTriage.confidence < 0.4 ? 'Low confidence' : aiTriage.confidence < 0.75 ? 'Moderate confidence' : 'High confidence'}
                                                    </span>
                                                </div>
                                                <span style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px', lineHeight: 1.4 }}>
                                                    Based on submitted case details only. Number intelligence not yet available.
                                                </span>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                                {/* Human Review Required */}
                                <div className="aitriage-field">
                                    <span className="aitriage-label">Human Review Required</span>
                                    <span className={`aitriage-bool-badge ${aiTriage.human_review_required ? 'aitriage-bool-yes' : 'aitriage-bool-no'}`}>
                                        {aiTriage.human_review_required ? 'Yes' : 'No'}
                                    </span>
                                </div>

                                {/* â”€â”€ Number Intelligence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                                {(() => {
                                    const phoneNumber = caseData?.meta?.details?.phone_number || caseData?.meta?.details?.sender || null;
                                    const intel = aiTriage.raw_response?.number_intel;
                                    const lookupStatus = intel?.lookup_status || null;
                                    const extLookup = intel?.external_lookup || null;
                                    const complaints = intel?.complaint_sources || null;

                                    // Technical lookup status
                                    const techStatus = extLookup ? 'completed' : lookupStatus === 'no_service' ? 'no_service' : 'unavailable';
                                    const techLabel = techStatus === 'completed' ? 'Technical lookup completed' : techStatus === 'no_service' ? 'No technical lookup service configured' : 'Technical lookup unavailable';
                                    const techColor = techStatus === 'completed' ? '#2563eb' : '#94a3b8';

                                    // Complaint source status
                                    const compStatus = complaints?.overall_status || 'unavailable';
                                    const compLabel = compStatus === 'match_found' ? 'Public complaint-source match found' : compStatus === 'no_match' ? 'No reliable public complaint-source match found' : 'Complaint-source lookup unavailable';
                                    const compColor = compStatus === 'match_found' ? '#dc2626' : compStatus === 'no_match' ? '#16a34a' : '#94a3b8';

                                    // Web corroboration status
                                    const webCorr = intel?.web_corroboration || null;
                                    const webStatus = webCorr?.status || 'not_performed';
                                    const webLabel = webStatus === 'corroboration_found' ? 'Number-specific corroboration found' : webStatus === 'no_corroboration' ? 'Web search performed â€” no number-specific corroboration' : webStatus === 'unavailable' ? 'Web search unavailable' : 'Web search not performed';
                                    const webColor = webStatus === 'corroboration_found' ? '#dc2626' : webStatus === 'no_corroboration' ? '#16a34a' : '#94a3b8';

                                    // Gemini corroboration status
                                    const gemCorr = intel?.gemini_corroboration || null;
                                    const gemStatus = gemCorr?.status || 'not_performed';
                                    const gemLabel = gemStatus === 'corroboration_found' ? 'Gemini corroboration found'
                                        : gemStatus === 'related_evidence' ? 'Gemini found related evidence'
                                            : gemStatus === 'no_corroboration' ? 'Gemini found no number-specific corroboration'
                                                : gemStatus === 'unavailable' ? 'Gemini unavailable'
                                                    : 'Gemini not performed';
                                    const gemColor = gemStatus === 'corroboration_found' ? '#dc2626' : gemStatus === 'related_evidence' ? '#d97706' : gemStatus === 'no_corroboration' ? '#16a34a' : '#94a3b8';

                                    return (
                                        <div className="aitriage-field" style={{ marginTop: '0.5rem' }}>
                                            <div className="aitriage-review-divider" />
                                            <span className="aitriage-label" style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '0.5rem' }}>
                                                <Search size={13} /> Number Intelligence
                                            </span>

                                            {!phoneNumber && !intel && (
                                                <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0.35rem 0 0', fontStyle: 'italic' }}>
                                                    No phone number available for number intelligence.
                                                </p>
                                            )}

                                            {phoneNumber && (!intel || aiTriage.raw_response?.number_intel_pending) && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#2563eb', margin: '0.35rem 0 0' }}>
                                                    <Loader2 size={13} className="dsf-spinner" />
                                                    Building number intelligence â€” awaiting corroboration sourcesâ€¦
                                                </div>
                                            )}

                                            {intel && (
                                                <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                    {/* Reported number */}
                                                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem' }}>
                                                        <span style={{ color: '#64748b', minWidth: '120px' }}>Reported number:</span>
                                                        <span style={{ color: '#1e293b', fontWeight: 500 }}>{intel.phone_number || 'â€”'}</span>
                                                    </div>

                                                    {/* Technical lookup status */}
                                                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem', alignItems: 'center' }}>
                                                        <span style={{ color: '#64748b', minWidth: '120px' }}>Technical lookup:</span>
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                            fontSize: '0.76rem', fontWeight: 600, color: techColor,
                                                            background: techStatus === 'completed' ? '#eff6ff' : '#f8fafc',
                                                            padding: '2px 8px', borderRadius: '4px',
                                                            border: `1px solid ${techStatus === 'completed' ? '#bfdbfe' : '#e2e8f0'}`,
                                                        }}>
                                                            {techLabel}
                                                        </span>
                                                    </div>

                                                    {/* Complaint source status */}
                                                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem', alignItems: 'center' }}>
                                                        <span style={{ color: '#64748b', minWidth: '120px' }}>Complaint sources:</span>
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                            fontSize: '0.76rem', fontWeight: 600, color: compColor,
                                                            background: compStatus === 'match_found' ? '#fef2f2' : compStatus === 'no_match' ? '#f0fdf4' : '#f8fafc',
                                                            padding: '2px 8px', borderRadius: '4px',
                                                            border: `1px solid ${compStatus === 'match_found' ? '#fecaca' : compStatus === 'no_match' ? '#bbf7d0' : '#e2e8f0'}`,
                                                        }}>
                                                            {compLabel}
                                                        </span>
                                                    </div>

                                                    {/* Web corroboration status */}
                                                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem', alignItems: 'center' }}>
                                                        <span style={{ color: '#64748b', minWidth: '120px' }}>Web corroboration:</span>
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                            fontSize: '0.76rem', fontWeight: 600, color: webColor,
                                                            background: webStatus === 'corroboration_found' ? '#fef2f2' : webStatus === 'no_corroboration' ? '#f0fdf4' : '#f8fafc',
                                                            padding: '2px 8px', borderRadius: '4px',
                                                            border: `1px solid ${webStatus === 'corroboration_found' ? '#fecaca' : webStatus === 'no_corroboration' ? '#bbf7d0' : '#e2e8f0'}`,
                                                        }}>
                                                            {webLabel}
                                                        </span>
                                                    </div>

                                                    {/* Web corroboration summary */}
                                                    {webCorr && webCorr.search_performed && webCorr.summary && (
                                                        <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '0.5rem 0.65rem', border: '1px solid #e2e8f0', marginTop: '0.1rem' }}>
                                                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Web Search Findings</span>
                                                            <div style={{ fontSize: '0.79rem', color: '#475569', marginTop: '0.25rem', lineHeight: 1.45 }}>
                                                                {webCorr.summary}
                                                            </div>
                                                            {Array.isArray(webCorr.sources) && webCorr.sources.length > 0 && (
                                                                <div style={{ marginTop: '0.3rem', fontSize: '0.72rem', color: '#64748b' }}>
                                                                    Sources: {webCorr.sources.map((url: string, i: number) => (
                                                                        <span key={i}>{i > 0 ? ', ' : ''}<a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>{new URL(url).hostname}</a></span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Gemini corroboration status */}
                                                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem', alignItems: 'center' }}>
                                                        <span style={{ color: '#64748b', minWidth: '120px' }}>Gemini search:</span>
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                            fontSize: '0.76rem', fontWeight: 600, color: gemColor,
                                                            background: gemStatus === 'corroboration_found' ? '#fef2f2' : gemStatus === 'related_evidence' ? '#fff7ed' : gemStatus === 'no_corroboration' ? '#f0fdf4' : '#f8fafc',
                                                            padding: '2px 8px', borderRadius: '4px',
                                                            border: `1px solid ${gemStatus === 'corroboration_found' ? '#fecaca' : gemStatus === 'related_evidence' ? '#fed7aa' : gemStatus === 'no_corroboration' ? '#bbf7d0' : '#e2e8f0'}`,
                                                        }}>
                                                            {gemLabel}
                                                        </span>
                                                    </div>

                                                    {/* Gemini corroboration summary */}
                                                    {gemCorr && gemCorr.search_performed && gemCorr.summary && (
                                                        <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '0.5rem 0.65rem', border: '1px solid #e2e8f0', marginTop: '0.1rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Gemini Findings</span>
                                                                {gemCorr.classification && (
                                                                    <span style={{
                                                                        fontSize: '0.65rem', fontWeight: 600, padding: '1px 5px', borderRadius: '3px',
                                                                        color: gemCorr.classification === 'direct_match' ? '#dc2626' : gemCorr.classification === 'related_match' ? '#d97706' : '#64748b',
                                                                        background: gemCorr.classification === 'direct_match' ? '#fef2f2' : gemCorr.classification === 'related_match' ? '#fff7ed' : '#f1f5f9',
                                                                    }}>
                                                                        {gemCorr.classification === 'direct_match' ? 'Direct match' : gemCorr.classification === 'related_match' ? 'Related match' : gemCorr.classification === 'generic_only' ? 'Generic only' : 'No evidence'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '0.79rem', color: '#475569', marginTop: '0.25rem', lineHeight: 1.45 }}>{gemCorr.summary}</div>
                                                            {Array.isArray(gemCorr.sources) && gemCorr.sources.length > 0 && (
                                                                <div style={{ marginTop: '0.3rem', fontSize: '0.72rem', color: '#64748b' }}>
                                                                    Sources: {gemCorr.sources.map((url: string, i: number) => (
                                                                        <span key={i}>{i > 0 ? ', ' : ''}<a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>{(() => { try { return new URL(url).hostname; } catch { return url; } })()}</a></span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Sources checked */}
                                                    {Array.isArray(intel.sources_checked) && intel.sources_checked.length > 0 && (
                                                        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem' }}>
                                                            <span style={{ color: '#64748b', minWidth: '120px' }}>Sources checked:</span>
                                                            <span style={{ color: '#1e293b' }}>{intel.sources_checked.join(', ')}</span>
                                                        </div>
                                                    )}

                                                    {/* Scam likelihood score */}
                                                    {intel.scam_likelihood && intel.scam_likelihood.score != null && (
                                                        <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '0.5rem 0.65rem', border: '1px solid #e2e8f0', marginTop: '0.1rem' }}>
                                                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Scam Likelihood</span>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.3rem' }}>
                                                                {/* Score bar */}
                                                                <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                                                    <div style={{
                                                                        height: '100%', borderRadius: '4px',
                                                                        width: `${Math.min(100, Math.max(0, intel.scam_likelihood.score))}%`,
                                                                        background: intel.scam_likelihood.score >= 80 ? '#dc2626' : intel.scam_likelihood.score >= 60 ? '#ea580c' : intel.scam_likelihood.score >= 40 ? '#d97706' : intel.scam_likelihood.score >= 20 ? '#65a30d' : '#16a34a',
                                                                    }} />
                                                                </div>
                                                                <span style={{ fontSize: '0.79rem', fontWeight: 600, color: '#1e293b', minWidth: '2.5rem', textAlign: 'right' }}>
                                                                    {intel.scam_likelihood.score}%
                                                                </span>
                                                            </div>
                                                            {intel.scam_likelihood.label && (
                                                                <span style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                                                                    {intel.scam_likelihood.label}
                                                                </span>
                                                            )}
                                                            {intel.scam_likelihood.explanation && (
                                                                <div style={{ fontSize: '0.79rem', color: '#475569', marginTop: '0.25rem', lineHeight: 1.45 }}>
                                                                    {intel.scam_likelihood.explanation}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Evidence Strength */}
                                                    {intel.evidence_strength && (
                                                        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem', alignItems: 'center' }}>
                                                            <span style={{ color: '#64748b', minWidth: '120px' }}>Evidence strength:</span>
                                                            <span style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                                fontSize: '0.76rem', fontWeight: 600,
                                                                color: intel.evidence_strength === 'strong_direct' ? '#dc2626' : intel.evidence_strength === 'moderate_related' ? '#d97706' : intel.evidence_strength === 'weak_generic' ? '#64748b' : '#94a3b8',
                                                                background: intel.evidence_strength === 'strong_direct' ? '#fef2f2' : intel.evidence_strength === 'moderate_related' ? '#fff7ed' : '#f8fafc',
                                                                padding: '2px 8px', borderRadius: '4px',
                                                                border: `1px solid ${intel.evidence_strength === 'strong_direct' ? '#fecaca' : intel.evidence_strength === 'moderate_related' ? '#fed7aa' : '#e2e8f0'}`,
                                                            }}>
                                                                {intel.evidence_strength === 'strong_direct' ? 'Strong â€” direct number-specific evidence'
                                                                    : intel.evidence_strength === 'moderate_related' ? 'Moderate â€” related number/prefix evidence'
                                                                        : intel.evidence_strength === 'weak_generic' ? 'Weak â€” generic advice only'
                                                                            : 'No external evidence'}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Spoofing Assessment */}
                                                    {intel.spoofing_assessment && intel.spoofing_assessment !== 'not_applicable' && (
                                                        <div style={{
                                                            background: intel.spoofing_assessment === 'possible_spoofing' ? '#fffbeb' : '#f8fafc',
                                                            borderRadius: '6px', padding: '0.5rem 0.65rem',
                                                            border: `1px solid ${intel.spoofing_assessment === 'possible_spoofing' ? '#fde68a' : '#e2e8f0'}`,
                                                            marginTop: '0.1rem',
                                                        }}>
                                                            <span style={{ fontSize: '0.72rem', color: intel.spoofing_assessment === 'possible_spoofing' ? '#92400e' : '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                                                {intel.spoofing_assessment === 'possible_spoofing' ? 'âš  Possible Spoofing / Impersonation'
                                                                    : intel.spoofing_assessment === 'likely_legitimate' ? 'Number appears legitimate'
                                                                        : 'Spoofing unlikely'}
                                                            </span>
                                                            {intel.spoofing_assessment === 'possible_spoofing' && (
                                                                <div style={{ fontSize: '0.76rem', color: '#92400e', marginTop: '0.25rem', lineHeight: 1.4 }}>
                                                                    This number may belong to a legitimate institution. The reported incident could involve caller ID spoofing or impersonation. Verify only through official contact channels.
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Number Risk Assessment */}
                                                    {intel.number_risk_assessment && (
                                                        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem' }}>
                                                            <span style={{ color: '#64748b', minWidth: '120px' }}>Number profile:</span>
                                                            <span style={{ color: '#475569', lineHeight: 1.4 }}>{intel.number_risk_assessment}</span>
                                                        </div>
                                                    )}

                                                    {/* External lookup data */}
                                                    {extLookup && (
                                                        <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '0.5rem 0.65rem', border: '1px solid #e2e8f0', marginTop: '0.1rem' }}>
                                                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>External Lookup Data</span>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.2rem 1rem', marginTop: '0.3rem', fontSize: '0.79rem' }}>
                                                                {extLookup.fraud_score != null && (
                                                                    <div><span style={{ color: '#64748b' }}>Fraud score: </span><span style={{ fontWeight: 600, color: extLookup.fraud_score >= 75 ? '#dc2626' : extLookup.fraud_score >= 50 ? '#d97706' : '#16a34a' }}>{extLookup.fraud_score}/100</span></div>
                                                                )}
                                                                {extLookup.line_type && (
                                                                    <div><span style={{ color: '#64748b' }}>Line type: </span><span style={{ color: '#1e293b' }}>{extLookup.line_type}</span></div>
                                                                )}
                                                                {extLookup.carrier && (
                                                                    <div><span style={{ color: '#64748b' }}>Carrier: </span><span style={{ color: '#1e293b' }}>{extLookup.carrier}</span></div>
                                                                )}
                                                                {extLookup.country && (
                                                                    <div><span style={{ color: '#64748b' }}>Country: </span><span style={{ color: '#1e293b' }}>{extLookup.country}</span></div>
                                                                )}
                                                                {extLookup.voip != null && (
                                                                    <div><span style={{ color: '#64748b' }}>VOIP: </span><span style={{ color: extLookup.voip ? '#d97706' : '#1e293b', fontWeight: extLookup.voip ? 600 : 400 }}>{extLookup.voip ? 'Yes' : 'No'}</span></div>
                                                                )}
                                                                {extLookup.recent_abuse != null && (
                                                                    <div><span style={{ color: '#64748b' }}>Recent abuse: </span><span style={{ color: extLookup.recent_abuse ? '#dc2626' : '#1e293b', fontWeight: extLookup.recent_abuse ? 600 : 400 }}>{extLookup.recent_abuse ? 'Yes' : 'No'}</span></div>
                                                                )}
                                                                {extLookup.active != null && (
                                                                    <div><span style={{ color: '#64748b' }}>Active: </span><span style={{ color: '#1e293b' }}>{extLookup.active ? 'Yes' : 'No'}</span></div>
                                                                )}
                                                                {extLookup.spammer != null && extLookup.spammer && (
                                                                    <div><span style={{ color: '#64748b' }}>Spammer: </span><span style={{ color: '#dc2626', fontWeight: 600 }}>Yes</span></div>
                                                                )}
                                                                {extLookup.prepaid != null && (
                                                                    <div><span style={{ color: '#64748b' }}>Prepaid: </span><span style={{ color: '#1e293b' }}>{extLookup.prepaid ? 'Yes' : 'No'}</span></div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Public complaint matches */}
                                                    {intel.complaint_sources && intel.complaint_sources.overall_status !== 'unavailable' && (
                                                        <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '0.5rem 0.65rem', border: '1px solid #e2e8f0', marginTop: '0.1rem' }}>
                                                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Public Complaint Matches</span>
                                                            <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem', alignItems: 'center', marginTop: '0.3rem' }}>
                                                                <span style={{ color: '#64748b' }}>Status:</span>
                                                                <span style={{
                                                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                                    fontSize: '0.76rem', fontWeight: 600,
                                                                    color: intel.complaint_sources.overall_status === 'match_found' ? '#dc2626' : '#16a34a',
                                                                    background: intel.complaint_sources.overall_status === 'match_found' ? '#fef2f2' : '#f0fdf4',
                                                                    padding: '2px 8px', borderRadius: '4px',
                                                                    border: `1px solid ${intel.complaint_sources.overall_status === 'match_found' ? '#fecaca' : '#bbf7d0'}`,
                                                                }}>
                                                                    {intel.complaint_sources.overall_status === 'match_found' ? 'Complaint reports found' : 'No complaint reports found'}
                                                                </span>
                                                            </div>
                                                            {Array.isArray(intel.complaint_sources.results) && intel.complaint_sources.results.length > 0 && (
                                                                <div style={{ marginTop: '0.3rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                                                    {intel.complaint_sources.results.map((cr: any, ci: number) => (
                                                                        cr.status !== 'unavailable' && (
                                                                            <div key={ci} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.79rem', alignItems: 'center' }}>
                                                                                <span style={{
                                                                                    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                                                                                    background: cr.status === 'match_found' ? '#dc2626' : '#16a34a',
                                                                                }} />
                                                                                <span style={{ color: '#334155' }}>
                                                                                    {cr.summary || `${cr.source}: ${cr.status === 'match_found' ? 'Match found' : 'No match'}`}
                                                                                </span>
                                                                            </div>
                                                                        )
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Source findings summary */}
                                                    {intel.source_findings_summary && (
                                                        <div>
                                                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Source-Backed Findings</span>
                                                            <div style={{ fontSize: '0.82rem', color: '#334155', background: '#f8fafc', borderRadius: '6px', padding: '0.5rem 0.65rem', borderLeft: '3px solid #C9A84C', marginTop: '0.2rem', lineHeight: 1.5 }}>
                                                                {intel.source_findings_summary}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* AI assessment */}
                                                    {(intel.ai_assessment || intel.intelligence_summary) && (
                                                        <div>
                                                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>AI Assessment</span>
                                                            <div style={{ fontSize: '0.82rem', color: '#334155', background: '#fefce8', borderRadius: '6px', padding: '0.5rem 0.65rem', borderLeft: '3px solid #eab308', marginTop: '0.2rem', lineHeight: 1.5 }}>
                                                                {intel.ai_assessment || intel.intelligence_summary}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Pattern match */}
                                                    {intel.pattern_match && intel.pattern_match !== 'N/A' && (
                                                        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem' }}>
                                                            <span style={{ color: '#64748b', minWidth: '120px' }}>Pattern match:</span>
                                                            <span style={{ color: '#1e293b' }}>{intel.pattern_match}</span>
                                                        </div>
                                                    )}

                                                    {/* Risk indicators */}
                                                    {Array.isArray(intel.risk_indicators) && intel.risk_indicators.length > 0 && (
                                                        <div>
                                                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Risk indicators:</span>
                                                            <ul className="aitriage-bullets" style={{ marginTop: '0.15rem' }}>
                                                                {intel.risk_indicators.map((r: string, i: number) => <li key={i}>{r}</li>)}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {/* Recommended actions */}
                                                    {Array.isArray(intel.recommended_actions) && intel.recommended_actions.length > 0 && (
                                                        <div>
                                                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Recommended actions:</span>
                                                            <ul className="aitriage-bullets" style={{ marginTop: '0.15rem' }}>
                                                                {intel.recommended_actions.map((a: string, i: number) => <li key={i}>{a}</li>)}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {/* Limitations */}
                                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem', lineHeight: 1.4, fontStyle: 'italic' }}>
                                                        {intel.limitations || 'This is indicative intelligence, not legal proof. External source checks are limited to configured services.'}
                                                    </div>

                                                    {/* Checked timestamp */}
                                                    {intel.checked_at && (
                                                        <span style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>Checked: {fmtDateTime(intel.checked_at)}</span>
                                                    )}

                                                    {/* Re-run button for admins */}
                                                    {canReview && phoneNumber && (
                                                        <button
                                                            type="button"
                                                            className="casedetail-btn casedetail-btn-action"
                                                            style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem', marginTop: '0.25rem', opacity: 0.8 }}
                                                            onClick={handleRunNumberIntel}
                                                            disabled={numberIntelLoading}
                                                        >
                                                            {numberIntelLoading ? <Loader2 size={13} className="dsf-spinner" /> : <Search size={13} />}
                                                            {numberIntelLoading ? 'Runningâ€¦' : 'Re-run Number Intelligence'}
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {numberIntelMsg && (
                                                <span style={{ display: 'block', fontSize: '0.75rem', marginTop: '0.4rem', color: numberIntelMsg.startsWith('Error') ? '#dc2626' : '#16a34a' }}>
                                                    {numberIntelMsg}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Already reviewed indicator */}
                                {aiTriage.reviewed_at && (
                                    <div className="aitriage-reviewed-banner">
                                        <CheckCircle2 size={13} />
                                        Reviewed{aiTriage.accepted ? ' & Accepted' : ''} on {fmtDateTime(aiTriage.reviewed_at)}
                                    </div>
                                )}

                                {/* Manager/Admin review controls */}
                                {canReview && (
                                    <div className="aitriage-review-section">
                                        <div className="aitriage-review-divider" />

                                        {!aiTriage.accepted && (
                                            <button
                                                type="button"
                                                className="casedetail-btn casedetail-btn-save"
                                                style={{ width: '100%', justifyContent: 'center', marginBottom: '0.75rem' }}
                                                onClick={handleAcceptAi}
                                                disabled={aiAccepting || aiSaving}
                                            >
                                                {aiAccepting ? <Loader2 size={15} className="dsf-spinner" /> : <CheckCircle2 size={15} />}
                                                {aiAccepting ? 'Acceptingâ€¦' : 'Accept AI Suggestions'}
                                            </button>
                                        )}

                                        <div className="aitriage-override-form">
                                            <span className="aitriage-label" style={{ marginBottom: '0.25rem' }}>Override / Final Assessment</span>
                                            <div className="casedetail-form-field">
                                                <label className="casedetail-form-label">Risk Level</label>
                                                <select className="dsf-input" value={aiHumanRisk} onChange={(e) => setAiHumanRisk(e.target.value)}>
                                                    <option value="">â€” Select â€”</option>
                                                    {RISK_OPTIONS.map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                                                </select>
                                            </div>
                                            <div className="casedetail-form-field">
                                                <label className="casedetail-form-label">Category</label>
                                                <select className="dsf-input" value={aiHumanCategory} onChange={(e) => setAiHumanCategory(e.target.value)}>
                                                    <option value="">â€” Select â€”</option>
                                                    {CATEGORY_OPTIONS.map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                                                </select>
                                            </div>
                                            <div className="casedetail-form-field">
                                                <label className="casedetail-form-label">Urgency</label>
                                                <select className="dsf-input" value={aiHumanUrgency} onChange={(e) => setAiHumanUrgency(e.target.value)}>
                                                    <option value="">â€” Select â€”</option>
                                                    {RISK_OPTIONS.map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                                                </select>
                                            </div>
                                            <div className="casedetail-form-field">
                                                <label className="casedetail-form-label">Notes</label>
                                                <textarea
                                                    className="dsf-textarea"
                                                    rows={2}
                                                    value={aiHumanNotes}
                                                    onChange={(e) => setAiHumanNotes(e.target.value)}
                                                    placeholder="Override notesâ€¦"
                                                    style={{ minHeight: '60px' }}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                className="casedetail-btn casedetail-btn-action"
                                                style={{ width: '100%', justifyContent: 'center' }}
                                                onClick={handleSaveAiReview}
                                                disabled={aiSaving || aiAccepting}
                                            >
                                                {aiSaving ? <Loader2 size={15} className="dsf-spinner" /> : <Shield size={15} />}
                                                {aiSaving ? 'Savingâ€¦' : 'Save Review'}
                                            </button>
                                        </div>

                                        {aiMsg && (
                                            <span style={{ display: 'block', fontSize: '0.75rem', marginTop: '0.5rem', color: aiMsg.startsWith('Error') ? '#dc2626' : '#16a34a' }}>
                                                {aiMsg}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                </div>
            </div>

            {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            {/* CASE HISTORY (COLLAPSIBLE)                                     */}
            {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <div className="casedetail-section" style={{ marginTop: '1.5rem' }}>
                <h2
                    className="casedetail-section-title"
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => setHistoryOpen(prev => !prev)}
                >
                    <Clock size={16} /> Case History
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                        {historyOpen ? 'â–¾ collapse' : 'â–¸ expand'} ({caseHistory.length})
                    </span>
                </h2>
                {historyOpen && (
                    caseHistory.length === 0 ? (
                        <p className="casedetail-empty">No history entries found.</p>
                    ) : (
                        <div className="dashboard-panel-table-wrap">
                            <table className="dashboard-panel-table">
                                <thead>
                                    <tr><th>Source</th><th>Action</th><th>Actor</th><th>Time</th></tr>
                                </thead>
                                <tbody>
                                    {caseHistory.map(entry => (
                                        <tr key={entry.id}>
                                            <td>{entry.source}</td>
                                            <td>{entry.action}</td>
                                            <td>{entry.actor_type ?? 'â€”'}</td>
                                            <td>{fmtDateTime(entry.created_at)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>

            {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            {/* LOG ACTION MODAL                                              */}
            {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
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
                                <option value="">â€” Select â€”</option>
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
                                placeholder="Describe the action takenâ€¦"
                            />
                        </div>
                        <div className="casedetail-form-field" style={{ marginTop: '0.75rem' }}>
                            <label className="casedetail-form-label">Attachment URL (optional)</label>
                            <input
                                type="text"
                                className="dsf-input"
                                value={actionAttachUrl}
                                onChange={(e) => setActionAttachUrl(e.target.value)}
                                placeholder="https://â€¦"
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
                                {actionSaving ? 'Loggingâ€¦' : 'Log Action'}
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
