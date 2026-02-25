import React from 'react';
import { Shield, Mail, Search, CheckCircle, Phone } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────
   Brand tokens (local to this page — mirrors main site, no side-effects)
───────────────────────────────────────────────────────────────────────── */
const NAVY = '#0B1E36';
const NAVY_MID = '#112540';
const NAVY_DEEP = '#0A1828';
const GOLD = '#C9A84C';
const GOLD_DARK = '#A8853C';

/* ─────────────────────────────────────────────────────────────────────────
   Placeholders — replace before going live
───────────────────────────────────────────────────────────────────────── */
const GET_PROTECTION_URL = '(GET_PROTECTION_URL)';
const SUPPORT_PHONE = '(SUPPORT_PHONE)';
const CARE_HOME_NAME = '(Care Home Name)';

/* ─────────────────────────────────────────────────────────────────────────
   Tiny scoped style block — affects ONLY .slp-care-* classes
───────────────────────────────────────────────────────────────────────── */
const CARE_STYLES = `
  /* ── Reset margin on p inside care page ── */
  .slp-care-root p { max-width: none; margin: 0; }
  .slp-care-root h1, .slp-care-root h2 { letter-spacing: -0.01em; }

  /* ── Primary gold button ── */
  .slp-care-btn-primary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    width: 100%;
    padding: 1.1rem 2rem;
    min-height: 58px;
    border-radius: 9999px;
    background: linear-gradient(135deg, #C6A544 0%, #D2B356 50%, #B8962E 100%);
    color: ${NAVY};
    font-size: 1.05rem;
    font-weight: 700;
    border: none;
    cursor: pointer;
    text-decoration: none;
    box-shadow: 0 4px 18px rgba(201,168,76,0.28);
    transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
  }
  .slp-care-btn-primary:hover {
    filter: brightness(1.08);
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(201,168,76,0.38);
  }
  .slp-care-btn-primary:active { transform: scale(0.98); }

  /* ── Secondary outline buttons ── */
  .slp-care-btn-secondary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    width: 100%;
    padding: 1rem 2rem;
    min-height: 54px;
    border-radius: 9999px;
    background: transparent;
    color: ${GOLD};
    font-size: 1rem;
    font-weight: 600;
    border: 2px solid ${GOLD};
    cursor: pointer;
    text-decoration: none;
    transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
  }
  .slp-care-btn-secondary:hover {
    background: ${GOLD};
    color: ${NAVY};
    transform: translateY(-1px);
  }
  .slp-care-btn-secondary:active { transform: scale(0.98); }

  /* ── Step cards ── */
  .slp-care-step {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 1rem;
    padding: 1.5rem 1.25rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.75rem;
  }

  /* ── Trust strip items ── */
  .slp-care-trust-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #94a3b8;
  }

  /* ── Desktop layout ── */
  @media (min-width: 640px) {
    .slp-care-steps-grid {
      grid-template-columns: repeat(3, 1fr) !important;
    }
    .slp-care-trust-strip {
      flex-direction: row !important;
      gap: 2rem !important;
    }
    .slp-care-btns {
      max-width: 400px !important;
    }
  }
`;

