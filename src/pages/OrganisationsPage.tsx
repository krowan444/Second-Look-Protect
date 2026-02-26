import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Button } from '../components/Button';
import { SectionWrapper, SectionHeading } from '../components/SectionWrapper';
import { TrustBadge } from '../components/TrustBadge';
import {
    Shield, CheckCircle, Users, Building2, Home, Landmark, Heart,
    Upload, MessageSquare, BarChart3, Mail, ArrowRight,
} from 'lucide-react';

/* ─── Scoped page styles (orgs-page only) ──────────────────────────────── */
const ORGS_CSS = `
  .orgs-page { background: #ffffff; }

  /* Hero — calm enterprise feel, NOT homepage-style */
  .orgs-hero {
    background: linear-gradient(165deg, #F4F6F8 0%, #EEF1F5 40%, #F9F9F7 100%);
    border-bottom: 1px solid #e2e8f0;
  }
  .orgs-hero-img {
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(11,30,54,0.10), 0 2px 8px rgba(0,0,0,0.04);
    width: 100%;
    max-width: 520px;
    height: auto;
  }

  /* Reassurance badges */
  .orgs-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    color: #64748b;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 9999px;
    padding: 5px 14px;
    font-weight: 500;
  }
  .orgs-badge::before {
    content: '•';
    color: #C9A84C;
    font-weight: 700;
  }

  /* Organisation cards — clean, minimal */
  .orgs-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    transition: box-shadow 0.25s ease, border-color 0.25s ease;
  }
  .orgs-card:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.06);
    border-color: #cbd5e1;
  }

  /* Step blocks */
  .orgs-step {
    background: #F9F9F7;
    border: 1px solid #f1f5f9;
    border-radius: 12px;
    padding: 2rem;
    text-align: center;
  }
  .orgs-step-num {
    width: 48px; height: 48px;
    border-radius: 50%;
    background: #ffffff;
    border: 2px solid #e2e8f0;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.15rem; font-weight: 700;
    color: #0B1E36;
    margin: 0 auto 1rem;
  }

  /* Selector panel */
  .orgs-selector-panel {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 2rem;
    max-width: 420px;
    margin: 0 auto;
  }
  .orgs-selector-panel select {
    width: 100%;
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    color: #0B1E36;
    font-size: 1rem;
    min-height: 48px;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .orgs-selector-panel select:focus {
    outline: none;
    border-color: #C9A84C;
    box-shadow: 0 0 0 3px rgba(201,168,76,0.15);
  }

  /* Footer (self-contained, matches global site footer) */
  .orgs-footer {
    background: #0A1C32;
    color: #94a3b8;
    border-top: 1px solid rgba(255,255,255,0.08);
  }
  .orgs-footer a { color: #94a3b8; text-decoration: none; transition: color 0.2s ease; }
  .orgs-footer a:hover { color: #ffffff; }
`;

/* ─── Smooth scroll with navbar offset ─────────────────────────────────── */
function scrollToId(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const navHeight = 72;
    const top = el.getBoundingClientRect().top + window.scrollY - navHeight - 16;
    window.scrollTo({ top, behavior: 'smooth' });
}

/* ─── Organisation card data ───────────────────────────────────────────── */
const ORG_CARDS = [
    {
        title: 'Care Homes',
        description: 'Structured safeguarding support with clear guidance and optional monthly insight summaries.',
        buttonLabel: 'View care home overview',
        href: '/care',
        icon: Home,
    },
    {
        title: 'Assisted / Supported Living',
        description: 'Independence-focused protection with a gentle safeguarding layer for residents and teams.',
        buttonLabel: 'View assisted living overview',
        href: '/assisted',
        icon: Heart,
    },
    {
        title: 'Housing Associations / Extra Care',
        description: 'Safeguarding support for resident communities and tenancy support teams.',
        buttonLabel: 'View housing overview',
        href: '/housing',
        icon: Building2,
    },
    {
        title: 'Community Organisations',
        description: 'Support for charities and local groups helping older adults check suspicious contacts.',
        buttonLabel: 'View community overview',
        href: '/community',
        icon: Users,
    },
    {
        title: 'Public Sector & Partnerships',
        description: 'For councils and safeguarding teams exploring partnership or pilot discussions.',
        buttonLabel: 'View partnership overview',
        href: '/partners',
        icon: Landmark,
    },
];

