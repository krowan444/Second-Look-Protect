import React, { useState, useRef, useCallback } from 'react';
import {
    Upload, Loader2, AlertTriangle, CheckCircle2,
    Phone, MessageSquare, Mail, Globe, FileWarning,
    Users, DollarSign, ShieldAlert, ClipboardList,
    ChevronDown, ChevronUp, X, Paperclip,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const INCIDENT_TYPES = [
    { value: 'suspicious_phone_call', label: 'Suspicious Phone Call', icon: Phone },
    { value: 'suspicious_message', label: 'Suspicious Message (SMS / WhatsApp / Social)', icon: MessageSquare },
    { value: 'suspicious_email', label: 'Suspicious Email', icon: Mail },
    { value: 'suspicious_website', label: 'Suspicious Website / Link (URL)', icon: Globe },
    { value: 'suspicious_letter', label: 'Suspicious Letter / Post', icon: FileWarning },
    { value: 'in_person_incident', label: 'In-Person / Doorstep Incident', icon: Users },
    { value: 'financial_concern', label: 'Financial Concern (Possible Exploitation)', icon: DollarSign },
    { value: 'general_safeguarding_note', label: 'General Safeguarding Note', icon: ShieldAlert },
] as const;

type IncidentType = (typeof INCIDENT_TYPES)[number]['value'];

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

function resolveOrgId(): string | null {
    return localStorage.getItem('slp_viewing_as_org_id')
        || localStorage.getItem('slp_active_org_id')
        || null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════════════════════════════════ */

interface SubmitCasePageProps {
    onNavigate?: (path: string) => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export function SubmitCasePage({ onNavigate }: SubmitCasePageProps) {

    /* ── Incident type ─────────────────────────────────────────────────────── */
    const [incidentType, setIncidentType] = useState<IncidentType | ''>('');
    const [typeListExpanded, setTypeListExpanded] = useState(true);

    /* ── Resident info ─────────────────────────────────────────────────────── */
    const [residentRef, setResidentRef] = useState('');
    const [roomLocation, setRoomLocation] = useState('');

    /* ── Type-specific fields (stored as meta JSON) ────────────────────────── */
    // Phone call
    const [callDate, setCallDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [callTime, setCallTime] = useState('');
    const [callPhone, setCallPhone] = useState('');
    const [callMoneyRequested, setCallMoneyRequested] = useState('');
    const [callInfoShared, setCallInfoShared] = useState('');
    const [callPaymentMade, setCallPaymentMade] = useState('');

    // Message
    const [msgPlatform, setMsgPlatform] = useState('');
    const [msgSender, setMsgSender] = useState('');
    const [msgLinkIncluded, setMsgLinkIncluded] = useState('');
    const [msgContent, setMsgContent] = useState('');
    const [msgMoneyRequested, setMsgMoneyRequested] = useState('');
    const [msgInfoShared, setMsgInfoShared] = useState('');
    const [msgPaymentMade, setMsgPaymentMade] = useState('');

    // Email
    const [emailSender, setEmailSender] = useState('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailLinkClicked, setEmailLinkClicked] = useState('');
    const [emailAttachOpened, setEmailAttachOpened] = useState('');
    const [emailContent, setEmailContent] = useState('');

    // Website
    const [webUrl, setWebUrl] = useState('');
    const [webHowAccessed, setWebHowAccessed] = useState('');
    const [webDetailsEntered, setWebDetailsEntered] = useState('');
    const [webNotes, setWebNotes] = useState('');

    // Letter
    const [letterSender, setLetterSender] = useState('');
    const [letterPaymentRequested, setLetterPaymentRequested] = useState('');
    const [letterMethod, setLetterMethod] = useState('');
    const [letterNotes, setLetterNotes] = useState('');

    // In-person
    const [inPersonOrg, setInPersonOrg] = useState('');
    const [inPersonAccess, setInPersonAccess] = useState('');
    const [inPersonMoney, setInPersonMoney] = useState('');
    const [inPersonDesc, setInPersonDesc] = useState('');

    // Financial concern
    const [finConcernType, setFinConcernType] = useState('');
    const [finUrgent, setFinUrgent] = useState('');
    const [finNotes, setFinNotes] = useState('');

    // General note
    const [genCategory, setGenCategory] = useState('');
    const [genNotes, setGenNotes] = useState('');

    /* ── Actions taken ─────────────────────────────────────────────────────── */
    const [actFamilyInformed, setActFamilyInformed] = useState(false);
    const [actBankContacted, setActBankContacted] = useState(false);
    const [actPoliceInformed, setActPoliceInformed] = useState(false);
    const [actSafeguardingLead, setActSafeguardingLead] = useState(false);
    const [actResidentAdvised, setActResidentAdvised] = useState(false);
    const [actDeviceSecured, setActDeviceSecured] = useState(false);
    const [actEscalated, setActEscalated] = useState(false);
    const [actEscalationNotes, setActEscalationNotes] = useState('');
    const [actPoliceRef, setActPoliceRef] = useState('');
    const [actBankRef, setActBankRef] = useState('');

    /* ── Summary ───────────────────────────────────────────────────────────── */
    const [summary, setSummary] = useState('');

    /* ── Evidence upload ───────────────────────────────────────────────────── */
    const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    /* ── More details expander ─────────────────────────────────────────────── */
    const [showMore, setShowMore] = useState(false);

    /* ── UI state ──────────────────────────────────────────────────────────── */
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showToast, setShowToast] = useState(false);

    /* ── File handlers ─────────────────────────────────────────────────────── */
    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        setEvidenceFiles(prev => [...prev, ...files]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    const removeFile = useCallback((idx: number) => {
        setEvidenceFiles(prev => prev.filter((_, i) => i !== idx));
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files).filter((f: File) =>
            f.type.startsWith('image/') || f.type === 'application/pdf'
        );
        setEvidenceFiles(prev => [...prev, ...files]);
    }, []);

    /* ── Build meta JSON from type-specific fields ─────────────────────────── */
    function buildMeta(): Record<string, any> {
        const meta: Record<string, any> = {
            incident_type: incidentType,
            resident_reference: residentRef.trim(),
            room_location: roomLocation.trim(),
            actions_taken: {
                family_informed: actFamilyInformed,
                bank_contacted: actBankContacted,
                police_informed: actPoliceInformed,
                safeguarding_lead_informed: actSafeguardingLead,
                resident_advised: actResidentAdvised,
                device_secured: actDeviceSecured,
                escalated_internally: actEscalated,
                escalation_notes: actEscalationNotes.trim() || null,
                police_reference: actPoliceRef.trim() || null,
                bank_reference: actBankRef.trim() || null,
            },
            evidence: [], // will be populated after upload
        };

        switch (incidentType) {
            case 'suspicious_phone_call':
                meta.details = {
                    date: callDate, time: callTime || null, phone_number: callPhone || null,
                    money_requested: callMoneyRequested || null, information_shared: callInfoShared || null,
                    payment_made: callPaymentMade || null,
                };
                break;
            case 'suspicious_message':
                meta.details = {
                    platform: msgPlatform || null, sender: msgSender || null,
                    link_included: msgLinkIncluded || null, message_content: msgContent || null,
                    money_requested: msgMoneyRequested || null, information_shared: msgInfoShared || null,
                    payment_made: msgPaymentMade || null,
                };
                break;
            case 'suspicious_email':
                meta.details = {
                    sender_email: emailSender || null, subject: emailSubject || null,
                    link_clicked: emailLinkClicked || null, attachment_opened: emailAttachOpened || null,
                    email_content: emailContent || null,
                };
                break;
            case 'suspicious_website':
                meta.details = {
                    url: webUrl || null, how_accessed: webHowAccessed || null,
                    details_entered: webDetailsEntered || null, notes: webNotes || null,
                };
                break;
            case 'suspicious_letter':
                meta.details = {
                    claimed_sender: letterSender || null, payment_requested: letterPaymentRequested || null,
                    method_requested: letterMethod || null, notes: letterNotes || null,
                };
                break;
            case 'in_person_incident':
                meta.details = {
                    claimed_organisation: inPersonOrg || null, access_gained: inPersonAccess || null,
                    money_requested: inPersonMoney || null, description: inPersonDesc || null,
                };
                break;
            case 'financial_concern':
                meta.details = {
                    concern_type: finConcernType || null, urgent: finUrgent || null, notes: finNotes || null,
                };
                break;
            case 'general_safeguarding_note':
                meta.details = {
                    category: genCategory || null, notes: genNotes || null,
                };
                break;
        }

        return meta;
    }

    /* ── Submit handler ────────────────────────────────────────────────────── */
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!incidentType) { setError('Please select what happened.'); return; }
        if (!residentRef.trim()) { setError('Resident reference is required.'); return; }
        if (!summary.trim()) { setError('Please provide a summary of what happened.'); return; }

        setSubmitting(true);

        try {
            const supabase = getSupabase();

            /* 1. Get session */
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) { setError('You are not logged in.'); setSubmitting(false); return; }

            /* 2. Fetch profile to determine role + organisation */
            const { data: profile } = await supabase
                .from('profiles')
                .select('organisation_id, role')
                .eq('id', session.user.id)
                .single();

            /* 3. Resolve organisation_id based on role */
            let finalOrgId: string | null = null;
            if (profile?.role === 'super_admin') {
                // Super admins use the "Viewing as" context from localStorage
                finalOrgId = resolveOrgId();
                if (!finalOrgId) { setError('Please select an organisation before submitting a case.'); setSubmitting(false); return; }
            } else {
                // Staff / org_admin — use their own profile org
                finalOrgId = profile?.organisation_id ?? null;
                if (!finalOrgId) { setError('Your account is not assigned to an organisation. Please contact an admin.'); setSubmitting(false); return; }
            }

            /* 3. Insert case row first (to get case ID for storage path) */
            const meta = buildMeta();

            const row: Record<string, unknown> = {
                organisation_id: finalOrgId,
                submitted_by: session.user.id,
                submission_type: incidentType,
                description: summary.trim(),
                status: 'new',
                resident_ref: residentRef.trim() || null,
                attachment_url: null,
                meta,
            };

            const { data: inserted, error: insertErr } = await supabase
                .from('cases')
                .insert(row)
                .select('id')
                .single();

            if (insertErr) throw new Error(`Case insert failed: ${insertErr.message}`);
            const caseId = inserted.id;

            /* 4. Upload evidence files to `evidence` bucket */
            const evidenceUrls: { path: string; url: string }[] = [];

            if (evidenceFiles.length > 0) {
                for (const file of evidenceFiles) {
                    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const path = `${finalOrgId}/${caseId}/${Date.now()}-${sanitized}`;

                    const { error: uploadErr } = await supabase.storage
                        .from('evidence')
                        .upload(path, file, { cacheControl: '3600', upsert: false });

                    if (uploadErr) {
                        console.error('[SLP] Evidence upload error:', uploadErr);
                        throw new Error(`Evidence upload failed for "${file.name}": ${uploadErr.message}`);
                    }

                    const { data: urlData } = supabase.storage
                        .from('evidence')
                        .getPublicUrl(path);

                    evidenceUrls.push({
                        path,
                        url: String(urlData.publicUrl).trim(),
                    });
                }

                /* 5. Update the case row with evidence URLs */
                meta.evidence = evidenceUrls;
                const { error: updateErr } = await supabase
                    .from('cases')
                    .update({
                        attachment_url: evidenceUrls[0]?.url || null,
                        meta,
                    })
                    .eq('id', caseId);

                if (updateErr) {
                    console.error('[SLP] Case update with evidence failed:', updateErr);
                    // Non-fatal — case was created, evidence was uploaded
                }
            }

            /* 6. Timeline event for compliance */
            if (inserted?.id) {
                try {
                    await supabase.rpc('add_case_timeline_event', {
                        p_case_id: inserted.id,
                        p_event_type: 'case_submitted',
                        p_before: null,
                        p_after: null,
                        p_meta: {
                            submission_type: incidentType,
                            resident_reference: residentRef.trim(),
                            actions_taken: meta.actions_taken,
                        },
                    });
                } catch {
                    // Timeline is best-effort — don't block the submission
                }
            }

            /* 7. Dispatch admin email alert for new case */
            try {
                await fetch('/api/email-dispatch', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        event_type: 'admin_case_created',
                        organisation_id: finalOrgId,
                        case_id: caseId,
                        context: { message: `New case submitted (${incidentType})` },
                    }),
                });
            } catch { /* Email dispatch is best-effort — never block submission */ }

            /* 8. Trigger AI triage generation (fire-and-forget, non-blocking) */
            try {
                console.log('[SLP] Triggering AI triage — case_id:', caseId, '| organisation_id:', finalOrgId);
                fetch('/api/ai-triage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ case_id: caseId, organisation_id: finalOrgId }),
                }).catch((err) => { console.warn('[SLP] AI triage fetch failed:', err); });
            } catch { /* AI triage is best-effort — never block submission */ }

            /* 8. Success → toast + navigate */
            setShowToast(true);
            setTimeout(() => {
                setShowToast(false);
                onNavigate?.('/dashboard/cases');
            }, 1800);

        } catch (err: any) {
            setError(err?.message ?? 'Failed to submit case. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    /* ═══════════════════════════════════════════════════════════════════════
       RENDER HELPERS
       ═══════════════════════════════════════════════════════════════════════ */

    function renderYesNo(
        label: string, value: string, onChange: (v: string) => void, hint?: string
    ) {
        return (
            <div className="dsf-field">
                <label className="dsf-label">{label}</label>
                {hint && <p className="dsf-hint">{hint}</p>}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {['Yes', 'No'].map(opt => (
                        <button key={opt} type="button"
                            className={`dsf-type-btn${value === opt ? ' dsf-type-btn--active' : ''}`}
                            style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                            onClick={() => onChange(opt)}
                            disabled={submitting}
                        >{opt}</button>
                    ))}
                </div>
            </div>
        );
    }

    function renderInput(
        label: string, value: string, onChange: (v: string) => void,
        opts?: { placeholder?: string; required?: boolean; type?: string; hint?: string }
    ) {
        return (
            <div className="dsf-field">
                <label className="dsf-label">
                    {label} {opts?.required
                        ? <span className="dsf-required">*</span>
                        : <span className="dsf-optional">(optional)</span>}
                </label>
                {opts?.hint && <p className="dsf-hint">{opts.hint}</p>}
                <input type={opts?.type ?? 'text'} className="dsf-input" value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={opts?.placeholder} disabled={submitting} />
            </div>
        );
    }

    function renderTextarea(
        label: string, value: string, onChange: (v: string) => void,
        opts?: { placeholder?: string; required?: boolean; hint?: string; rows?: number }
    ) {
        return (
            <div className="dsf-field">
                <label className="dsf-label">
                    {label} {opts?.required
                        ? <span className="dsf-required">*</span>
                        : <span className="dsf-optional">(optional)</span>}
                </label>
                {opts?.hint && <p className="dsf-hint">{opts.hint}</p>}
                <textarea className="dsf-textarea" rows={opts?.rows ?? 3} value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={opts?.placeholder} disabled={submitting} />
            </div>
        );
    }

    function renderSelect(
        label: string, value: string, onChange: (v: string) => void,
        options: string[], opts?: { hint?: string }
    ) {
        return (
            <div className="dsf-field">
                <label className="dsf-label">{label} <span className="dsf-optional">(optional)</span></label>
                {opts?.hint && <p className="dsf-hint">{opts.hint}</p>}
                <select className="dsf-input" value={value}
                    onChange={e => onChange(e.target.value)} disabled={submitting}
                    style={{ cursor: 'pointer' }}>
                    <option value="">— Select —</option>
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            </div>
        );
    }

    /* ── Type-specific fields ──────────────────────────────────────────────── */
    function renderTypeFields() {
        switch (incidentType) {
            case 'suspicious_phone_call':
                return (<>
                    {renderInput('Date', callDate, setCallDate, { type: 'date', hint: 'Date the call was received.' })}
                    {renderInput('Time', callTime, setCallTime, { type: 'time', hint: 'Approximate time of the call.' })}
                    {renderInput('Phone number displayed', callPhone, setCallPhone, { placeholder: 'e.g. +44 7700 000000' })}
                    {renderYesNo('Money requested?', callMoneyRequested, setCallMoneyRequested)}
                    {renderYesNo('Information shared?', callInfoShared, setCallInfoShared, 'Did the resident share personal or financial information?')}
                    {renderYesNo('Payment made?', callPaymentMade, setCallPaymentMade)}
                </>);
            case 'suspicious_message':
                return (<>
                    {renderSelect('Platform', msgPlatform, setMsgPlatform, ['SMS', 'WhatsApp', 'Messenger', 'Other'])}
                    {renderInput('Sender number or username', msgSender, setMsgSender)}
                    {renderYesNo('Link included?', msgLinkIncluded, setMsgLinkIncluded)}
                    {renderTextarea('Message content', msgContent, setMsgContent, { placeholder: 'Paste the message here if available…' })}
                    {renderYesNo('Money requested?', msgMoneyRequested, setMsgMoneyRequested)}
                    {renderYesNo('Information shared?', msgInfoShared, setMsgInfoShared, 'Did the resident share personal or financial information?')}
                    {renderYesNo('Payment made?', msgPaymentMade, setMsgPaymentMade)}
                </>);
            case 'suspicious_email':
                return (<>
                    {renderInput('Sender email', emailSender, setEmailSender, { placeholder: 'sender@example.com' })}
                    {renderInput('Subject', emailSubject, setEmailSubject)}
                    {renderYesNo('Link clicked?', emailLinkClicked, setEmailLinkClicked)}
                    {renderYesNo('Attachment opened?', emailAttachOpened, setEmailAttachOpened)}
                    {renderTextarea('Email content', emailContent, setEmailContent, { placeholder: 'Paste the email content here if available…' })}
                </>);
            case 'suspicious_website':
                return (<>
                    {renderInput('URL', webUrl, setWebUrl, { required: true, placeholder: 'https://…', hint: 'The suspicious website address.' })}
                    {renderInput('How accessed', webHowAccessed, setWebHowAccessed, { placeholder: 'e.g. link in email, typed in browser' })}
                    {renderYesNo('Details entered?', webDetailsEntered, setWebDetailsEntered, 'Were any personal or payment details entered?')}
                    {renderTextarea('Notes', webNotes, setWebNotes)}
                </>);
            case 'suspicious_letter':
                return (<>
                    {renderInput('Claimed sender', letterSender, setLetterSender, { placeholder: 'e.g. HMRC, bank name' })}
                    {renderYesNo('Payment requested?', letterPaymentRequested, setLetterPaymentRequested)}
                    {renderSelect('Method requested', letterMethod, setLetterMethod, ['Cash', 'Bank transfer', 'Gift cards', 'Other'])}
                    {renderTextarea('Notes', letterNotes, setLetterNotes)}
                </>);
            case 'in_person_incident':
                return (<>
                    {renderInput('Claimed organisation', inPersonOrg, setInPersonOrg, { placeholder: 'e.g. utility company, council' })}
                    {renderYesNo('Access gained?', inPersonAccess, setInPersonAccess, 'Did they gain entry to the building or room?')}
                    {renderYesNo('Money requested?', inPersonMoney, setInPersonMoney)}
                    {renderTextarea('Description', inPersonDesc, setInPersonDesc, { required: true, placeholder: 'Describe what happened…', rows: 4 })}
                </>);
            case 'financial_concern':
                return (<>
                    {renderSelect('Concern type', finConcernType, setFinConcernType, ['Pressure', 'Unusual withdrawals', 'POA concern', 'Other'])}
                    {renderYesNo('Urgent?', finUrgent, setFinUrgent, 'Does this need immediate attention?')}
                    {renderTextarea('Notes', finNotes, setFinNotes, { placeholder: 'Describe the concern…', rows: 4 })}
                </>);
            case 'general_safeguarding_note':
                return (<>
                    {renderInput('Category', genCategory, setGenCategory, { placeholder: 'e.g. welfare, behaviour change' })}
                    {renderTextarea('Notes', genNotes, setGenNotes, { placeholder: 'Describe the observation or concern…', rows: 4 })}
                </>);
            default:
                return null;
        }
    }

    /* ═══════════════════════════════════════════════════════════════════════
       RENDER
       ═══════════════════════════════════════════════════════════════════════ */
    return (
        <div>
            {/* Header */}
            <div className="dashboard-page-header">
                <h1 className="dashboard-page-title">Submit Case</h1>
                <p className="dashboard-page-subtitle">
                    Record a safeguarding concern or suspicious incident. All fields are confidential.
                </p>
            </div>

            <form className="dsf-card" onSubmit={handleSubmit} autoComplete="off">

                {/* ── Step 1: What happened? ───────────────────────────────── */}
                <div className="dsf-field">
                    <label className="dsf-label">
                        What happened? <span className="dsf-required">*</span>
                    </label>
                    <p className="dsf-hint">Select the type of incident you are reporting.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', overflow: 'hidden' }}>
                        {INCIDENT_TYPES.map(t => {
                            const Icon = t.icon;
                            const active = incidentType === t.value;
                            const isCollapsed = !typeListExpanded && incidentType !== '';
                            const hiding = isCollapsed && !active;
                            return (
                                <div key={t.value} style={{
                                    maxHeight: hiding ? '0px' : '80px',
                                    opacity: hiding ? 0 : 1,
                                    marginTop: hiding ? '0px' : '0.3rem',
                                    marginBottom: hiding ? '0px' : '0.3rem',
                                    overflow: 'hidden',
                                    borderRadius: '14px',
                                    transition: 'max-height 0.55s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.45s cubic-bezier(0.4, 0, 0.2, 1), margin 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
                                    pointerEvents: hiding ? 'none' : 'auto',
                                }}>
                                    <button type="button"
                                        className={`dsf-type-btn${active ? ' dsf-type-btn--active' : ''}`}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.65rem', width: '100%',
                                            padding: active && isCollapsed ? '0.5rem 0.85rem' : '0.8rem 1rem',
                                            textAlign: 'left', justifyContent: 'flex-start',
                                            fontSize: active && isCollapsed ? '0.84rem' : '0.85rem',
                                            transition: 'padding 0.55s cubic-bezier(0.4, 0, 0.2, 1), font-size 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
                                        }}
                                        onClick={() => {
                                            if (active && !typeListExpanded) {
                                                setTypeListExpanded(true);
                                            } else {
                                                setIncidentType(t.value);
                                                setTypeListExpanded(false);
                                                setError(null);
                                            }
                                        }}
                                        disabled={submitting}
                                    >
                                        <Icon size={active && isCollapsed ? 16 : 18} style={{ transition: 'all 0.55s cubic-bezier(0.4, 0, 0.2, 1)', flexShrink: 0 }} />
                                        <span style={{ flex: 1 }}>{t.label}</span>
                                        {active && isCollapsed && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', color: '#b0b8c4', fontWeight: 400 }}>
                                                Change <ChevronDown size={12} />
                                            </span>
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Step 2: Sections (only when type selected) ───────────── */}
                {incidentType && (
                    <>
                        {/* Resident Information */}
                        <div className="dashboard-panel" style={{ marginTop: '1.25rem' }}>
                            <div className="dashboard-panel-header">
                                <h2 className="dashboard-panel-title">
                                    <ClipboardList size={16} className="dashboard-panel-title-icon" />
                                    Resident Information
                                </h2>
                            </div>
                            <div style={{ padding: '1rem 1.25rem' }}>
                                {renderInput('Resident Reference', residentRef, setResidentRef, {
                                    required: true,
                                    placeholder: 'e.g. Initials or internal reference',
                                    hint: 'Use initials or internal reference if required by your policy.',
                                })}
                                {renderInput('Room / Location', roomLocation, setRoomLocation, {
                                    placeholder: 'e.g. Room 12',
                                })}
                            </div>
                        </div>

                        {/* Type-Specific Fields */}
                        <div className="dashboard-panel" style={{ marginTop: '1rem' }}>
                            <div className="dashboard-panel-header">
                                <h2 className="dashboard-panel-title">
                                    <ShieldAlert size={16} className="dashboard-panel-title-icon" />
                                    Incident Details
                                </h2>
                            </div>
                            <div style={{ padding: '1rem 1.25rem' }}>
                                {renderTypeFields()}
                            </div>
                        </div>

                        {/* Actions Taken */}
                        <div className="dashboard-panel" style={{ marginTop: '1rem' }}>
                            <div className="dashboard-panel-header">
                                <h2 className="dashboard-panel-title">
                                    <CheckCircle2 size={16} className="dashboard-panel-title-icon" />
                                    Actions Taken
                                </h2>
                            </div>
                            <div style={{ padding: '1rem 1.25rem' }}>
                                <p className="dsf-hint" style={{ marginBottom: '0.75rem' }}>Tick any actions already taken.</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {[
                                        { label: 'Family informed', checked: actFamilyInformed, set: setActFamilyInformed },
                                        { label: 'Bank contacted', checked: actBankContacted, set: setActBankContacted },
                                        { label: 'Police informed', checked: actPoliceInformed, set: setActPoliceInformed },
                                        { label: 'Safeguarding lead informed', checked: actSafeguardingLead, set: setActSafeguardingLead },
                                        { label: 'Resident advised / reassured', checked: actResidentAdvised, set: setActResidentAdvised },
                                        { label: 'Device / account secured', checked: actDeviceSecured, set: setActDeviceSecured },
                                        { label: 'Escalated internally', checked: actEscalated, set: setActEscalated },
                                    ].map(item => (
                                        <label key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem', color: '#334155' }}>
                                            <input type="checkbox" checked={item.checked}
                                                onChange={e => item.set(e.target.checked)} disabled={submitting}
                                                style={{ width: '18px', height: '18px', accentColor: '#C9A84C' }} />
                                            {item.label}
                                        </label>
                                    ))}

                                    {/* Escalation notes — visible when escalated */}
                                    {actEscalated && (
                                        <div style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                                            <label className="dsf-label" style={{ fontSize: '0.82rem' }}>
                                                Escalation notes <span className="dsf-optional">(optional)</span>
                                            </label>
                                            <textarea className="dsf-textarea" rows={3}
                                                value={actEscalationNotes}
                                                onChange={e => setActEscalationNotes(e.target.value)}
                                                placeholder="Who was this escalated to and any notes…"
                                                disabled={submitting} />
                                        </div>
                                    )}
                                </div>

                                {/* Optional ref numbers — collapsible */}
                                <button type="button" onClick={() => setShowMore(!showMore)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.75rem', padding: '0.4rem 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', color: '#64748b', fontFamily: 'inherit' }}>
                                    {showMore ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    {showMore ? 'Hide additional details' : 'Add more details'}
                                </button>

                                {showMore && (
                                    <div style={{ marginTop: '0.5rem' }}>
                                        {renderInput('Police reference number', actPoliceRef, setActPoliceRef, { placeholder: 'e.g. CR/12345/24' })}
                                        {renderInput('Bank reference / case number', actBankRef, setActBankRef)}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="dashboard-panel" style={{ marginTop: '1rem' }}>
                            <div className="dashboard-panel-header">
                                <h2 className="dashboard-panel-title">
                                    <ClipboardList size={16} className="dashboard-panel-title-icon" />
                                    Summary
                                </h2>
                            </div>
                            <div style={{ padding: '1rem 1.25rem' }}>
                                {renderTextarea('Summary of what happened', summary, setSummary, {
                                    required: true,
                                    rows: 5,
                                    placeholder: 'Write what happened in plain English. This will help generate the safeguarding report.',
                                    hint: 'Write what happened in plain English. This will help generate the safeguarding report.',
                                })}
                            </div>
                        </div>

                        {/* Evidence Upload */}
                        <div className="dashboard-panel" style={{ marginTop: '1rem' }}>
                            <div className="dashboard-panel-header">
                                <h2 className="dashboard-panel-title">
                                    <Paperclip size={16} className="dashboard-panel-title-icon" />
                                    Upload Evidence
                                    <span className="dsf-optional" style={{ marginLeft: '0.5rem' }}>(optional)</span>
                                </h2>
                            </div>
                            <div style={{ padding: '1rem 1.25rem' }}>
                                {/* Drop zone */}
                                <div
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{
                                        border: '2px dashed #cbd5e1', borderRadius: '10px', padding: '1.5rem',
                                        textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s',
                                        background: '#f8fafc',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#C9A84C')}
                                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#cbd5e1')}
                                >
                                    <Upload size={28} style={{ color: '#94a3b8', margin: '0 auto 0.5rem' }} />
                                    <p style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
                                        Drag &amp; drop files here, or click to browse
                                    </p>
                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                                        Images (JPG, PNG, WEBP) and PDFs accepted
                                    </p>
                                </div>
                                <input ref={fileInputRef} type="file" multiple
                                    accept="image/*,.pdf" onChange={handleFileSelect}
                                    style={{ display: 'none' }} />

                                {/* File list */}
                                {evidenceFiles.length > 0 && (
                                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                        {evidenceFiles.map((f, i) => (
                                            <div key={i} style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '0.5rem 0.65rem', background: '#f1f5f9', borderRadius: '6px', fontSize: '0.82rem',
                                            }}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#334155' }}>
                                                    {f.name} <span style={{ color: '#94a3b8' }}>({(f.size / 1024).toFixed(0)} KB)</span>
                                                </span>
                                                <button type="button" onClick={() => removeFile(i)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#94a3b8' }}>
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="dsf-error" style={{ marginTop: '1rem' }}>
                                <AlertTriangle size={16} />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Submit */}
                        <div className="dsf-actions" style={{ marginTop: '1.25rem' }}>
                            <button type="submit" className="dsf-submit-btn" disabled={submitting}>
                                {submitting ? (
                                    <><Loader2 size={18} className="dsf-spinner" /> Submitting…</>
                                ) : (
                                    <><Upload size={18} /> Submit Case</>
                                )}
                            </button>
                        </div>
                    </>
                )}

                {/* Error (shown when no type selected but error set) */}
                {!incidentType && error && (
                    <div className="dsf-error" style={{ marginTop: '1rem' }}>
                        <AlertTriangle size={16} />
                        <span>{error}</span>
                    </div>
                )}
            </form>

            {/* Success toast */}
            {showToast && (
                <div className="dsf-toast">
                    <CheckCircle2 size={18} />
                    <span>Case submitted successfully</span>
                </div>
            )}
        </div>
    );
}
