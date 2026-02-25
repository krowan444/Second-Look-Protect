import React from 'react';
import { Shield, Mail, Search, CheckCircle, Phone } from 'lucide-react';

/* ─── Brand tokens (reused from main site) ─────────────────────────────── */
const NAVY = '#0B1E36';
const NAVY_LIGHT = '#112540';
const GOLD = '#C9A84C';
const GOLD_HOVER = '#D9BC78';

/* ─── Placeholder values (replace later) ──────────────────────────────── */
const GET_PROTECTION_URL = '(GET_PROTECTION_URL)';
const SUPPORT_PHONE = '(SUPPORT_PHONE)';

/* ─── CareHomePage ─────────────────────────────────────────────────────── */
export function CareHomePage() {
    return (
        <div
            className="care-page"
            style={{
                minHeight: '100vh',
                background: NAVY,
                color: '#fff',
                fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
            }}
        >
            {/* ── 1. Minimal header ─────────────────────────────────────────── */}
            <header
                style={{
                    textAlign: 'center',
                    padding: '2.5rem 1.5rem 1.5rem',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <Shield style={{ width: '1.75rem', height: '1.75rem', color: GOLD }} />
                    <span
                        style={{
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            letterSpacing: '-0.01em',
                            fontFamily: "'Merriweather', Georgia, serif",
                        }}
                    >
                        Second Look <span style={{ color: GOLD }}>Protect</span>
                    </span>
                </div>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                    Safeguarding support provided by your care home
                </p>
                <p style={{ color: '#64748b', fontSize: '0.8rem' }}>
                    Prepared for residents of <strong style={{ color: '#94a3b8' }}>(Care Home Name)</strong>
                </p>
            </header>

            {/* ── 2. Calm reassurance hero ──────────────────────────────────── */}
            <section
                style={{
                    textAlign: 'center',
                    padding: '3rem 1.5rem 2rem',
                    maxWidth: '620px',
                    margin: '0 auto',
                }}
            >
                <h1
                    style={{
                        fontSize: 'clamp(1.5rem, 5vw, 2.25rem)',
                        fontWeight: 700,
                        lineHeight: 1.3,
                        marginBottom: '0.75rem',
                        fontFamily: "'Merriweather', Georgia, serif",
                    }}
                >
                    If something doesn't feel right,
                    <br />
                    you can check it <span style={{ color: GOLD }}>safely</span> here.
                </h1>
                <p style={{ color: '#94a3b8', fontSize: '1.05rem' }}>
                    Nothing is too small to check.
                </p>
            </section>

            {/* ── 3. Primary action buttons ─────────────────────────────────── */}
            <section
                style={{
                    maxWidth: '440px',
                    margin: '0 auto',
                    padding: '0 1.5rem 2.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.875rem',
                }}
            >
                <a
                    href={GET_PROTECTION_URL}
                    className="care-btn care-btn-primary"
                >
                    <Shield style={{ width: '1.15rem', height: '1.15rem' }} />
                    Get Protection Now
                </a>

                <a
                    href={`tel:${SUPPORT_PHONE}`}
                    className="care-btn care-btn-secondary"
                >
                    <Phone style={{ width: '1.15rem', height: '1.15rem' }} />
                    Call for Support
                </a>

                <a
                    href={`sms:${SUPPORT_PHONE}`}
                    className="care-btn care-btn-secondary"
                >
                    <Mail style={{ width: '1.15rem', height: '1.15rem' }} />
                    Text for Support
                </a>
            </section>

            {/* ── 4. The 3 steps ────────────────────────────────────────────── */}
            <section
                style={{
                    maxWidth: '720px',
                    margin: '0 auto',
                    padding: '2.5rem 1.5rem 1.5rem',
                }}
            >
                <div className="care-steps-grid">
                    {[
                        {
                            icon: <Mail style={{ width: '1.5rem', height: '1.5rem', color: GOLD }} />,
                            step: 'Step 1',
                            text: 'Show us what you received',
                        },
                        {
                            icon: <Search style={{ width: '1.5rem', height: '1.5rem', color: GOLD }} />,
                            step: 'Step 2',
                            text: 'We check it carefully for you',
                        },
                        {
                            icon: <CheckCircle style={{ width: '1.5rem', height: '1.5rem', color: GOLD }} />,
                            step: 'Step 3',
                            text: 'You get clear, simple guidance',
                        },
                    ].map((item) => (
                        <div
                            key={item.step}
                            className="care-step-card"
                        >
                            <div
                                style={{
                                    width: '3rem',
                                    height: '3rem',
                                    borderRadius: '50%',
                                    background: 'rgba(201,168,76,0.12)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '0.75rem',
                                }}
                            >
                                {item.icon}
                            </div>
                            <span
                                style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    letterSpacing: '0.08em',
                                    textTransform: 'uppercase' as const,
                                    color: GOLD,
                                    marginBottom: '0.35rem',
                                    display: 'block',
                                }}
                            >
                                {item.step}
                            </span>
                            <p style={{ fontSize: '1rem', color: '#e2e8f0', margin: 0 }}>{item.text}</p>
                        </div>
                    ))}
                </div>

                <p
                    style={{
                        textAlign: 'center',
                        color: '#475569',
                        fontSize: '0.8rem',
                        marginTop: '1.5rem',
                    }}
                >
                    Clear support without pressure or judgement.
                </p>
            </section>

            {/* ── 5. Trust reinforcement strip ──────────────────────────────── */}
            <section
                style={{
                    background: NAVY_LIGHT,
                    padding: '1.75rem 1.5rem',
                    marginTop: '1.5rem',
                }}
            >
                <div
                    className="care-trust-strip"
                >
                    {[
                        'Independent UK-based support',
                        'Designed for safeguarding environments',
                        'Calm, simple guidance',
                    ].map((item) => (
                        <span
                            key={item}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '0.85rem',
                                color: '#94a3b8',
                            }}
                        >
                            <CheckCircle style={{ width: '0.9rem', height: '0.9rem', color: GOLD, flexShrink: 0 }} />
                            {item}
                        </span>
                    ))}
                </div>
            </section>

            {/* ── 6. Care home anchor ───────────────────────────────────────── */}
            <section
                style={{
                    textAlign: 'center',
                    padding: '2.5rem 1.5rem 1rem',
                    maxWidth: '500px',
                    margin: '0 auto',
                }}
            >
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    Example safeguarding portal prepared for <strong style={{ color: '#94a3b8' }}>(Care Home Name)</strong>
                </p>
                <p style={{ color: '#475569', fontSize: '0.75rem' }}>
                    Preview version — no login or setup required.
                </p>
            </section>

            {/* ── 7. Ultra-minimal footer ───────────────────────────────────── */}
            <footer
                style={{
                    textAlign: 'center',
                    padding: '2rem 1.5rem 2.5rem',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    maxWidth: '500px',
                    margin: '0 auto',
                }}
            >
                <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                    Need urgent help? Please speak to a staff member immediately.
                </p>
                <p style={{ color: '#475569', fontSize: '0.75rem' }}>
                    Your privacy is important to us. We never share personal information without your consent.
                </p>
            </footer>
        </div>
    );
}
