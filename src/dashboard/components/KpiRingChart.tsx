import React from 'react';
import { KPI_COLORS, type KpiStatus } from './kpiDefaults';

/* ── KPI Ring Chart ──────────────────────────────────────────────────────
   Pure SVG donut chart with animated fill and centre label.
   No external dependencies.                                               */

interface KpiRingChartProps {
    /** 0–100 percentage to fill */
    percent: number;
    /** Status determines the ring colour */
    status: KpiStatus;
    /** Main centre label (e.g. "87%") */
    label: string;
    /** Secondary line below the label */
    sublabel?: string;
    /** SVG viewBox size — default 100 */
    size?: number;
}

export function KpiRingChart({
    percent,
    status,
    label,
    sublabel,
    size = 100,
}: KpiRingChartProps) {
    const colours = KPI_COLORS[status];
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (Math.min(Math.max(percent, 0), 100) / 100) * circumference;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.35rem',
        }}>
            <div style={{ position: 'relative', width: size, height: size }}>
                <svg
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                    style={{ transform: 'rotate(-90deg)' }}
                >
                    {/* Track */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={KPI_COLORS.track}
                        strokeWidth={strokeWidth}
                    />
                    {/* Fill */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={colours.ring}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        style={{
                            transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.3s ease',
                        }}
                    />
                </svg>
                {/* Centre text */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <span style={{
                        fontSize: size * 0.22,
                        fontWeight: 700,
                        color: colours.fg,
                        lineHeight: 1.1,
                    }}>
                        {label}
                    </span>
                </div>
            </div>
            {sublabel && (
                <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: '#475569',
                    textAlign: 'center',
                    lineHeight: 1.2,
                    maxWidth: size + 20,
                }}>
                    {sublabel}
                </span>
            )}
            {/* Status pill */}
            <span style={{
                fontSize: '0.62rem',
                fontWeight: 600,
                color: colours.fg,
                background: colours.bg,
                padding: '2px 8px',
                borderRadius: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
            }}>
                {colours.label}
            </span>
        </div>
    );
}