/* ─────────────────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────────────────── */
export function CareHomePage() {
    return (
        <>
            {/* Scoped styles */}
            <style>{CARE_STYLES}</style>

            <div
                className="slp-care-root"
                style={{
                    minHeight: '100vh',
                    background: NAVY,
                    color: '#fff',
                    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
                    WebkitFontSmoothing: 'antialiased',
                }}
            >

                {/* ── 1. HEADER ──────────────────────────────────────────────────── */}
                <header
                    style={{
                        background: NAVY_MID,
                        borderBottom: `1px solid rgba(255,255,255,0.06)`,
                        padding: '1.75rem 1.5rem 1.5rem',
                        textAlign: 'center',
                    }}
                >
                    {/* Logo */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                        <Shield style={{ width: '1.875rem', height: '1.875rem', color: GOLD }} aria-hidden="true" />
                        <span style={{
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            fontFamily: "'Merriweather', Georgia, serif",
                            letterSpacing: '-0.015em',
                            color: '#fff',
                        }}>
                            Second Look <span style={{ color: GOLD }}>Protect</span>
                        </span>
                    </div>

                    {/* Soft sublines */}
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '0.2rem' }}>
                        Safeguarding support provided by your care home
                    </p>
                    <p style={{ color: '#64748b', fontSize: '0.8rem', lineHeight: 1.6 }}>
                        Prepared for residents of{' '}
                        <strong style={{ color: '#94a3b8', fontWeight: 600 }}>{CARE_HOME_NAME}</strong>
                    </p>
                </header>

                {/* ── 2. REASSURANCE HERO ────────────────────────────────────────── */}
                <section
                    style={{
                        textAlign: 'center',
                        padding: '3.5rem 1.5rem 2.5rem',
                        maxWidth: '640px',
                        margin: '0 auto',
                    }}
                    aria-label="Reassurance"
                >
                    <h1
                        style={{
                            fontFamily: "'Merriweather', Georgia, serif",
                            fontSize: 'clamp(1.6rem, 5vw, 2.4rem)',
                            fontWeight: 700,
                            lineHeight: 1.3,
                            color: '#F0F4F8',
                            marginBottom: '0.875rem',
                        }}
                    >
                        If something doesn&rsquo;t feel right,
                        <br />
                        you can check it{' '}
                        <span style={{ color: GOLD }}>safely</span> here.
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: '1.1rem', lineHeight: 1.7 }}>
                        Nothing is too small to check.
                    </p>
                </section>

                {/* ── 3. PRIMARY ACTIONS ─────────────────────────────────────────── */}
                <section
                    style={{
                        padding: '0 1.5rem 3rem',
                        display: 'flex',
                        justifyContent: 'center',
                    }}
                    aria-label="Actions"
                >
                    <div
                        className="slp-care-btns"
                        style={{
                            width: '100%',
                            maxWidth: '360px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.875rem',
                        }}
                    >
                        {/* Get Protection Now */}
                        <a
                            href={GET_PROTECTION_URL}
                            className="slp-care-btn-primary"
                            aria-label="Get Protection Now"
                        >
                            <Shield style={{ width: '1.1rem', height: '1.1rem', flexShrink: 0 }} aria-hidden="true" />
                            Get Protection Now
                        </a>

                        {/* Call for Support */}
                        <a
                            href={`tel:${SUPPORT_PHONE}`}
                            className="slp-care-btn-secondary"
                            aria-label={`Call for support on ${SUPPORT_PHONE}`}
                        >
                            <Phone style={{ width: '1rem', height: '1rem', flexShrink: 0 }} aria-hidden="true" />
                            Call for Support
                        </a>

                        {/* Text for Support */}
                        <a
                            href={`sms:${SUPPORT_PHONE}`}
                            className="slp-care-btn-secondary"
                            aria-label={`Text for support on ${SUPPORT_PHONE}`}
                        >
                            <Mail style={{ width: '1rem', height: '1rem', flexShrink: 0 }} aria-hidden="true" />
                            Text for Support
                        </a>
                    </div>
                </section>

                {/* ── 4. THREE STEPS ─────────────────────────────────────────────── */}
                <section
                    style={{
                        maxWidth: '760px',
                        margin: '0 auto',
                        padding: '0 1.5rem 3rem',
                    }}
                    aria-label="How it works"
                >
                    <div
                        className="slp-care-steps-grid"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr',
                            gap: '1.125rem',
                        }}
                    >
                        {[
                            {
                                icon: <Mail style={{ width: '1.5rem', height: '1.5rem', color: GOLD }} aria-hidden="true" />,
                                step: 'Step 1',
                                text: 'Show us what you received',
                            },
                            {
                                icon: <Search style={{ width: '1.5rem', height: '1.5rem', color: GOLD }} aria-hidden="true" />,
                                step: 'Step 2',
                                text: 'We check it carefully for you',
                            },
                            {
                                icon: <CheckCircle style={{ width: '1.5rem', height: '1.5rem', color: GOLD }} aria-hidden="true" />,
                                step: 'Step 3',
                                text: 'You get clear, simple guidance',
                            },
                        ].map((item) => (
                            <div key={item.step} className="slp-care-step">
                                {/* Icon circle */}
                                <div style={{
                                    width: '3.25rem',
                                    height: '3.25rem',
                                    borderRadius: '50%',
                                    background: 'rgba(201,168,76,0.1)',
                                    border: '1px solid rgba(201,168,76,0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    {item.icon}
                                </div>
                                {/* Step label */}
                                <span style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    letterSpacing: '0.15em',
                                    textTransform: 'uppercase' as const,
                                    color: GOLD_DARK,
                                }}>
                                    {item.step}
                                </span>
                                {/* Step text */}
                                <p style={{ fontSize: '1rem', color: '#e2e8f0', lineHeight: 1.55, fontWeight: 500 }}>
                                    {item.text}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Micro-line */}
                    <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.8rem', marginTop: '1.5rem' }}>
                        Clear support without pressure or judgement.
                    </p>
                </section>

                {/* ── 5. TRUST STRIP ─────────────────────────────────────────────── */}
                <section
                    style={{
                        background: NAVY_MID,
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        padding: '1.75rem 1.5rem',
                    }}
                    aria-label="Trust signals"
                >
                    <div
                        className="slp-care-trust-strip"
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.875rem',
                            maxWidth: '600px',
                            margin: '0 auto',
                        }}
                    >
                        {[
                            'Independent UK-based support',
                            'Designed for safeguarding environments',
                            'Calm, simple guidance',
                        ].map((item) => (
                            <span key={item} className="slp-care-trust-item">
                                <CheckCircle
                                    style={{ width: '0.875rem', height: '0.875rem', color: GOLD, flexShrink: 0 }}
                                    aria-hidden="true"
                                />
                                {item}
                            </span>
                        ))}
                    </div>
                </section>

                {/* ── 6. CARE HOME ANCHOR ────────────────────────────────────────── */}
                <section
                    style={{
                        textAlign: 'center',
                        padding: '2.5rem 1.5rem 1rem',
                        maxWidth: '520px',
                        margin: '0 auto',
                    }}
                    aria-label="Preview information"
                >
                    <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '0.35rem' }}>
                        Example safeguarding portal prepared for{' '}
                        <strong style={{ color: '#94a3b8', fontWeight: 600 }}>{CARE_HOME_NAME}</strong>
                    </p>
                    <p style={{ color: '#475569', fontSize: '0.75rem', lineHeight: 1.6 }}>
                        Preview version — no login or setup required.
                    </p>
                </section>

                {/* ── 7. MINIMAL FOOTER ──────────────────────────────────────────── */}
                <footer
                    style={{
                        textAlign: 'center',
                        padding: '2rem 1.5rem 3rem',
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        maxWidth: '500px',
                        margin: '0 auto',
                    }}
                >
                    <p style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>
                        Need urgent help? Please speak to a staff member immediately.
                    </p>
                    <p style={{ color: '#475569', fontSize: '0.75rem', lineHeight: 1.6 }}>
                        Your privacy is important to us. We never share your personal information without your consent.
                    </p>
                </footer>

            </div>
        </>
    );
}
