import React, { useEffect, useState } from 'react';
import { CheckCircle, Shield, Home, Package, Star, MapPin } from 'lucide-react';

interface Props {
    onGoHome: () => void;
}

// Plan-specific perks shown on the confirmation page
const PLAN_PERKS: Record<string, { title: string; items: string[] }> = {
    'Basic Shield': {
        title: 'Your Basic Shield includes:',
        items: [
            'Up to 5 Personal Reviews per month',
            '24-Hour Reassurance Response',
            'Clear Risk Assessment (Low / Medium / High)',
            'Guardian Risk Summary for your records',
            "The Recovery Blueprint — step-by-step guidance if you've already clicked",
        ],
    },
    'The Guardian': {
        title: 'Your Guardian Pack is on its way:',
        items: [
            'Premium Fridge Magnet — quick-access scam warning guide',
            '2× Wallet Cards — carry your protection everywhere',
            'Phone Stickers — instant reminder on your device',
            'Up to 15 Personal Reviews per month',
            'Priority 12-Hour Response',
        ],
    },
    'Family Shield': {
        title: 'Your Family Shield Pack is on its way:',
        items: [
            'Protection for up to 5 family members',
            '5× Physical Guardian Kits — Fridge Magnets, Wallet Cards & Stickers for every member',
            'Exclusive Scam Scenario Flash Cards for the whole family',
            'Shared Guardian Risk Summary dashboard',
            'Priority 24-Hour Reassurance Response',
        ],
    },
};

const PHYSICAL_PLANS = ['The Guardian', 'Family Shield'];

export default function SubscriptionSuccessPage({ onGoHome }: Props) {
    const [email, setEmail] = useState<string | null>(null);
    const [plan, setPlan] = useState<string | null>(null);
    const [billingInterval, setBillingInterval] = useState<string | null>(null);
    const [shippingAddress, setShippingAddress] = useState<{
        name?: string | null; line1?: string | null; line2?: string | null;
        city?: string | null; postal_code?: string | null; country?: string | null;
    } | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('session_id');
        if (!sessionId) return;

        fetch(`/api/record-subscription?session_id=${encodeURIComponent(sessionId)}`)
            .then((r) => r.json())
            .then((data: { email?: string; plan?: string; billingInterval?: string; shippingAddress?: typeof shippingAddress }) => {
                if (data.email) setEmail(data.email);
                if (data.plan) setPlan(data.plan);
                if (data.billingInterval) setBillingInterval(data.billingInterval);
                if (data.shippingAddress) setShippingAddress(data.shippingAddress);
            })
            .catch(() => { /* fails gracefully */ });
    }, []);

    const perks = plan ? PLAN_PERKS[plan] : null;
    const hasPhysical = plan ? PHYSICAL_PLANS.includes(plan) : false;
    const intervalLabel = billingInterval === 'yearly' ? 'annual' : 'monthly';

    return (
        <div className="min-h-screen bg-[#0B1E36] flex flex-col items-center justify-center px-4 py-16 text-center">

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
                className="text-3xl md:text-4xl font-bold text-white mb-3 leading-tight"
                style={{ fontFamily: "'Merriweather', serif" }}
            >
                Success! Your protection<br className="hidden md:block" /> is now active.
            </h1>

            {/* Plan badge */}
            {plan && (
                <span className="inline-block mb-5 px-4 py-1.5 rounded-full bg-[#C9A84C]/20 text-[#C9A84C] text-sm font-semibold ring-1 ring-[#C9A84C]/30">
                    {plan} — {intervalLabel} plan
                </span>
            )}

            {/* Email confirmation */}
            <p className="text-slate-300 text-lg max-w-md mb-6 leading-relaxed">
                {email ? (
                    <>
                        We have sent a detailed receipt and your plan details to{' '}
                        <span className="text-[#C9A84C] font-semibold">{email}</span>.
                    </>
                ) : (
                    'We have sent a detailed receipt and your plan details to your email address.'
                )}
            </p>

            {/* Plan-specific perks */}
            {perks && (
                <div className="w-full max-w-md mb-8 bg-white/5 rounded-xl p-6 text-left ring-1 ring-white/10">
                    <p className="text-slate-200 font-semibold mb-4 flex items-center gap-2">
                        {hasPhysical
                            ? <Package className="w-4 h-4 text-[#C9A84C]" aria-hidden="true" />
                            : <Star className="w-4 h-4 text-[#C9A84C]" aria-hidden="true" />
                        }
                        {perks.title}
                    </p>
                    <ul className="space-y-2">
                        {perks.items.map((item) => (
                            <li key={item} className="flex items-start gap-2 text-slate-300 text-sm">
                                <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" aria-hidden="true" />
                                {item}
                            </li>
                        ))}
                    </ul>
                    {hasPhysical && (
                        <>
                            {shippingAddress ? (
                                <div className="mt-4 flex items-start gap-2 text-sm text-slate-300 bg-white/5 rounded-lg p-3 ring-1 ring-white/10">
                                    <MapPin className="w-4 h-4 text-[#C9A84C] mt-0.5 shrink-0" aria-hidden="true" />
                                    <div>
                                        <p className="font-semibold text-slate-200 mb-0.5">Shipping to:</p>
                                        {shippingAddress.name && <p>{shippingAddress.name}</p>}
                                        {shippingAddress.line1 && <p>{shippingAddress.line1}</p>}
                                        {shippingAddress.line2 && <p>{shippingAddress.line2}</p>}
                                        <p>
                                            {[shippingAddress.city, shippingAddress.postal_code, shippingAddress.country]
                                                .filter(Boolean).join(', ')}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <p className="mt-4 text-xs text-slate-400">
                                    📦 Physical items will be posted to you within 3–5 working days.
                                </p>
                            )}
                        </>
                    )}
                </div>
            )}

            <p className="text-slate-400 text-sm max-w-sm mb-6 leading-relaxed">
                If you spot anything suspicious, forward it to our team straight away —
                we are here to help.
            </p>

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
