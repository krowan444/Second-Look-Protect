const PAYMENT_LINK = (import.meta.env.VITE_STRIPE_PAYMENT_LINK as string) || "/check";

function Nav() {
  return (
    <header className="bg-white/90 backdrop-blur border-b border-green/10 sticky top-0 z-20">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-5 py-3">
        <a href="/" className="no-underline">
          <span className="font-display font-bold text-xl text-green">Second Look <em className="text-gold not-italic">Protect</em></span>
          <span className="block text-[11px] font-semibold text-green-soft">A calm second opinion before you act</span>
        </a>
        <div className="flex items-center gap-3">
          <a href="tel:07563887804" className="hidden sm:block text-sm font-bold text-green no-underline">07563 887804</a>
          <a href="/check" className="bg-gold hover:bg-gold-soft text-green-deep font-semibold text-sm px-4 py-2 rounded-full no-underline">
            Free scam check
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

      {/* HERO */}
      <section className="bg-cream-2">
        <div className="max-w-5xl mx-auto px-5 py-14 md:py-20 text-center">
          <p className="uppercase tracking-widest text-gold font-bold text-xs mb-4">Not sure if it's a scam? Don't guess.</p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight m-0">
            Send it to us <span className="text-gold italic">before</span> you click, pay or reply.
          </h1>
          <p className="max-w-2xl mx-auto mt-5 text-lg text-ink/80">
            A suspicious text, email, phone call, letter or website — send it over and you'll get a clear,
            plain-English answer: <strong>scam or safe</strong>. AI-powered analysis, personally reviewed
            and sent to you by a real human. Your first check is free.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="/check" className="bg-green text-cream font-semibold px-6 py-3 rounded-full no-underline">Check something now — free</a>
            <a href="#peace-of-mind" className="border-2 border-green text-green font-semibold px-6 py-3 rounded-full no-underline">Protect my family · £9.99/mo</a>
          </div>
          <p className="mt-4 text-sm text-green-soft">No jargon · No judgement · Reviewed by a real person in Northampton</p>
        </div>
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

      {/* PRICING */}
      <section id="peace-of-mind" className="bg-cream-2 py-14">
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
                <li>✓ Unlimited scam checks for your whole household</li>
                <li>✓ Priority review — members go to the front of the queue</li>
                <li>✓ Family Safe Word set up with you, step by step</li>
                <li>✓ A real person to call before you act on anything</li>
                <li>✓ Cancel any time</li>
              </ul>
              <a href={PAYMENT_LINK} className="inline-block bg-gold text-green-deep font-semibold px-5 py-2.5 rounded-full no-underline">Join Peace of Mind</a>
              <p className="text-xs mt-3 text-cream/70">The most caring gift you can set up for your parents.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SAFE WORD */}
      <section className="max-w-3xl mx-auto px-5 py-14 text-center">
        <h2 className="text-3xl font-bold">The Family Safe Word</h2>
        <p className="text-lg text-ink/80">
          A voice on the phone that sounds exactly like your son or granddaughter, asking for urgent help,
          is today's most convincing scam. The defence is beautifully simple: a code word only your family
          knows, agreed in advance, asked for on any unexpected call. Every Peace of Mind member gets theirs
          set up with Kieran — it takes ten minutes, and it works.
        </p>
      </section>

      {/* WHO */}
      <section className="bg-cream-2 py-14">
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
        <div className="max-w-5xl mx-auto px-5 py-8 flex flex-wrap justify-between gap-4">
          <span className="font-display text-cream text-lg">Second Look <span className="text-gold">Protect</span></span>
          <span>
            📞 <a href="tel:07563887804" className="text-cream/90">07563 887804</a> · hello@learnaifast.co.uk ·
            part of <a href="https://www.learnaifast.co.uk" className="text-cream/90">Learn AI Fast</a> · © 2026
          </span>
        </div>
      </footer>
    </div>
  );
}
