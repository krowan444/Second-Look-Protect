import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Button } from '../components/Button';
import { SectionWrapper, SectionHeading } from '../components/SectionWrapper';
import { TrustBadge } from '../components/TrustBadge';
import {
    Shield, CheckCircle, Users, Building2, Home, Landmark, Heart,
    Upload, MessageSquare, BarChart3, Mail, ArrowRight,
} from 'lucide-react';

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
    { num: '1', title: 'Submit a concern', description: 'Residents or staff upload a suspicious message, screenshot, or call details.', icon: Upload },
    { num: '2', title: 'Receive clear guidance', description: 'Human-reviewed guidance provided in plain language with next steps.', icon: MessageSquare },
    { num: '3', title: 'Build safeguarding insight', description: 'Organisations can receive a simple overview of common scam types and trends.', icon: BarChart3 },
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
   OrganisationsPage Component
   ═══════════════════════════════════════════════════════════════════════════ */

export function OrganisationsPage() {
    const [selectedEnv, setSelectedEnv] = useState('');

    function handleGetProtection() {
        window.history.pushState(null, '', '/get-protection');
        window.location.reload();
    }

    return (
        <div className="min-h-screen bg-white selection:bg-[#C9A84C]/30 selection:text-[#0B1E36]">
            <Navbar onGetProtection={handleGetProtection} />

            {/* ══════════════════════════════════════════════════════════════════
          SECTION 1 — HERO
          ══════════════════════════════════════════════════════════════════ */}
            <section
                className="relative bg-[#F9F9F7] overflow-hidden"
                aria-label="Organisations hero"
                style={{ paddingTop: '140px' }}
            >
                <div className="max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24">
                    <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
                        {/* Text column */}
                        <div className="max-w-[540px]">
                            <h1
                                className="text-[#0B1E36] mb-6 leading-tight"
                                style={{ fontFamily: "'Merriweather', serif" }}
                            >
                                Digital safeguarding support for organisations supporting older adults
                            </h1>

                            <p className="text-slate-600 text-lg leading-relaxed mb-6 max-w-lg">
                                Helping care and supported living environments respond confidently to increasingly sophisticated scams targeting residents.
                            </p>

                            {/* Micro reassurance */}
                            <div className="flex flex-wrap gap-3 mb-10">
                                {['UK-based', 'Human-reviewed guidance', 'Designed to support existing safeguarding processes'].map((badge) => (
                                    <span
                                        key={badge}
                                        className="text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1.5 font-medium"
                                    >
                                        {badge}
                                    </span>
                                ))}
                            </div>

                            {/* CTAs */}
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Button
                                    variant="primary"
                                    size="lg"
                                    onClick={() => scrollToId('org-options')}
                                    aria-label="Explore organisation options — scroll to organisation cards"
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
                        <div className="flex justify-center md:justify-end">
                            <img
                                src="/images/organisations/organisation-hero.png"
                                alt="Organisation safeguarding dashboard preview"
                                className="rounded-xl w-full max-w-[520px]"
                                style={{
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
                                }}
                                loading="eager"
                                fetchPriority="high"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════════
          SECTION 2 — AUTHORITY LAYER
          ══════════════════════════════════════════════════════════════════ */}
            <SectionWrapper background="white" topBorder className="py-14 md:py-20">
                <SectionHeading
                    title="Designed for safeguarding environments"
                />

                <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    {AUTHORITY_ITEMS.map((item) => (
                        <div
                            key={item.title}
                            className="bg-[#F9F9F7] border border-slate-100 rounded-xl p-8 hover:shadow-sm transition-shadow duration-300"
                        >
                            <div className="flex items-start gap-4">
                                <div
                                    className="w-10 h-10 rounded-full bg-[#C9A84C]/10 flex items-center justify-center shrink-0 mt-0.5"
                                    aria-hidden="true"
                                >
                                    <CheckCircle className="w-5 h-5 text-[#C9A84C]" />
                                </div>
                                <div>
                                    <h3 className="text-[#0B1E36] text-base font-semibold mb-2">{item.title}</h3>
                                    <p className="text-slate-600 text-sm leading-relaxed">{item.description}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </SectionWrapper>

            {/* ══════════════════════════════════════════════════════════════════
          SECTION 3 — ORGANISATION SELECTION
          ══════════════════════════════════════════════════════════════════ */}
            <SectionWrapper id="org-options" background="offwhite" topBorder className="py-14 md:py-20">
                <SectionHeading
                    title="Choose your environment"
                    subtitle="Select the option closest to your organisation to view the most relevant overview."
                />

                <div
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto"
                >
                    {ORG_CARDS.map((card) => {
                        const Icon = card.icon;
                        return (
                            <div
                                key={card.title}
                                className="bg-white border border-slate-100 rounded-xl p-8 flex flex-col hover:shadow-md transition-shadow duration-300"
                            >
                                <div
                                    className="w-12 h-12 rounded-lg bg-[#C9A84C]/10 flex items-center justify-center mb-5"
                                    aria-hidden="true"
                                >
                                    <Icon className="w-6 h-6 text-[#C9A84C]" />
                                </div>
                                <h3 className="text-[#0B1E36] mb-3">{card.title}</h3>
                                <p className="text-slate-600 text-sm leading-relaxed mb-6 flex-1">
                                    {card.description}
                                </p>
                                <Button
                                    variant="secondary"
                                    size="md"
                                    as="a"
                                    href={card.href}
                                    className="w-full justify-center text-sm"
                                >
                                    {card.buttonLabel}
                                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                                </Button>
                            </div>
                        );
                    })}
                </div>
            </SectionWrapper>

            {/* ══════════════════════════════════════════════════════════════════
          SECTION 4 — HOW IT WORKS
          ══════════════════════════════════════════════════════════════════ */}
            <SectionWrapper background="white" topBorder className="py-14 md:py-20">
                <SectionHeading title="How it works" />

                <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                    {STEPS.map((step) => {
                        const Icon = step.icon;
                        return (
                            <div
                                key={step.num}
                                className="bg-[#F9F9F7] border border-slate-100 rounded-xl p-8 text-center flex flex-col items-center"
                            >
                                {/* Step number */}
                                <div
                                    className="w-14 h-14 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center text-xl font-bold text-[#0B1E36] mb-5"
                                    aria-hidden="true"
                                >
                                    {step.num}
                                </div>
                                <div
                                    className="w-10 h-10 rounded-lg bg-[#C9A84C]/10 flex items-center justify-center mb-4"
                                    aria-hidden="true"
                                >
                                    <Icon className="w-5 h-5 text-[#C9A84C]" />
                                </div>
                                <h3 className="text-[#0B1E36] text-base font-semibold mb-3">{step.title}</h3>
                                <p className="text-slate-600 text-sm leading-relaxed">{step.description}</p>
                            </div>
                        );
                    })}
                </div>
            </SectionWrapper>

            {/* ══════════════════════════════════════════════════════════════════
          SECTION 5 — PRE-ONBOARDING
          ══════════════════════════════════════════════════════════════════ */}
            <SectionWrapper id="org-example" background="offwhite" topBorder className="py-14 md:py-20">
                <SectionHeading
                    title="Explore how this could work for your organisation"
                />

                <div className="max-w-2xl mx-auto text-center">
                    <p className="text-slate-600 text-base leading-relaxed mb-8">
                        We can provide a simplified safeguarding view designed for organisational environments.
                        The experience is calm, clear, and focused on protection.
                    </p>

                    <Button
                        variant="primary"
                        size="lg"
                        as="a"
                        href="/care"
                        className="mb-10 inline-flex"
                    >
                        View example safeguarding environment
                        <ArrowRight className="w-5 h-5" aria-hidden="true" />
                    </Button>

                    {/* Micro-selector */}
                    <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md mx-auto">
                        <label
                            htmlFor="org-env-select"
                            className="block text-[#0B1E36] font-semibold text-base mb-4"
                            style={{ fontFamily: "'Merriweather', serif" }}
                        >
                            What type of environment do you support?
                        </label>
                        <select
                            id="org-env-select"
                            value={selectedEnv}
                            onChange={(e) => setSelectedEnv(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-[#0B1E36] text-base
                         focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C]
                         transition-all duration-200 cursor-pointer min-h-[48px]"
                        >
                            <option value="">Select your environment…</option>
                            {ENV_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </SectionWrapper>

            {/* ══════════════════════════════════════════════════════════════════
          SECTION 6 — WHY ORGANISATIONS USE THIS
          ══════════════════════════════════════════════════════════════════ */}
            <SectionWrapper background="white" topBorder className="py-14 md:py-20">
                <SectionHeading title="Why organisations use Second Look Protect" />

                <ul className="grid sm:grid-cols-2 gap-x-10 gap-y-5 max-w-3xl mx-auto list-none" role="list">
                    {BENEFITS.map((benefit) => (
                        <li
                            key={benefit}
                            className="flex items-start gap-3 text-slate-700 text-base leading-relaxed"
                        >
                            <CheckCircle className="w-5 h-5 text-[#C9A84C] shrink-0 mt-0.5" aria-hidden="true" />
                            {benefit}
                        </li>
                    ))}
                </ul>
            </SectionWrapper>

            {/* ══════════════════════════════════════════════════════════════════
          SECTION 7 — FINAL CTA
          ══════════════════════════════════════════════════════════════════ */}
            <SectionWrapper background="offwhite" topBorder className="py-14 md:py-20">
                <div className="max-w-xl mx-auto text-center">
                    <h2
                        className="text-[#0B1E36] mb-6"
                        style={{ fontFamily: "'Merriweather', serif" }}
                    >
                        Interested in learning more?
                    </h2>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button
                            variant="primary"
                            size="lg"
                            as="a"
                            href="mailto:hello@secondlookprotect.co.uk?subject=Organisation%20enquiry"
                        >
                            <Mail className="w-5 h-5" aria-hidden="true" />
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
            </SectionWrapper>

            {/* ── Footer (replicating global footer from App.tsx) ─────────────── */}
            <footer
                className="bg-[#0A1C32] text-slate-400 pt-16 pb-10 border-t border-white/8"
                role="contentinfo"
            >
                <div className="max-w-6xl mx-auto px-6 md:px-10">
                    {/* Trust strip */}
                    <div className="mb-12 pb-12 border-b border-white/8">
                        <TrustBadge light />
                    </div>

                    <div className="grid md:grid-cols-4 gap-12 mb-12">
                        {/* Brand */}
                        <div className="md:col-span-2">
                            <div className="flex items-center gap-3 mb-5">
                                <Shield className="w-6 h-6 text-[#C9A84C]" aria-hidden="true" />
                                <span
                                    className="text-xl font-semibold text-white"
                                    style={{ fontFamily: "'Merriweather', serif" }}
                                >
                                    Second Look Protect
                                </span>
                            </div>

                            <p className="text-base leading-relaxed max-w-sm mb-5">
                                UK-based, independent verification service. Not affiliated with any bank, financial institution, or government body.
                            </p>

                            {/* Contact */}
                            <div className="space-y-2 mb-5 text-sm">
                                <p>
                                    <a href="tel:01604385888" className="flex items-center gap-2 hover:text-white transition-colors duration-200">
                                        <span aria-hidden="true">📞</span>
                                        <span><span className="text-slate-500">Office:</span> 01604 385888</span>
                                    </a>
                                </p>
                                <p>
                                    <a href="tel:07907614821" className="flex items-center gap-2 hover:text-white transition-colors duration-200">
                                        <span aria-hidden="true">📱</span>
                                        <span><span className="text-slate-500">Mobile / WhatsApp:</span> 07907 614821</span>
                                    </a>
                                </p>
                                <p>
                                    <a href="mailto:hello@secondlookprotect.co.uk" className="flex items-center gap-2 hover:text-white transition-colors duration-200">
                                        <span aria-hidden="true">✉</span>
                                        <span><span className="text-slate-500">Enquiries:</span> hello@secondlookprotect.co.uk</span>
                                    </a>
                                </p>
                                <p>
                                    <a href="mailto:support@secondlookprotect.co.uk" className="flex items-center gap-2 hover:text-white transition-colors duration-200">
                                        <span aria-hidden="true">🛠</span>
                                        <span><span className="text-slate-500">Support:</span> support@secondlookprotect.co.uk</span>
                                    </a>
                                </p>
                            </div>

                            {/* Legal authority */}
                            <div className="space-y-1 text-xs text-slate-600 border-t border-white/8 pt-4">
                                <p>Registered Office: 14 Millside Close, Fortune House, Northampton, Northamptonshire, NN2 7TR</p>
                            </div>
                        </div>

                        {/* Quick Links */}
                        <nav aria-label="Footer navigation">
                            <h4 className="text-white font-semibold text-base mb-5">Quick Links</h4>
                            <ul className="space-y-3 text-base">
                                {[
                                    { label: 'Home', href: '/' },
                                    { label: 'How It Works', href: '/#how-it-works' },
                                    { label: 'Plans', href: '/#pricing' },
                                    { label: 'Contact', href: 'mailto:hello@secondlookprotect.co.uk' },
                                ].map((l) => (
                                    <li key={l.label}>
                                        <a href={l.href} className="hover:text-white transition-colors duration-200">
                                            {l.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </nav>

                        {/* Legal */}
                        <nav aria-label="Legal links">
                            <h4 className="text-white font-semibold text-base mb-5">Legal</h4>
                            <ul className="space-y-3 text-base">
                                <li>
                                    <a href="/privacy-policy" className="hover:text-white transition-colors duration-200">
                                        Privacy Policy
                                    </a>
                                </li>
                                <li>
                                    <a href="/terms-of-service" className="hover:text-white transition-colors duration-200">
                                        Terms of Service
                                    </a>
                                </li>
                                <li>
                                    <a href="#" className="hover:text-white transition-colors duration-200">
                                        Cookie Policy
                                    </a>
                                </li>
                            </ul>
                        </nav>
                    </div>

                    {/* Bottom bar */}
                    <div className="pt-8 border-t border-white/8 flex flex-col gap-3 text-xs text-slate-600">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                            <p className="text-slate-400 text-sm">© {new Date().getFullYear()} Second Look Protect Ltd. All rights reserved.</p>
                            <div className="flex gap-6">
                                {['Twitter', 'LinkedIn', 'Facebook'].map((s) => (
                                    <a key={s} href="#" className="hover:text-white transition-colors duration-200 text-sm"
                                        aria-label={`${s} — opens in new tab`}>
                                        {s}
                                    </a>
                                ))}
                            </div>
                        </div>
                        <p>
                            Second Look Protect Ltd is an independent verification service. We are not authorised or regulated by the Financial Conduct Authority (FCA).
                            We do not provide financial advice. UK-Based. Independent.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
