import React from 'react';

interface SectionWrapperProps {
    id?: string;
    children: React.ReactNode;
    className?: string;
    innerClassName?: string;
    background?: 'white' | 'offwhite' | 'slate' | 'navy' | 'transparent';
    topBorder?: boolean;
}

const bgClasses: Record<string, string> = {
    white: 'bg-white',
    offwhite: 'bg-[#F9F9F7]',
    slate: 'bg-slate-50',
    navy: 'bg-[#1C3256] text-white',
    transparent: '',
};

export function SectionWrapper({
    id,
    children,
    className = '',
    innerClassName = '',
    background = 'white',
    topBorder = false,
}: SectionWrapperProps) {
    return (
        <section
            id={id}
            className={[
                bgClasses[background],
                'pt-20 pb-20 md:pt-28 md:pb-28',
                topBorder ? 'border-t border-slate-200' : '',
                className,
            ].filter(Boolean).join(' ')}
        >
            <div className={['max-w-6xl mx-auto px-6 md:px-10', innerClassName].join(' ')}>
                {children}
            </div>
        </section>
    );
}

/* Section heading block — used at top of most sections */
interface SectionHeadingProps {
    label?: string;
    title: string;
    subtitle?: string;
    align?: 'left' | 'center';
    light?: boolean; /* for navy backgrounds */
}

export function SectionHeading({
    label,
    title,
    subtitle,
    align = 'center',
    light = false,
}: SectionHeadingProps) {
    const alignClass = align === 'center' ? 'text-center mx-auto' : '';
    const titleColor = light ? 'text-white' : 'text-[#0B1E36]';
    const subtitleColor = light ? 'text-slate-300' : 'text-slate-600';
    const labelColor = light ? 'text-[#C9A84C]' : 'text-[#A8853C]';

    return (
        <div className={['mb-10 md:mb-14 max-w-2xl', alignClass].join(' ')}>
            {label && (
                <p className={['text-sm font-semibold tracking-widest uppercase mb-3', labelColor].join(' ')}>
                    {label}
                </p>
            )}
            <h2 className={['mb-4', titleColor].join(' ')}>{title}</h2>
            {subtitle && (
                <p className={['text-lg leading-relaxed', subtitleColor].join(' ')}>{subtitle}</p>
            )}
        </div>
    );
}