/* ─── How-it-works steps ───────────────────────────────────────────────── */
const STEPS = [
    { num: '1', title: 'Submit a concern', description: 'Residents or staff upload a suspicious message, screenshot, or call details.' },
    { num: '2', title: 'Receive clear guidance', description: 'Human-reviewed guidance provided in plain language with next steps.' },
    { num: '3', title: 'Build safeguarding insight', description: 'Organisations can receive a simple overview of common scam types and trends.' },
];

/* ─── Benefits ─────────────────────────────────────────────────────────── */
const BENEFITS = [
    'Reduces safeguarding uncertainty',
    'Supports staff confidence',
    'Encourages residents to check before acting',
    'Provides insight into emerging scam patterns',
    'Adds a simple additional safeguarding layer',
];

/* ─── Authority items ──────────────────────────────────────────────────── */
const AUTHORITY_ITEMS = [
    { title: 'UK-based human-reviewed guidance', description: 'Clear responses reviewed with safeguarding in mind.' },
    { title: 'Built to support existing safeguarding procedures', description: 'Designed to complement current processes without disruption.' },
    { title: 'Resident-first design', description: 'Calm, simple interface to reduce confusion and anxiety.' },
    { title: 'Privacy-conscious approach', description: 'Built with trust and sensitive information in mind.' },
];

/* ─── Environment selector options ─────────────────────────────────────── */
const ENV_OPTIONS = ['Care home', 'Assisted living', 'Housing', 'Community', 'Other'];

/* ═══════════════════════════════════════════════════════════════════════════
   OrganisationsPage — standalone gateway page
   NOT a clone of the homepage. This has its own unique enterprise layout.
   ═══════════════════════════════════════════════════════════════════════════ */

