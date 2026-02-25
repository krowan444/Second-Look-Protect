import React, { useState, useRef, useEffect } from 'react';
import { Shield, Upload, Link2, Phone, ArrowLeft, CheckCircle, ChevronRight, Image, X, MessageSquare } from 'lucide-react';
import { Button } from '../components/Button';
import { getSupabase } from '../lib/supabaseClient';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface NavigationProps {
    onBack: () => void;
}

/* ─── Option card ─────────────────────────────────────────────────────────── */

interface OptionCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    selected: boolean;
    onClick: () => void;
}

function OptionCard({ icon, title, description, selected, onClick }: OptionCardProps) {
    return (
        <button
            onClick={onClick}
            aria-pressed={selected}
            className={[
                'w-full text-left rounded-xl border-2 p-6 transition-all duration-200 cursor-pointer group',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-offset-2',
                selected
                    ? 'border-[#C9A84C] bg-[#C9A84C]/5 shadow-md'
                    : 'border-slate-200 bg-white hover:border-[#C9A84C]/40 hover:shadow-sm',
            ].join(' ')}
        >
            <div className="flex items-start gap-4">
                <div className={[
                    'shrink-0 w-11 h-11 rounded-lg flex items-center justify-center transition-colors duration-200',
                    selected ? 'bg-[#C9A84C]/15 text-[#A8853C]' : 'bg-slate-100 text-slate-500 group-hover:bg-[#C9A84C]/10 group-hover:text-[#A8853C]',
                ].join(' ')}>
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <p className={['font-semibold text-base', selected ? 'text-[#0B1E36]' : 'text-slate-700'].join(' ')}>
                            {title}
                        </p>
                        {selected && <CheckCircle className="w-5 h-5 text-[#C9A84C] shrink-0" aria-hidden="true" />}
                    </div>
                    <p className="text-slate-500 text-sm mt-1 leading-relaxed">{description}</p>
                </div>
            </div>
        </button>
    );
}

/* ─── Step indicator ──────────────────────────────────────────────────────── */

function StepIndicator({ step, total }: { step: number; total: number }) {
    return (
        <div className="flex items-center gap-2" aria-label={`Step ${step} of ${total}`} role="status">
            {Array.from({ length: total }).map((_, i) => (
                <div
                    key={i}
                    className={[
                        'h-1 rounded-full transition-all duration-300',
                        i < step ? 'bg-[#C9A84C] w-8' : 'bg-slate-200 w-4',
                    ].join(' ')}
                    aria-hidden="true"
                />
            ))}
        </div>
    );
}

/* ─── Options config ──────────────────────────────────────────────────────── */

const OPTIONS = [
    {
        id: 'screenshot',
        icon: <Upload className="w-5 h-5" />,
        title: 'Upload a screenshot',
        description: 'Send a screenshot of a suspicious message, email, or website.',
    },
    {
        id: 'link',
        icon: <Link2 className="w-5 h-5" />,
        title: 'Submit a suspicious link',
        description: 'Paste a URL you are unsure about — we will check what is behind it.',
    },
    {
        id: 'contact',
        icon: <Phone className="w-5 h-5" />,
        title: 'Request contact verification',
        description: 'Verify if a phone number, email address, or caller is legitimate.',
    },
];

/* ─── Main page ───────────────────────────────────────────────────────────── */

