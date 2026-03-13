import React, { useState } from 'react';
import './index.css';
import { Navbar } from './components/Navbar';
import { Button } from './components/Button';
import { SectionWrapper, SectionHeading } from './components/SectionWrapper';
import { TrustBadge } from './components/TrustBadge';
import { PricingCard } from './components/PricingCard';
import { FAQAccordion } from './components/FAQAccordion';
import { GetProtectionPage } from './pages/GetProtectionPage';
import SubscriptionSuccessPage from './pages/SubscriptionSuccessPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { SupportPage } from './pages/SupportPage';
import { TermsOfServicePage } from './pages/TermsOfServicePage';
import { CareHomePage } from './pages/CareHomePage';
import { OrganisationsPage } from './pages/OrganisationsPage';
import { ExampleSafeguardingPage } from './pages/ExampleSafeguardingPage';
import { CareHomesEnvironmentPage } from './pages/CareHomesEnvironmentPage';
import { AssistedSupportedLivingPage } from './pages/AssistedSupportedLivingPage';
import { HousingAssociationsPage } from './pages/HousingAssociationsPage';
import { CommunityOrganisationsPage } from './pages/CommunityOrganisationsPage';
import { PublicSectorPartnershipsPage } from './pages/PublicSectorPartnershipsPage';
import { DashboardApp } from './dashboard/DashboardApp';
import {
  Shield, CheckCircle, Search, Lock, AlertTriangle,
  Phone, Star, ArrowRight, Users, Mail,
} from 'lucide-react';

/* ─── Data ─────────────────────────────────────────────────────────────── */

const PRICING_PLANS = [
  {
    name: 'Single Site',
    planKey: 'BASIC',           // maps to NEXT_PUBLIC_PRICE_ID_BASIC_MONTHLY / _YEARLY
    monthlyPrice: '£9.99',
    yearlyPrice: '£8.32',   // per month equivalent
    yearlyTotal: '£99.90', // billed annually (saves 2 months)
    tagline: 'Simple monthly access. Cancel anytime.',
    description: 'For one care home or service that needs a clearer way to record concerns and manage safeguarding review.',
    featureGroups: [
      {
        groupTitle: 'Core Platform',
        items: [
          'Structured concern logging',
          'Manager review workflow',
          'AI supported initial triage',
          'Clear risk visibility',
          'Case history and audit trail',
          'Monthly reporting support',
          'Inspection ready record keeping',
        ],
      },
    ],
    ctaLabel: 'Book a Demo',
    featured: false,
  },
  {
    name: 'Professional',
    planKey: 'GUARDIAN',
    monthlyPrice: '£19.99',
    yearlyPrice: '£16.65',
    yearlyTotal: '£199.90',
    tagline: 'Simple monthly access. Cancel anytime.',
    description: 'For services that need stronger reporting, clearer visibility, and more operational support.',
    featureGroups: [
      {
        groupTitle: 'Enhanced Oversight',
        items: [
          'Everything in Single Site',
          'Stronger reporting visibility',
          'Priority support',
          'Clearer alerting and follow up',
          'Improved oversight for managers',
          'Better support for governance review',
          'More confidence for inspection preparation',
        ],
      },
    ],
    ctaLabel: 'Book a Demo',
    featured: true,
  },
  {
    name: 'Group Oversight',
    planKey: 'FAMILY',
    monthlyPrice: '£34.99',
    yearlyPrice: '£29.15',
    yearlyTotal: '£349.90',
    tagline: 'Simple monthly access. Cancel anytime.',
    description: 'For care groups and multi site providers that need visibility across multiple services.',
    featureGroups: [
      {
        groupTitle: 'Multi-Site Management',
        items: [
          'Everything in Professional',
          'Multi site oversight',
          'Cross service benchmarking',
          'Group trends and pressure visibility',
          'Repeated resident targeting insight',
          'Monthly group reporting support',
          'Leadership visibility across services',
        ],
      },
    ],
    ctaLabel: 'Talk to Us About Your Organisation',
    featured: false,
  },
];

const TESTIMONIALS = [
  {
    quote: 'The platform has completely streamlined how our sites record concerns. It gives management clear oversight and ensures our teams get consistent, expert guidance before an incident escalates.',
    author: 'Sarah T., Operations Director',
    location: 'Regional Care Group',
  },
  {
    quote: 'Having a dedicated Forward-to-Check service means our care staff know exactly what to do when they spot something suspicious. The rapid turnaround on risk assessments has been invaluable.',
    author: 'David S., Safeguarding Lead',
    location: 'Residential Care Home',
  },
  {
    quote: 'As a care organisation, we needed structured evidence for our CQC inspections. Second Look Protect not only helps us manage live concerns, but gives us the reporting we need for governance.',
    author: 'Helen R., Compliance Manager',
    location: 'Supported Living Provider',
  },
];

/* ─── Sub-components ───────────────────────────────────────────────────── */

function StarRating({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-1" role="img" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="w-5 h-5 text-[#C9A84C] fill-current" aria-hidden="true" />
      ))}
    </div>
  );
}

function TestimonialCard({ quote, author, location }: typeof TESTIMONIALS[0]) {
  return (
    <article className="bg-slate-50 border border-slate-100 rounded-xl p-8 md:p-10 flex flex-col gap-6">
      <StarRating />
      <blockquote>
        <p className="text-slate-700 text-lg italic leading-relaxed">
          &ldquo;{quote}&rdquo;
        </p>
      </blockquote>
      <footer>
        <p className="font-semibold text-[#0B1E36] text-base">{author}</p>
        <p className="text-slate-500 text-sm">{location} · Verified member</p>
      </footer>
    </article>
  );
}

/* ─── Click tracking utility ────────────────────────────────────────────── */

function trackEvent(event: string, data: Record<string, string>) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('slp_track', { detail: { event, ...data } }));
    console.info('[SLP Track]', event, data);
  }
}

/* ─── Smooth scroll with navbar offset ─────────────────────────────────── */

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const navHeight = 72; // approximate navbar height
  const top = el.getBoundingClientRect().top + window.scrollY - navHeight - 16;
  window.scrollTo({ top, behavior: 'smooth' });
}

/* ─── Main App ─────────────────────────────────────────────────────────── */

