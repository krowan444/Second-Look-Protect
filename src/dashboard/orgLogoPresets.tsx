/**
 * Org logo presets — sector-appropriate, elegant SVG symbols
 * for care home / safeguarding organisations.
 *
 * Each preset is a small inline SVG path rendered at whatever size the caller needs.
 * Colour is always passed in via `color` prop so the same path works on light and dark backgrounds.
 */

import React from 'react';

export interface OrgLogoPreset {
    key: string;
    label: string;
    /** ViewBox string, e.g. "0 0 24 24" */
    viewBox: string;
    /** One or more SVG <path> / <circle> / <rect> etc elements as a React render */
    render: (color: string) => React.ReactNode;
}

export const ORG_LOGO_PRESETS: OrgLogoPreset[] = [
    {
        key: 'shield',
        label: 'Shield',
        viewBox: '0 0 24 24',
        render: (c) => (
            <path
                fill={c}
                d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V6L12 2z"
            />
        ),
    },
    {
        key: 'home',
        label: 'Care Home',
        viewBox: '0 0 24 24',
        render: (c) => (
            <>
                <path fill={c} d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </>
        ),
    },
    {
        key: 'heart',
        label: 'Heart',
        viewBox: '0 0 24 24',
        render: (c) => (
            <path
                fill={c}
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            />
        ),
    },
    {
        key: 'hands',
        label: 'Helping Hands',
        viewBox: '0 0 24 24',
        render: (c) => (
            <path
                fill={c}
                d="M16.5 6A4.5 4.5 0 0 0 12 1.5 4.5 4.5 0 0 0 7.5 6H3v4l2 1 1 11h12l1-11 2-1V6h-4.5zM12 3a3 3 0 0 1 3 3H9a3 3 0 0 1 3-3zm0 16.5A1.5 1.5 0 1 1 12 16a1.5 1.5 0 0 1 0 3.5z"
            />
        ),
    },
    {
        key: 'leaf',
        label: 'Wellbeing',
        viewBox: '0 0 24 24',
        render: (c) => (
            <path
                fill={c}
                d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20c9 0 14-9 14-9s-1.17 1.75-3.11 3.33C18.07 14.1 18 13.6 18 13c0-1.1.9-2 2-2V9c-1.1 0-2 .9-2 2 0 .4.04.79.1 1.17C18.26 11.39 18 10.91 18 10.5V10c0-1.1.9-2 2-2h-3z"
            />
        ),
    },
    {
        key: 'check',
        label: 'Safety Check',
        viewBox: '0 0 24 24',
        render: (c) => (
            <>
                <path fill={c} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" opacity="0.25" />
                <path fill={c} d="M10 17l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </>
        ),
    },
    {
        key: 'building',
        label: 'Building',
        viewBox: '0 0 24 24',
        render: (c) => (
            <path
                fill={c}
                d="M17 11V3H7v4H3v14h8v-4h2v4h8V11h-4zM7 19H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5v-2h2v2zm4 4H9v-2h2v2zm0-4H9v-2h2v2zm0-4H9V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2z"
            />
        ),
    },
    {
        key: 'star',
        label: 'Excellence',
        viewBox: '0 0 24 24',
        render: (c) => (
            <path
                fill={c}
                d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
            />
        ),
    },
];

/** Render a preset icon as an inline SVG */
export function PresetSvg({
    preset,
    color = '#C9A84C',
    size = 20,
}: {
    preset: OrgLogoPreset;
    color?: string;
    size?: number;
}) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={preset.viewBox}
            width={size}
            height={size}
            aria-hidden="true"
            style={{ display: 'block', flexShrink: 0 }}
        >
            {preset.render(color)}
        </svg>
    );
}

/** Resolve a preset key → OrgLogoPreset, or null if not found */
export function findPreset(key: string | null | undefined): OrgLogoPreset | null {
    if (!key) return null;
    return ORG_LOGO_PRESETS.find((p) => p.key === key) ?? null;
}
