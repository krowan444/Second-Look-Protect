import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Button } from '../components/Button';
import { SectionWrapper, SectionHeading } from '../components/SectionWrapper';
import { TrustBadge } from '../components/TrustBadge';
import {
    Shield, CheckCircle, Users, Building2, Home, Landmark, Heart,
    Upload, MessageSquare, BarChart3, Mail, ArrowRight, Plus, Minus,
} from 'lucide-react';

/* ─── Scoped page styles (orgs-page only) ──────────────────────────────── */
const ORGS_CSS = `
  .orgs-page { background: #ffffff; }

  /* Hero — calm enterprise feel, NOT homepage-style */
  .orgs-hero {
    background: linear-gradient(165deg, #F4F6F8 0%, #EEF1F5 40%, #F9F9F7 100%);
    border-bottom: 1px solid #e2e8f0;
  }
  /* Desktop: top-align text and image so image sits level with headline */
  @media (min-width: 768px) {
    .orgs-hero-grid { align-items: start !important; }
  }
  .orgs-hero-img {
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(11,30,54,0.10), 0 2px 8px rgba(0,0,0,0.04);
    width: 100%;
    max-width: 720px;
    height: auto;
    object-fit: contain;
  }

  /* Hero CTA buttons — scoped size override (not global) */
  .orgs-hero-ctas {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
  .orgs-hero-ctas button,
  .orgs-hero-ctas a {
    max-width: 420px;
    width: 100%;
    padding-top: 0.7rem !important;
    padding-bottom: 0.7rem !important;
    min-height: 48px !important;
    max-height: 56px !important;
    font-size: 0.92rem !important;
  }

  /* Card buttons — push to bottom for equal-height cards */
  .orgs-card > a,
  .orgs-card > button {
    margin-top: auto !important;
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
        href: '/care-homes',
        icon: Home,
    },
    {
        title: 'Assisted / Supported Living',
        description: 'Independence-focused protection with a gentle safeguarding layer for residents and teams.',
        buttonLabel: 'View assisted living overview',
        href: '/assisted-supported-living',
        icon: Heart,
    },
    {
        title: 'Housing Associations / Extra Care',
        description: 'Safeguarding support for resident communities and tenancy support teams.',
        buttonLabel: 'View housing overview',
        href: '/housing-associations',
        icon: Building2,
    },
    {
        title: 'Community Organisations',
        description: 'Support for charities and local groups helping older adults check suspicious contacts.',
        buttonLabel: 'View community overview',
        href: '/community-organisations',
        icon: Users,
    },
    {
        title: 'Public Sector & Partnerships',
        description: 'For councils and safeguarding teams exploring partnership or pilot discussions.',
        buttonLabel: 'View partnership overview',
        href: '/public-sector-partnerships',
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

/* ─── Organisation FAQ data ──────────────────────────────────────────────── */
const ORG_FAQS: { question: string; answer: React.ReactNode }[] = [
    {
        question: 'How does this support our existing safeguarding procedures?',
        answer: (
            <>
                <p className="mb-3">Second Look Protect is designed to complement — not replace — your existing safeguarding processes.</p>
                <p className="mb-3">When a suspicious message, call, or digital interaction arises, staff can submit it through the platform and receive clear, human-reviewed guidance. This supports confident decision-making while maintaining your internal reporting and escalation protocols.</p>
                <p>The system acts as an additional layer of digital safeguarding support, helping staff respond consistently and calmly to emerging scam threats.</p>
            </>
        ),
    },
    {
        question: 'Who reviews submitted cases?',
        answer: (
            <>
                <p className="mb-3">All submitted cases are reviewed using a combination of structured analysis and human oversight.</p>
                <p className="mb-3">We provide clear, reasoned guidance based on the content submitted, helping staff understand:</p>
                <ul className="space-y-1 mb-3">
                    <li className="flex items-start gap-2"><span className="text-[#A8853C] mt-1" aria-hidden="true">&bull;</span>What the risk level is</li>
                    <li className="flex items-start gap-2"><span className="text-[#A8853C] mt-1" aria-hidden="true">&bull;</span>Why it may be suspicious</li>
                    <li className="flex items-start gap-2"><span className="text-[#A8853C] mt-1" aria-hidden="true">&bull;</span>What practical next steps are appropriate</li>
                </ul>
                <p>The aim is not automation alone, but clarity and responsible safeguarding judgement.</p>
            </>
        ),
    },
    {
        question: 'How is resident data handled and stored?',
        answer: (
            <>
                <p className="mb-3">We take data protection seriously.</p>
                <p className="mb-3">Second Look Protect is UK-based and designed with privacy in mind. Only the information necessary to assess a suspicious message or interaction is processed.</p>
                <p>We do not sell data, and submissions are handled in line with appropriate UK data protection standards. Organisations receive clear guidance on what information should and should not be submitted to maintain safeguarding best practice.</p>
            </>
        ),
    },
    {
        question: 'Can multiple staff members access the platform?',
        answer: (
            <>
                <p className="mb-3">Yes.</p>
                <p className="mb-3">Organisation access can be structured to support multiple authorised staff members.</p>
                <p className="mb-3">This ensures safeguarding leads, managers, or designated team members can access submissions and guidance as appropriate within your internal governance framework.</p>
                <p>Access is controlled and structured around organisational use.</p>
            </>
        ),
    },
    {
        question: 'Do we receive safeguarding summaries or reporting?',
        answer: (
            <>
                <p className="mb-3">Yes.</p>
                <p className="mb-3">Organisations can receive periodic safeguarding insight summaries outlining:</p>
                <ul className="space-y-1 mb-3">
                    <li className="flex items-start gap-2"><span className="text-[#A8853C] mt-1" aria-hidden="true">&bull;</span>Number of submissions</li>
                    <li className="flex items-start gap-2"><span className="text-[#A8853C] mt-1" aria-hidden="true">&bull;</span>Common scam types identified</li>
                    <li className="flex items-start gap-2"><span className="text-[#A8853C] mt-1" aria-hidden="true">&bull;</span>Emerging patterns</li>
                    <li className="flex items-start gap-2"><span className="text-[#A8853C] mt-1" aria-hidden="true">&bull;</span>Risk trends affecting residents</li>
                </ul>
                <p>This helps your team remain proactive and informed, supporting safeguarding awareness and reporting processes.</p>
            </>
        ),
    },
    {
        question: 'How is pricing structured for organisations?',
        answer: (
            <>
                <p className="mb-3">Organisation pricing is structured based on environment type, size, and expected usage.</p>
                <p className="mb-3">Rather than fixed public tiers, we provide tailored pricing aligned to your safeguarding requirements.</p>
                <p className="mb-3">This ensures fairness and suitability for different care and supported living environments.</p>
                <p>You can request organisation pricing details directly through the page.</p>
            </>
        ),
    },
    {
        question: 'What is required for onboarding?',
        answer: (
            <>
                <p className="mb-3">Onboarding is simple and designed to avoid disruption.</p>
                <p className="mb-3">Once agreed, your organisation receives:</p>
                <ul className="space-y-1 mb-3">
                    <li className="flex items-start gap-2"><span className="text-[#A8853C] mt-1" aria-hidden="true">&bull;</span>A dedicated access link</li>
                    <li className="flex items-start gap-2"><span className="text-[#A8853C] mt-1" aria-hidden="true">&bull;</span>Clear usage guidance</li>
                    <li className="flex items-start gap-2"><span className="text-[#A8853C] mt-1" aria-hidden="true">&bull;</span>Simple internal introduction materials</li>
                </ul>
                <p>No complex setup or technical integration is required. The system is designed to sit alongside your existing safeguarding framework without adding operational burden.</p>
            </>
        ),
    },
];

/* ─── Local FAQ accordion for /organisations ─────────────────────────────── */
function OrgsFaqSection() {
    const [openIdx, setOpenIdx] = useState<number | null>(0);

    return (
        <section
            id="org-faq"
            style={{
                background: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                padding: '3.5rem 0 4rem',
                scrollMarginTop: '140px',
            }}
        >
            <div className="max-w-3xl mx-auto px-6 md:px-10">
                <h2 style={{
                    fontFamily: "'Merriweather', serif",
                    color: '#0B1E36',
                    textAlign: 'center',
                    marginBottom: '2.5rem',
                    fontSize: 'clamp(1.5rem, 2.8vw, 2.25rem)',
                    fontWeight: 600,
                }}>
                    Organisation FAQs
                </h2>

                <div aria-label="Organisation frequently asked questions">
                    {ORG_FAQS.map((item, idx) => {
                        const isOpen = openIdx === idx;
                        const panelId = `org-faq-panel-${idx}`;
                        const triggerId = `org-faq-trigger-${idx}`;
                        return (
                            <div key={item.question} className="border-b border-slate-200 last:border-0">
                                <h3>
                                    <button
                                        id={triggerId}
                                        aria-expanded={isOpen}
                                        aria-controls={panelId}
                                        onClick={() => setOpenIdx(isOpen ? null : idx)}
                                        className="w-full flex items-center justify-between gap-4 py-5 text-left text-[#0B1E36] font-semibold text-base
                                            hover:text-[#1A3354] transition-colors duration-200
                                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-inset rounded-sm"
                                    >
                                        <span>{item.question}</span>
                                        <span className="shrink-0 text-[#A8853C]" aria-hidden="true">
                                            {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                        </span>
                                    </button>
                                </h3>
                                <div
                                    id={panelId}
                                    role="region"
                                    aria-labelledby={triggerId}
                                    hidden={!isOpen}
                                >
                                    <div className="pb-5 text-slate-600 text-base leading-relaxed max-w-prose">
                                        {typeof item.answer === 'string' ? <p>{item.answer}</p> : item.answer}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   OrganisationsPage — standalone gateway page
   NOT a clone of the homepage. This has its own unique enterprise layout.
   ═══════════════════════════════════════════════════════════════════════════ */

export function OrganisationsPage() {
    const [selectedEnv, setSelectedEnv] = useState('');

    /* Intercept bare #hash clicks (e.g. from shared Navbar) and redirect to /#hash
       so they navigate to the homepage section instead of doing nothing. */
    React.useEffect(() => {
        function handleHashClick(e: MouseEvent) {
            const anchor = (e.target as HTMLElement).closest('a');
            if (!anchor) return;
            const href = anchor.getAttribute('href');
            if (href && href.startsWith('#') && href.length > 1) {
                e.preventDefault();
                // "How it works" scrolls to local section on this page
                if (href === '#how-it-works') {
                    const el = document.getElementById('how-it-works-org');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                    return;
                }
                // "Plans" scrolls to organisation options section on this page
                if (href === '#pricing') {
                    const el = document.getElementById('org-options');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                    return;
                }
                // "FAQ" scrolls to local organisation FAQ section
                if (href === '#faq') {
                    const el = document.getElementById('org-faq');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                    return;
                }
                // "Contact" scrolls to local organisation contact section
                if (href === '#contact') {
                    const el = document.getElementById('org-contact');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                    return;
                }
                window.location.href = '/' + href;
            }
        }
        document.addEventListener('click', handleHashClick, true);
        return () => document.removeEventListener('click', handleHashClick, true);
    }, []);

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
                    style={{ paddingTop: '140px', position: 'relative', zIndex: 0 }}
                >
                    <div className="max-w-6xl mx-auto px-6 md:px-10 py-10 md:py-16">
                        <div className="orgs-hero-grid grid md:grid-cols-2 gap-12 md:gap-16 items-center">
                            {/* Text column */}
                            <div style={{ maxWidth: '480px' }}>
                                <h1
                                    className="text-[#0B1E36] mb-3"
                                    style={{
                                        fontFamily: "'Merriweather', serif",
                                        lineHeight: 1.25,
                                        fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)',
                                        fontWeight: 600,
                                    }}
                                >
                                    Digital safeguarding designed for care and supported living environments
                                </h1>

                                <p style={{
                                    color: '#94a3b8',
                                    fontSize: '0.85rem',
                                    fontWeight: 500,
                                    letterSpacing: '0.03em',
                                    marginBottom: '0.75rem',
                                }}>
                                    UK-based &bull; Human-reviewed &bull; Built for care environments
                                </p>

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
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '3.5rem' }}>
                                    {['Supports safeguarding leads and managers', 'Clear case tracking and documentation', 'Designed to fit existing safeguarding workflows'].map((badge) => (
                                        <span key={badge} className="orgs-badge">{badge}</span>
                                    ))}
                                </div>

                                {/* CTAs */}
                                <div className="orgs-hero-ctas">
                                    <Button
                                        variant="primary"
                                        size="md"
                                        onClick={() => scrollToId('org-options')}
                                        aria-label="Explore organisation options"
                                    >
                                        See how this works for your organisation
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="md"
                                        as="a"
                                        href="/example-safeguarding-environment"
                                        aria-label="View example safeguarding environment"
                                    >
                                        View safeguarding dashboard example
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
            SECTION — AUTHORITY LAYER (What it does)
            ═══════════════════════════════════════════════════════════════ */}
                <section style={{
                    background: '#ffffff',
                    borderTop: '1px solid #e2e8f0',
                    padding: '3.5rem 0 4rem',
                }}>
                    <div className="max-w-6xl mx-auto px-6 md:px-10">
                        <p style={{
                            color: '#94a3b8',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            letterSpacing: '0.03em',
                            textAlign: 'center',
                            marginBottom: '0.75rem',
                        }}>
                            Designed specifically for safeguarding workflows
                        </p>
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
            SECTION — HOW IT WORKS (moved up for flow)
            ═══════════════════════════════════════════════════════════════ */}
                <section
                    id="how-it-works-org"
                    style={{
                        background: '#F9F9F7',
                        borderTop: '1px solid #e2e8f0',
                        padding: '2rem 0 3rem',
                        scrollMarginTop: '140px',
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
            SECTION — ENVIRONMENT SELECTOR (Who it's for)
            ═══════════════════════════════════════════════════════════════ */}
                <section
                    id="org-options"
                    style={{
                        background: '#ffffff',
                        borderTop: '1px solid #e2e8f0',
                        padding: '3.5rem 0 4rem',
                        scrollMarginTop: '140px',
                    }}
                >
                    <div className="max-w-6xl mx-auto px-6 md:px-10">
                        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                            <p style={{
                                color: '#94a3b8',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                letterSpacing: '0.03em',
                                marginBottom: '0.5rem',
                            }}>
                                Supporting different care environments
                            </p>
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

                        {/* Reassurance micro-line */}
                        <p style={{
                            color: '#94a3b8',
                            fontSize: '0.82rem',
                            textAlign: 'center',
                            marginTop: '2rem',
                        }}>
                            Each environment provides a simplified interface tailored to safeguarding workflows.
                        </p>
                    </div>
                </section>

                {/* ═══════════════════════════════════════════════════════════════
            SECTION — PRE-ONBOARDING (Explore Example)
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
                            See how Second Look Protect fits your safeguarding environment
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
                                    href="/example-safeguarding-environment"
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
            SECTION — WHY ORGANISATIONS USE THIS (Benefits)
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
            SECTION — ORGANISATION FAQs
            ═══════════════════════════════════════════════════════════════ */}
                <OrgsFaqSection />

                {/* ═══════════════════════════════════════════════════════════════
            SECTION 7 — FINAL CTA (Calm Close)
            ═══════════════════════════════════════════════════════════════ */}
                <section
                    id="org-contact"
                    style={{
                        background: '#F9F9F7',
                        borderTop: '1px solid #e2e8f0',
                        padding: '3.5rem 0 4rem',
                        scrollMarginTop: '140px',
                    }}>
                    <div style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center', padding: '0 1.5rem' }}>
                        <h2 style={{
                            fontFamily: "'Merriweather', serif",
                            color: '#0B1E36',
                            marginBottom: '1.25rem',
                            fontSize: 'clamp(1.5rem, 2.8vw, 2.25rem)',
                            fontWeight: 600,
                        }}>
                            Discuss safeguarding support for your organisation
                        </h2>

                        <p style={{
                            color: '#475569',
                            fontSize: '1rem',
                            lineHeight: 1.7,
                            marginBottom: '2rem',
                        }}>
                            Speak with us about suitability, onboarding, and organisation pricing. We&rsquo;re happy to answer questions and explore how Second Look Protect can fit your safeguarding framework.
                        </p>

                        <Button
                            variant="primary"
                            size="lg"
                            as="a"
                            href="mailto:organisation@secondlookprotect.co.uk?subject=Organisation%20safeguarding%20discussion"
                        >
                            Book a safeguarding discussion
                        </Button>

                        {/* Secondary contact block */}
                        <div style={{
                            marginTop: '2.5rem',
                            paddingTop: '2rem',
                            borderTop: '1px solid #e2e8f0',
                        }}>
                            <h3 style={{
                                fontFamily: "'Merriweather', serif",
                                color: '#0B1E36',
                                fontSize: '1rem',
                                fontWeight: 600,
                                marginBottom: '1.25rem',
                            }}>
                                Organisation enquiries
                            </h3>

                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                                fontSize: '0.9rem',
                            }}>
                                <a
                                    href="mailto:organisation@secondlookprotect.co.uk"
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    <span style={{ color: '#64748b' }}>Email</span>
                                    <span style={{ color: '#334155', fontWeight: 500 }}>organisation@secondlookprotect.co.uk</span>
                                </a>
                                <a
                                    href="tel:07563887804"
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    <span style={{ color: '#64748b' }}>Mobile</span>
                                    <span style={{ color: '#334155', fontWeight: 500 }}>07563 887804</span>
                                </a>
                                <a
                                    href="tel:01604000000"
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    <span style={{ color: '#64748b' }}>Landline</span>
                                    <span style={{ color: '#334155', fontWeight: 500 }}>01604 000000</span>
                                </a>
                            </div>
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