export function GetProtectionPage({ onBack }: NavigationProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);

    // Step 2 inputs — type-specific
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [linkValue, setLinkValue] = useState('');
    const [contactValue, setContactValue] = useState('');

    // Step 2 inputs — contact details (all types)
    const [nameValue, setNameValue] = useState('');
    const [emailValue, setEmailValue] = useState('');
    const [phoneValue, setPhoneValue] = useState('');
    const [noteValue, setNoteValue] = useState('');

    // UI states
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // Consent checkbox
    const [consentChecked, setConsentChecked] = useState(false);
    const [consentError, setConsentError] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    /* ── Scroll to top on every step change (scoped to this page only) ──── */
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [step, submitted]);

    // Click tracking
    function trackEvent(event: string, data: Record<string, string>) {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('slp_track', { detail: { event, ...data } }));
            console.info('[SLP Track]', event, data);
        }
    }

    function handleOptionSelect(id: string) {
        setSelectedOption(id);
        setSubmitError(null);
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const chosen = e.target.files?.[0] ?? null;
        setFile(chosen);
        setSubmitError(null);
        if (chosen) {
            const url = URL.createObjectURL(chosen);
            setPreviewUrl(url);
        } else {
            setPreviewUrl(null);
        }
    }

    function clearFile() {
        setFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    function handleContinue() {
        if (!selectedOption) return;
        trackEvent('get_protection_option_selected', { option: selectedOption });
        setStep(2);
    }

    /* ── Supabase submit handler ─────────────────────────────────────────── */

    async function handleSubmit() {
        if (!consentChecked) {
            setConsentError(true);
            return;
        }
        setConsentError(false);
        setSubmitError(null);
        setIsSubmitting(true);

        try {
            const supabase = getSupabase();

            // ── STEP 1: Upload image to SUBMISSIONS bucket (screenshot only) ──
            let publicImageUrl: string | null = null;

            if (selectedOption === 'screenshot' && file) {
                const storageKey = `submissions/${crypto.randomUUID()}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

                console.log('[SLP] Step 1 — Uploading to SUBMISSIONS bucket:', storageKey);

                const { error: uploadError } = await supabase.storage
                    .from('SUBMISSIONS')
                    .upload(storageKey, file, { cacheControl: '3600', upsert: false });

                if (uploadError) {
                    throw new Error(`Image upload failed: ${uploadError.message}`);
                }

                // ── STEP 2: Get the public URL for that specific file ──────────
                // getPublicUrl returns a direct HTTPS link ending in the original
                // filename (e.g. …/submissions/uuid/1234567890-photo.jpg).
                // It is always a plain text string — no signing, no expiry.
                const { data: urlData } = supabase.storage
                    .from('SUBMISSIONS')
                    .getPublicUrl(storageKey);

                publicImageUrl = String(urlData.publicUrl).trim(); // explicit text string
                console.log('[SLP] Step 2 — Public image URL:', publicImageUrl);
            }

            // Build message: combine type-specific input with user's written message
            const parts: string[] = [];
            if (selectedOption === 'link' && linkValue.trim()) parts.push(`URL: ${linkValue.trim()}`);
            if (selectedOption === 'contact' && contactValue.trim()) parts.push(`Contact: ${contactValue.trim()}`);
            if (noteValue.trim()) parts.push(noteValue.trim());
            const messageText: string | null = parts.join('\n\n') || null;

            // ── STEP 4: Insert ONE row with name + email + phone + message + image_url ──
            console.log('[SLP] Step 3 — Inserting submission row into Supabase...');

            const { error: insertError } = await supabase
                .from('submissions')
                .insert({
                    name: nameValue.trim(),
                    email: emailValue.trim(),
                    phone: phoneValue.trim() || null,
                    message: messageText,
                    image_url: publicImageUrl,
                    status: 'new',
                });

            if (insertError) {
                // Surface the exact Supabase error so it's easy to diagnose
                throw new Error(`Database error: ${insertError.message}`);
            }

            console.log('[SLP] Step 4 — Submission saved to database ✓');

            // ── STEP 5: Only show success after BOTH upload AND insert succeed ──
            trackEvent('get_protection_submit', { option: selectedOption ?? 'unknown' });
            setSubmitted(true);

        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
            console.error('[SLP] Submission failed:', err);
            setSubmitError(msg);
        } finally {
            setIsSubmitting(false);
        }
    }

    // Is the submit button ready?
    const typeSpecificReady = selectedOption === 'screenshot' ? true // image is optional
        : selectedOption === 'link' ? true // link is optional
            : selectedOption === 'contact' ? contactValue.trim().length > 0
                : false;
    const canSubmit = !isSubmitting
        && consentChecked
        && typeSpecificReady
        && nameValue.trim().length > 0
        && emailValue.trim().length > 0
        && phoneValue.trim().length > 0
        && noteValue.trim().length > 0;

    // Shared input style
    const inputCls = [
        'w-full rounded-lg border-2 border-slate-200 bg-white px-4 py-3 text-slate-700 text-base',
        'focus:outline-none focus:border-[#C9A84C] transition-colors duration-200 placeholder:text-slate-400',
    ].join(' ');

    /* ── Shared nav bar ───────────────────────────────────────────────────── */
    const Navbar = (
        <nav className="bg-[#0B1E36] border-b border-white/10 px-6 md:px-10 py-4 flex items-center justify-between">
            <button
                onClick={step === 2 && !submitted ? () => setStep(1) : onBack}
                className="flex items-center gap-2 text-slate-300 hover:text-white text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] rounded"
                aria-label={step === 2 && !submitted ? 'Go back to option selection' : 'Return to home page'}
            >
                <ArrowLeft className="w-4 h-4" />
                {step === 2 && !submitted ? 'Back' : 'Back to home'}
            </button>
            <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#C9A84C]" aria-hidden="true" />
                <span className="text-white text-sm font-semibold tracking-tight" style={{ fontFamily: "'Merriweather', serif" }}>
                    Second Look <span className="text-[#C9A84C]">Protect</span>
                </span>
            </div>
        </nav>
    );

    /* ── Confirmation screen ──────────────────────────────────────────────── */
    if (submitted) {
        return (
            <div className="min-h-screen bg-[#0B1E36] flex flex-col">
                <nav className="bg-[#0B1E36] border-b border-white/10 px-6 md:px-10 py-4 flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-slate-300 hover:text-white text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] rounded"
                        aria-label="Return to home page"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to home
                    </button>
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-[#C9A84C]" aria-hidden="true" />
                        <span className="text-white text-sm font-semibold tracking-tight" style={{ fontFamily: "'Merriweather', serif" }}>
                            Second Look <span className="text-[#C9A84C]">Protect</span>
                        </span>
                    </div>
                </nav>
                <main className="flex-1 flex items-center justify-center px-6 py-16">
                    <div className="max-w-md w-full text-center bg-[#FAFAF8] rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.15)] border border-white/10 px-8 py-12">
                        <div className="w-20 h-20 rounded-full bg-[#C9A84C]/15 flex items-center justify-center mx-auto mb-8">
                            <CheckCircle className="w-10 h-10 text-[#C9A84C]" />
                        </div>
                        <h1 className="text-[#0B1E36] mb-2" style={{ fontFamily: "'Merriweather', serif" }}>
                            Request received.
                        </h1>
                        <p className="text-slate-400 text-xs mb-4">You are taking a second look.</p>
                        <p className="text-slate-600 text-lg leading-relaxed mb-4">
                            A UK-based specialist will review your submission and respond promptly.
                            <br /><br />
                            <span className="text-slate-500 text-base">No judgement. No pressure. Just clarity.</span>
                        </p>
                        <p className="text-slate-400 text-sm leading-relaxed mb-10">
                            You've done the right thing. There's no need to rush. We will review this for you.
                        </p>
                        <Button
                            onClick={onBack}
                            variant="secondary"
                            className="border-[#0B1E36]"
                            aria-label="Return to the Second Look Protect home page"
                        >
                            Return to home
                        </Button>
                    </div>
                </main>
            </div>
        );
    }

    /* ── Step 1: Select option ────────────────────────────────────────────── */
    if (step === 1) {
        return (
            <div className="min-h-screen bg-[#0B1E36] flex flex-col">
                {Navbar}
                <main className="flex-1 flex items-start justify-center px-6 py-12 md:py-20">
                    <div className="w-full max-w-xl bg-[#FAFAF8] rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.15)] border border-white/10 px-6 md:px-10 py-8 md:py-12">
                        <div className="flex items-center justify-between mb-8">
                            <StepIndicator step={1} total={2} />
                            <span className="text-slate-400 text-xs">Step 1 of 2</span>
                        </div>
                        <div className="mb-10">
                            <p className="text-[#A8853C] text-xs font-semibold tracking-widest uppercase mb-3">
                                Step 1 of 2 — Choose your check type
                            </p>
                            <h1 className="text-[#0B1E36] mb-2" style={{ fontFamily: "'Merriweather', serif" }}>
                                Not sure if something is safe? Let's take a second look.
                            </h1>
                            <p className="text-slate-400 text-xs mb-3">You are taking a second look.</p>
                            <p className="text-slate-500 text-base leading-relaxed max-w-prose mb-3">
                                If something doesn't feel right, simply upload it below — we'll review it and send you a clear, easy-to-understand risk report explaining what's safe, what's risky, and what to do next.
                            </p>

                            <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                You can upload a screenshot, paste a link, or copy the message — whichever is easiest for you.
                            </p>
                        </div>
                        <div className="space-y-3 mb-10" role="radiogroup" aria-label="Submission type">
                            {OPTIONS.map((opt) => (
                                <React.Fragment key={opt.id}>
                                    <OptionCard
                                        icon={opt.icon}
                                        title={opt.title}
                                        description={opt.description}
                                        selected={selectedOption === opt.id}
                                        onClick={() => handleOptionSelect(opt.id)}
                                    />
                                    {selectedOption === opt.id && (
                                        <div
                                            className="flex flex-col gap-3 pl-2"
                                            style={{
                                                animation: 'slpFadeIn 0.3s ease-out',
                                            }}
                                        >
                                            <style>{`@keyframes slpFadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                                            <p className="text-[#A8853C] text-sm font-medium">
                                                You chose: {opt.title}
                                            </p>
                                            <Button
                                                onClick={handleContinue}
                                                size="lg"
                                                className="slp-continue-btn w-full justify-center font-semibold border-0"
                                                aria-label="Continue to step 2"
                                            >
                                                Continue <ChevronRight className="w-5 h-5" />
                                            </Button>
                                        </div>
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                        <div className="flex flex-col gap-3">
                            <p className="text-center text-slate-400 text-xs">Your submission is treated with full confidentiality.</p>
                            <p className="text-center text-slate-400 text-xs leading-relaxed">
                                We will never ask for passwords, OTPs, full banking details, or ask you to move money. If unsure, contact us directly via our official website or{' '}
                                <a href="mailto:hello@secondlookprotect.co.uk" className="underline underline-offset-1 hover:text-slate-600 transition-colors">hello@secondlookprotect.co.uk</a>.
                            </p>
                        </div>
                        <div className="mt-10 pt-8 border-t border-slate-200 flex flex-wrap justify-center gap-6 text-slate-400 text-xs">
                            <span>✓ ICO Registered</span>
                            <span>✓ UK-Based Specialists</span>
                            <span>✓ Human-Reviewed</span>
                        </div>

                        {/* ── Support section ── */}
                        <div className="mt-8 pt-6 border-t border-slate-200 text-center">
                            <p className="text-slate-400 text-xs font-medium tracking-wide uppercase mb-4">Need help instead?</p>
                            <div className="flex flex-col gap-3 max-w-md mx-auto">
                                <a
                                    href="tel:01604385888"
                                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg border border-[#C9A84C]/40 text-[#0B1E36] text-base font-semibold hover:bg-[#C9A84C]/10 transition-colors duration-200 whitespace-nowrap"
                                >
                                    <Phone className="w-5 h-5 text-[#C9A84C]" />
                                    Call — 01604 385888
                                </a>
                                <a
                                    href="sms:07907614821"
                                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg border border-[#C9A84C]/40 text-[#0B1E36] text-base font-semibold hover:bg-[#C9A84C]/10 transition-colors duration-200 whitespace-nowrap"
                                >
                                    <MessageSquare className="w-5 h-5 text-[#C9A84C]" />
                                    Text — 07907 614821
                                </a>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    /* ── Step 2: Submit details ───────────────────────────────────────────── */
    return (
        <div className="min-h-screen bg-[#0B1E36] flex flex-col">
            {Navbar}
            <main className="flex-1 flex items-start justify-center px-6 py-12 md:py-20">
                <div className="w-full max-w-xl bg-[#FAFAF8] rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.15)] border border-white/10 px-6 md:px-10 py-8 md:py-12">
                    <div className="flex items-center justify-between mb-8">
                        <StepIndicator step={2} total={2} />
                        <span className="text-slate-400 text-xs">Step 2 of 2</span>
                    </div>

                    <div className="mb-10">
                        <p className="text-[#A8853C] text-xs font-semibold tracking-widest uppercase mb-3">
                            Step 2 of 2 — Provide details
                        </p>
                        <h1 className="text-[#0B1E36] mb-2" style={{ fontFamily: "'Merriweather', serif" }}>
                            {selectedOption === 'screenshot' ? 'Upload your screenshot'
                                : selectedOption === 'link' ? 'Paste the suspicious link'
                                    : 'Enter the contact to verify'}
                        </h1>
                        <p className="text-slate-400 text-xs mb-3">You are taking a second look.</p>
                        <p className="text-slate-500 text-base leading-relaxed max-w-prose">
                            {selectedOption === 'screenshot'
                                ? 'Attach a screenshot if you have one — this is optional. Fill in your details below and we will still get back to you.'
                                : selectedOption === 'link'
                                    ? 'Paste the full URL (starting with https://) that you would like us to check.'
                                    : 'Enter the phone number, email address, or contact name you want us to verify.'}
                        </p>
                    </div>

                    {/* ── Screenshot upload ── */}
                    {selectedOption === 'screenshot' && (
                        <div className="mb-8">
                            {!file ? (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className={[
                                        'w-full border-2 border-dashed border-slate-300 rounded-xl p-10',
                                        'flex flex-col items-center justify-center gap-3 cursor-pointer',
                                        'hover:border-[#C9A84C]/50 hover:bg-[#C9A84C]/3 transition-all duration-200',
                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]',
                                    ].join(' ')}
                                    aria-label="Click to select an image file"
                                >
                                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                                        <Image className="w-6 h-6 text-slate-400" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-slate-600 font-medium text-sm">Click to upload a screenshot</p>
                                        <p className="text-slate-400 text-xs mt-1">Optional · JPG, PNG, WEBP, GIF</p>
                                    </div>
                                </button>
                            ) : (
                                <div className="relative rounded-xl overflow-hidden border-2 border-[#C9A84C]/30 bg-white">
                                    <img
                                        src={previewUrl ?? ''}
                                        alt="Preview of uploaded screenshot"
                                        className="w-full max-h-64 object-contain"
                                    />
                                    <button
                                        onClick={clearFile}
                                        className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow hover:bg-white transition-colors"
                                        aria-label="Remove selected image"
                                    >
                                        <X className="w-4 h-4 text-slate-600" />
                                    </button>
                                    <div className="px-4 py-3 border-t border-slate-100">
                                        <p className="text-slate-600 text-sm font-medium truncate">{file.name}</p>
                                        <p className="text-slate-400 text-xs">{(file.size / 1024).toFixed(0)} KB</p>
                                    </div>
                                </div>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="sr-only"
                                aria-label="Image file input"
                            />
                        </div>
                    )}

                    {/* ── Link input ── */}
                    {selectedOption === 'link' && (
                        <div className="mb-8">
                            <label htmlFor="link-input" className="block text-slate-700 font-medium text-sm mb-2">
                                Suspicious URL
                            </label>
                            <input
                                id="link-input"
                                type="url"
                                placeholder="https://example.com/suspicious-page"
                                value={linkValue}
                                onChange={(e) => { setLinkValue(e.target.value); setSubmitError(null); }}
                                className={[
                                    'w-full rounded-lg border-2 border-slate-200 bg-white px-4 py-3 text-slate-700 text-base',
                                    'focus:outline-none focus:border-[#C9A84C] transition-colors duration-200',
                                    'placeholder:text-slate-400',
                                ].join(' ')}
                                autoComplete="off"
                                spellCheck={false}
                            />
                        </div>
                    )}

                    {/* ── Contact input ── */}
                    {selectedOption === 'contact' && (
                        <div className="mb-8">
                            <label htmlFor="contact-input" className="block text-slate-700 font-medium text-sm mb-2">
                                Phone number, email, or contact name
                            </label>
                            <input
                                id="contact-input"
                                type="text"
                                placeholder="+44 7700 000000 or name@example.com"
                                value={contactValue}
                                onChange={(e) => { setContactValue(e.target.value); setSubmitError(null); }}
                                className={[
                                    'w-full rounded-lg border-2 border-slate-200 bg-white px-4 py-3 text-slate-700 text-base',
                                    'focus:outline-none focus:border-[#C9A84C] transition-colors duration-200',
                                    'placeholder:text-slate-400',
                                ].join(' ')}
                            />
                        </div>
                    )}

                    {/* ── Contact details ── */}
                    <div className="mb-8 space-y-4 border-t border-slate-200 pt-8">
                        <p className="text-slate-700 font-semibold text-sm">Your contact details</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Name */}
                            <div>
                                <label htmlFor="name-input" className="block text-slate-600 text-sm mb-1">
                                    Name <span className="text-red-500" aria-label="required">*</span>
                                </label>
                                <input
                                    id="name-input"
                                    type="text"
                                    placeholder="Your full name"
                                    value={nameValue}
                                    onChange={(e) => { setNameValue(e.target.value); setSubmitError(null); }}
                                    required
                                    className={inputCls}
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label htmlFor="email-input" className="block text-slate-600 text-sm mb-1">
                                    Email <span className="text-red-500" aria-label="required">*</span>
                                </label>
                                <input
                                    id="email-input"
                                    type="email"
                                    placeholder="your@email.com"
                                    value={emailValue}
                                    onChange={(e) => { setEmailValue(e.target.value); setSubmitError(null); }}
                                    required
                                    className={inputCls}
                                />
                            </div>
                        </div>

                        {/* Phone */}
                        <div>
                            <label htmlFor="phone-input" className="block text-slate-600 text-sm mb-1">
                                Phone Number <span className="text-red-500" aria-label="required">*</span>
                            </label>
                            <input
                                id="phone-input"
                                type="tel"
                                placeholder="+44 7700 000000"
                                value={phoneValue}
                                onChange={(e) => { setPhoneValue(e.target.value); setSubmitError(null); }}
                                required
                                className={inputCls}
                            />
                        </div>

                        {/* Message — required for all types */}
                        <div>
                            <label htmlFor="note-input" className="block text-slate-600 text-sm mb-1">
                                Message <span className="text-red-500" aria-label="required">*</span>
                            </label>
                            <textarea
                                id="note-input"
                                placeholder="Please provide more info on the link or email you are reporting..."
                                value={noteValue}
                                onChange={(e) => { setNoteValue(e.target.value); setSubmitError(null); }}
                                required
                                rows={4}
                                className={inputCls + ' resize-none'}
                            />
                        </div>
                    </div>

                    {/* ── Privacy consent checkbox ── */}
                    <div className="mb-4">
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <input
                                id="consent-checkbox"
                                type="checkbox"
                                checked={consentChecked}
                                onChange={(e) => { setConsentChecked(e.target.checked); if (e.target.checked) setConsentError(false); }}
                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-slate-300 accent-[#C9A84C] cursor-pointer"
                                aria-required="true"
                                aria-describedby={consentError ? 'consent-error' : undefined}
                            />
                            <span className="text-slate-600 text-sm leading-relaxed">
                                I understand my information will be used to review my enquiry in line with the{' '}
                                <a
                                    href="/privacy-policy"
                                    className="text-[#A8853C] underline underline-offset-2 hover:text-[#C9A84C] transition-colors"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Privacy Policy
                                </a>
                                , and that this service provides guidance to help me decide what to do next and does not provide financial advice.
                            </span>
                        </label>
                        {consentError && (
                            <p id="consent-error" role="alert" className="mt-2 ml-7 text-red-600 text-xs">
                                Please confirm you understand how your information will be used.
                            </p>
                        )}
                    </div>

                    {/* ── Error message ── */}
                    {submitError && (
                        <div
                            role="alert"
                            className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm"
                        >
                            {submitError}
                        </div>
                    )}

                    {/* ── Submit ── */}
                    <div className="flex flex-col gap-3">
                        <Button
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            size="lg"
                            className={[
                                'w-full justify-center font-semibold transition-all duration-200 border-0',
                                canSubmit
                                    ? 'bg-[#0B1E36] text-white hover:bg-[#1C3256] active:scale-[0.98] transition-colors duration-200'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed',
                            ].join(' ')}
                            aria-label="Submit your check for review"
                            aria-busy={isSubmitting}
                        >
                            {isSubmitting ? 'Submitting…' : 'Submit for Review'}
                        </Button>
                        <p className="text-center text-slate-400 text-xs">Your submission is treated with full confidentiality.</p>
                        <p className="text-center text-slate-400 text-xs leading-relaxed">
                            We will never ask for passwords, OTPs, full banking details, or ask you to move money. If unsure, contact us directly via our official website or{' '}
                            <a href="mailto:hello@secondlookprotect.co.uk" className="underline underline-offset-1 hover:text-slate-600 transition-colors">hello@secondlookprotect.co.uk</a>.
                        </p>
                    </div>

                    <div className="mt-10 pt-8 border-t border-slate-200 flex flex-wrap justify-center gap-6 text-slate-400 text-xs">
                        <span>✓ ICO Registered</span>
                        <span>✓ UK-Based Specialists</span>
                        <span>✓ Human-Reviewed</span>
                    </div>

                    {/* ── Support section ── */}
                    <div className="mt-8 pt-6 border-t border-slate-200 text-center">
                        <p className="text-slate-400 text-xs font-medium tracking-wide uppercase mb-4">Need help instead?</p>
                        <div className="flex flex-col gap-3 max-w-md mx-auto">
                            <a
                                href="tel:01604385888"
                                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg border border-[#C9A84C]/40 text-[#0B1E36] text-base font-semibold hover:bg-[#C9A84C]/10 transition-colors duration-200 whitespace-nowrap"
                            >
                                <Phone className="w-5 h-5 text-[#C9A84C]" />
                                Call — 01604 385888
                            </a>
                            <a
                                href="sms:07907614821"
                                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg border border-[#C9A84C]/40 text-[#0B1E36] text-base font-semibold hover:bg-[#C9A84C]/10 transition-colors duration-200 whitespace-nowrap"
                            >
                                <MessageSquare className="w-5 h-5 text-[#C9A84C]" />
                                Text — 07907 614821
                            </a>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
