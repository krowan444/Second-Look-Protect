import React, { useState, useEffect } from 'react';
import { Shield, ArrowLeft, CheckCircle, ArrowRight, Building2, Users, FileText, ClipboardCheck, LayoutDashboard, Phone } from 'lucide-react';
import { Button } from '../components/Button';
import { getSupabase } from '../lib/supabaseClient';

interface Props {
    onBack: () => void;
}

export function GetProtectionPage({ onBack }: Props) {
    const [submitted, setSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // Form fields
    const [nameValue, setNameValue] = useState('');
    const [orgNameValue, setOrgNameValue] = useState('');
    const [roleValue, setRoleValue] = useState('');
    const [emailValue, setEmailValue] = useState('');
    const [phoneValue, setPhoneValue] = useState('');
    const [orgTypeValue, setOrgTypeValue] = useState('');
    const [noteValue, setNoteValue] = useState('');

    // Consent checkbox
    const [consentChecked, setConsentChecked] = useState(false);
    const [consentError, setConsentError] = useState(false);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [submitted]);

    function trackEvent(event: string, data: Record<string, string>) {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('slp_track', { detail: { event, ...data } }));
            console.info('[SLP Track]', event, data);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!consentChecked) {
            setConsentError(true);
            return;
        }
        setConsentError(false);
        setSubmitError(null);
        setIsSubmitting(true);

        try {
            const supabase = getSupabase();

            const { error: insertError } = await supabase
                .from('demo_requests')
                .insert({
                    full_name: nameValue.trim(),
                    work_email: emailValue.trim(),
                    phone_number: phoneValue.trim(),
                    organisation_name: orgNameValue.trim(),
                    organisation_type: orgTypeValue.trim() || null,
                    role: roleValue.trim() || null,
                    message: noteValue.trim() || null,
                    consent: consentChecked,
                    source_page: 'book_demo',
                    status: 'new'
                });

            if (insertError) {
                console.error('[SLP] Supabase submission failed:', insertError.message);
                throw new Error('There was an issue saving your request. Please try again or contact us directly.');
            }

            trackEvent('demo_request_submitted', { orgType: orgTypeValue || 'not_provided' });

            setNameValue('');
            setOrgNameValue('');
            setRoleValue('');
            setEmailValue('');
            setPhoneValue('');
            setOrgTypeValue('');
            setNoteValue('');
            setConsentChecked(false);

            setSubmitted(true);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
            console.error('[SLP] Submission failed:', err);
            setSubmitError(msg);
        } finally {
            setIsSubmitting(false);
        }
    }

    const canSubmit = !isSubmitting &&
        consentChecked &&
        nameValue.trim().length > 0 &&
        orgNameValue.trim().length > 0 &&
        emailValue.trim().length > 0 &&
        phoneValue.trim().length > 0;

    const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-700 text-sm focus:outline-none focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C] transition-colors duration-200 placeholder:text-slate-400";
    const labelCls = "block text-slate-700 font-medium text-sm mb-1.5";

    /* ── Shared nav bar ───────────────────────────────────────────────────── */
    const Navbar = (
        <nav className="bg-[#0B1E36] border-b border-white/10 px-6 md:px-10 py-4 flex items-center justify-between sticky top-0 z-50">
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
    );

    /* ── Confirmation screen ──────────────────────────────────────────────── */
    if (submitted) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-[#C9A84C]/30 selection:text-[#0B1E36]">
                {Navbar}
                <main className="flex-1 flex items-center justify-center px-6 py-16">
                    <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-sm border border-slate-100 px-8 py-12">
                        <div className="w-20 h-20 rounded-full bg-[#C9A84C]/10 flex items-center justify-center mx-auto mb-8">
                            <CheckCircle className="w-10 h-10 text-[#C9A84C]" />
                        </div>
                        <h1 className="text-[#0B1E36] text-2xl mb-3" style={{ fontFamily: "'Merriweather', serif" }}>
                            Request received.
                        </h1>
                        <p className="text-slate-500 text-sm leading-relaxed mb-8">
                            Thank you. Your demo request has been received and our team will be in touch shortly.
                        </p>
                        <Button
                            onClick={onBack}
                            variant="primary"
                            className="w-full justify-center"
                            aria-label="Return to the Second Look Protect home page"
                        >
                            Return to home
                        </Button>
                    </div>
                </main>
            </div>
        );
    }

    /* ── Main Demo Booking Form ───────────────────────────────────────────── */
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-[#C9A84C]/30 selection:text-[#0B1E36]">
            {Navbar}

            <main className="flex-1 max-w-6xl mx-auto w-full px-6 md:px-10 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">

                {/* ── Left Column: Value Prop & Messaging ── */}
                <div className="lg:col-span-6 flex flex-col gap-10">

                    {/* Hero Text */}
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-1 h-4 bg-[#C9A84C] rounded-full" aria-hidden="true" />
                            <span className="text-[#C9A84C] text-[11px] font-semibold tracking-widest uppercase">
                                PRACTICAL PLATFORM DEMO
                            </span>
                        </div>
                        <h1 className="text-[#0B1E36] text-3xl md:text-4xl leading-tight mb-5" style={{ fontFamily: "'Merriweather', serif" }}>
                            Book a practical walkthrough for your care organisation
                        </h1>
                        <p className="text-slate-600 text-lg leading-relaxed mb-4">
                            See how Second Look Protect helps care homes and care groups log scam related safeguarding concerns, review cases clearly, track developing trends, and strengthen inspection ready oversight through one clear platform.
                        </p>
                        <p className="text-slate-500 text-sm font-medium italic bg-white inline-block px-4 py-2 rounded-lg border border-slate-100 shadow-sm">
                            A calm, structured walkthrough for care providers. No pressure. No technical jargon.
                        </p>
                    </div>

                    {/* Image */}
                    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white p-2">
                        <img
                            src="/images/demo-page.png"
                            alt="Second Look Protect platform overview"
                            className="w-full rounded-xl"
                        />
                    </div>

                    {/* What Second Look Protect helps you do - Benefit Cards */}
                    <div>
                        <h2 className="text-[#0B1E36] font-semibold text-lg mb-2" style={{ fontFamily: "'Merriweather', serif" }}>
                            What Second Look Protect helps you do
                        </h2>
                        <p className="text-slate-500 text-sm mb-5">
                            A clearer way to record concerns, spot patterns, and maintain inspection ready oversight across your service.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Card 1 */}
                            <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
                                <h3 className="text-slate-800 font-semibold text-[15px] mb-2">Log concerns clearly</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">
                                    Record scam related safeguarding concerns in one structured place without messy follow up.
                                </p>
                            </div>

                            {/* Card 2 */}
                            <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
                                <h3 className="text-slate-800 font-semibold text-[15px] mb-2">Spot patterns earlier</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">
                                    See repeated issues, emerging scam trends, and wider risk signals affecting vulnerable residents.
                                </p>
                            </div>

                            {/* Card 3 */}
                            <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
                                <h3 className="text-slate-800 font-semibold text-[15px] mb-2">Strengthen inspection readiness</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">
                                    Keep reporting clearer, more consistent, and easier to review when oversight matters most.
                                </p>
                            </div>

                            {/* Card 4 */}
                            <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
                                <h3 className="text-slate-800 font-semibold text-[15px] mb-2">Give managers better oversight</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">
                                    Help leaders review concerns, track actions, and support safer decision making across the team.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Who this is for */}
                    <div>
                        <p className="text-slate-500 text-sm font-medium uppercase tracking-wide mb-4">Designed for:</p>
                        <div className="flex flex-wrap gap-2">
                            {['Care home managers', 'Safeguarding leads', 'Compliance managers', 'Operations leaders', 'Care groups supporting vulnerable residents'].map((tag) => (
                                <span key={tag} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-1.5 text-xs text-slate-600 font-medium shadow-sm">
                                    <Users className="w-3 h-3 text-[#C9A84C]" />
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Right Column: Form ── */}
                <div className="lg:col-span-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-10 lg:sticky lg:top-28">
                    <div className="mb-8">
                        <h2 className="text-[#0B1E36] font-semibold text-[22px] mb-2" style={{ fontFamily: "'Merriweather', serif" }}>
                            Request a demo
                        </h2>
                        <p className="text-slate-500 text-sm">
                            Tell us a little about your organisation or what you would like to see in the demo.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label htmlFor="name" className={labelCls}>Full name <span className="text-red-500">*</span></label>
                                <input
                                    id="name"
                                    type="text"
                                    required
                                    className={inputCls}
                                    placeholder="Jane Doe"
                                    value={nameValue}
                                    onChange={(e) => { setNameValue(e.target.value); setSubmitError(null); }}
                                />
                            </div>
                            <div>
                                <label htmlFor="email" className={labelCls}>Work email <span className="text-red-500">*</span></label>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    className={inputCls}
                                    placeholder="jane@caregroup.co.uk"
                                    value={emailValue}
                                    onChange={(e) => { setEmailValue(e.target.value); setSubmitError(null); }}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="phone" className={labelCls}>Phone number <span className="text-red-500">*</span></label>
                            <input
                                id="phone"
                                type="tel"
                                required
                                className={inputCls}
                                placeholder="07700 900000"
                                value={phoneValue}
                                onChange={(e) => { setPhoneValue(e.target.value); setSubmitError(null); }}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-100 pt-5 mt-5">
                            <div>
                                <label htmlFor="orgName" className={labelCls}>Organisation name <span className="text-red-500">*</span></label>
                                <input
                                    id="orgName"
                                    type="text"
                                    required
                                    className={inputCls}
                                    placeholder="Organisation Name"
                                    value={orgNameValue}
                                    onChange={(e) => { setOrgNameValue(e.target.value); setSubmitError(null); }}
                                />
                            </div>
                            <div>
                                <label htmlFor="orgType" className={labelCls}>Organisation type</label>
                                <select
                                    id="orgType"
                                    className={inputCls}
                                    value={orgTypeValue}
                                    onChange={(e) => { setOrgTypeValue(e.target.value); setSubmitError(null); }}
                                >
                                    <option value="" disabled>Select type...</option>
                                    <option value="Care home">Care home</option>
                                    <option value="Care group">Care group</option>
                                    <option value="Assisted living">Assisted living</option>
                                    <option value="Supported living">Supported living</option>
                                    <option value="Other care provider">Other care provider</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="role" className={labelCls}>Your role</label>
                            <input
                                id="role"
                                type="text"
                                className={inputCls}
                                placeholder="e.g. Care Home Manager, Compliance Lead"
                                value={roleValue}
                                onChange={(e) => { setRoleValue(e.target.value); setSubmitError(null); }}
                            />
                        </div>

                        <div>
                            <label htmlFor="note" className={labelCls}>Optional message</label>
                            <textarea
                                id="note"
                                className={inputCls + " resize-none"}
                                rows={3}
                                placeholder="Any specific challenges you're facing or features you'd like to focus on?"
                                value={noteValue}
                                onChange={(e) => { setNoteValue(e.target.value); setSubmitError(null); }}
                            />
                        </div>

                        {/* Privacy consent checkbox */}
                        <div className="pt-2">
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={consentChecked}
                                    onChange={(e) => { setConsentChecked(e.target.checked); if (e.target.checked) setConsentError(false); }}
                                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#C9A84C] cursor-pointer"
                                />
                                <span className="text-slate-500 text-xs leading-relaxed">
                                    I agree to the <a href="/privacy-policy" onClick={(e) => { e.preventDefault(); window.open('/privacy-policy', '_blank'); }} className="text-[#A8853C] hover:underline">Privacy Policy</a> and consent to being contacted regarding this request.
                                </span>
                            </label>
                            {consentError && (
                                <p className="mt-1 ml-7 text-red-600 text-[11px]">Please accept the privacy policy to continue.</p>
                            )}
                        </div>

                        {submitError && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
                                {submitError}
                            </div>
                        )}

                        <div className="pt-4 flex flex-col gap-3">
                            <Button
                                type="submit"
                                disabled={!canSubmit}
                                size="lg"
                                className="w-full justify-center transition-all duration-200"
                            >
                                {isSubmitting ? 'Submitting...' : 'Request a demo'}
                            </Button>

                            <div className="text-center">
                                <span className="text-slate-400 text-xs">— or —</span>
                            </div>

                            <a
                                href="tel:01604385888"
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-sm font-medium hover:bg-slate-100 hover:text-slate-900 transition-colors"
                            >
                                <Phone className="w-4 h-4 text-slate-400" />
                                Call to discuss first
                            </a>
                        </div>
                    </form>

                    {/* Contact Reassurance */}
                    <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 gap-4 text-center">
                        <div>
                            <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">Office Line</p>
                            <p className="text-slate-700 text-sm font-medium">01604 385888</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">Mobile / WhatsApp</p>
                            <p className="text-slate-700 text-sm font-medium">07907 614821</p>
                        </div>
                        <div className="col-span-2 mt-2">
                            <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">Email Enquiries</p>
                            <p className="text-slate-700 text-sm font-medium">hello@secondlookprotect.co.uk</p>
                        </div>
                    </div>
                </div>

            </main>

            {/* Closing Reassurance Block */}
            <section className="bg-white border-t border-slate-200 py-16">
                <div className="max-w-3xl mx-auto px-6 text-center">
                    <Shield className="w-8 h-8 text-[#C9A84C] mx-auto mb-6" />
                    <p className="text-[#0B1E36] text-lg md:text-xl leading-relaxed font-medium mb-3" style={{ fontFamily: "'Merriweather', serif" }}>
                        Second Look Protect is built to help care providers handle scam related safeguarding concerns with clearer oversight, stronger reporting, and a more confident response process.
                    </p>
                    <p className="text-slate-500 text-sm">
                        Useful for teams who want a clearer safeguarding workflow without adding complexity.
                    </p>
                </div>
            </section>
        </div>
    );
}
