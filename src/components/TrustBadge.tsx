import React from 'react';
import { Shield, Lock, Clock, BadgeCheck, CheckCircle } from 'lucide-react';

const BADGES = [
    { icon: BadgeCheck, label: 'UK-Based Experts' },
    { icon: Lock, label: 'Fully Confidential' },
    { icon: Shield, label: 'Independent Service' },
    { icon: Clock, label: 'Priority Response Available' },
    { icon: CheckCircle, label: 'Human-Reviewed, Clear Guidance' },
];

interface TrustBadgeProps {
    light?: boolean;
}

export function TrustBadge({ light = false }: TrustBadgeProps) {
    const textColor = light ? 'text-slate-300' : 'text-slate-600';
    const iconColor = light ? 'text-[#C9A84C]' : 'text-[#A8853C]';
    const dividerColor = light ? 'bg-white/15' : 'bg-slate-300';

    return (
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3" role="list" aria-label="Trust credentials">
            {BADGES.map((badge, i) => (
                <React.Fragment key={badge.label}>
                    <div className={`flex items-center gap-2 text-sm font-medium ${textColor}`} role="listitem">
                        <badge.icon className={`w-4 h-4 shrink-0 ${iconColor}`} aria-hidden="true" />
                        <span>{badge.label}</span>
                    </div>
                    {i < BADGES.length - 1 && (
                        <div className={`hidden sm:block w-px h-4 ${dividerColor}`} aria-hidden="true" />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
}
