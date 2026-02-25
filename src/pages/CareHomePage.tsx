import React from 'react';
import { Shield, Mail, Search, CheckCircle, Phone } from 'lucide-react';

/* ─── Brand tokens (reused from main site, local only) ─────────────────── */
const NAVY = '#0B1E36';
const NAVY_LIGHT = '#112540';
const GOLD = '#C9A84C';

/* ─── Placeholder values (replace before going live) ───────────────────── */
const GET_PROTECTION_URL = '/get-protection';
const SUPPORT_PHONE_CALL = '01604385888';
const SUPPORT_PHONE_TEXT = '07907614821';

/* ─── Scoped styles — ONLY affect .care-page-* classes ─────────────────── */
const CARE_CSS = `
  .care-page * { box-sizing: border-box; }
  .care-page p { max-width: none; margin: 0; text-align: center; }
  .care-page h1 { text-align: center; margin: 0; }
  .care-page section, .care-page header, .care-page footer { text-align: center; }

  /* ── Primary gold CTA ── */
  .care-page-btn-primary {
    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    width: 100%; min-height: 56px; padding: 0 1.5rem;
    border-radius: 9999px; border: none; cursor: pointer; text-decoration: none;
    background: linear-gradient(135deg, #C6A544 0%, #D2B356 50%, #B8962E 100%);
    color: #0B1E36; font-size: 18px; font-weight: 700;
    box-shadow: 0 4px 18px rgba(201,168,76,0.28);
    transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
  }
  .care-page-btn-primary:hover {
    filter: brightness(1.08); transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(201,168,76,0.38);
  }
  .care-page-btn-primary:active { transform: scale(0.98); }

  /* ── Secondary outline CTA ── */
  .care-page-btn-secondary {
    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    width: 100%; min-height: 56px; padding: 0 1.5rem;
    border-radius: 9999px; cursor: pointer; text-decoration: none;
    background: transparent; color: #C9A84C;
    font-size: 18px; font-weight: 600;
    border: 2px solid #C9A84C;
    white-space: nowrap;
    transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
  }
  .care-page-btn-secondary:hover {
    background: #C9A84C; color: #0B1E36; transform: translateY(-1px);
  }
  .care-page-btn-secondary:active { transform: scale(0.98); }

  /* ── Steps grid: 3-col on desktop, stacked on mobile ── */
  .care-page-steps {
    display: grid; grid-template-columns: 1fr; gap: 10px;
    max-width: 720px; margin: 0 auto;
  }
  @media (min-width: 640px) {
    .care-page-steps { grid-template-columns: repeat(3, 1fr); }
  }

  /* ── Step card ── */
  .care-page-step {
    display: flex; align-items: center; gap: 12px;
    padding: 12px; text-align: left;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
  }
  @media (min-width: 640px) {
    .care-page-step {
      flex-direction: column; align-items: center; text-align: center;
      padding: 14px; gap: 8px;
    }
  }

  /* ── Trust strip ── */
  .care-page-trust {
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    max-width: 600px; margin: 0 auto;
  }
  @media (min-width: 640px) {
    .care-page-trust { flex-direction: row; gap: 2rem; justify-content: center; }
  }
`;

