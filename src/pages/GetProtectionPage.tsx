import React, { useState } from 'react';
import { Shield, Upload, Link2, Phone, ArrowLeft, CheckCircle, ChevronRight } from 'lucide-react';
import { Button } from '../components/Button';

/* ─── Types ──────────────────────────────────────────────────────────────── */

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
                {/* Icon */}
                <div
                    className={[
                        'shrink-0 w-11 h-11 rounded-lg flex items-center justify-center transition-colors duration-200',
                        selected ? 'bg-[#C9A84C]/15 text-[#A8853C]' : 'bg-slate-100 text-slate-500 group-hover:bg-[#C9A84C]/10 group-hover:text-[#A8853C]',
                    ].join(' ')}
                >
                    {icon}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <p className={[
                            'font-semibold text-base',
                            selected ? 'text-[#0B1E36]' : 'text-slate-700',
                        ].join(' ')}>
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

/* ─── Step indicator ─────────────────────────────────────────────────────── */

function StepIndicator({ step, total }: { step: number; total: number }) {
    return (
        <div className="flex items-center gap-2" aria-label={`Step ${step} of ${total}`} role="status">
            {Array.from({ length: total }).map((_, i) => (
                <div
                    key={i}
                    className={[
                        'h-1 rounded-full transition-all duration-300',
                        i < step ? 'bg-[#C9A84C] w-8' : i === step - 1 ? 'bg-[#C9A84C] w-8' : 'bg-slate-200 w-4',
                    ].join(' ')}
                    aria-hidden="true"
                />
            ))}
        </div>
    );
}

/* ─── Main page ───────────────────────────────────────────────────────────── */

const OPTIONS = [
    {
        id: 'screenshot',
        icon: <Upload className="w-5 h-5" />,
        title: 'Upload a screenshot',
        description: 'Send us a screenshot of a suspicious message, email, or website.',
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

export function GetProtectionPage({ onBack }: NavigationProps) {
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);

    // Click tracking
    const trackEvent = (event: string, data: Record<string, string>) => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('slp_track', { detail: { event, ...data } }));
            console.info('[SLP Track]', event, data);
        }
    };

    function handleSubmit() {
        if (!selectedOption) return;
        trackEvent('get_protection_submit', { option: selectedOption });
        setSubmitted(true);
    }

    function handleOptionSelect(id: string) {
        setSelectedOption(id);
        trackEvent('get_protection_option_selected', { option: id });
    }

    // ── Confirmation screen ──────────────────────────────────────────────────
    if (submitted) {
        return (
            <div className="min-h-screen bg-[#F9F9F7] flex flex-col">
                {/* Nav */}
                <nav className="bg-[#112540] border-b border-white/10 px-6 py-4">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-slate-300 hover:text-white text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] rounded"
                        aria-label="Return to home page"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to home
                    </button>
                </nav>

                {/* Confirmation */}
                <main className="flex-1 flex items-center justify-center px-6 py-16">
                    <div className="max-w-md w-full text-center">
                        <div className="w-20 h-20 rounded-full bg-[#C9A84C]/15 flex items-center justify-center mx-auto mb-8">
                            <CheckCircle className="w-10 h-10 text-[#C9A84C]" />
                        </div>
                        <h1 className="text-[#0B1E36] mb-4" style={{ fontFamily: "'Merriweather', serif" }}>
                            Request received.
                        </h1>
                        <p className="text-slate-600 text-lg leading-relaxed mb-10">
                            A UK-based specialist will review your submission and respond promptly.
                            <br /><br />
                            <span className="text-slate-500 text-base">No judgement. No pressure. Just clarity.</span>
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

    // ── Main onboarding flow ─────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#F9F9F7] flex flex-col">
            {/* Nav */}
            <nav className="bg-[#112540] border-b border-white/10 px-6 md:px-10 py-4 flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-300 hover:text-white text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] rounded"
                    aria-label="Return to home page"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>
                <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-[#C9A84C]" aria-hidden="true" />
                    <span className="text-white text-sm font-semibold tracking-wide">Second Look Protect</span>
                </div>
            </nav>

            {/* Main */}
            <main className="flex-1 flex items-start justify-center px-6 py-12 md:py-20">
                <div className="w-full max-w-xl">

                    {/* Step indicator */}
                    <div className="mb-8">
                        <StepIndicator step={1} total={2} />
                    </div>

                    {/* Header */}
                    <div className="mb-10">
                        <p className="text-[#A8853C] text-xs font-semibold tracking-widest uppercase mb-3">
                            Step 1 of 2 — Choose your check type
                        </p>
                        <h1 className="text-[#0B1E36] mb-3" style={{ fontFamily: "'Merriweather', serif" }}>
                            Start Protection in 60 Seconds
                        </h1>
                        <p className="text-slate-500 text-base leading-relaxed max-w-prose">
                            Select how you would like to submit for review. No registration required to start.
                        </p>
                    </div>

                    {/* Options */}
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
                            </React.Fragment>
                        ))}
                    </div>

                    {/* CTA */}
                    <div className="flex flex-col gap-3">
                        <Button
                            onClick={handleSubmit}
                            disabled={!selectedOption}
                            size="lg"
                            className={[
                                'w-full justify-center font-semibold transition-all duration-200 border-0',
                                selectedOption
                                    ? 'bg-[#C9A84C] text-[#0B1E36] hover:bg-[#D9BC78] active:scale-[0.98]'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed',
                            ].join(' ')}
                            aria-label="Continue to submit your check"
                        >
                            Continue
                            <ChevronRight className="w-5 h-5" aria-hidden="true" />
                        </Button>

                        <p className="text-center text-slate-400 text-xs">
                            Your submission is treated with full confidentiality.
                        </p>
                    </div>

                    {/* Trust strip */}
                    <div className="mt-10 pt-8 border-t border-slate-200 flex flex-wrap justify-center gap-6 text-slate-400 text-xs">
                        <span>✓ ICO Registered</span>
                        <span>✓ UK-Based Specialists</span>
                        <span>✓ Human-Reviewed</span>
                    </div>
                </div>
            </main>
        </div>
    );
}
