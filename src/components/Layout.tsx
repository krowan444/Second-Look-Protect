import { SITE } from "../lib/site";
import { track } from "../lib/analytics";

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className="shrink-0">
      <defs>
        <clipPath id="slp-shield">
          <path d="M50 6 L89 19 V49 C89 72 71 88 50 95 C29 88 11 72 11 49 V19 Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#slp-shield)">
        <rect x="0" y="0" width="50" height="100" fill="#1c3527" />
        <rect x="50" y="0" width="50" height="100" fill="#c9932b" />
      </g>
      <path
        d="M30 52 L44 66 L72 34"
        fill="none"
        stroke="#faf7f0"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ size = 36 }: { size?: number }) {
  return (
    <a href="/" className="no-underline flex items-center gap-2.5">
      <Logo size={size} />
      <span>
        <span className="font-display font-bold text-xl text-green">
          Second Look <em className="text-gold not-italic">Protect</em>
        </span>
        <span className="block text-[11px] font-semibold text-green-soft">
          A calm second opinion before you act
        </span>
      </span>
    </a>
  );
}

/** Sticky top bar — the original Second Look Protect header. */
export function Nav({ cta = true }: { cta?: boolean }) {
  return (
    <header className="bg-white/90 backdrop-blur border-b border-green/10 sticky top-0 z-20">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-5 py-3">
        <Wordmark />
        <div className="flex items-center gap-4">
          <a href="/about" className="hidden sm:block text-sm font-bold text-green no-underline">
            About
          </a>
          {/* Points at the real /session page so it works from every page,
              not just the home page anchor it used to scroll to. */}
          <a href="/session" className="hidden sm:block text-sm font-bold text-green no-underline">
            AI Safety Session
          </a>
          {cta && (
            <a
              href="/check"
              onClick={() => track("nav_check_clicked")}
              className="bg-gold hover:bg-gold-soft text-green-deep font-semibold text-sm px-4 py-2 rounded-full no-underline"
            >
              Check a scam
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

/** Shared footer — one definition, so contact details can never drift. */
export function Footer() {
  return (
    <footer className="bg-green-deep text-cream/80 text-sm">
      <div className="max-w-5xl mx-auto px-5 py-10">
        <div className="grid sm:grid-cols-2 gap-6 items-start">
          <div>
            <span className="flex items-center gap-2.5">
              <Logo size={28} />
              <span className="font-display text-cream text-lg">
                Second Look <span className="text-gold">Protect</span>
              </span>
            </span>
            <p className="text-cream/70 mt-3 mb-0 max-w-xs">
              A calm second opinion before you act. Independent, UK-based, and read by a real person.
            </p>
          </div>
          <div className="sm:text-right">
            <p className="m-0">
              <a href={`tel:${SITE.phoneDial}`} className="text-cream/90">
                {SITE.phoneDisplay}
              </a>
            </p>
            <p className="m-0 mt-1">
              <a href={`mailto:${SITE.email}`} className="text-cream/90 break-all">
                {SITE.email}
              </a>
            </p>
            <p className="m-0 mt-3 flex flex-wrap gap-x-4 gap-y-1 sm:justify-end">
              <a href="/talks" className="text-cream/90">Group talks</a>
              <a href="/session" className="text-cream/90">1-to-1 session</a>
              <a href="/about" className="text-cream/90">About</a>
              <a href="/check" className="text-cream/90">Free check</a>
            </p>
          </div>
        </div>

        <p className="text-cream/70 text-xs mt-6 mb-0">
          <a href={SITE.billingPortal} target="_blank" rel="noopener" className="text-cream/90">
            Manage or cancel your plan
          </a>{" "}
          — takes under a minute, no phone call needed.
        </p>
        <p className="text-cream/60 text-xs mt-2 mb-0">
          Your details and anything you send us are kept private — never shared or sold. Reports are
          guidance, not financial or legal advice. Sister company to{" "}
          <a href={SITE.learnAiFast} className="text-cream/80">Learn AI Fast</a> · © {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}

/** Standard page wrapper: nav, content, footer. */
export function Page({ children, cta = true }: { children: React.ReactNode; cta?: boolean }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav cta={cta} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
