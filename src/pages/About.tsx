import { Logo } from "./Home";

export default function About() {
  return (
    <div>
      {/* NAV */}
      <header className="bg-white/90 backdrop-blur border-b border-green/10 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-5 py-3">
          <a href="/" className="no-underline flex items-center gap-2.5">
            <Logo size={36} />
            <span>
              <span className="font-display font-bold text-xl text-green">Second Look <em className="text-gold not-italic">Protect</em></span>
              <span className="block text-[11px] font-semibold text-green-soft">A calm second opinion before you act</span>
            </span>
          </a>
          <a href="/check" className="bg-gold hover:bg-gold-soft text-green-deep font-semibold text-sm px-4 py-2 rounded-full no-underline">
            Check a scam
          </a>
        </div>
      </header>

      {/* STORY */}
      <section className="bg-cream-2">
        <div className="max-w-5xl mx-auto px-5 py-14 md:py-20 grid md:grid-cols-5 gap-10 items-start">
          <div className="md:col-span-2">
            <img
              src="/about-kieran.jpg"
              alt="Kieran, founder of Second Look Protect"
              className="w-full rounded-2xl border border-gold/20 shadow-md"
            />
            <p className="text-sm text-green-soft text-center mt-3 mb-0">Kieran · Northampton</p>
          </div>
          <div className="md:col-span-3">
            <p className="uppercase tracking-widest text-gold font-bold text-xs mt-0 mb-3">About Second Look Protect</p>
            <h1 className="text-3xl md:text-4xl font-bold mt-0">Hello, I'm Kieran.</h1>
            <p className="text-lg text-ink/80">
              I started Second Look Protect because I kept hearing the same story, again and again.
              A friend's mum talked into moving her savings by a "bank" that never was. A neighbour's
              dad paying a "delivery fee" that led to his card being emptied. Each time, the person
              wasn't careless — the scam was simply that convincing. And I was hearing it more
              and more often.
            </p>
            <p className="text-lg text-ink/80">
              There's a reason for that. AI has handed scammers tools they could only dream of a few
              years ago. The clumsy, badly-spelled scam email is gone — today's messages are written
              in perfect English, voices can be cloned from three seconds of audio, and fake videos
              can look like the real thing. The old advice — "look for the spelling mistakes" — simply
              doesn't work any more. Scams now fool careful, intelligent people every single day.
            </p>
            <p className="text-lg text-ink/80">
              I work with AI for a living, so I can see exactly how these tricks are made — and that
              felt like something worth putting to good use. I wanted the people around me, and people
              like them everywhere, to have somewhere simple to turn <em>before</em> any damage is done.
              Not a helpline queue. Not another app to learn. Just a real person who'll take a calm
              second look and tell you, in plain English, what's going on and what to do next.
            </p>
            <p className="text-lg text-ink/80">
              That's Second Look Protect. No jargon, no judgement — because the people who get scammed
              aren't silly, they're unfamiliar. A second look changes that.
            </p>
            <p className="text-lg text-ink/80 font-semibold text-green">
              If something doesn't feel right, send it over. That's exactly what I'm here for.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="/check" className="bg-green text-cream font-semibold px-6 py-3 rounded-full no-underline">
                Get a free Second Look
              </a>
              <a href="/#peace-of-mind" className="border-2 border-green text-green font-semibold px-6 py-3 rounded-full no-underline">
                Peace of Mind · £9.99/mo
              </a>
            </div>
          </div>
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
          <p className="text-cream/60 text-xs mt-4 mb-0">
            Your details and anything you send us are kept private — never shared or sold. Reports are guidance,
            not financial or legal advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