export default function App() {
  // ── Dashboard routes — entirely separate shell ──────────────────────────
  if (window.location.pathname.startsWith('/dashboard')) {
    return <DashboardApp />;
  }

  // Initialise page from URL so /subscription-success works on direct load / Stripe redirect
  function getInitialPage(): 'home' | 'get-protection' | 'subscription-success' | 'privacy-policy' | 'support' | 'terms-of-service' | 'care' | 'care-submit' | 'organisations' | 'example-safeguarding' | 'care-homes' | 'assisted-supported-living' | 'housing-associations' | 'community-organisations' | 'public-sector-partnerships' {
    const path = window.location.pathname;
    if (path.startsWith('/subscription-success')) return 'subscription-success';
    if (path.startsWith('/get-protection')) return 'get-protection';
    if (path.startsWith('/privacy-policy')) return 'privacy-policy';
    if (path.startsWith('/support')) return 'support';
    if (path.startsWith('/terms-of-service')) return 'terms-of-service';
    if (path.startsWith('/organisations')) return 'organisations';
    if (path.startsWith('/example-safeguarding-environment')) return 'example-safeguarding';
    if (path.startsWith('/care-homes')) return 'care-homes';
    if (path.startsWith('/assisted-supported-living')) return 'assisted-supported-living';
    if (path.startsWith('/housing-associations')) return 'housing-associations';
    if (path.startsWith('/community-organisations')) return 'community-organisations';
    if (path.startsWith('/public-sector-partnerships')) return 'public-sector-partnerships';
    if (path.startsWith('/care/submit')) return 'care-submit';
    if (path.startsWith('/care')) return 'care';
    return 'home';
  }

  const [page, setPage] = useState<'home' | 'get-protection' | 'subscription-success' | 'privacy-policy' | 'support' | 'terms-of-service' | 'care' | 'care-submit' | 'organisations' | 'example-safeguarding' | 'care-homes' | 'assisted-supported-living' | 'housing-associations' | 'community-organisations' | 'public-sector-partnerships'>(getInitialPage);
  const [isYearly, setIsYearly] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const howItWorksRef = React.useRef<HTMLDivElement>(null);
  const [howItWorksInView, setHowItWorksInView] = React.useState(true);
  React.useEffect(() => {
    const el = howItWorksRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setHowItWorksInView(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* ── Hash scroll: when homepage loads with /#section, scroll to it ─── */
  React.useEffect(() => {
    if (page !== 'home') return;

    function scrollToHash(hash: string) {
      if (!hash || hash.length < 2) return;
      const id = hash.replace(/^#/, '');
      let attempts = 0;
      const maxAttempts = 10;
      const tryScroll = () => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(tryScroll, 100);
        }
      };
      tryScroll();
    }

    // On initial load
    scrollToHash(window.location.hash);

    // On hash change while on homepage
    const onHashChange = () => scrollToHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [page]);

  async function handleSubscribe(planKey: string) {
    const interval = isYearly ? 'yearly' : 'monthly';
    const loadingKey = `${planKey}_${interval}`;
    if (loadingPlan) return;
    setLoadingPlan(loadingKey);

    console.log(`[SLP] 🛒 Starting checkout: planKey=${planKey}, interval=${interval}`);

    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planKey,
          billingInterval: interval,
          planName: PRICING_PLANS.find((p) => p.planKey === planKey)?.name ?? '',
        }),
      });

      console.log(`[SLP] Checkout API → HTTP ${res.status}`);

      // Safely parse JSON; if the API returned HTML/text, capture it for debugging
      let data: { url?: string; error?: string };
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        data = await res.json() as { url?: string; error?: string };
      } else {
        const rawText = await res.text();
        console.error('[SLP] ❌ Checkout API returned non-JSON:', rawText);
        alert(`Checkout error (HTTP ${res.status}): The server returned an unexpected response. Check browser console.`);
        return;
      }

      console.log('[SLP] Checkout API response:', data);

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('[SLP] ❌ No checkout URL returned. Error:', data.error);
        alert(`Subscription error: ${data.error ?? 'No checkout URL returned — check browser console'}`);
      }
    } catch (err) {
      console.error('[SLP] ❌ Fetch failed (network error or JSON parse):', err);
      alert(`Could not start checkout: ${err instanceof Error ? err.message : 'Network error — check browser console'}`);
    } finally {
      setLoadingPlan(null);
    }
  }

  function handleGetProtection() {
    trackEvent('hero_cta_click', { button: 'get_protection' });
    setPage('get-protection');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function handleHowItWorks() {
    trackEvent('hero_cta_click', { button: 'how_it_works' });
    scrollToSection('how-it-works');
  }

  // ── Early return: Subscription Success page ─────────────────────────────
  if (page === 'subscription-success') {
    return (
      <SubscriptionSuccessPage
        onGoHome={() => {
          window.history.replaceState(null, '', '/');
          setPage('home');
          window.scrollTo({ top: 0, behavior: 'instant' });
        }}
      />
    );
  }

  // ── Early return: GetProtection page ────────────────────────────────────
  if (page === 'get-protection') {
    return (
      <GetProtectionPage
        onBack={() => {
          setPage('home');
          window.scrollTo({ top: 0, behavior: 'instant' });
        }}
      />
    );
  }

  // ── Early return: Privacy Policy page ───────────────────────────────────
  if (page === 'privacy-policy') {
    return (
      <PrivacyPolicyPage
        onBack={() => {
          window.history.replaceState(null, '', '/');
          setPage('home');
          window.scrollTo({ top: 0, behavior: 'instant' });
        }}
      />
    );
  }

  // ── Early return: Support page ──────────────────────────────────────────
  if (page === 'support') {
    return (
      <SupportPage
        onBack={() => {
          window.history.replaceState(null, '', '/');
          setPage('home');
          window.scrollTo({ top: 0, behavior: 'instant' });
        }}
      />
    );
  }

  // ── Early return: Terms of Service page ────────────────────────────────
  if (page === 'terms-of-service') {
    return (
      <TermsOfServicePage
        onBack={() => {
          window.history.replaceState(null, '', '/');
          setPage('home');
          window.scrollTo({ top: 0, behavior: 'instant' });
        }}
      />
    );
  }

  // ── Early return: Care Submit page (care-scoped submission flow) ──────
  if (page === 'care-submit') {
    return (
      <GetProtectionPage
        onBack={() => {
          window.history.pushState(null, '', '/care');
          setPage('care');
          window.scrollTo({ top: 0, behavior: 'instant' });
        }}
      />
    );
  }

  // ── Early return: Organisations page ──────────────────────────────────
  if (page === 'organisations') {
    return <OrganisationsPage />;
  }

  // ── Early return: Example Safeguarding page ────────────────────────────
  if (page === 'example-safeguarding') {
    return <ExampleSafeguardingPage />;
  }

  // ── Early return: Care Homes Environment page ─────────────────────────
  if (page === 'care-homes') {
    return <CareHomesEnvironmentPage />;
  }

  // ── Early return: Assisted/Supported Living page ────────────────────
  if (page === 'assisted-supported-living') {
    return <AssistedSupportedLivingPage />;
  }

  // ── Early return: Housing Associations page ───────────────────────
  if (page === 'housing-associations') {
    return <HousingAssociationsPage />;
  }

  // ── Early return: Community Organisations page ────────────────────
  if (page === 'community-organisations') {
    return <CommunityOrganisationsPage />;
  }

  // ── Early return: Public Sector & Partnerships page ───────────────
  if (page === 'public-sector-partnerships') {
    return <PublicSectorPartnershipsPage />;
  }

  // ── Early return: Care Home page ──────────────────────────────────────
  if (page === 'care') {
    return <CareHomePage />;
  }

  // ── Home page ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 selection:bg-[#C9A84C]/30 selection:text-[#0B1E36] home-sticky-padded">
      <Navbar onGetProtection={handleGetProtection} />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section
        className="relative bg-[#112540] text-white overflow-hidden hero-bg"
        aria-label="Hero section"
      >
        {/* Subtle radial glow behind content */}
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 30% 50%, rgba(201,168,76,0.06) 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        {/* Left-side gradient: ensures text always sits on dark ground */}
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{ background: 'linear-gradient(to right, #112540 0%, #112540 45%, rgba(17,37,64,0.85) 60%, transparent 75%)' }}
          aria-hidden="true"
        />

        {/* Two-column grid */}
        <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-10 pt-32 pb-20 md:pt-44 md:pb-24">
          <div className="grid gap-12 md:gap-16">
            {/* ── LEFT: Copy — constrained to left half ─────────────────── */}
            <div className="max-w-[580px]">
              {/* Micro label */}
              <div className="animate-fade-in-up flex items-center gap-3 mb-8">
                <div className="w-1 h-5 bg-[#C9A84C] rounded-full" aria-hidden="true" />
                <span className="text-[#C9A84C] text-xs font-semibold tracking-widest uppercase">
                  INDEPENDENT · UK BASED · SAFEGUARDING FOCUSED
                </span>
              </div>

              {/* Headline */}
              <h1
                className="animate-fade-in-up animate-delay-100 text-white mb-6 leading-tight"
                style={{ fontFamily: "'Merriweather', serif", textShadow: '0px 1px 6px rgba(0,0,0,0.15)' }}
              >
                <span className="block" style={{ color: '#A8C4DE' }}>Spot safeguarding risk earlier.</span>
                <span className="block text-[#C9A84C]" style={{ marginTop: '-4px' }}>Log, review, and report concerns with clear oversight.</span>
              </h1>

              {/* AI context supporting line */}
              <p className="animate-fade-in-up animate-delay-150 text-slate-300 text-lg leading-relaxed mb-4 max-w-lg">
                Second Look Protect helps care homes and care groups record suspicious incidents, assess scam related safeguarding risk, support vulnerable residents, and maintain clear oversight through one secure platform.
              </p>

              {/* Supporting text */}
              <p className="animate-fade-in-up animate-delay-200 text-slate-400 text-sm leading-relaxed mb-3 max-w-lg">
                From suspicious calls, emails, payment requests, and impersonation attempts to wider financial abuse concerns, teams can log issues quickly, review them consistently, and act with confidence.
              </p>


              {/* Benefit chips */}
              <div className="animate-fade-in-up animate-delay-300 flex flex-wrap gap-2 mb-10" role="list" aria-label="Key benefits">
                {[
                  '✓ Record safeguarding concerns in one clear place',
                  '✓ Support vulnerable residents when something feels wrong',
                  '✓ Strengthen manager oversight and review workflows',
                  '✓ Build clearer evidence for governance and inspection',
                ].map((chip) => (
                  <span
                    key={chip}
                    role="listitem"
                    className="text-sm text-slate-200 bg-white/8 border border-white/12 rounded-full px-4 py-1.5 font-medium"
                  >
                    {chip}
                  </span>
                ))}
              </div>

              {/* CTAs */}
              <div className="animate-fade-in-up animate-delay-400 flex flex-col sm:flex-row gap-4 mb-5">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleGetProtection}
                  aria-label="Book a Demo"
                  className="btn-gold-gradient border-0 font-semibold w-full sm:w-auto justify-center"
                >
                  Book a Demo
                </Button>
                <button
                  onClick={handleHowItWorks}
                  aria-label="See how Second Look Protect works — scroll to explanation"
                  className="hero-secondary-cta inline-flex items-center justify-center gap-2 font-medium text-white text-base transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    borderRadius: '20px',
                    padding: '15px 30px',
                    minHeight: '56px',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.11)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.30)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.18)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                  }}
                >
                  Request a Walkthrough
                </button>
              </div>

              {/* Sub-CTA stack — full-width, left-aligned below both buttons */}
              <p className="text-slate-200 text-sm font-medium mb-3">A practical walkthrough for care providers:</p>

              <div className="flex flex-col gap-1.5 mb-5">
                <p className="text-slate-300/85 text-sm">✓ See whether the platform fits your safeguarding process</p>
                <p className="text-slate-300/85 text-sm">✓ Understand how the system could work in your organisation</p>
                <p className="text-slate-300/85 text-sm">✓ No pressure, just a clear look at the workflow</p>
              </div>

              {/* Reassurance line */}
              <p className="text-slate-300/80 italic" style={{ fontSize: '13px', letterSpacing: '0.01em' }}>
                Calm, structured support when something does not feel right.
              </p>

              {/* Care environment trust badge */}
              <div className="mt-6">
                <span className="inline-flex items-center gap-2 bg-[#C9A84C]/15 border border-[#C9A84C]/50 text-slate-200 text-xs font-medium px-4 py-1.5 rounded-full shadow-sm">
                  <Shield className="w-3.5 h-3.5 text-[#C9A84C] shrink-0" aria-hidden="true" />
                  Designed for care homes, assisted living teams, and safeguarding focused organisations.
                </span>
              </div>

              {/* Hero phone + email nudge */}
              <div className="hero-contact-card mt-5 flex flex-col gap-1.5">
                <a
                  href="tel:07907614821"
                  className="hero-contact-row text-slate-400 text-sm no-underline"
                  aria-label="Call us on 07907 614821"
                >
                  <span className="hero-contact-label">Speak to our team:</span>
                  <span className="hero-contact-value">
                    Call 07907 614821
                  </span>
                </a>
                <a
                  href="mailto:hello@secondlookprotect.co.uk"
                  className="hero-contact-row text-slate-400 text-sm no-underline"
                  aria-label="Email hello@secondlookprotect.co.uk"
                >
                  <span className="hero-contact-label">Email enquiries:</span>
                  <span className="hero-contact-value hero-contact-value-email">
                    hello@secondlookprotect.co.uk
                  </span>
                </a>
              </div>
            </div>


          </div>
        </div>

        {/* Soft gradient edge */}
        <div
          className="absolute bottom-0 left-0 right-0 h-12 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.06))' }}
          aria-hidden="true"
        />
      </section>

      {/* ── How It Works ─────────────────────────────────────────────── */}
      <SectionWrapper id="how-it-works" background="offwhite" topBorder={false} className="pt-14 md:pt-20 pb-10 md:pb-14">
        <SectionHeading
          title="How It Works"
          subtitle="A simple, structured process for recording concerns, reviewing risk, and supporting better safeguarding decisions."
        />

        <div ref={howItWorksRef} className="grid md:grid-cols-3 gap-14 md:gap-16 max-w-4xl mx-auto relative">
          {/* Connector line */}
          <div
            className="hidden md:block absolute top-[35px] left-[18%] right-[18%] h-px bg-slate-300"
            aria-hidden="true"
          />

          {[
            {
              step: '1',
              gold: false,
              headline: 'Concern Recorded',
              sub: 'Staff or managers record a suspicious email, message, call, or payment request.',
            },
            {
              step: '2',
              gold: false,
              headline: 'Risk Assessed',
              sub: 'Using AI-supported initial triage and human oversight, the incident is evaluated for safeguarding risk.',
            },
            {
              step: '3',
              gold: true,
              headline: 'Action Taken',
              sub: 'Teams follow clear guidance and build an inspection-ready trail of their actions.',
            },
          ].map(({ step, headline, sub, gold }, i) => (
            <div
              key={step}
              className="relative flex flex-col items-center text-center"
              style={{
                opacity: howItWorksInView ? 1 : 0,
                transform: howItWorksInView ? 'translateY(0)' : 'translateY(18px)',
                transition: 'opacity 0.65s ease, transform 0.65s ease',
                transitionDelay: `${i * 160}ms`,
              }}
            >
              {/* Step number circle */}
              <div
                className={[
                  'w-[72px] h-[72px] rounded-full flex items-center justify-center text-2xl font-bold mb-6 relative z-10',
                  gold
                    ? 'bg-[#C9A84C] text-[#0B1E36] shadow-lg'
                    : 'bg-white text-[#0B1E36] border-2 border-slate-200 shadow-sm',
                ].join(' ')}
                aria-hidden="true"
              >
                {step}
              </div>

              {/* Step label */}
              <p className="text-[#C9A84C] text-[10px] font-semibold tracking-[0.18em] uppercase mb-3">
                Step {step}
              </p>

              {/* Headline */}
              <h3 className="text-[#0B1E36] text-base font-semibold leading-snug mb-3 max-w-[210px]">
                {headline}
              </h3>

              {/* Sub-text */}
              {sub && (
                <p className="text-slate-600 text-sm leading-relaxed">{sub}</p>
              )}
            </div>
          ))}
        </div>

      </SectionWrapper>

      {/* ── Who This Is For ──────────────────────────────────────────────── */}
      <SectionWrapper background="white" topBorder className="pt-12 md:pt-14">
        {/* Header — centred */}
        <div className="max-w-xl mx-auto text-center mb-10">
          <p className="text-[#A8853C] text-lg font-semibold tracking-widest uppercase mb-6">
            WHO THIS IS FOR
          </p>
          <h2 className="text-[#0B1E36]">
            Built for organisations responsible for safeguarding vulnerable people.
          </h2>
          <p className="text-slate-600 text-lg leading-relaxed mt-4">
            Second Look Protect is designed for care homes, assisted living providers, housing and support teams, safeguarding leads, compliance managers, and care groups that need a clearer way to record concerns, review risk, and evidence oversight.
          </p>
          <div className="mt-8 flex items-center justify-center gap-2 text-slate-500 bg-slate-50 rounded-full px-5 py-2 inline-flex border border-slate-100 mx-auto">
            <Shield className="w-4 h-4 text-[#A8853C]" aria-hidden="true" />
            <span className="text-sm font-medium">Built for single site and multi site organisations</span>
          </div>
        </div>

        {/* 2-col card grid */}
        <ul
          className="max-w-[900px] mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4"
          role="list"
        >
          {[
            'Care home managers needing clearer oversight',
            'Safeguarding leads reviewing suspicious incidents',
            'Compliance and governance teams preparing for inspection',
            'Care groups monitoring risk across multiple services',
          ].map((item) => (
            <li
              key={item}
              className="flex items-center gap-4 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4"
            >
              {/* Icon badge */}
              <div
                className="w-9 h-9 rounded-full bg-[#C9A84C]/12 flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                <CheckCircle className="w-5 h-5 text-[#C9A84C]" />
              </div>
              {/* Text */}
              <span className="text-[#0B1E36] font-medium text-[15px] leading-snug">
                {item}
              </span>
            </li>
          ))}
        </ul>
      </SectionWrapper>

      {/* ── View Our Plans / Demo CTA ─────────────────────────────────────────── */}
      <SectionWrapper background="white" topBorder className="py-8 md:py-10">
        <div className="text-center">
          <Button variant="primary" size="lg" className="inline-flex" onClick={handleGetProtection}>
            Book a Demo <ArrowRight className="w-5 h-5 ml-2" aria-hidden="true" />
          </Button>
          <div className="mt-4 flex flex-col items-center gap-0.5">
            <p className="text-slate-400 text-xs tracking-wide">Discuss pilot options and organisation fit:</p>
            <a
              href="mailto:hello@secondlookprotect.co.uk"
              className="text-[#A8853C] hover:text-[#C9A84C] transition-colors duration-200 font-medium text-sm"
              aria-label="Email hello@secondlookprotect.co.uk"
            >
              hello@secondlookprotect.co.uk
            </a>
          </div>
        </div>
      </SectionWrapper>

      {/* ── The Problem ──────────────────────────────────────────────── */}
      <SectionWrapper background="offwhite" topBorder={false} className="pt-10 md:pt-14 pb-12 md:pb-16">
        <SectionHeading
          title="Scam related safeguarding concerns are becoming harder to manage."
          subtitle="Suspicious calls, emails, payment requests, impersonation attempts, and financial abuse concerns can place vulnerable residents at risk. These issues are often handled across scattered messages or disconnected notes, making it harder to maintain clear oversight. Care teams need a calm, structured way to log concerns, review risk, and evidence their decisions before harm escalates."
        />

        <div className="grid md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 hover:shadow-md transition-shadow duration-300">
            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-6" aria-hidden="true">
              <AlertTriangle className="w-6 h-6 text-slate-500" />
            </div>
            <h3 className="mb-3">Harder to evidence risk</h3>
            <p className="text-slate-600 text-base leading-relaxed">
              Modern scam activity looks genuine and convincing. Staff may see suspicious contact, unusual payment pressure, or signs of manipulation without having one clear place to log their concern for management review.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 hover:shadow-md transition-shadow duration-300">
            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-6" aria-hidden="true">
              <Lock className="w-6 h-6 text-slate-500" />
            </div>
            <h3 className="mb-3">Weaker leadership visibility</h3>
            <p className="text-slate-600 text-base leading-relaxed">
              When incidents are recorded inconsistently, important patterns — like the same resident being targeted repeatedly — can be missed. Delays in incident review can increase organisational risk.
            </p>
          </div>

          {/* Card 3 — highlighted solution */}
          <div className="bg-[#112540] rounded-xl p-8 text-white border-l-4 border-[#C9A84C]">
            <div className="w-12 h-12 bg-[#C9A84C]/15 rounded-lg flex items-center justify-center mb-6" aria-hidden="true">
              <Shield className="w-6 h-6 text-[#C9A84C]" />
            </div>
            <h3 className="text-white font-semibold mb-3" style={{ color: '#F3F6FA' }}>A clearer operational workflow</h3>
            <p className="text-slate-200 text-base leading-relaxed">
              Second Look Protect gives teams one structured place to record concerns, support manager review, track follow-up actions, and build clear inspection-ready reporting.
            </p>
          </div>
        </div>
      </SectionWrapper>



      {/* ── Structured Safeguarding Workflow ──────────────────────────────────── */}
      <SectionWrapper background="offwhite" topBorder>
        <SectionHeading
          title="See the workflow in practice."
        />

        {/* Sub-label + paragraphs — constrained to ~65 char line length */}
        <div className="max-w-[640px] mx-auto text-center mt-10 mb-14">
          <p className="text-[#A8853C] text-xs font-semibold tracking-widest uppercase mb-5">
            A CALMER WAY TO MANAGE CONCERNS
          </p>

          <p className="text-slate-600 text-base leading-relaxed mb-5">
            Care teams should not rely on scattered messages, spreadsheets, or memory when a potential issue is reported. Second Look Protect creates a structured process so concerns move from initial reporting to formal review with total clarity.
          </p>

          <p className="text-slate-600 text-base leading-relaxed">
            The platform provides oversight for managers, better support for vulnerable residents, and clear evidence when accountability matters.
          </p>
        </div>

        {/* Card — centered, left-aligned text inside for readability */}
        <div className="max-w-3xl mx-auto bg-white border border-slate-100 rounded-xl p-8 md:p-12 shadow-sm">
          <h3 className="text-[#0B1E36] text-lg font-semibold mb-5">
            Why reporting visibility matters now
          </h3>
          <p className="text-slate-600 text-base leading-relaxed mb-4">
            Scam related harm is not just a personal issue. In care settings, it quickly becomes a safeguarding, financial abuse, resident wellbeing, and governance matter.
          </p>
          <p className="text-slate-600 text-base leading-relaxed mb-8">
            Second Look Protect helps leadership teams track concern volume, assess seriousness, review manager activity, and show inspectors that concerns were handled properly.
          </p>
          <p className="text-slate-400 text-sm italic">
            Built to support governance and inspection readiness.
          </p>
        </div>
      </SectionWrapper>

      {/* ── Founder's Note ─────────────────────────────────────────────── */}
      <SectionWrapper background="slate" topBorder>
        <div className="max-w-2xl mx-auto text-center">

          {/* Eyebrow */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <Shield className="w-5 h-5 text-[#A8853C]" aria-hidden="true" />
            <span className="text-[#A8853C] text-sm font-medium tracking-widest uppercase">
              Why I Started Second Look Protect
            </span>
          </div>

          {/* Decorative open-quote */}
          <div
            className="text-[8rem] leading-none text-[#C9A84C]/20 font-serif select-none mb-2"
            aria-hidden="true"
            style={{ fontFamily: "'Merriweather', serif" }}
          >
            &ldquo;
          </div>

          {/* Quote */}
          <blockquote className="m-0">
            I started Second Look Protect because I saw how convincing modern scams and manipulation attempts have become, especially toward vulnerable people. I quickly realised care organisations need more than just ad-hoc advice. They need a serious safeguarding platform — a structured place to log concerns, oversee managers, and evidence to inspectors that risk is being handled correctly. Second Look Protect was built to give leadership teams completely clear oversight.

            {/* Divider */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="h-px w-16 bg-[#C9A84C]/40" aria-hidden="true" />
              <Shield className="w-4 h-4 text-[#C9A84C]/60" aria-hidden="true" />
              <div className="h-px w-16 bg-[#C9A84C]/40" aria-hidden="true" />
            </div>

            <footer>
              <div className="flex flex-col items-center justify-center w-full text-center">
                <p className="font-semibold text-[#0B1E36] text-base tracking-wide">Kieran Rowan</p>
                <p className="text-slate-500 text-sm mt-1">Founder, Second Look Protect</p>
              </div>
            </footer>
          </blockquote>
        </div>
      </SectionWrapper>

      {/* ── Reassurance — No shame ─────────────────────────────────────── */}
      <SectionWrapper background="offwhite" topBorder>
        <div className="max-w-2xl mx-auto flex flex-col items-center text-center">
          <p className="text-[#A8853C] text-xs font-semibold tracking-widest uppercase mb-4">
            Clear. Calm. Structured.
          </p>

          <h2 className="text-[#0B1E36] mb-6">
            Understand how concerns move from reporting to review
          </h2>

          <p className="text-slate-600 text-lg leading-relaxed mb-6">
            Not every concern begins with confirmed harm. Often it starts with something that feels off. A suspicious caller. An unusual payment request. A resident who may be being targeted repeatedly.
          </p>

          <p className="text-slate-600 text-base leading-relaxed">
            Second Look Protect gives managers the structure to pause, record the concern clearly, review the safeguarding risk, and build a formal record before situations become more serious.
          </p>
        </div>
      </SectionWrapper>

      {/* ── Pricing ──────────────────────────────────────────────────── */}
      <SectionWrapper id="pricing" background="navy">
        <SectionHeading
          title="Plans for care providers"
          subtitle="Simple options for organisations that want clearer safeguarding workflows, stronger oversight, and more confidence in reporting."
          light
        />

        {/* Monthly / Yearly toggle */}
        <div className="flex items-center justify-center gap-4 mb-10" role="group" aria-label="Billing period">
          <span className={`text-sm font-medium transition-colors ${!isYearly ? 'text-white' : 'text-slate-400'}`}>
            Monthly
          </span>
          <button
            onClick={() => setIsYearly((v) => !v)}
            aria-pressed={isYearly}
            aria-label={isYearly ? 'Switch to monthly billing' : 'Switch to yearly billing'}
            className={[
              'relative w-14 h-7 rounded-full transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]',
              isYearly ? 'bg-[#C9A84C]' : 'bg-white/20',
            ].join(' ')}
          >
            <span
              className={[
                'absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-300',
                isYearly ? 'translate-x-7' : 'translate-x-0',
              ].join(' ')}
            />
          </button>
          <span className={`text-sm font-medium transition-colors ${isYearly ? 'text-white' : 'text-slate-400'}`}>
            Yearly
            <span className="ml-1.5 text-xs font-semibold text-[#C9A84C] bg-[#C9A84C]/15 px-2 py-0.5 rounded-md">
              Save 2 months
            </span>
          </span>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          {PRICING_PLANS.map((plan) => (
            <div key={plan.name}>
              <PricingCard
                {...plan}
                isYearly={isYearly}
                isLoading={loadingPlan === `${plan.planKey}_${isYearly ? 'yearly' : 'monthly'}`}
                onSubscribe={handleSubscribe}
              />
            </div>
          ))}
        </div>

        <div className="mt-14 mx-auto max-w-lg text-center space-y-3">
          <p className="text-slate-300 text-sm font-medium tracking-wide">
            Simple cancellation if your organisation no longer needs the service:
          </p>
          <p className="text-slate-400 text-sm leading-relaxed">
            Just email{' '}
            <a
              href="mailto:support@secondlookprotect.co.uk"
              className="text-slate-200 font-medium hover:text-[#C9A84C] transition-colors duration-200"
            >
              support@secondlookprotect.co.uk
            </a>
            {' '}and we'll take care of it for you. Stop anytime.
          </p>
          <p className="text-slate-500 text-xs" style={{ opacity: 0.8 }}>
            Direct support from a real person. No unnecessary friction.
          </p>
          <p className="text-slate-500 text-xs text-center mt-4">
            All plans include a 14-day free trial. · Prices shown in GBP.
          </p>
        </div>

        {/* Core System strip */}
        <div
          className="mt-20 pt-16 border-t border-white/10 relative"
          style={{ background: 'linear-gradient(180deg, rgba(201,168,76,0.03) 0%, transparent 60%)' }}
        >
          {/* Scoped hover style — desktop only */}
          <style>{`
            .feature-card {
              transition: transform 0.25s ease, box-shadow 0.25s ease;
              border-radius: 1rem;
              padding: 1.5rem;
            }
            @media (hover: hover) and (min-width: 768px) {
              .feature-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 20px rgba(201,168,76,0.08);
              }
            }
            .risk-dot { position: relative; display: inline-flex; }
            .risk-dot::after {
              content: '';
              position: absolute;
              inset: -3px;
              border-radius: 50%;
              opacity: 0.25;
            }
            .risk-dot-green::after { box-shadow: 0 0 8px 2px rgba(74,222,128,0.5); }
            .risk-dot-yellow::after { box-shadow: 0 0 8px 2px rgba(250,204,21,0.5); }
            .risk-dot-red::after { box-shadow: 0 0 8px 2px rgba(248,113,113,0.5); }
          `}</style>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">

            {/* Forward-to-Check */}
            <div className="feature-card">
              <h4 className="text-white font-bold mb-5 flex items-center gap-2" style={{ fontSize: '1.05rem' }}>
                <span className="text-[#C9A84C] text-lg" aria-hidden="true">📨</span>
                Simple concern submission
              </h4>
              <p className="text-slate-400 text-sm mb-5 leading-relaxed font-medium italic" style={{ opacity: 0.92 }}>
                No complicated process
              </p>
              <ul className="space-y-3 text-sm text-slate-300" style={{ opacity: 0.92 }}>
                {[
                  'Record suspicious emails',
                  'Log calls, messages, or payment requests',
                  'Capture links, screenshots, or supporting evidence',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-[#C9A84C] mt-0.5" aria-hidden="true">→</span>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-slate-400 text-sm mt-6 italic leading-relaxed">
                If staff can report a concern, they can use Second Look Protect.
              </p>
            </div>

            {/* Risk Assessment */}
            <div className="feature-card">
              <h4 className="text-white font-bold mb-5 flex items-center gap-2" style={{ fontSize: '1.05rem' }}>
                <Shield className="w-5 h-5 text-[#C9A84C]" aria-hidden="true" />
                Clear safeguarding risk guidance
              </h4>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed" style={{ opacity: 0.92 }}>
                Every recorded concern can be reviewed through a structured risk based process that helps teams decide what needs attention next.
              </p>
              <ul className="space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <span className="risk-dot risk-dot-green text-green-400 text-base mt-0.5" aria-label="Green">&#x1F7E2;</span>
                  <span className="text-slate-200 leading-snug">
                    <strong className="text-white block">Low concern</strong>
                    <span style={{ opacity: 0.85 }}>Some indicators present</span>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="risk-dot risk-dot-yellow text-yellow-400 text-base mt-0.5" aria-label="Amber">&#x1F7E1;</span>
                  <span className="text-slate-200 leading-snug">
                    <strong className="text-white block">Caution</strong>
                    <span style={{ opacity: 0.85 }}>Warning signs need review</span>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="risk-dot risk-dot-red text-red-400 text-base mt-0.5" aria-label="Red">&#x1F534;</span>
                  <span className="text-slate-200 leading-snug">
                    <strong className="text-white block">High concern</strong>
                    <span style={{ opacity: 0.85 }}>Stronger indicators of risk or harm</span>
                  </span>
                </li>
              </ul>
            </div>

            {/* Flexible Membership */}
            <div className="feature-card">
              <h4 className="text-white text-base font-bold mb-5 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-[#C9A84C]" aria-hidden="true" />
                Flexible access for care providers
              </h4>
              <ul className="space-y-3.5 text-sm text-slate-300" style={{ opacity: 0.92 }}>
                {[
                  'Monthly access with no unnecessary lock in',
                  'Suitable for single services and growing groups',
                  'Save 2 months on annual billing',
                  'Clear option to review plan choice as needs change',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#C9A84C] shrink-0 mt-0.5" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Peace of Mind */}
            <div className="feature-card">
              <h4 className="text-white text-base font-bold mb-5 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#C9A84C]" aria-hidden="true" />
                Group Oversight
              </h4>
              <p className="text-slate-400 text-sm leading-relaxed" style={{ opacity: 0.92 }}>
                For multi-site organisations, maintain visibility across services to monitor pressure, spot repeated targets, and track manager review performance.
              </p>
              <p className="text-slate-400 text-sm leading-relaxed mt-3" style={{ opacity: 0.92 }}>
                Clearer intelligence and support without the administrative burden.
              </p>
            </div>

          </div>
        </div>

        {/* Section-wide centered tagline */}
        <div className="w-full flex justify-center mt-10">
          <p className="text-slate-400 text-sm text-center tracking-wide" style={{ opacity: 0.7 }}>Clear. Calm. Structured.</p>
        </div>
      </SectionWrapper>

      {/* ── Early Access ─────────────────────────────────────────────── */}
      <SectionWrapper id="testimonials" background="offwhite" topBorder>
        <div className="max-w-2xl mx-auto text-center">
          <SectionHeading
            title="Built with real safeguarding use in mind"
          />

          <p className="text-slate-600 text-lg leading-relaxed mb-6">
            Second Look Protect is being shaped around the needs of real care environments and safeguarding teams. Early rollout helps refine the platform around practical workflows, clearer reporting, and stronger operational oversight.
          </p>

          <p className="text-slate-600 text-lg leading-relaxed mb-6">
            This keeps the product grounded in real world care sector use while improving clarity, usability, and inspection readiness over time.
          </p>
        </div>
      </SectionWrapper>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <SectionWrapper id="faq" background="white" topBorder>
        <div className="max-w-3xl mx-auto">
          <SectionHeading
            title="Frequently Asked Questions"
            subtitle="Clear answers for care managers, safeguarding leads, and teams responsible for protecting vulnerable residents."
          />
          <FAQAccordion />
        </div>
      </SectionWrapper>

      {/* ── Contact ──────────────────────────────────────────────────── */}
      <SectionWrapper id="contact" background="offwhite" topBorder>
        <div className="max-w-2xl mx-auto flex flex-col items-center text-center">
          <p className="text-[#C9A84C] text-xs font-semibold tracking-widest uppercase mb-3">Get in Touch</p>
          <h2 className="text-[#0B1E36] mb-3" style={{ fontFamily: "'Merriweather', serif" }}>
            Talk to us about your organisation
          </h2>
          <p className="text-slate-600 text-lg mb-10">
            Whether you want to book a demo, explore a pilot, or understand how Second Look Protect could support your safeguarding process, we would be glad to speak with you.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
            {/* Office */}
            <a
              href="tel:01604385888"
              className="group flex flex-col items-center gap-3 bg-white rounded-xl p-6 border border-slate-100 shadow-sm hover:shadow-md hover:border-[#C9A84C]/40 transition-all duration-200"
              aria-label="Call office on 01604 385888"
            >
              <div className="w-12 h-12 rounded-full bg-[#C9A84C]/10 flex items-center justify-center group-hover:bg-[#C9A84C]/20 transition-colors">
                <span className="text-xl" aria-hidden="true">📞</span>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Office Line</p>
                <p className="text-[#0B1E36] font-semibold text-base mb-1">01604 385888</p>
                <p className="text-slate-400 text-[11px] leading-snug">For general enquiries and organisation discussions</p>
              </div>
            </a>

            {/* Mobile */}
            <a
              href="tel:07907614821"
              className="group flex flex-col items-center gap-3 bg-white rounded-xl p-6 border border-slate-100 shadow-sm hover:shadow-md hover:border-[#C9A84C]/40 transition-all duration-200"
              aria-label="Call or WhatsApp 07907 614821"
            >
              <div className="w-12 h-12 rounded-full bg-[#C9A84C]/10 flex items-center justify-center group-hover:bg-[#C9A84C]/20 transition-colors">
                <span className="text-xl" aria-hidden="true">📱</span>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Mobile / WhatsApp</p>
                <p className="text-[#0B1E36] font-semibold text-base mb-1">07907 614821</p>
                <p className="text-slate-400 text-[11px] leading-snug">For quick contact and demo enquiries</p>
              </div>
            </a>

            {/* General Enquiries */}
            <a
              href="mailto:hello@secondlookprotect.co.uk"
              className="group flex flex-col items-center gap-3 bg-white rounded-xl p-6 border border-slate-100 shadow-sm hover:shadow-md hover:border-[#C9A84C]/40 transition-all duration-200"
              aria-label="Email general enquiries"
            >
              <div className="w-12 h-12 rounded-full bg-[#C9A84C]/10 flex items-center justify-center group-hover:bg-[#C9A84C]/20 transition-colors">
                <span className="text-xl" aria-hidden="true">✉</span>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">General Enquiries</p>
                <span className="inline-block px-4 py-1.5 rounded-full bg-[#C9A84C]/10 text-[#0B1E36] text-sm font-semibold group-hover:bg-[#C9A84C]/20 transition-colors">Send email</span>
                <p className="text-[#0B1E36] font-semibold text-[13px] mt-2 leading-snug">hello@secondlookprotect.co.uk</p>
                <p className="text-slate-400 text-[11px] mt-1 leading-snug">For questions about platform fit and pilots</p>
              </div>
            </a>

            {/* Technical Support */}
            <a
              href="mailto:support@secondlookprotect.co.uk"
              className="group flex flex-col items-center gap-3 bg-white rounded-xl p-6 border border-slate-100 shadow-sm hover:shadow-md hover:border-[#C9A84C]/40 transition-all duration-200"
              aria-label="Email technical support"
            >
              <div className="w-12 h-12 rounded-full bg-[#C9A84C]/10 flex items-center justify-center group-hover:bg-[#C9A84C]/20 transition-colors">
                <span className="text-xl" aria-hidden="true">🛠</span>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">Technical Support</p>
                <span className="inline-block px-4 py-1.5 rounded-full bg-[#C9A84C]/10 text-[#0B1E36] text-sm font-semibold group-hover:bg-[#C9A84C]/20 transition-colors">Send email</span>
                <p className="text-[#0B1E36] font-semibold text-[13px] mt-2 leading-snug">support@secondlookprotect.co.uk</p>
                <p className="text-slate-400 text-[11px] mt-1 leading-snug">For platform support and account help</p>
              </div>
            </a>
          </div>
        </div>

        {/* Contact footer note — full section width, true center */}
        <div className="flex flex-col items-center justify-center w-full mt-8 text-center" style={{ maxWidth: '56rem', marginLeft: 'auto', marginRight: 'auto' }}>
          <p className="text-slate-500 text-sm italic">Mon to Sat, 8am to 8pm. We aim to respond promptly to organisation enquiries and support requests.</p>
          <p className="text-slate-400 text-xs mt-3 max-w-2xl">
            Second Look Protect supports structured safeguarding concern handling. For urgent internal safeguarding action, organisations should continue to follow their own immediate procedures and escalation routes.
          </p>
        </div>
      </SectionWrapper>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <SectionWrapper background="navy">
        <div className="max-w-xl mx-auto text-center">
          <div className="flex justify-center mb-8" aria-hidden="true">
            <div className="w-16 h-16 rounded-full bg-[#C9A84C]/15 flex items-center justify-center">
              <Shield className="w-8 h-8 text-[#C9A84C]" />
            </div>
          </div>
          <h2 className="text-white mb-5" style={{ fontFamily: "'Merriweather', serif" }}>
            Clearer safeguarding support when something does not feel right.
          </h2>
          <p className="text-slate-300 text-lg leading-relaxed mb-10">
            Help your team record concerns earlier, review risk more consistently, and maintain stronger oversight across your service.
          </p>
          <Button
            variant="primary"
            size="lg"
            onClick={handleGetProtection}
            aria-label="Book a Demo"
            className="btn-gold-gradient border-0 font-semibold w-full sm:w-auto justify-center"
          >
            Book a Demo
          </Button>
          <p className="text-slate-500 text-sm mt-4">A practical walkthrough for care providers and safeguarding teams.</p>
        </div>
      </SectionWrapper>

      {/* ── Footer ───────────────────────────────────────────────────── */}
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
                Safeguarding intelligence and oversight platform for care providers. Built to help organisations record concerns, review risk, and maintain clearer evidence for governance and inspection.
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
                    <span><span className="text-slate-500">Discuss Platform Fit:</span> hello@secondlookprotect.co.uk</span>
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
                  { label: 'How It Works', href: '#how-it-works' },
                  { label: 'Plans', href: '#pricing' },
                  { label: 'Reviews', href: '#testimonials' },
                  { label: 'About Us', href: '#' },
                  { label: 'Contact', href: '#' },
                ].map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="hover:text-white transition-colors duration-200">
                      {l.label}
                    </a>
                  </li>
                ))}
                <li>
                  <a
                    href="/support"
                    onClick={(e) => { e.preventDefault(); window.history.pushState(null, '', '/support'); setPage('support'); window.scrollTo({ top: 0, behavior: 'instant' }); }}
                    className="hover:text-white transition-colors duration-200"
                  >
                    Support
                  </a>
                </li>
              </ul>
            </nav>

            {/* Legal */}
            <nav aria-label="Legal links">
              <h4 className="text-white font-semibold text-base mb-5">Legal</h4>
              <ul className="space-y-3 text-base">
                <li>
                  <a
                    href="/privacy-policy"
                    onClick={(e) => { e.preventDefault(); window.history.pushState(null, '', '/privacy-policy'); setPage('privacy-policy'); window.scrollTo({ top: 0, behavior: 'instant' }); }}
                    className="hover:text-white transition-colors duration-200"
                  >
                    Privacy Policy
                  </a>
                </li>
                {['Terms of Service', 'Cookie Policy'].map((l) => (
                  <li key={l}>
                    <a
                      href={l === 'Terms of Service' ? '/terms-of-service' : '#'}
                      onClick={l === 'Terms of Service' ? (e) => { e.preventDefault(); window.history.pushState(null, '', '/terms-of-service'); setPage('terms-of-service'); window.scrollTo({ top: 0, behavior: 'instant' }); } : undefined}
                      className="hover:text-white transition-colors duration-200"
                    >
                      {l}
                    </a>
                  </li>
                ))}
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
              Second Look Protect supports organisational safeguarding processes. It does not replace internal procedures, leadership judgement, or urgent safeguarding escalation routes.
              To explore how the platform fits your environment, request a practical walkthrough above.
            </p>
          </div>
        </div>
      </footer>

      {/* ── Sticky bottom CTA — mobile portrait only ───────────────────── */}
      <style>{`
        .home-sticky-bar { display: none; }
        @media (max-width: 480px) and (orientation: portrait) {
          .home-sticky-bar {
            display: flex !important;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            z-index: 50;
            justify-content: center;
            align-items: center;
            padding: 12px 20px;
            padding-bottom: max(12px, env(safe-area-inset-bottom));
            background: rgba(11,30,54,0.92);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-top: 1px solid rgba(201,168,76,0.15);
            box-shadow: 0 -4px 20px rgba(0,0,0,0.25);
          }
          .home-sticky-bar button {
            display: flex; align-items: center; justify-content: center; gap: 0.5rem;
            width: 100%; max-width: 340px;
            padding: 14px 1.5rem;
            border-radius: 9999px; border: none; cursor: pointer;
            background: linear-gradient(135deg, #C6A544 0%, #D2B356 50%, #B8962E 100%);
            color: #0B1E36; font-size: 16px; font-weight: 700;
            box-shadow: 0 4px 18px rgba(201,168,76,0.28);
            transition: filter 0.18s ease;
            position: relative; overflow: hidden;
          }
          .home-sticky-bar button::after {
            content: '';
            position: absolute;
            top: 0; left: -100%; width: 60%; height: 100%;
            background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%);
            animation: home-shimmer 4.5s ease-in-out infinite;
          }
          @keyframes home-shimmer {
            0%, 85% { left: -100%; }
            100%    { left: 150%; }
          }
          .home-sticky-bar button:active { filter: brightness(0.95); }
          /* Bottom padding to prevent content overlap */
          .home-sticky-padded { padding-bottom: 76px !important; }
          /* Hide old floating FAB */
          .home-fab-old { display: none !important; }
        }
      `}</style>
      <div className="home-sticky-bar" aria-label="Quick action">
        <button onClick={handleGetProtection} aria-label="Book a Demo">
          <Shield className="w-[18px] h-[18px]" aria-hidden="true" />
          Book a Demo
        </button>
      </div>
    </div>
  );
}
