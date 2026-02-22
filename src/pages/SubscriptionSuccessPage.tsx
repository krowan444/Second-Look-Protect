import React, { useEffect, useState } from 'react';
import { CheckCircle, Shield, Home } from 'lucide-react';

interface Props {
    onGoHome: () => void;
}

export default function SubscriptionSuccessPage({ onGoHome }: Props) {
    const [email, setEmail] = useState<string | null>(null);

    // Fetch the customer email from the Stripe session using the session_id in the URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('session_id');
        if (!sessionId) return;

        fetch(`/api/get-session?session_id=${encodeURIComponent(sessionId)}`)
            .then((r) => r.json())
            .then((data: { email?: string }) => {
                if (data.email) setEmail(data.email);
            })
            .catch(() => {/* email stays null — message still works without it */ });
    }, []);

    return (
        <div className="min-h-screen bg-[#0B1E36] flex flex-col items-center justify-center px-4 text-center">

            {/* Brand mark */}
            <div className="mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#C9A84C]/15 ring-2 ring-[#C9A84C]/30">
                    <Shield className="w-10 h-10 text-[#C9A84C]" aria-hidden="true" />
                </div>
            </div>

            {/* Success icon */}
            <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-6" aria-hidden="true" />

            {/* Headline */}
            <h1
                className="text-3xl md:text-4xl font-bold text-white mb-5 leading-tight"
                style={{ fontFamily: "'Merriweather', serif" }}
            >
                Success! Your protection<br className="hidden md:block" /> is now active.
            </h1>

            {/* Personalised confirmation */}
            <p className="text-slate-300 text-lg max-w-md mb-3 leading-relaxed">
                {email ? (
                    <>
                        We have sent a detailed receipt and your plan details to{' '}
                        <span className="text-[#C9A84C] font-semibold">{email}</span>.
                    </>
                ) : (
                    'We have sent a detailed receipt and your plan details to your email address.'
                )}
            </p>

            <p className="text-slate-400 text-sm max-w-sm mb-10 leading-relaxed">
                If you have any questions or spot anything suspicious, forward it to our
                team straight away — we are here to help.
            </p>

            {/* Cancellation note */}
            <p className="text-slate-500 text-xs mb-10">
                Simple cancellations: Just email us to stop your subscription at any time.
            </p>

            {/* Return to Home */}
            <button
                onClick={onGoHome}
                className="
                    inline-flex items-center gap-2 px-8 py-4 rounded-lg
                    bg-[#C9A84C] text-[#0B1E36] font-semibold text-base
                    hover:bg-[#D9BC78] active:scale-[0.98] transition-all duration-200
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]
                    focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1E36]
                "
                aria-label="Return to homepage"
            >
                <Home className="w-4 h-4" aria-hidden="true" />
                Return to Home
            </button>
        </div>
    );
}
