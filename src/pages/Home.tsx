const PAYMENT_LINK = (import.meta.env.VITE_STRIPE_PAYMENT_LINK as string) || "/check";
/* AI Scam Safety Session — booked via cal.com (same as Learn AI Fast); pick a time then pay by card */
const SESSION_LINK = (import.meta.env.VITE_SESSION_LINK as string) || "https://cal.com/kieran-rowan-tiujdp";

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
      <path d="M30 52 L44 66 L72 34" fill="none" stroke="#faf7f0" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Nav() {
  return (
    <header className="bg-white/90 backdrop-blur border-b border-green/10 sticky top-0 z-20">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-5 py-3">
        <a href="/" className="no-underline flex items-center gap-2.5">
          <Logo size={36} />
          <span>
            <span className="font-display font-bold text-xl text-green">Second Look <em className="text-gold not-italic">Protect</em></span>
            <span className="block text-[11px] font-semibold text-green-soft">A calm second opinion before you act</span>
          </span>
        </a>
        <div className="flex items-center gap-4">
          <a href="/about" className="hidden sm:block text-sm font-bold text-green no-underline">About</a>
          <a href="#safety-session" className="hidden sm:block text-sm font-bold text-green no-underline">AI Safety Session</a>
          <a href="/check" className="bg-gold hover:bg-gold-soft text-green-deep font-semibold text-sm px-4 py-2 rounded-full no-underline">
            Check a scam
          </a>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  return (
    <div>
      <Nav />

      {/* HERO — background image with copy on the left half.
          Save the hero photo as public/hero.jpg */}
      <section className="relative bg-cream-2 overflow-hidden">
        {/* Full-bleed background on tablet/desktop */}
        <div
          className="hidden md:block absolute inset-0 bg-cover"
          style={{ backgroundImage: "url(/hero.jpg)", backgroundPosition: "right center" }}
          aria-hidden="true"
        />
        {/* Soft cream wash so text stays readable over the left of the photo */}
        <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-cream-2 from-25% via-cream-2/80 via-45% to-transparent to-70%" aria-hidden="true" />

        <div className="relative max-w-5xl mx-auto px-5 py-14 md:py-28">
          <div className="md:max-w-[48%] text-center md:text-left">
            <p className="uppercase tracking-widest text-gold font-bold text-xs mb-4">Independent · UK-based · Human-verified</p>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight m-0">
              Before you click. Get a calm <span className="text-gold italic">Second Look</span>.
            </h1>
            <p className="mt-5 text-lg text-ink/80">
              Cloned voices, perfect phishing emails, fake bank calls — AI has made scams look real.
              Send us any suspicious text, email, call, letter or website, and we'll tell you in
              plain English: <strong>what's real, what's risky, and exactly what to do next</strong>.
              A real person, usually the same day.
            </p>
            <div className="mt-8 flex flex-wrap justify-center md:justify-start items-center gap-3">
              <span className="text-center">
                <a href="/check" className="inline-block bg-green text-cream font-semibold px-7 py-3.5 rounded-full no-underline text-lg">
                  Try your first check free
                </a>
                <span className="block text-xs text-green-soft mt-1.5">takes about 60 seconds</span>
              </span>
              <a href="#peace-of-mind" className="border-2 border-green text-green font-semibold px-6 py-3 rounded-full no-underline md:mb-6">
                Peace of Mind · £9.99/mo
              </a>
            </div>
            <p className="mt-4 text-sm text-green-soft font-semibold">
              No judgement. No pressure. Just clarity.
            </p>
          </div>
        </div>

        {/* On phones, show the photo below the copy instead of behind it */}
        <img
          src="/hero.jpg"
          alt="A woman smiling at her laptop as a Second Look Protect report tells her a message is safe"
          className="md:hidden w-full block"
        />
      </section>

      {/* STATS */}
      <section className="bg-green text-cream-2">
        <div className="max-w-5xl mx-auto px-5 py-10 grid sm:grid-cols-3 gap-6 text-center">
          {[
            ["3 sec", "of audio is all it takes to clone a loved one's voice"],
            ["37.5%", "how often people spot a cloned voice — worse than a coin flip"],
            ["£576m", "lost in the UK last year to fraud that talks victims into paying"],
          ].map(([n, t]) => (
            <div key={n}>
              <div className="font-display text-4xl text-gold font-bold">{n}</div>
              <div className="text-sm mt-1 opacity-90">{t}</div>
            </div>
          ))}
          <p className="sm:col-span-3 text-sm mt-2 opacity-95">
            Scammers now write perfect English and sound exactly like family.
            <strong className="text-gold"> The old warning signs are gone — a second look is the new one.</strong>
          </p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-5xl mx-auto px-5 py-14">
        <h2 className="text-3xl text-center font-bold">How it works</h2>
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          {[
            ["1. Send it over", "Forward the message, paste the text, or upload a screenshot or photo — takes two minutes, from any device."],
            ["2. We take a second look", "Our AI analyses the wording, links and phone numbers and checks them against known scam reports — then Kieran personally reviews every report before it goes anywhere."],
            ["3. You get a clear answer", "A plain-English report by email: scam or safe, why, and exactly what to do next. Usually the same day."],
          ].map(([h, t]) => (
            <div key={h} className="bg-white border border-gold/20 rounded-2xl p-6 shadow-sm">
              <h3 className="text-xl font-bold mt-0">{h}</h3>
              <p className="text-ink/80 m-0">{t}</p>
            </div>
          ))}
        </div>
      </section>

      {/* RECENTLY CAUGHT — swap these for real (anonymised) checks as they come in */}
      <section className="bg-cream-2 py-14">
        <div className="max-w-5xl mx-auto px-5">
          <h2 className="text-3xl text-center font-bold">Recent second looks</h2>
          <p className="text-center text-ink/70 mt-2">Real checks, anonymised.</p>
          <div className="grid md:grid-cols-3 gap-6 mt-8">
            {[
              ["🚨 Likely scam", "“Missed delivery” text claiming a small redelivery fee", "The link led to a copycat site built to harvest card details. We said: delete it, and never pay a fee from a text."],
              ["🚨 Likely scam", "Phone call from “the bank's fraud team” urging a transfer to a ‘safe account’", "Banks never ask you to move money. We said: hang up and call the number on the back of your card."],
              ["✅ Safe", "A text from a GP surgery about a health check", "Genuine sender, no links asking for details. Our member replied with total confidence — that's the point."],
            ].map(([tag, h, t]) => (
              <div key={h} className="bg-white border border-gold/20 rounded-2xl p-6 shadow-sm">
                <div className="text-sm font-bold text-green-soft">{tag}</div>
                <h3 className="text-lg font-bold mt-1">{h}</h3>
                <p className="text-ink/80 m-0 text-sm">{t}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="peace-of-mind" className="py-14">
        <div className="max-w-5xl mx-auto px-5">
          <h2 className="text-3xl text-center font-bold">Simple, honest pricing</h2>
          <div className="grid md:grid-cols-2 gap-6 mt-8 max-w-3xl mx-auto">
            <div className="bg-white border border-gold/20 rounded-2xl p-7 shadow-sm text-center">
              <h3 className="text-xl font-bold mt-0">First check</h3>
              <div className="font-display text-4xl font-bold text-green">Free</div>
              <p className="text-ink/80">See how it works with the message that's worrying you right now. No card, no catch.</p>
              <a href="/check" className="inline-block border-2 border-green text-green font-semibold px-5 py-2.5 rounded-full no-underline">Send it over</a>
            </div>
            <div className="bg-green text-cream rounded-2xl p-7 shadow-md text-center">
              <h3 className="text-xl font-bold mt-0 text-cream">Peace of Mind</h3>
              <div className="font-display text-4xl font-bold text-gold">£9.99<span className="text-lg">/month</span></div>
              <ul className="text-left text-cream/90 text-sm space-y-2 my-4 list-none p-0">
                <li>✓ A real person reviewing every check before you act</li>
                <li>✓ Unlimited scam checks for your whole household</li>
                <li>✓ Priority review — members go to the front of the queue</li>
                <li>✓ Family Safe Word set up with you, step by step</li>
                <li>✓ Cancel any time</li>
              </ul>
              <a href={PAYMENT_LINK} className="inline-block bg-gold text-green-deep font-semibold px-5 py-2.5 rounded-full no-underline">Join Peace of Mind</a>
            </div>
          </div>
        </div>
      </section>

      {/* FOR FAMILIES — the gift angle gets its own section */}
      <section className="bg-cream-2 py-14">
        <div className="max-w-3xl mx-auto px-5 text-center">
          <h2 className="text-3xl font-bold">Worried about Mum or Dad?</h2>
          <p className="text-lg text-ink/80">
            You can't check every message that reaches your parents — but we can. Set up Peace of Mind
            for them and they get a friendly expert to ask <em>before</em> they click, pay or reply,
            without feeling watched over or judged. You get to stop worrying every time the phone rings.
          </p>
          <a href={PAYMENT_LINK} className="inline-block bg-green text-cream font-semibold px-6 py-3 rounded-full no-underline mt-2">
            Set it up for someone you love
          </a>
          <p className="text-sm text-green-soft mt-3">The most caring gift you can give — £9.99 a month, cancel any time.</p>
        </div>
      </section>

      {/* SAFE WORD */}
      <section className="max-w-3xl mx-auto px-5 py-14 text-center">
        <h2 className="text-3xl font-bold">One word can beat a cloned voice</h2>
        <p className="text-lg text-ink/80">
          A voice on the phone that sounds exactly like your son or granddaughter, asking for urgent help,
          is today's most convincing scam. The defence is beautifully simple: a code word only your family
          knows, agreed in advance, asked for on any unexpected call. Every Peace of Mind member gets theirs
          set up with Kieran — it takes ten minutes, and it works.
        </p>
      </section>

      {/* AI SAFETY SESSION — cross-sell */}
      <section id="safety-session" className="py-14">
        <div className="max-w-5xl mx-auto px-5">
          <div className="bg-green text-cream rounded-2xl overflow-hidden shadow-md grid md:grid-cols-2">
            <img
              src="/session-kieran.jpg"
              alt="Kieran teaching an AI scam safety session one-to-one at a laptop"
              className="w-full h-56 md:h-full object-cover"
            />
            <div className="p-8 md:p-10">
              <p className="uppercase tracking-widest text-gold font-bold text-xs mt-0 mb-3">One-to-one with Kieran · 60 minutes · Zoom</p>
              <h2 className="text-3xl font-bold text-cream mt-0">AI Scam Safety Session</h2>
              <p className="text-cream/90 text-lg">
                Learn how modern scams use AI, what to look for, and exactly what to do before you
                reply, click or pay — calmly explained, no jargon, no scare tactics.
              </p>
              <ul className="text-left text-cream/90 space-y-2 my-5 list-none p-0">
                <li>✓ Spot cloned voices and deepfake videos</li>
                <li>✓ Verify urgent messages safely, step by step</li>
                <li>✓ Create your own Family Safe Word Plan</li>
              </ul>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="font-display text-4xl font-bold text-gold">£79.99</span>
                <a href={SESSION_LINK} target="_blank" rel="noopener" className="inline-block bg-gold text-green-deep font-semibold px-6 py-3 rounded-full no-underline">
                  Book your session
                </a>
              </div>
              <p className="text-sm mt-4 mb-0 text-cream/70">Pick a time that suits you · Secure card payment at booking · A lovely gift for parents and grandparents</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-cream-2 py-14">
        <div className="max-w-3xl mx-auto px-5">
          <h2 className="text-3xl text-center font-bold">Questions people ask us</h2>
          <div className="mt-8 space-y-3">
            {[
              ["Is my information private?", "Yes. What you send us is used only to check the message and is never shared or sold. You can ask us to delete it at any time."],
              ["What if it turns out to be nothing?", "That's the best outcome there is. Most checks come back safe — and knowing for certain is exactly what you're here for. Nobody will ever make you feel silly for asking."],
              ["Do I need to download or install anything?", "No. There's nothing to install and nothing technical to learn. You just send us the message and we do the rest."],
              ["How quickly will I hear back?", "Usually the same day. Peace of Mind members go to the front of the queue."],
              ["What if I've already clicked or paid?", "Send it over anyway — straight away. Your report will tell you exactly what to do next, and acting fast makes a real difference."],
              ["What does it cost?", "Your first check is completely free, with no card details. After that, Peace of Mind is £9.99 a month for unlimited checks for your whole household — cancel any time."],
              ["I'm a Peace of Mind member — how do you know it's me?", "There's no login and nothing to remember. Just use the same email address you joined with when you send a check — we recognise it automatically and you go straight to the front of the queue."],
              ["How do I cancel?", "Any time, in under a minute, with no phone call needed. Use the 'Manage or cancel your plan' link at the bottom of this page — enter the email you joined with and you'll be sent a secure link to cancel instantly. Prefer to just ask? Email hello@learnaifast.co.uk and we'll sort it the same day."],
            ].map(([q, a]) => (
              <details key={q} className="bg-white border border-gold/20 rounded-2xl px-6 py-4 shadow-sm">
                <summary className="font-bold text-green cursor-pointer">{q}</summary>
                <p className="text-ink/80 mt-2 mb-0">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* WHO */}
      <section className="py-14">
        <div className="max-w-3xl mx-auto px-5 text-center">
          <h2 className="text-3xl font-bold">A real person, not a helpline</h2>
          <p className="text-lg text-ink/80">
            Second Look Protect is run by Kieran — the friendly AI guide behind{" "}
            <a href="https://www.learnaifast.co.uk" className="text-green font-semibold">Learn AI Fast</a> in Northampton.
            Every report is personally reviewed before it reaches you. The people who get scammed aren't silly —
            they're unfamiliar. A second look changes that.
          </p>
          <p className="text-green-soft text-sm">
            Want to get confident with AI yourself? Friendly 1-to-1 lessons at{" "}
            <a href="https://www.learnaifast.co.uk" className="text-green font-semibold">learnaifast.co.uk</a>
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-green-deep text-cream/80 text-sm">
        <div className="max-w-5xl mx-auto px-5 py-8">
          <div className="flex flex-wrap justify-between gap-4 items-center">
            <span className="flex items-center gap-2.5">
              <Logo size={28} />
              <span className="font-display text-cream text-lg">Second Look <span className="text-gold">Protect</span></span>
            </span>
            <span>
              📞 07563 887804 · hello@learnaifast.co.uk ·
              part of <a href="https://www.learnaifast.co.uk" className="text-cream/90">Learn AI Fast</a> · © 2026
            </span>
          </div>
          <p className="text-cream/70 text-xs mt-4 mb-0">
            <a href="https://billing.stripe.com/p/login/dRm8wPde41D2a385m8dby00" target="_blank" rel="noopener" className="text-cream/90">
              Manage or cancel your plan
            </a>{" "}
            — takes under a minute, no phone call needed.
          </p>
          <p className="text-cream/60 text-xs mt-2 mb-0">
            Your details and anything you send us are kept private — never shared or sold. Reports are guidance,
            not financial or legal advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
