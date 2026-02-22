import React from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from './Button';

interface FeatureGroup {
    groupTitle: string;
    items: string[];
}

export interface PricingCardProps {
    name: string;
    planKey: string;            // 'BASIC' | 'GUARDIAN' | 'FAMILY' — sent to server

    // Monthly pricing
    monthlyPrice: string;       // e.g. "£9.99"

    // Yearly pricing (billed annually — saves 2 months)
    yearlyPrice: string;        // e.g. "£8.32"  (per-month equivalent)
    yearlyTotal: string;        // e.g. "£99.90"

    tagline: string;
    description: string;
    featureGroups: FeatureGroup[];
    ctaLabel: string;
    featured?: boolean;

    // Runtime props injected from parent
    isYearly: boolean;
    isLoading: boolean;
    onSubscribe: (planKey: string) => void;
}

function GroupedFeatureList({ groups, light }: { groups: FeatureGroup[]; light: boolean }) {
    const titleColor = light ? 'text-slate-400' : 'text-slate-500';
    const itemColor = light ? 'text-slate-200' : 'text-slate-700';
    const checkColor = 'text-[#C9A84C]';

    return (
        <div className="space-y-6 flex-1">
            {groups.map((group) => (
                <div key={group.groupTitle}>
                    <p className={`text-xs font-semibold tracking-widest uppercase mb-3 ${titleColor}`}>
                        {group.groupTitle}
                    </p>
                    <ul className="space-y-2" aria-label={group.groupTitle}>
                        {group.items.map((item) => (
                            <li key={item} className="flex items-start gap-2.5">
                                <CheckCircle className={`w-4 h-4 shrink-0 mt-0.5 ${checkColor}`} aria-hidden="true" />
                                <span className={`text-sm leading-snug ${itemColor}`}>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
}

export function PricingCard({
    name,
    planKey,
    monthlyPrice,
    yearlyPrice,
    yearlyTotal,
    tagline,
    description,
    featureGroups,
    ctaLabel,
    featured = false,
    isYearly,
    isLoading,
    onSubscribe,
}: PricingCardProps) {
    const displayPrice = isYearly ? yearlyPrice : monthlyPrice;

    const PriceBlock = ({ light }: { light: boolean }) => (
        <div className="mb-7">
            <div className="flex items-baseline gap-1">
                <span
                    className={`text-4xl font-bold ${light ? 'text-white' : 'text-[#112540]'}`}
                    style={{ fontFamily: "'Merriweather', serif" }}
                >
                    {displayPrice}
                </span>
                <span className={`text-sm ml-1 ${light ? 'text-slate-400' : 'text-slate-500'}`}>/mo</span>
            </div>
            {isYearly && (
                <p className={`text-xs mt-1 ${light ? 'text-slate-400' : 'text-slate-500'}`}>
                    Billed {yearlyTotal}/yr · <span className="text-[#C9A84C] font-medium">Save 2 months</span>
                </p>
            )}
        </div>
    );

    const CtaButton = ({ variant }: { variant: 'primary' | 'secondary-light' | 'secondary-dark' }) => (
        <button
            onClick={() => onSubscribe(planKey)}
            disabled={isLoading}
            aria-label={`Subscribe to ${name} plan`}
            className={[
                'w-full mt-8 py-4 rounded-lg font-semibold text-base transition-all duration-200 min-h-[48px]',
                'flex items-center justify-center gap-2',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-offset-2',
                isLoading ? 'opacity-70 cursor-not-allowed' : '',
                variant === 'primary'
                    ? 'bg-[#C9A84C] text-[#0B1E36] hover:bg-[#D9BC78] active:scale-[0.98]'
                    : 'border border-white/20 text-white hover:bg-white/10 focus-visible:ring-offset-[#112540]',
            ].join(' ')}
        >
            {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Redirecting…</>
            ) : ctaLabel}
        </button>
    );

    if (featured) {
        return (
            <article
                className="relative bg-white rounded-xl p-8 flex flex-col shadow-2xl ring-2 ring-[#C9A84C] md:-mt-4 md:-mb-4"
                aria-label={`${name} plan — recommended`}
            >
                <div className="flex items-start justify-between gap-3 mb-1">
                    <h3 className="text-[#112540]">{name}</h3>
                    <span className="shrink-0 text-xs font-semibold tracking-widest uppercase text-[#A8853C] bg-[#C9A84C]/10 px-3 py-1 rounded-md">
                        Recommended
                    </span>
                </div>

                <p className="text-sm font-medium text-[#A8853C] italic mb-2">{tagline}</p>
                <p className="text-slate-500 mb-6 text-sm leading-relaxed">{description}</p>

                <PriceBlock light={false} />
                <GroupedFeatureList groups={featureGroups} light={false} />
                <CtaButton variant="primary" />
            </article>
        );
    }

    return (
        <article
            className="bg-white/5 border border-white/10 rounded-xl p-8 flex flex-col"
            aria-label={`${name} plan`}
        >
            <h3 className="text-white mb-1">{name}</h3>
            <p className="text-sm font-medium text-[#C9A84C]/80 italic mb-2">{tagline}</p>
            <p className="text-slate-400 mb-6 text-sm leading-relaxed">{description}</p>

            <PriceBlock light={true} />
            <GroupedFeatureList groups={featureGroups} light={true} />
            <CtaButton variant="secondary-light" />
        </article>
    );
}
