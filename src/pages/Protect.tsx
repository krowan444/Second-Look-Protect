import { Page } from "../components/Layout";
import { SITE } from "../lib/site";
import { track, EVENTS } from "../lib/analytics";
import { usePageMeta } from "../lib/meta";

const WHAT_IT_DOES = [
  [
    "📩",
    "You send us the thing that's worrying you",
    "A text, an email, a letter, a website, or a description of a phone call. Forward it, paste it, or photograph it — whatever's easiest on whatever device you're holding.",
  ],
  [
    "🔍",
    "We examine it properly",
    "We read the wording, follow where the links actually go, check the phone numbers and sender addresses, and compare it against scams already being reported across the UK.",
  ],
  [
    "👤",
    "Kieran checks the answer himself",
    "No report is ever sent automatically. A real person reviews every single one before it reaches you — because being told the wrong thing about your money is worse than being told nothing.",
  ],
  [
    "✅",
    "You get a straight answer",
    "In plain English: is it a scam, why we think so, and exactly what to do next. Usually the same day, often within a couple of hours.",
  ],
];

const BENEFITS = [
  ["Certainty instead of second-guessing", "Stop staring at a message wondering. You get a clear verdict from someone who checks these all day."],
  ["No jargon, ever", "Everything is explained the way you'd explain it to a friend. Nothing technical, nothing patronising."],
  ["Nobody makes you feel silly", "The people who get caught aren't foolish — they're unfamiliar. Asking is the sensible thing, and we treat it that way."],
  ["A real person, not a helpline queue", "You're not on hold, and you're not talking to a robot. You're talking to Kieran."],
  ["Your details stay yours", "What you send is used only to check the message. Never shared, never sold, deleted whenever you ask."],
  ["It works before the damage", "The whole point is catching it in the gap between 'this feels odd' and 'I've clicked it'."],
];

const FOR_YOU_IF = [
  "A message says you owe money, missed a delivery, or your account is suspended",
  "Someone rang claiming to be your bank, HMRC, or a familiar voice asking for urgent help",
  "A website or advert looks too cheap, too urgent, or just slightly wrong",
  "You've been asked to move money to a 'safe account'",
  "You're worried about a parent or grandparent and want somewhere they can turn",
  "You've already clicked or paid, and need to know what to do right now",
];