/* ─── Component ────────────────────────────────────────────────────────── */
export function CareHomePage() {
    return (
        <>
            <style>{CARE_CSS}</style>

            <div
                className="care-page"
                style={{
                    minHeight: '100vh',
                    background: NAVY,
                    color: '#fff',
                    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
                    WebkitFontSmoothing: 'antialiased',
                }}
            >

                {/* ── 1. HEADER — compressed ─────────────────────────────────────── */}
                <header style={{
                    padding: '14px 1.5rem 10px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                    {/* Logo */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: '0.5rem', marginBottom: '6px',
                    }}>
                        <Shield style={{ width: '1.5rem', height: '1.5rem', color: GOLD }} aria-hidden="true" />
                        <span style={{
                            fontSize: '1.15rem', fontWeight: 700,
                            fontFamily: "'Merriweather', Georgia, serif",
                            letterSpacing: '-0.01em',
                        }}>
                            Second Look <span style={{ color: GOLD }}>Protect</span>
                        </span>
                    </div>
                    {/* Identity lines */}
                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '4px' }}>
                        Trusted safeguarding support provided by your care home
                    </p>
                    <p style={{ color: '#64748b', fontSize: '0.72rem' }}>
                        Prepared for residents of <strong style={{ color: '#94a3b8' }}>(Care Home Name)</strong>
                    </p>
                </header>

                {/* ── 2. HEADLINE — single compact line ──────────────────────────── */}
                <section style={{
                    padding: '12px 1.5rem',
                    maxWidth: '640px', margin: '0 auto',
                }}>
                    <h1 style={{
                        fontFamily: "'Merriweather', Georgia, serif",
                        fontSize: 'clamp(1.15rem, 3.5vw, 1.75rem)',
                        fontWeight: 700, lineHeight: 1.35, color: '#F0F4F8',
                    }}>
                        If something doesn&rsquo;t feel right, you can check it{' '}
                        <span style={{ color: GOLD }}>safely</span> here.
                    </h1>
                </section>

                {/* ── 3. STEPS — before buttons ───────────────────────────────────── */}
                <section style={{ padding: '12px 1.5rem 14px' }}>
                    <div className="care-page-steps">
                        {[
                            { icon: <Mail style={{ width: 22, height: 22, color: GOLD }} aria-hidden="true" />, step: 'Step 1', text: 'Share the message or call you received' },
                            { icon: <Search style={{ width: 22, height: 22, color: GOLD }} aria-hidden="true" />, step: 'Step 2', text: 'We check it carefully for you' },
                            { icon: <CheckCircle style={{ width: 22, height: 22, color: GOLD }} aria-hidden="true" />, step: 'Step 3', text: 'You get clear, simple guidance' },
                        ].map((item) => (
                            <div key={item.step} className="care-page-step">
                                {/* Icon circle */}
                                <div style={{
                                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                                    background: 'rgba(201,168,76,0.1)',
                                    border: '1px solid rgba(201,168,76,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    {item.icon}
                                </div>
                                {/* Text */}
                                <div>
                                    <span style={{
                                        display: 'block', fontSize: '0.6rem', fontWeight: 700,
                                        letterSpacing: '0.12em', textTransform: 'uppercase' as const,
                                        color: 'rgba(168,133,60,0.7)', marginBottom: 2, textAlign: 'center',
                                    }}>
                                        {item.step}
                                    </span>
                                    <p style={{ fontSize: '0.92rem', color: '#e2e8f0', fontWeight: 500, textAlign: 'center' }}>
                                        {item.text}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p style={{ color: '#475569', fontSize: '0.72rem', marginTop: '10px' }}>
                        Clear support without pressure or judgement.
                    </p>
                </section>

                {/* ── 4. BUTTONS — immediately after steps ───────────────────────── */}
                <section style={{
                    maxWidth: '460px', margin: '0 auto',
                    padding: '0 1.5rem 2rem',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: '12px',
                }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.78rem', marginBottom: '10px' }}>
                        You are safe to check first.
                    </p>
                    <a href={GET_PROTECTION_URL} className="care-page-btn-primary" aria-label="Get Protection Now" style={{ marginBottom: '12px' }}>
                        <Shield style={{ width: 18, height: 18, flexShrink: 0 }} aria-hidden="true" />
                        Get Protection Now
                    </a>
                    <a href={`tel:${SUPPORT_PHONE_CALL}`} className="care-page-btn-secondary" aria-label="Call for Support on 01604 385888">
                        <Phone style={{ width: 18, height: 18, flexShrink: 0 }} aria-hidden="true" />
                        Call for Support — 01604 385888
                    </a>
                    <a href={`sms:${SUPPORT_PHONE_TEXT}`} className="care-page-btn-secondary" aria-label="Text for Support on 07907 614821">
                        <Mail style={{ width: 18, height: 18, flexShrink: 0 }} aria-hidden="true" />
                        Text for Support — 07907 614821
                    </a>
                </section>

                {/* ── 5. Trust strip ──────────────────────────────────────────────── */}
                <section style={{
                    background: NAVY_LIGHT,
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    padding: '1.25rem 1.5rem',
                }}>
                    <div className="care-page-trust">
                        {[
                            'Independent UK-based support',
                            'Designed for safeguarding environments',
                            'Calm, simple guidance',
                        ].map((item) => (
                            <span key={item} style={{
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                fontSize: '0.8rem', color: '#94a3b8',
                            }}>
                                <CheckCircle style={{ width: 14, height: 14, color: GOLD, flexShrink: 0 }} aria-hidden="true" />
                                {item}
                            </span>
                        ))}
                    </div>
                </section>

                {/* ── 6. Care home anchor ─────────────────────────────────────────── */}
                <section style={{
                    padding: '2rem 1.5rem 0.75rem',
                    maxWidth: '500px', margin: '0 auto',
                }}>
                    <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '4px' }}>
                        Example safeguarding portal prepared for <strong style={{ color: '#94a3b8' }}>(Care Home Name)</strong>
                    </p>
                    <p style={{ color: '#475569', fontSize: '0.7rem' }}>
                        Preview version — no login or setup required.
                    </p>
                </section>

                {/* ── 7. Minimal footer ───────────────────────────────────────────── */}
                <footer style={{
                    padding: '1.5rem 1.5rem 2rem',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    maxWidth: '500px', margin: '0 auto',
                }}>
                    <p style={{ color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        Need urgent help? Please speak to a staff member immediately.
                    </p>
                    <p style={{ color: '#475569', fontSize: '0.7rem' }}>
                        Your privacy is important to us. We never share personal information without your consent.
                    </p>
                </footer>

            </div>
        </>
    );
}
