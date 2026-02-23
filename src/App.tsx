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
import {
  Shield, CheckCircle, Search, Lock, AlertTriangle,
  Phone, Star, ArrowRight, Users, Mail,
} from 'lucide-react';

/* ─── Data ─────────────────────────────────────────────────────────────── */

const PRICING_PLANS = [
  {
    name: 'Basic Shield',
    planKey: 'BASIC',           // maps to NEXT_PUBLIC_PRICE_ID_BASIC_MONTHLY / _YEARLY
    monthlyPrice: '£9.99',
    yearlyPrice: '£8.32',   // per month equivalent
    yearlyTotal: '£99.90', // billed annually (saves 2 months)
    tagline: 'Simple, steady reassurance when you need it.',
    description: 'For independent individuals who want a trusted second opinion before they act.',
    featureGroups: [
      {
        groupTitle: 'Protection Includes',
        items: [
          'Up to 5 Personal Reviews per month',
          '24-Hour Reassurance Response',
          'Clear Risk Assessment (Low / Medium / High)',
          'Guardian Risk Summary for your records',
          'The Recovery Blueprint – step-by-step guidance if you\'ve already clicked',
        ],
      },
      {
        groupTitle: 'Ongoing Support',
        items: [
          'Monthly UK Scam Bulletin',
          'Optional monthly Pause Reminder text',
        ],
      },
      {
        groupTitle: 'Physical Protection Kit',
        items: [
          '1x Phone-Side "Pause & Check" Sticker',
          '1x Wallet Emergency Card',
        ],
      },
    ],
    ctaLabel: 'Start with Basic Shield',
    featured: false,
  },
  {
    name: 'The Guardian',
    planKey: 'GUARDIAN',
    monthlyPrice: '£19.99',
    yearlyPrice: '£16.65',
    yearlyTotal: '£199.90',
    tagline: 'Confident protection for you and someone you care about.',
    description: 'Our most popular plan. Faster response, broader coverage, and proactive safety tools.',
    featureGroups: [
      {
        groupTitle: 'Everything in Basic, plus',
        items: [
          'Up to 20 Full Reviews per month',
          'Priority Response (within 4 hours, Mon–Fri)',
          'Safe-Shop Website, QR Code & Invoice Verification',
          'Verified Vault – real bank & service contact numbers',
          'Protection for 2 People',
          'Annual Digital Safety Check-Up',
        ],
      },
      {
        groupTitle: 'Proactive Alerts',
        items: [
          'Weekly UK Scam Alerts',
          'Monthly Protection Activity Summary',
        ],
      },
      {
        groupTitle: 'Full Guardian Pack',
        items: [
          'Premium Fridge Magnet',
          '2x Wallet Cards',
          '2x Phone Reminder Stickers',
          'A5 "Top Scam Red Flags" Desktop Guide',
        ],
      },
    ],
    ctaLabel: 'Start with The Guardian',
    featured: true,
  },
  {
    name: 'Family Shield',
    planKey: 'FAMILY',
    monthlyPrice: '£34.99',
    yearlyPrice: '£29.15',
    yearlyTotal: '£349.90',
    tagline: 'Complete household protection and accountability.',
    description: 'Designed for families protecting elderly parents or multiple loved ones.',
    featureGroups: [
      {
        groupTitle: 'Everything in Guardian, plus',
        items: [
          'Unlimited Reviews (Fair Use Policy)',
          'Same-Day Priority Handling',
          'Emergency "Human-Line" Call-Back Window',
          'Coverage for Up to 5 Family Members',
          'Annual 1-on-1 Digital Health Review',
        ],
      },
      {
        groupTitle: 'Family Accountability',
        items: [
          'Monthly "Peace of Mind" Summary sent to Family Lead',
          'Shared Submission Access',
        ],
      },
      {
        groupTitle: 'Elite Family Kit',
        items: [
          'Full Guardian Pack for 5',
          'Scam Scenario Flash Cards',
        ],
      },
    ],
    ctaLabel: 'Start with Family Shield',
    featured: false,
  },
];

