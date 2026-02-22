import React from 'react';
import { CheckCircle, Shield, ArrowLeft } from 'lucide-react';

interface Props {
    onGoHome: () => void;
}

export default function SubscriptionSuccessPage({ onGoHome }: Props) {
    return (
        <div className="min-h-screen bg-[#0B1E36] flex flex-col items-center justify-center px-4 text-center">
            {/* Logo / brand mark */}
            <div className="mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#C9A84C]/15 ring-2 ring-[#C9A84C]/30">
                    <Shield className="w-10 h-10 text-[#C9A84C]" aria-hidden="true" />
                </div>
            </div>

            {/* Success icon */}
            <div className="mb-6">
                <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" aria-hidden="true" />
            </div>

            {/* Headline */}
            <h1
                className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight"
                style={{ fontFamily: "'Merriweather', serif" }}
            >
                Thank you for protecting<br className="hidden md:block" /> your family!
            </h1>

            {/* Sub-copy */}
            <p className="text-slate-300 text-lg max-w-md mb-3">
                Your subscription is now active. You're covered.
            </p>
            <p className="text-slate-400 text-sm max-w-sm mb-10 leading-relaxed">
                Check your inbox for a confirmation from Stripe. If you have any
                questions, just reply to that email or forward anything suspicious
                to our team straight away.
            </p>

            {/* Cancellation reminder */}
            <p className="text-slate-500 text-xs mb-10">
                Simple cancellations: Just email us to stop your subscription at any time.
            </p>

            {/* CTA */}
            <button
                onClick={onGoHome}
                className="
                    inline-flex items-center gap-2 px-8 py-4 rounded-lg
                    bg-[#C9A84C] text-[#0B1E36] font-semibold text-base
                    hover:bg-[#D9BC78] active:scale-[0.98] transition-all duration-200
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1E36]
                "
                aria-label="Return to homepage"
            >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                Back to Home
            </button>
        </div>
    );
}