export default function Protect() {
  usePageMeta(
    "What is Second Look Protect? | A calm second opinion before you act",
    "Second Look Protect checks any suspicious text, email, call, letter or website and tells you in plain English whether it's a scam and what to do next. Reviewed by a real person. First check free."
  );

  return (
    <Page>
      {/* HERO */}
      <section className="bg-cream-2 border-b border-gold/15">
        <div className="max-w-3xl mx-auto px-5 py-14 md:py-20 text-center">
          <p className="uppercase tracking-widest text-gold font-bold text-xs mb-4 mt-0">
            Independent · UK-based · Human-verified
          </p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight m-0">
            What is <span className="text-gold italic">Second Look Protect</span>?
          </h1>
          <p className="mt-6 text-lg text-ink/80">
            It's somewhere to send anything that feels off — before you click it, reply to it, or
            pay it. You send us the message. We check it properly. You get a clear, plain-English
            answer from a real person, usually the same day.
          </p>
          <p className="mt-4 text-lg text-ink/80">
            That's the whole idea. No app to learn, no login, no jargon, and no one making you feel
            silly for asking.
          </p>
          <div className="mt-8">
            <a
              href="/check"
              onClick={() => track(EVENTS.startCheck, { from: "protect_hero" })}
              className="inline-block bg-green text-cream font-semibold px-7 py-3.5 rounded-full no-underline text-lg"
            >
              Try your first check free
            </a>
            <span className="block text-xs text-green-soft mt-2 font-semibold">
              takes about 60 seconds · no card needed
            </span>
          </div>
        </div>
      </section>

      {/* WHY IT EXISTS */}
      <section className="bg-green text-cream-2">
        <div className="max-w-3xl mx-auto px-5 py-14 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-cream mt-0">Why it needed to exist</h2>
          <p className="text-lg text-cream/90">
            The old advice was "look for the spelling mistakes". That advice is dead. AI now writes
            scam messages in perfect English, clones a familiar voice from three seconds of audio,
            and builds fake bank websites that look identical to the real one.
          </p>
          <p className="text-lg text-cream/90">
            Careful, intelligent people are being caught every day — not because they were careless,
            but because the fakes genuinely are that convincing now.
            <strong className="text-gold"> When you can't tell by looking, you need a second look.</strong>
          </p>
        </div>
      </section>

      {/* WHAT IT DOES */}
      <section className="max-w-5xl mx-auto px-5 py-16">
        <h2 className="text-3xl md:text-4xl text-center font-bold mt-0">What actually happens</h2>
        <p className="text-center text-ink/70 mt-3">Four steps. You only do the first one.</p>
        <div className="grid md:grid-cols-2 gap-5 mt-10">
          {WHAT_IT_DOES.map(([icon, h, t]) => (
            <div key={h} className="bg-white border border-gold/20 rounded-2xl p-6 shadow-sm">
              <div className="text-3xl">{icon}</div>
              <h3 className="text-lg font-bold mt-3 mb-2">{h}</h3>
              <p className="text-ink/80 m-0 text-[15px]">{t}</p>
            </div>
          ))}
        </div>
      </section>

      {/* BENEFITS */}
      <section className="bg-cream-2 py-16">
        <div className="max-w-5xl mx-auto px-5">
          <h2 className="text-3xl md:text-4xl text-center font-bold mt-0">What you get out of it</h2>
          <div className="grid md:grid-cols-2 gap-5 mt-10">
            {BENEFITS.map(([h, t]) => (
              <div key={h} className="bg-white border border-gold/20 rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-bold mt-0 mb-1.5">✓ {h}</h3>
                <p className="text-ink/80 m-0 text-[15px]">{t}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="max-w-3xl mx-auto px-5 py-16">
        <h2 className="text-3xl md:text-4xl text-center font-bold mt-0">Send it to us if…</h2>
        <ul className="list-none p-0 mt-8 space-y-3">
          {FOR_YOU_IF.map((t) => (
            <li key={t} className="flex gap-3 bg-white border border-gold/20 rounded-xl px-5 py-4 shadow-sm">
              <span className="text-gold font-bold shrink-0">▸</span>
              <span className="text-ink/80">{t}</span>
            </li>
          ))}
        </ul>
        <p className="text-center text-ink/70 mt-8 mb-0">
          And if it turns out to be nothing at all? That's the best possible outcome — and exactly
          why it was worth asking.
        </p>
      </section>

      {/* PRICING */}
      <section className="bg-cream-2 py-16">
        <div className="max-w-3xl mx-auto px-5">
          <h2 className="text-3xl md:text-4xl text-center font-bold mt-0">What it costs</h2>
          <div className="grid md:grid-cols-2 gap-6 mt-10">
            <div className="bg-white border border-gold/20 rounded-2xl p-7 shadow-sm text-center flex flex-col">
              <h3 className="text-xl font-bold mt-0">Your first check</h3>
              <div className="font-display text-4xl font-bold text-green">Free</div>
              <p className="text-ink/80 flex-1">
                Send the message worrying you right now and see exactly how it works. No card, no
                account, no catch.
              </p>
              <a
                href="/check"
                onClick={() => track(EVENTS.startCheck, { from: "protect_pricing" })}
                className="inline-block border-2 border-green text-green font-semibold px-5 py-2.5 rounded-full no-underline"
              >
                Send it over
              </a>
            </div>
            <div className="bg-green text-cream rounded-2xl p-7 shadow-md text-center flex flex-col">
              <h3 className="text-xl font-bold mt-0 text-cream">Peace of Mind</h3>
              <div className="font-display text-4xl font-bold text-gold">
                {SITE.membershipPrice}
                <span className="text-lg">/month</span>
              </div>
              <ul className="text-left text-cream/90 text-sm space-y-2 my-4 list-none p-0 flex-1">
                <li>✓ Unlimited checks for your whole household</li>
                <li>✓ Priority review — straight to the front of the queue</li>
                <li>✓ Your Family Safe Word set up with Kieran</li>
                <li>✓ Cancel any time</li>
              </ul>
              <a
                href={SITE.paymentLink}
                onClick={() => track(EVENTS.clickMembership, { from: "protect_pricing" })}
                className="inline-block bg-gold text-green-deep font-semibold px-5 py-2.5 rounded-full no-underline"
              >
                Join Peace of Mind
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA + BACK */}
      <section className="py-16">
        <div className="max-w-2xl mx-auto px-5 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mt-0">Got something worrying you now?</h2>
          <p className="text-lg text-ink/80">
            Don't sit with it, and don't act on it. Send it over and you'll have a straight answer
            today — free, and from a real person.
          </p>
          <div className="mt-6">
            <a
              href="/check"
              onClick={() => track(EVENTS.startCheck, { from: "protect_footer" })}
              className="inline-block bg-gold hover:bg-gold-soft text-green-deep font-semibold px-8 py-4 rounded-full no-underline text-lg transition-colors"
            >
              Check it free — right now
            </a>
          </div>
          <p className="text-sm text-green-soft mt-4">
            Or call {SITE.phoneDisplay} · email{" "}
            <a href={`mailto:${SITE.email}`} className="text-green font-semibold break-all">
              {SITE.email}
            </a>
          </p>
          <p className="mt-8 mb-0">
            <a href="/" className="text-green font-semibold no-underline">
              ← Back to the main page
            </a>
          </p>
        </div>
      </section>
    </Page>
  );
}
