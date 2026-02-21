import React from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from './Button';

interface FeatureGroup {
    groupTitle: string;
    items: string[];
}

interface PricingCardProps {
    name: string;
    price: string;
    tagline: string;
    description: string;
    featureGroups: FeatureGroup[];
    ctaLabel: string;
    featured?: boolean;
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
    price,
    tagline,
    description,
    featureGroups,
    ctaLabel,
    featured = false,
}: PricingCardProps) {
    if (featured) {
        return (
            <article
                className="relative bg-white rounded-xl p-8 flex flex-col shadow-2xl ring-2 ring-[#C9A84C] md:-mt-4 md:-mb-4"
                aria-label={`${name} plan — recommended`}
            >
                {/* Recommended label */}
                <div className="flex items-start justify-between gap-3 mb-1">
                    <h3 className="text-[#112540]">{name}</h3>
                    <span className="shrink-0 text-xs font-semibold tracking-widest uppercase text-[#A8853C] bg-[#C9A84C]/10 px-3 py-1 rounded-md">
                        Recommended
                    </span>
                </div>

                <p className="text-sm font-medium text-[#A8853C] italic mb-2">{tagline}</p>
                <p className="text-slate-500 mb-6 text-sm leading-relaxed">{description}</p>

                <div className="mb-7 text-[#112540]">
                    <span className="text-4xl font-bold" style={{ fontFamily: "'Merriweather', serif" }}>{price}</span>
                    <span className="text-slate-500 text-sm ml-1">/month</span>
                </div>

                <GroupedFeatureList groups={featureGroups} light={false} />

                <Button variant="primary" size="lg" className="w-full justify-center mt-8">
                    {ctaLabel}
                </Button>
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

            <div className="mb-7">
                <span className="text-4xl font-bold text-white" style={{ fontFamily: "'Merriweather', serif" }}>{price}</span>
                <span className="text-slate-400 text-sm ml-1">/month</span>
            </div>

            <GroupedFeatureList groups={featureGroups} light={true} />

            <button
                className="w-full mt-8 py-4 rounded-lg border border-white/20 text-white font-medium text-base
          hover:bg-white/10 transition-colors duration-200
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#112540]
          min-h-[48px]"
            >
                {ctaLabel}
            </button>
        </article>
    );
}
