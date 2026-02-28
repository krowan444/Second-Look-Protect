import React, { useState } from 'react';
import {
    Upload, Loader2, AlertTriangle, CheckCircle2,
    FileText, Image, Phone, Mail,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

/* ─── Submission type options ────────────────────────────────────────────── */

const SUBMISSION_TYPES = [
    { value: 'text', label: 'Text / Message', icon: FileText },
    { value: 'image', label: 'Image / Screenshot', icon: Image },
    { value: 'call_notes', label: 'Call Notes', icon: Phone },
    { value: 'email', label: 'Email', icon: Mail },
] as const;

type SubmissionType = (typeof SUBMISSION_TYPES)[number]['value'];

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface SubmitCasePageProps {
    onNavigate?: (path: string) => void;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function SubmitCasePage({ onNavigate }: SubmitCasePageProps) {
    /* Form state */
    const [submissionType, setSubmissionType] = useState<SubmissionType>('text');
    const [content, setContent] = useState('');
    const [attachmentUrl, setAttachmentUrl] = useState('');
    const [residentRef, setResidentRef] = useState('');

    /* UI state */
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showToast, setShowToast] = useState(false);

    /* ── Submit handler ────────────────────────────────────────────────────── */
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!content.trim()) {
            setError('Please enter the case content before submitting.');
            return;
        }

        setSubmitting(true);

        try {
            const supabase = getSupabase();

            /* 1. Get session */
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                setError('You are not logged in. Please refresh and try again.');
                setSubmitting(false);
                return;
            }

            /* 2. Fetch profile → organisation_id */
            const { data: profile, error: profErr } = await supabase
                .from('profiles')
                .select('organisation_id')
                .eq('id', session.user.id)
                .single();

            if (profErr || !profile?.organisation_id) {
                setError('Could not determine your organisation. Please contact your administrator.');
                setSubmitting(false);
                return;
            }

            /* 3. Insert into submissions */
            const row: Record<string, unknown> = {
                organisation_id: profile.organisation_id,
                submitted_by: session.user.id,
                submission_type: submissionType,
                message: content.trim(),
                status: 'submitted',
                submitted_at: new Date().toISOString(),
            };

            if (attachmentUrl.trim()) {
                row.attachment_url = attachmentUrl.trim();
            }
            if (residentRef.trim()) {
                row.resident_ref = residentRef.trim();
            }

            const { error: insertErr } = await supabase
                .from('submissions')
                .insert(row);

            if (insertErr) {
                throw insertErr;
            }

            /* 4. Success → toast + navigate */
            setShowToast(true);
            setTimeout(() => {
                setShowToast(false);
                if (onNavigate) {
                    onNavigate('/dashboard/cases');
                }
            }, 1800);
        } catch (err: any) {
            setError(err?.message ?? 'Failed to submit case. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    /* ── Render ─────────────────────────────────────────────────────────────── */
    return (
        <div>
            {/* Header */}
            <div className="dashboard-page-header">
                <h1 className="dashboard-page-title">Submit Case</h1>
                <p className="dashboard-page-subtitle">
                    Upload a suspicious message, link, or screenshot for expert safeguarding review.
                </p>
            </div>

            {/* Form card */}
            <form className="dsf-card" onSubmit={handleSubmit} autoComplete="off">

                {/* Submission type */}
                <div className="dsf-field">
                    <label className="dsf-label" htmlFor="dsf-type">
                        Submission Type <span className="dsf-required">*</span>
                    </label>
                    <div className="dsf-type-grid">
                        {SUBMISSION_TYPES.map((t) => {
                            const Icon = t.icon;
                            const active = submissionType === t.value;
                            return (
                                <button
                                    key={t.value}
                                    type="button"
                                    className={`dsf-type-btn${active ? ' dsf-type-btn--active' : ''}`}
                                    onClick={() => setSubmissionType(t.value)}
                                >
                                    <Icon size={20} />
                                    <span>{t.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Content */}
                <div className="dsf-field">
                    <label className="dsf-label" htmlFor="dsf-content">
                        Content <span className="dsf-required">*</span>
                    </label>
                    <p className="dsf-hint">
                        Paste the suspicious message, describe the incident, or add any relevant notes.
                    </p>
                    <textarea
                        id="dsf-content"
                        className="dsf-textarea"
                        rows={6}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Enter case details here…"
                        disabled={submitting}
                    />
                </div>

                {/* Attachment URL */}
                <div className="dsf-field">
                    <label className="dsf-label" htmlFor="dsf-attachment">
                        Attachment URL <span className="dsf-optional">(optional)</span>
                    </label>
                    <p className="dsf-hint">
                        Link to an image, document, or external resource related to this case.
                    </p>
                    <input
                        id="dsf-attachment"
                        type="url"
                        className="dsf-input"
                        value={attachmentUrl}
                        onChange={(e) => setAttachmentUrl(e.target.value)}
                        placeholder="https://example.com/screenshot.png"
                        disabled={submitting}
                    />
                </div>

                {/* Resident ref */}
                <div className="dsf-field">
                    <label className="dsf-label" htmlFor="dsf-resident">
                        Resident Reference <span className="dsf-optional">(optional)</span>
                    </label>
                    <p className="dsf-hint">
                        An internal reference for the resident involved, e.g. "Resident A12".
                    </p>
                    <input
                        id="dsf-resident"
                        type="text"
                        className="dsf-input"
                        value={residentRef}
                        onChange={(e) => setResidentRef(e.target.value)}
                        placeholder="e.g. Resident A12"
                        disabled={submitting}
                    />
                </div>

                {/* Error */}
                {error && (
                    <div className="dsf-error">
                        <AlertTriangle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Actions */}
                <div className="dsf-actions">
                    <button
                        type="submit"
                        className="dsf-submit-btn"
                        disabled={submitting}
                    >
                        {submitting ? (
                            <>
                                <Loader2 size={18} className="dsf-spinner" />
                                Submitting…
                            </>
                        ) : (
                            <>
                                <Upload size={18} />
                                Submit Case
                            </>
                        )}
                    </button>
                </div>
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