export function OrganisationsPage() {
    const [selectedEnv, setSelectedEnv] = useState('');

    function handleGetProtection() {
        window.history.pushState(null, '', '/get-protection');
        window.location.href = '/get-protection';
    }

    return (
        <>
            <style>{ORGS_CSS}</style>
            <div className="orgs-page min-h-screen selection:bg-[#C9A84C]/30 selection:text-[#0B1E36]">
                <Navbar onGetProtection={handleGetProtection} />

                {/* ═══════════════════════════════════════════════════════════════
            SECTION 1 — HERO (enterprise gateway, NOT homepage style)
            ═══════════════════════════════════════════════════════════════ */}
                <section
                    className="orgs-hero"
                    aria-label="Organisations hero"
                    style={{ paddingTop: '140px' }}
                >
                    <div className="max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24">
                        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
                            {/* Text column */}
                            <div style={{ maxWidth: '540px' }}>
                                <h1
                                    className="text-[#0B1E36] mb-6"
                                    style={{
                                        fontFamily: "'Merriweather', serif",
                                        lineHeight: 1.25,
                                        fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)',
                                        fontWeight: 600,
                                    }}
                                >
                                    Digital safeguarding support for organisations supporting older adults
                                </h1>

                                <p style={{
                                    color: '#475569',
                                    fontSize: '1.1rem',
                                    lineHeight: 1.7,
                                    marginBottom: '1.5rem',
                                    maxWidth: '480px',
                                }}>
                                    Helping care and supported living environments respond confidently to increasingly sophisticated scams targeting residents.
                                </p>

                                {/* Micro reassurance badges */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '2.5rem' }}>
                                    {['UK-based', 'Human-reviewed guidance', 'Designed to support existing safeguarding processes'].map((badge) => (
                                        <span key={badge} className="orgs-badge">{badge}</span>
                                    ))}
                                </div>

                                {/* CTAs */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} className="sm:flex-row sm:!gap-4">
                                    <Button
                                        variant="primary"
                                        size="lg"
                                        onClick={() => scrollToId('org-options')}
                                        aria-label="Explore organisation options"
                                    >
                                        Explore organisation options
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="lg"
                                        onClick={() => scrollToId('org-example')}
                                        aria-label="View example safeguarding environment"
                                    >
                                        View example safeguarding environment
                                    </Button>
                                </div>
                            </div>

                            {/* Image column */}
                            <div style={{ display: 'flex', justifyContent: 'center' }} className="md:justify-end">
                                <img
                                    src="/images/organisations/organisation-hero.png"
                                    alt="Organisation safeguarding dashboard preview"
                                    className="orgs-hero-img"
                                    loading="eager"
                                    decoding="async"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* ═══════════════════════════════════════════════════════════════
            SECTION 2 — AUTHORITY LAYER (Quiet Trust)
            ═══════════════════════════════════════════════════════════════ */}
                <section style={{
                    background: '#ffffff',
                    borderTop: '1px solid #e2e8f0',
                    padding: '3.5rem 0 4rem',
                }}>
                    <div className="max-w-6xl mx-auto px-6 md:px-10">
                        <h2
                            style={{
                                fontFamily: "'Merriweather', serif",
                                color: '#0B1E36',
                                textAlign: 'center',
                                marginBottom: '3rem',
                                fontSize: 'clamp(1.5rem, 2.8vw, 2.25rem)',
                                fontWeight: 600,
                            }}
                        >
                            Designed for safeguarding environments
                        </h2>

                        <div className="grid sm:grid-cols-2 gap-6" style={{ maxWidth: '900px', margin: '0 auto' }}>
                            {AUTHORITY_ITEMS.map((item) => (
                                <div
                                    key={item.title}
                                    style={{
                                        background: '#F9F9F7',
                                        border: '1px solid #f1f5f9',
                                        borderRadius: '12px',
                                        padding: '1.75rem',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                                        <div
                                            style={{
                                                width: '38px', height: '38px', borderRadius: '50%',
                                                background: 'rgba(201,168,76,0.08)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0, marginTop: '2px',
                                            }}
                                            aria-hidden="true"
                                        >
                                            <CheckCircle style={{ width: '18px', height: '18px', color: '#C9A84C' }} />
                                        </div>
                                        <div>
                                            <h3 style={{
                                                fontFamily: "'Merriweather', serif",
                                                color: '#0B1E36',
                                                fontSize: '0.95rem',
                                                fontWeight: 600,
                                                marginBottom: '6px',
                                                lineHeight: 1.35,
                                            }}>
                                                {item.title}
                                            </h3>
                                            <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.6 }}>
                                                {item.description}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ═══════════════════════════════════════════════════════════════
            SECTION 3 — ORGANISATION SELECTION (Core Gateway)
            ═══════════════════════════════════════════════════════════════ */}
                <section
                    id="org-options"
                    style={{
                        background: '#F9F9F7',
                        borderTop: '1px solid #e2e8f0',
                        padding: '3.5rem 0 4rem',
                    }}
                >
                    <div className="max-w-6xl mx-auto px-6 md:px-10">
                        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                            <h2 style={{
                                fontFamily: "'Merriweather', serif",
                                color: '#0B1E36',
                                marginBottom: '0.75rem',
                                fontSize: 'clamp(1.5rem, 2.8vw, 2.25rem)',
                                fontWeight: 600,
                            }}>
                                Choose your environment
                            </h2>
                            <p style={{ color: '#64748b', fontSize: '1rem' }}>
                                Select the option closest to your organisation to view the most relevant overview.
                            </p>
                        </div>

                        <div
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                            style={{ maxWidth: '1050px', margin: '0 auto' }}
                        >
                            {ORG_CARDS.map((card) => {
                                const Icon = card.icon;
                                return (
                                    <div key={card.title} className="orgs-card">
                                        <div
                                            style={{
                                                width: '44px', height: '44px', borderRadius: '10px',
                                                background: 'rgba(201,168,76,0.08)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                marginBottom: '1.25rem',
                                            }}
                                            aria-hidden="true"
                                        >
                                            <Icon style={{ width: '22px', height: '22px', color: '#C9A84C' }} />
                                        </div>
                                        <h3 style={{
                                            fontFamily: "'Merriweather', serif",
                                            color: '#0B1E36',
                                            fontSize: 'clamp(1rem, 1.8vw, 1.15rem)',
                                            fontWeight: 600,
                                            marginBottom: '0.75rem',
                                            lineHeight: 1.3,
                                        }}>
                                            {card.title}
                                        </h3>
                                        <p style={{
                                            color: '#64748b',
                                            fontSize: '0.88rem',
                                            lineHeight: 1.65,
                                            marginBottom: '1.5rem',
                                            flex: 1,
                                        }}>
                                            {card.description}
                                        </p>
                                        <Button
                                            variant="secondary"
                                            size="md"
                                            as="a"
                                            href={card.href}
                                            className="w-full justify-center"
                                            style={{ fontSize: '0.88rem' }}
                                        >
                                            {card.buttonLabel}
                                            <ArrowRight style={{ width: '16px', height: '16px' }} aria-hidden="true" />
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* ═══════════════════════════════════════════════════════════════
            SECTION 4 — HOW IT WORKS (3 calm steps)
            ═══════════════════════════════════════════════════════════════ */}
                <section style={{
                    background: '#ffffff',
                    borderTop: '1px solid #e2e8f0',
                    padding: '3.5rem 0 4rem',
                }}>
                    <div className="max-w-6xl mx-auto px-6 md:px-10">
                        <h2 style={{
                            fontFamily: "'Merriweather', serif",
                            color: '#0B1E36',
                            textAlign: 'center',
                            marginBottom: '2.5rem',
                            fontSize: 'clamp(1.5rem, 2.8vw, 2.25rem)',
                            fontWeight: 600,
                        }}>
                            How it works
                        </h2>

                        <div className="grid md:grid-cols-3 gap-6" style={{ maxWidth: '900px', margin: '0 auto' }}>
                            {STEPS.map((step) => (
                                <div key={step.num} className="orgs-step">
                                    <div className="orgs-step-num" aria-hidden="true">{step.num}</div>
                                    <h3 style={{
                                        fontFamily: "'Merriweather', serif",
                                        color: '#0B1E36',
                                        fontSize: '1rem',
                                        fontWeight: 600,
                                        marginBottom: '0.5rem',
                                    }}>
                                        {step.title}
                                    </h3>
                                    <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.65 }}>
                                        {step.description}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ═══════════════════════════════════════════════════════════════
            SECTION 5 — PRE-ONBOARDING (Explore Example)
            ═══════════════════════════════════════════════════════════════ */}
                <section
                    id="org-example"
                    style={{
                        background: '#F9F9F7',
                        borderTop: '1px solid #e2e8f0',
                        padding: '3.5rem 0 4rem',
                    }}
                >
                    <div className="max-w-6xl mx-auto px-6 md:px-10">
                        <h2 style={{
                            fontFamily: "'Merriweather', serif",
                            color: '#0B1E36',
                            textAlign: 'center',
                            marginBottom: '1.5rem',
                            fontSize: 'clamp(1.5rem, 2.8vw, 2.25rem)',
                            fontWeight: 600,
                        }}>
                            Explore how this could work for your organisation
                        </h2>

                        <div style={{ maxWidth: '580px', margin: '0 auto', textAlign: 'center' }}>
                            <p style={{
                                color: '#475569',
                                fontSize: '1rem',
                                lineHeight: 1.7,
                                marginBottom: '2rem',
                            }}>
                                We can provide a simplified safeguarding view designed for organisational environments.
                                The experience is calm, clear, and focused on protection.
                            </p>

                            <div style={{ marginBottom: '2.5rem' }}>
                                <Button
                                    variant="primary"
                                    size="lg"
                                    as="a"
                                    href="mailto:hello@secondlookprotect.co.uk?subject=Organisation%20safeguarding%20example"
                                >
                                    View example safeguarding environment
                                    <ArrowRight style={{ width: '18px', height: '18px' }} aria-hidden="true" />
                                </Button>
                            </div>

                            {/* Micro-selector (non-submitting UI) */}
                            <div className="orgs-selector-panel">
                                <label
                                    htmlFor="org-env-select"
                                    style={{
                                        display: 'block',
                                        fontFamily: "'Merriweather', serif",
                                        color: '#0B1E36',
                                        fontWeight: 600,
                                        fontSize: '0.95rem',
                                        marginBottom: '1rem',
                                    }}
                                >
                                    What type of environment do you support?
                                </label>
                                <select
                                    id="org-env-select"
                                    value={selectedEnv}
                                    onChange={(e) => setSelectedEnv(e.target.value)}
                                >
                                    <option value="">Select your environment…</option>
                                    {ENV_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ═══════════════════════════════════════════════════════════════
            SECTION 6 — WHY ORGANISATIONS USE THIS (Benefits)
            ═══════════════════════════════════════════════════════════════ */}
                <section style={{
                    background: '#ffffff',
                    borderTop: '1px solid #e2e8f0',
                    padding: '3.5rem 0 4rem',
                }}>
                    <div className="max-w-6xl mx-auto px-6 md:px-10">
                        <h2 style={{
                            fontFamily: "'Merriweather', serif",
                            color: '#0B1E36',
                            textAlign: 'center',
                            marginBottom: '2.5rem',
                            fontSize: 'clamp(1.5rem, 2.8vw, 2.25rem)',
                            fontWeight: 600,
                        }}>
                            Why organisations use Second Look Protect
                        </h2>

                        <ul
                            className="grid sm:grid-cols-2 gap-x-12 gap-y-4"
                            style={{ maxWidth: '680px', margin: '0 auto', listStyle: 'none', padding: 0 }}
                            role="list"
                        >
                            {BENEFITS.map((benefit) => (
                                <li
                                    key={benefit}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '10px',
                                        color: '#334155',
                                        fontSize: '0.95rem',
                                        lineHeight: 1.6,
                                    }}
                                >
                                    <CheckCircle style={{ width: '18px', height: '18px', color: '#C9A84C', flexShrink: 0, marginTop: '3px' }} aria-hidden="true" />
                                    {benefit}
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* ═══════════════════════════════════════════════════════════════
            SECTION 7 — FINAL CTA (Calm Close)
            ═══════════════════════════════════════════════════════════════ */}
                <section style={{
                    background: '#F9F9F7',
                    borderTop: '1px solid #e2e8f0',
                    padding: '3.5rem 0 4rem',
                }}>
                    <div style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center', padding: '0 1.5rem' }}>
                        <h2 style={{
                            fontFamily: "'Merriweather', serif",
                            color: '#0B1E36',
                            marginBottom: '1.5rem',
                            fontSize: 'clamp(1.5rem, 2.8vw, 2.25rem)',
                            fontWeight: 600,
                        }}>
                            Interested in learning more?
                        </h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} className="sm:flex-row sm:!gap-4 sm:justify-center">
                            <Button
                                variant="primary"
                                size="lg"
                                as="a"
                                href="mailto:hello@secondlookprotect.co.uk?subject=Organisation%20enquiry"
                            >
                                <Mail style={{ width: '18px', height: '18px' }} aria-hidden="true" />
                                Request a conversation
                            </Button>
                            <Button
                                variant="secondary"
                                size="lg"
                                as="a"
                                href="mailto:hello@secondlookprotect.co.uk"
                            >
                                Email hello@secondlookprotect.co.uk
                            </Button>
                        </div>
                    </div>
                </section>

                {/* ═══════════════════════════════════════════════════════════════
            FOOTER — matches global site footer exactly
            (Required because App.tsx early-returns for this page,
             so the homepage footer does not render)
            ═══════════════════════════════════════════════════════════════ */}
                <footer className="orgs-footer" role="contentinfo" style={{ padding: '4rem 0 2.5rem' }}>
                    <div className="max-w-6xl mx-auto px-6 md:px-10">

                        {/* Trust strip */}
                        <div style={{ marginBottom: '3rem', paddingBottom: '3rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            <TrustBadge light />
                        </div>

                        <div className="grid md:grid-cols-4 gap-12" style={{ marginBottom: '3rem' }}>
                            {/* Brand + Contact */}
                            <div className="md:col-span-2">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
                                    <Shield style={{ width: '24px', height: '24px', color: '#C9A84C' }} aria-hidden="true" />
                                    <span style={{
                                        fontSize: '1.2rem', fontWeight: 600, color: '#ffffff',
                                        fontFamily: "'Merriweather', serif",
                                    }}>
                                        Second Look Protect
                                    </span>
                                </div>
                                <p style={{ fontSize: '0.95rem', lineHeight: 1.65, maxWidth: '360px', marginBottom: '1.25rem', color: '#94a3b8' }}>
                                    UK-based, independent verification service. Not affiliated with any bank, financial institution, or government body.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                                    <a href="tel:01604385888" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span aria-hidden="true">📞</span> <span><span style={{ color: '#64748b' }}>Office:</span> 01604 385888</span>
                                    </a>
                                    <a href="tel:07907614821" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span aria-hidden="true">📱</span> <span><span style={{ color: '#64748b' }}>Mobile / WhatsApp:</span> 07907 614821</span>
                                    </a>
                                    <a href="mailto:hello@secondlookprotect.co.uk" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span aria-hidden="true">✉</span> <span><span style={{ color: '#64748b' }}>Enquiries:</span> hello@secondlookprotect.co.uk</span>
                                    </a>
                                    <a href="mailto:support@secondlookprotect.co.uk" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span aria-hidden="true">🛠</span> <span><span style={{ color: '#64748b' }}>Support:</span> support@secondlookprotect.co.uk</span>
                                    </a>
                                </div>
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem', fontSize: '0.72rem', color: '#475569' }}>
                                    <p>Registered Office: 14 Millside Close, Fortune House, Northampton, Northamptonshire, NN2 7TR</p>
                                </div>
                            </div>

                            {/* Quick Links */}
                            <nav aria-label="Footer navigation">
                                <h4 style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.95rem', marginBottom: '1.25rem' }}>Quick Links</h4>
                                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.95rem' }}>
                                    <li><a href="/">Home</a></li>
                                    <li><a href="/#how-it-works">How It Works</a></li>
                                    <li><a href="/#pricing">Plans</a></li>
                                    <li><a href="mailto:hello@secondlookprotect.co.uk">Contact</a></li>
                                </ul>
                            </nav>

                            {/* Legal */}
                            <nav aria-label="Legal links">
                                <h4 style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.95rem', marginBottom: '1.25rem' }}>Legal</h4>
                                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.95rem' }}>
                                    <li><a href="/privacy-policy">Privacy Policy</a></li>
                                    <li><a href="/terms-of-service">Terms of Service</a></li>
                                    <li><a href="#">Cookie Policy</a></li>
                                </ul>
                            </nav>
                        </div>

                        {/* Bottom bar */}
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '2rem' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>© {new Date().getFullYear()} Second Look Protect Ltd. All rights reserved.</p>
                                <div style={{ display: 'flex', gap: '1.5rem' }}>
                                    {['Twitter', 'LinkedIn', 'Facebook'].map((s) => (
                                        <a key={s} href="#" style={{ fontSize: '0.85rem' }} aria-label={`${s} — opens in new tab`}>{s}</a>
                                    ))}
                                </div>
                            </div>
                            <p style={{ fontSize: '0.72rem', color: '#475569' }}>
                                Second Look Protect Ltd is an independent verification service. We are not authorised or regulated by the Financial Conduct Authority (FCA).
                                We do not provide financial advice. UK-Based. Independent.
                            </p>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}
