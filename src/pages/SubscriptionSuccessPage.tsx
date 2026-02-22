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
        title: '',   // header removed per design update
        items: [
            'Up to 15 Personal Reviews per month — professional scam checks whenever you need them.',
            'Priority 12-Hour Reassurance Response — fast-track support for your peace of mind.',
            'Premium Fridge Magnet — a quick-access physical guide to scam warning signs.',
            '2× Wallet Cards & Phone Stickers — keep your protection visible on every device.',
            'Guardian Risk Summary — a detailed monthly breakdown for your records.',
        ],
    },
    'Family Shield': {
        title: '',   // header removed to match Guardian design
        items: [
            'Protection for up to 5 family members — shared security for your whole household.',
            '5× Physical Guardian Packs — stickers and magnets for every family member’s devices.',
            'Family ‘Scam Scenario’ Flash Cards — interactive tools to train the whole family.',
            'Priority 24-Hour Reassurance Response — our fastest support for family emergencies.',
            'Shared Guardian Risk Summary — a comprehensive overview of your family’s safety.',
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

    // Sticker claim form state (Basic Shield only)
    const [stickerLine1, setStickerLine1] = useState('');
    const [stickerCity, setStickerCity] = useState('');
    const [stickerPostcode, setStickerPostcode] = useState('');
    const [stickerSaving, setStickerSaving] = useState(false);
    const [stickerDone, setStickerDone] = useState(false);
    const [stickerError, setStickerError] = useState<string | null>(null);

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

    const handleStickerSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        setStickerSaving(true);
        setStickerError(null);
        try {
            const res = await fetch('/api/update-shipping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    line1: stickerLine1.trim(),
                    city: stickerCity.trim(),
                    postalCode: stickerPostcode.trim(),
                }),
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error ?? 'Save failed');
            }
            setStickerDone(true);
        } catch (err) {
            setStickerError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setStickerSaving(false);
        }
    };

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
                    {perks.title && (
                        <p className="text-slate-200 font-semibold mb-4 flex items-center gap-2">
                            {hasPhysical
                                ? <Package className="w-4 h-4 text-[#C9A84C]" aria-hidden="true" />
                                : <Star className="w-4 h-4 text-[#C9A84C]" aria-hidden="true" />
                            }
                            {perks.title}
                        </p>
                    )}
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
            {/* Shipping claim form — all three tiers */}
            {(plan === 'Basic Shield' || plan === 'The Guardian' || plan === 'Family Shield') && email && (
                <div className="w-full max-w-md mb-8 bg-white/5 rounded-xl p-6 text-left ring-1 ring-white/10">
                    {stickerDone ? (
                        <div className="flex items-start gap-3 text-emerald-400">
                            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                            <p className="text-sm font-medium">
                                {plan === 'The Guardian'
                                    ? 'Success! Your Guardian Magnet and Stickers are being prepared for dispatch.'
                                    : plan === 'Family Shield'
                                        ? 'Success! Your 5× Family Guardian Packs and Flash Cards are being prepared for dispatch.'
                                        : 'Thank you! Your sticker will be sent to this address.'}
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleStickerSubmit} noValidate>
                            <p className="text-slate-200 font-semibold mb-4 flex items-center gap-2">
                                <Package className="w-4 h-4 text-[#C9A84C]" aria-hidden="true" />
                                {plan === 'The Guardian'
                                    ? 'Where should we send your Guardian Magnet & Stickers?'
                                    : plan === 'Family Shield'
                                        ? 'Where should we send your Family Guardian Packs?'
                                        : 'Claim Your Shield Sticker'}
                            </p>
                            <p className="text-slate-400 text-xs mb-4">
                                {plan === 'The Guardian'
                                    ? "Enter your UK address and we'll post your Guardian Kit within 3–5 working days."
                                    : plan === 'Family Shield'
                                        ? "Enter your UK address and we'll post your 5 Family Guardian Packs within 3–5 working days."
                                        : "Enter your UK address and we'll post your free Shield Sticker within 3–5 working days."}
                            </p>

                            <div className="space-y-3">
                                <div>
                                    <label htmlFor="sticker-line1" className="block text-xs text-slate-400 mb-1">Address Line 1</label>
                                    <input
                                        id="sticker-line1"
                                        type="text"
                                        required
                                        value={stickerLine1}
                                        onChange={(e) => setStickerLine1(e.target.value)}
                                        placeholder="12 High Street"
                                        className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/60"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="sticker-city" className="block text-xs text-slate-400 mb-1">Town / City</label>
                                    <input
                                        id="sticker-city"
                                        type="text"
                                        required
                                        value={stickerCity}
                                        onChange={(e) => setStickerCity(e.target.value)}
                                        placeholder="London"
                                        className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/60"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="sticker-postcode" className="block text-xs text-slate-400 mb-1">Postcode</label>
                                    <input
                                        id="sticker-postcode"
                                        type="text"
                                        required
                                        value={stickerPostcode}
                                        onChange={(e) => setStickerPostcode(e.target.value)}
                                        placeholder="SW1A 1AA"
                                        className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/60"
                                    />
                                </div>
                            </div>

                            {stickerError && (
                                <p className="mt-3 text-xs text-red-400">{stickerError}</p>
                            )}

                            <button
                                type="submit"
                                disabled={stickerSaving || !stickerLine1 || !stickerCity || !stickerPostcode}
                                className="mt-4 w-full py-2.5 rounded-lg bg-[#C9A84C] text-[#0B1E36] font-semibold text-sm hover:bg-[#D9BC78] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {stickerSaving ? 'Saving…' : 'Confirm Delivery'}
                            </button>
                        </form>
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
        </div >
    );
}