const TESTIMONIALS = [
  {
    quote: 'I received a text from what looked exactly like my bank asking me to authorise a payment. I forwarded a screenshot to Second Look Protect, and within three minutes they confirmed it was a scam. They saved me £2,000.',
    author: 'Margaret T.',
    location: 'Kingsthorpe',
  },
  {
    quote: 'I set up the Family Shield for my elderly parents. It gives me such peace of mind knowing they have real experts to check things with before clicking any link. Worth every penny.',
    author: 'David S.',
    location: 'Duston',
  },
  {
    quote: 'The service is incredibly fast and straightforward. I forward suspicious emails and they reply almost instantly. It is like having a cybersecurity expert in your pocket, without any of the jargon.',
    author: 'Helen R.',
    location: 'Abington',
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
  // Initialise page from URL so /subscription-success works on direct load / Stripe redirect
  function getInitialPage(): 'home' | 'get-protection' | 'subscription-success' | 'privacy-policy' | 'support' | 'terms-of-service' {
    const path = window.location.pathname;
    if (path.startsWith('/subscription-success')) return 'subscription-success';
    if (path.startsWith('/get-protection')) return 'get-protection';
    if (path.startsWith('/privacy-policy')) return 'privacy-policy';
    if (path.startsWith('/support')) return 'support';
    if (path.startsWith('/terms-of-service')) return 'terms-of-service';
    return 'home';
  }

  const [page, setPage] = useState<'home' | 'get-protection' | 'subscription-success' | 'privacy-policy' | 'support' | 'terms-of-service'>(getInitialPage);
  const [isYearly, setIsYearly] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

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

  // ── Home page ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 selection:bg-[#C9A84C]/30 selection:text-[#0B1E36]">
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
                  Independent · UK-Based · Expert Verification
                </span>
              </div>

              {/* Headline */}
              <h1
                className="animate-fade-in-up animate-delay-100 text-white mb-6 leading-tight"
                style={{ fontFamily: "'Merriweather', serif", textShadow: '0px 1px 6px rgba(0,0,0,0.15)' }}
              >
                <span className="block" style={{ color: '#A8C4DE' }}>Before you click.</span>
                <span className="block text-[#C9A84C]" style={{ marginTop: '-4px' }}>Get a calm, expert second look.</span>
              </h1>

              {/* AI context supporting line */}
              <p className="animate-fade-in-up animate-delay-150 text-slate-300 text-sm leading-relaxed mb-4 max-w-lg">
                As AI technology evolves rapidly, scams and online deception are becoming more sophisticated. Second Look Protect gives you a simple, calm way to double-check before you act.
              </p>

              {/* Supporting text */}
              <p className="animate-fade-in-up animate-delay-200 text-slate-300 text-lg leading-relaxed mb-3 max-w-lg">
                Send us suspicious texts, emails, links, WhatsApp messages, or screenshots — and we&rsquo;ll verify what&rsquo;s real, what&rsquo;s risky, and what to do next.
              </p>
              <p className="animate-fade-in-up animate-delay-200 text-slate-400 text-sm leading-relaxed mb-3 max-w-lg">
                Supporting individuals, families, and care environments against increasingly sophisticated scams and AI-driven fraud.
              </p>
              <p className="animate-fade-in-up animate-delay-200 text-[#C9A84C]/70 text-sm font-medium tracking-wide mb-8">
                Independent. UK-based. Human-verified.
              </p>

              {/* Benefit chips */}
              <div className="animate-fade-in-up animate-delay-300 flex flex-wrap gap-2 mb-10" role="list" aria-label="Key benefits">
                {[
                  '✔ Verify links before you open them',
                  '✔ Spot scams that look real',
                  '✔ Protect parents & family finances',
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
                  aria-label="Get protection — start your fraud check in 60 seconds"
                  className="bg-[#C9A84C] text-[#0B1E36] hover:bg-[#D9BC78] border-0 font-semibold w-full sm:w-auto justify-center"
                >
                  Get Protection
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
                  See How It Works
                </button>
              </div>

              {/* Sub-CTA stack — full-width, left-aligned below both buttons */}
              <p className="text-slate-200 text-sm font-medium mb-3">Start in 60 seconds</p>

              <div className="flex flex-col gap-1.5 mb-5">
                <p className="text-slate-300/85 text-sm">✓ UK-based specialists</p>
                <p className="text-slate-300/85 text-sm">✓ Human-reviewed by UK specialists</p>
                <p className="text-slate-300/85 text-sm">✓ Supporting safeguarding decisions</p>
              </div>

              {/* Reassurance line */}
              <p className="text-slate-300/80 italic" style={{ fontSize: '13px', letterSpacing: '0.01em' }}>
                No judgement. No pressure. Just clarity when something doesn&rsquo;t feel right.
              </p>

              {/* Care environment trust badge */}
              <div className="mt-6">
                <span className="inline-flex items-center gap-2 bg-[#C9A84C]/15 border border-[#C9A84C]/50 text-slate-200 text-xs font-medium px-4 py-1.5 rounded-full shadow-sm">
                  <Shield className="w-3.5 h-3.5 text-[#C9A84C] shrink-0" aria-hidden="true" />
                  Suitable for care environments &amp; safeguarding teams.
                </span>
              </div>

              {/* Hero phone + email nudge */}
              <div className="mt-5 flex flex-col gap-1.5">
                <p className="text-slate-400 text-sm">
                  Prefer to talk?{' '}
                  <a
                    href="tel:07907614821"
                    className="text-[#C9A84C] hover:text-[#D9BC78] font-medium transition-colors duration-200"
                    aria-label="Call us on 07907 614821"
                  >
                    Call 07907 614821
                  </a>
                </p>
                <p className="text-slate-400 text-sm">
                  Prefer email?{' '}
                  <a
                    href="mailto:hello@secondlookprotect.co.uk"
                    className="text-[#C9A84C] hover:text-[#D9BC78] font-medium transition-colors duration-200"
                    aria-label="Email hello@secondlookprotect.co.uk"
                  >
                    hello@secondlookprotect.co.uk
                  </a>
                </p>
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

      {/* ── Simple 4-Step Explainer ───────────────────────────────────── */}
      <SectionWrapper background="offwhite" topBorder={false}>
        <div className="max-w-2xl mx-auto text-center mb-12">
          <p className="text-[#A8853C] text-xs font-semibold tracking-widest uppercase mb-4">
            How it works
          </p>
          <h2 className="text-[#0B1E36]">
            Simple. Calm. Clear.
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Step 1 */}
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#C9A84C]/12 flex items-center justify-center mb-5" aria-hidden="true">
              <Mail className="w-5 h-5 text-[#C9A84C]" />
            </div>
            <p className="text-[#C9A84C] text-xs font-semibold tracking-widest uppercase mb-2">Step 1</p>
            <h4 className="text-[#0B1E36] font-semibold mb-2">You receive something</h4>
            <p className="text-slate-500 text-sm leading-relaxed">
              A message, email, link, call, or invoice that feels uncertain.
            </p>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#C9A84C]/12 flex items-center justify-center mb-5" aria-hidden="true">
              <ArrowRight className="w-5 h-5 text-[#C9A84C]" />
            </div>
            <p className="text-[#C9A84C] text-xs font-semibold tracking-widest uppercase mb-2">Step 2</p>
            <h4 className="text-[#0B1E36] font-semibold mb-2">You send it to us</h4>
            <p className="text-slate-500 text-sm leading-relaxed">
              Forward it through our app, portal, or WhatsApp.
            </p>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#C9A84C]/12 flex items-center justify-center mb-5" aria-hidden="true">
              <Shield className="w-5 h-5 text-[#C9A84C]" />
            </div>
            <p className="text-[#C9A84C] text-xs font-semibold tracking-widest uppercase mb-2">Step 3</p>
            <h4 className="text-[#0B1E36] font-semibold mb-2">We review it carefully</h4>
            <p className="text-slate-500 text-sm leading-relaxed">
              Our UK-based experts check for warning signs and hidden risks.
            </p>
          </div>

          {/* Step 4 */}
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#C9A84C]/12 flex items-center justify-center mb-5" aria-hidden="true">
              <CheckCircle className="w-5 h-5 text-[#C9A84C]" />
            </div>
            <p className="text-[#C9A84C] text-xs font-semibold tracking-widest uppercase mb-2">Step 4</p>
            <h4 className="text-[#0B1E36] font-semibold mb-2">You get a clear answer</h4>
            <p className="text-slate-500 text-sm leading-relaxed">
              Simple guidance on whether it's safe — and what to do next.
            </p>
          </div>
        </div>
      </SectionWrapper>

      {/* ── Who This Is For ──────────────────────────────────────────────── */}
      <SectionWrapper background="white" topBorder>
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-[#A8853C] text-xs font-semibold tracking-widest uppercase mb-4">
            Who this is for
          </p>
          <h2 className="text-[#0B1E36] mb-10">
            Designed for real people who want extra reassurance online.
          </h2>

          <ul className="space-y-5 text-left max-w-md mx-auto" role="list">
            {[
              'Independent individuals wanting a trusted second opinion',
              'Concerned family members supporting loved ones',
              'Care home residents or retirement community members',
              'Older adults who want reassurance without technical complexity',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-[#C9A84C] shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-slate-600 text-base leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </SectionWrapper>

      {/* ── The Problem ──────────────────────────────────────────────── */}
      <SectionWrapper background="offwhite" topBorder={false} className="pt-16 md:pt-20 pb-12 md:pb-16">
        <SectionHeading
          title="The internet should not feel like a minefield."
          subtitle="Every day, convincing fake messages, websites, and calls target innocent people. They look like your bank, your delivery service, or even your family. One wrong click can cost you everything."
        />

        <div className="grid md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 hover:shadow-md transition-shadow duration-300">
            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-6" aria-hidden="true">
              <AlertTriangle className="w-6 h-6 text-slate-500" />
            </div>
            <h3 className="mb-3">Increasingly Convincing Fraud</h3>
            <p className="text-slate-600 text-base leading-relaxed">
              Modern fraud is difficult to distinguish from genuine communications. Criminals replicate real logos, names, and language to prompt immediate action.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 hover:shadow-md transition-shadow duration-300">
            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-6" aria-hidden="true">
              <Lock className="w-6 h-6 text-slate-500" />
            </div>
            <h3 className="mb-3">Serious Financial Consequences</h3>
            <p className="text-slate-600 text-base leading-relaxed">
              Once funds are transferred, recovery is rarely possible. The financial and personal impact can be significant and long-lasting.
            </p>
          </div>

          {/* Card 3 — highlighted solution */}
          <div className="bg-[#112540] rounded-xl p-8 text-white border-l-4 border-[#C9A84C]">
            <div className="w-12 h-12 bg-[#C9A84C]/15 rounded-lg flex items-center justify-center mb-6" aria-hidden="true">
              <Shield className="w-6 h-6 text-[#C9A84C]" />
            </div>
            <h3 className="text-white font-semibold mb-3" style={{ color: '#F3F6FA' }}>The Second Look Solution</h3>
            <p className="text-slate-200 text-base leading-relaxed">
              Pause. Before you click or pay — get a second look. Send it to us instead. Our experts analyse the request and give you a clear verdict — Safe or Scam.
            </p>
          </div>
        </div>
      </SectionWrapper>

      {/* ── How It Works ─────────────────────────────────────────────── */}
      <SectionWrapper id="how-it-works" background="white" topBorder className="pt-14 md:pt-20">
        <SectionHeading
          title="How It Works"
          subtitle="A clear, three-step process. Simple to use, whatever your level of technical experience."
        />

        <div className="grid md:grid-cols-3 gap-12 max-w-4xl mx-auto relative">
          {/* Connector line */}
          <div
            className="hidden md:block absolute top-11 left-[18%] right-[18%] h-px bg-slate-300"
            aria-hidden="true"
          />

          {[
            {
              step: '1',
              title: 'Receive & Pause',
              body: 'You receive a suspicious email, text, or payment request. Instead of acting on it immediately, you pause.',
              gold: false,
            },
            {
              step: '2',
              title: 'Send for a Second Look',
              body: "If something doesn't feel right — a call, text, email, website, or payment request — just press Get Protection and send it to us. No logins, no confusion — we'll handle everything for you.",
              gold: false,
            },
            {
              step: '3',
              title: 'Get the Verdict',
              body: 'Our experts carefully analyse the threat, send a clear risk report directly to your phone, and guide you step-by-step on exactly what to do next.',
              gold: true,
            },
          ].map(({ step, title, body, gold }) => (
            <div key={step} className="relative flex flex-col items-center text-center">
              <div
                className={[
                  'w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold mb-8 relative z-10',
                  gold
                    ? 'bg-[#C9A84C] text-[#0B1E36] shadow-lg'
                    : 'bg-white text-[#0B1E36] border-2 border-slate-200 shadow-sm',
                ].join(' ')}
                aria-hidden="true"
              >
                {step}
              </div>
              <h3 className="mb-3">{title}</h3>
              <p className="text-slate-600 text-base leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Button variant="primary" size="lg" className="inline-flex" as="a" href="#pricing">
            View Our Plans <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </Button>
          <div className="mt-4 flex flex-col items-center gap-0.5">
            <p className="text-slate-400 text-xs tracking-wide">Questions? Speak directly with us:</p>
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

      {/* ── Digital Safety Education ──────────────────────────────────── */}
      <SectionWrapper background="offwhite" topBorder>
        <SectionHeading
          title="The digital world is changing — and that's OK."
        />

        {/* Sub-label + paragraphs — constrained to ~65 char line length */}
        <div className="max-w-[640px] mx-auto text-center mt-10 mb-14">
          <p className="text-[#A8853C] text-xs font-semibold tracking-widest uppercase mb-5">
            A calm perspective on modern scams
          </p>

          <p className="text-slate-600 text-base leading-relaxed mb-5">
            Technology — including AI — is evolving rapidly. While this brings many benefits, it also means scam techniques are becoming more convincing and harder to recognise.
          </p>

          <p className="text-slate-600 text-base leading-relaxed">
            You shouldn't need to be a technology expert to stay safe online. Second Look Protect provides a clear, calm second opinion whenever something feels uncertain.
          </p>
        </div>

        {/* Card — centered, left-aligned text inside for readability */}
        <div className="max-w-3xl mx-auto bg-white border border-slate-100 rounded-xl p-8 md:p-12 shadow-sm">
          <h3 className="text-[#0B1E36] text-lg font-semibold mb-5">
            Why is online safety becoming more challenging?
          </h3>
          <p className="text-slate-600 text-base leading-relaxed mb-4">
            Technology and AI tools are evolving quickly. Unfortunately, this means scammers can create more convincing messages, emails, and fake content than ever before.
          </p>
          <p className="text-slate-600 text-base leading-relaxed mb-8">
            Having a trusted second opinion helps you stay confident without needing to understand all the technical details.
          </p>
          <p className="text-slate-400 text-sm italic">
            As scams evolve, so does your protection.
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
            <p
              className="text-[#0B1E36] text-xl md:text-2xl leading-relaxed mb-10"
              style={{ fontFamily: "'Merriweather', serif", fontWeight: 300 }}
            >
              I started Second Look Protect after seeing how convincing modern scams have become. Even careful, intelligent people are being caught off guard. This service exists to create a pause&nbsp;— a second look&nbsp;— before a decision is made.
            </p>

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
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-[#A8853C] text-xs font-semibold tracking-widest uppercase mb-4">
            Peace of mind
          </p>

          <h2 className="text-[#0B1E36] mb-6">
            You don't need to have been scammed to protect yourself.
          </h2>

          <p className="text-slate-600 text-lg leading-relaxed mb-6">
            Most members join after experiencing uncertainty — not after losing money.
          </p>

          <div className="space-y-3 text-slate-600 text-base leading-relaxed mb-8">
            <p>Sometimes it's just a message that feels slightly off.</p>
            <p>A phone call that doesn't sit right.</p>
            <p>An email that creates doubt.</p>
          </div>

          <p className="text-slate-600 text-base leading-relaxed">
            Second Look Protect exists so you can pause, check, and move forward with confidence — before anything goes wrong.
          </p>
        </div>
      </SectionWrapper>

      {/* ── Pricing ──────────────────────────────────────────────────── */}
      <SectionWrapper id="pricing" background="navy">
        <SectionHeading
          title="Protection Plans"
          subtitle="Simple, transparent pricing. No long-term commitment required."
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

        <div className="mt-10 mx-auto max-w-lg text-center space-y-2">
          <p className="text-slate-400 text-sm text-center">
            Simple cancellations: Just email us to stop your subscription at any time.
          </p>
          <p className="text-slate-500 text-xs text-center">
            All plans include a 14-day free trial. · Prices shown in GBP.
          </p>
        </div>

        {/* Core System strip */}
        <div className="mt-20 pt-16 border-t border-white/10 grid md:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Forward-to-Check */}
          <div>
            <h4 className="text-white text-base font-semibold mb-4 flex items-center gap-2">
              <span className="text-[#C9A84C] text-lg" aria-hidden="true">📨</span>
              Forward-to-Check System
            </h4>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed font-medium italic">
              No portals. No logins. No confusion.
            </p>
            <ul className="space-y-2 text-sm text-slate-300">
              {['Forward suspicious emails', 'Send WhatsApp screenshots', 'Submit website links'].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-[#C9A84C] mt-0.5" aria-hidden="true">→</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-slate-500 text-xs mt-5 italic">
              &ldquo;If you can forward a message, you can stay safe.&rdquo;
            </p>
          </div>

          {/* Risk Assessment */}
          <div>
            <h4 className="text-white text-base font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#C9A84C]" aria-hidden="true" />
              Guardian Risk Assessment
            </h4>
            <p className="text-slate-400 text-sm mb-5 leading-relaxed">Every review includes a clear, structured verdict:</p>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="text-green-400 text-base" aria-label="Green">&#x1F7E2;</span>
                <span className="text-slate-200"><strong className="text-white">Low Risk</strong> – No immediate warning signs detected</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-yellow-400 text-base" aria-label="Amber">&#x1F7E1;</span>
                <span className="text-slate-200"><strong className="text-white">Caution</strong> – Warning indicators present</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-400 text-base" aria-label="Red">&#x1F534;</span>
                <span className="text-slate-200"><strong className="text-white">High Risk</strong> – Strong scam indicators detected</span>
              </li>
            </ul>
          </div>

          {/* Flexible Membership */}
          <div>
            <h4 className="text-white text-base font-semibold mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#C9A84C]" aria-hidden="true" />
              Flexible Membership
            </h4>
            <ul className="space-y-3 text-sm text-slate-300">
              {[
                'Monthly rolling — no lock-in',
                'Cancel any time from your account',
                'Save 2 months on annual billing',
                'Switch plan at any time',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[#C9A84C] shrink-0 mt-0.5" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Peace of Mind */}
          <div>
            <h4 className="text-white text-base font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#C9A84C]" aria-hidden="true" />
              Peace of mind for you — and the people who care about you
            </h4>
            <p className="text-slate-400 text-sm leading-relaxed">
              Families and loved ones know there's always a calm, trusted second opinion available when something doesn't feel right. Support without judgement — for you and the people who care about you.
            </p>
          </div>

        </div>

        {/* Section-wide centered tagline */}
        <div className="w-full flex justify-center mt-8">
          <p className="text-slate-500 text-xs text-center">Clear. Calm. Structured.</p>
        </div>
      </SectionWrapper>

      {/* ── Testimonials ─────────────────────────────────────────────── */}
      <SectionWrapper id="testimonials" background="offwhite" topBorder>
        <SectionHeading
          title="What Our Members Say"
          subtitle="Accounts from people who use Second Look Protect to stay safe online."
        />

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div key={t.author}>
              <TestimonialCard {...t} />
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <SectionWrapper id="faq" background="white" topBorder>
        <div className="max-w-3xl mx-auto">
          <SectionHeading
            title="Frequently Asked Questions"
            subtitle="Clear answers. No pressure. No jargon."
          />
          <FAQAccordion />
        </div>
      </SectionWrapper>

      {/* ── Contact ──────────────────────────────────────────────────── */}
      <SectionWrapper id="contact" background="offwhite" topBorder>
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-[#C9A84C] text-xs font-semibold tracking-widest uppercase mb-3">Get in Touch</p>
          <h2 className="text-[#0B1E36] mb-3" style={{ fontFamily: "'Merriweather', serif" }}>
            We're here when you need us
          </h2>
          <p className="text-slate-600 text-lg mb-10">
            Call, WhatsApp, or email — whichever works best for you.
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
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Office Line</p>
                <p className="text-[#0B1E36] font-semibold text-base">01604 385888</p>
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
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Mobile / WhatsApp</p>
                <p className="text-[#0B1E36] font-semibold text-base">07907 614821</p>
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
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">General Enquiries</p>
                <p className="text-[#0B1E36] font-semibold text-xs break-all">hello@secondlookprotect.co.uk</p>
                <p className="text-slate-400 text-xs mt-1">Questions, billing, partnerships</p>
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
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Technical Support</p>
                <p className="text-[#0B1E36] font-semibold text-xs break-all">support@secondlookprotect.co.uk</p>
                <p className="text-slate-400 text-xs mt-1">App/portal access, technical issues</p>
              </div>
            </a>
          </div>
        </div>

        {/* Contact footer note — full section width, true center */}
        <div className="flex flex-col items-center justify-center w-full mt-8 text-center" style={{ maxWidth: '56rem', marginLeft: 'auto', marginRight: 'auto' }}>
          <p className="text-slate-500 text-sm italic">Mon – Sat · 8am – 8pm · We aim to respond within 1 hour.</p>
          <p className="text-slate-400 text-xs mt-3 max-w-2xl">
            We will never ask for passwords, OTPs, full banking details, or ask you to move money. If unsure, contact us directly via our official website or{' '}
            <a href="mailto:hello@secondlookprotect.co.uk" className="underline underline-offset-1 hover:text-slate-600 transition-colors">hello@secondlookprotect.co.uk</a>.
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
            Scammers rely on pressure.<br />
            <span className="text-[#C9A84C]">We give you pause.</span>
          </h2>
          <p className="text-slate-300 text-lg leading-relaxed mb-10">
            Expert verification, available whenever you need it. Start with a free trial — no pressure, no commitment.
          </p>
          <Button
            variant="primary"
            size="lg"
            onClick={handleGetProtection}
            aria-label="Get protection — start your fraud check now"
            className="bg-[#C9A84C] text-[#0B1E36] hover:bg-[#D9BC78] border-0 font-semibold w-full sm:w-auto justify-center"
          >
            🛡️ Protect Me Now
          </Button>
          <p className="text-slate-500 text-sm mt-4">14-day free trial · Cancel any time</p>
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
                <p>Registered with the UK Information Commissioner's Office (ICO).</p>
                <p>Second Look Protect Ltd · Company No. 15847293 (England &amp; Wales)</p>
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
              Second Look Protect Ltd is an independent verification service. We are not authorised or regulated by the Financial Conduct Authority (FCA).
              We do not provide financial advice. UK-Based. Independent.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
