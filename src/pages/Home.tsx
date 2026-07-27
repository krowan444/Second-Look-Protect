import { Page } from "../components/Layout";
import { SITE } from "../lib/site";
import { track, EVENTS } from "../lib/analytics";
import { usePageMeta } from "../lib/meta";

export { Logo } from "../components/Layout";

export default function Home() {
  usePageMeta(
    "Second Look Protect — Is it a scam? Get a straight answer, free",
    "Not sure if that text, email or call is a scam? Send it to Second Look Protect and a real person, backed by AI analysis, gives you a clear answer — first check free."
  );
  return (
    <Page>
      {/* ── HERO ───────────────────────────────────────────────────── */}
      <section className="relative bg-cream-2 overflow-hidden">
        <div
          className="hidden md:block absolute inset-0 bg-cover"
          style={{ backgroundImage: "url(/hero.jpg)", backgroundPosition: "right center" }}
          aria-hidden="true"
        />
        <div
          className="hidden md:block absolute inset-0 bg-gradient-to-r from-cream-2 from-25% via-cream-2/80 via-45% to-transparent to-70%"
          aria-hidden="true"
        />

        <div className="relative max-w-5xl mx-auto px-5 pt-8 pb-14 md:pt-16 md:pb-24">
          <div className="md:max-w-[50%] text-center md:text-left">
            <p className="uppercase tracking-widest text-gold font-bold text-xs mb-4 mt-0">
              Independent · UK-based · Checked by a real person
            </p>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight m-0">
              Not sure if it's real? <span className="text-gold italic">Don't guess.</span>
            </h1>
            <p className="mt-5 text-lg text-ink/80">
              Send us the text, email, call or letter that's worrying you. You'll get a clear answer
              in plain English — <strong>scam or safe, why, and exactly what to do next</strong> —
              from a real person, usually the same day.
            </p>
            <div className="mt-8 flex flex-wrap justify-center md:justify-start items-center gap-3">
              <span className="text-center">
                <a
                  href="/check"
                  onClick={() => track(EVENTS.startCheck, { from: "hero" })}
                  className="inline-block bg-green hover:bg-green-deep text-cream font-semibold px-8 py-4 rounded-full no-underline text-lg transition-colors"
                >
                  Check it free — right now
                </a>
                <span className="block text-xs text-green-soft mt-2 font-semibold">
                  Takes 60 seconds · No card · No account
                </span>
              </span>
            </div>
            <p className="mt-6 text-sm text-green-soft font-semibold">
              No judgement. No pressure. Just a straight answer.
            </p>
          </div>
        </div>

        <img
          src="/hero.jpg"
          alt="A woman smiling at her laptop as a Second Look Protect report tells her a message is safe"
          className="md:hidden w-full block"
        />
      </section>

      {/* ── WHY IT'S DIFFERENT NOW ─────────────────────────────────── */}
      <section className="bg-green text-cream-2">
        <div className="max-w-5xl mx-auto px-5 py-12 grid sm:grid-cols-3 gap-6 text-center">
          {[
            ["3 seconds", "of audio is all it takes to clone a loved one's voice"],
            ["37.5%", "how often people spot a cloned voice — worse than a coin flip"],
            ["£576m", "lost in the UK last year to fraud that talks victims into paying"],
          ].map(([n, t]) => (
            <div key={n}>
              <div className="font-display text-4xl text-gold font-bold">{n}</div>
              <div className="text-sm mt-1 opacity-90">{t}</div>
            </div>
          ))}
          <p className="sm:col-span-3 text-base mt-2 opacity-95 max-w-2xl mx-auto">
            Scammers now write perfect English and sound exactly like family.
            <strong className="text-gold"> The old warning signs are gone — a second look is the new one.</strong>
          </p>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 py-16">
        <h2 className="text-3xl md:text-4xl text-center font-bold mt-0">Three steps. About two minutes.</h2>
        <div className="grid md:grid-cols-3 gap-6 mt-10">
          {[
            [
              "1. Send it over",
              "Forward the message, paste the text, or snap a photo of the letter. Any device, no account, nothing to install.",
            ],
            [
              "2. We take a second look",
              "Our AI reads the wording, links and phone numbers and checks them against known scam reports — then Kieran personally reviews every single report before it goes anywhere.",
            ],
            [
              "3. You get a straight answer",
              "A plain-English report by email: scam or safe, why we think so, and exactly what to do next. Usually the same day.",
            ],
          ].map(([h, t]) => (
            <div key={h} className="bg-white border border-gold/20 rounded-2xl p-6 shadow-sm">
              <h3 className="text-xl font-bold mt-0">{h}</h3>
              <p className="text-ink/80 m-0">{t}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <a
            href="/check"
            onClick={() => track(EVENTS.startCheck, { from: "how_it_works" })}
            className="inline-block bg-gold hover:bg-gold-soft text-green-deep font-semibold px-7 py-3.5 rounded-full no-underline text-lg transition-colors"
          >
            Start my free check
          </a>
        </div>
      </section>

      {/* ── SOCIAL PROOF ───────────────────────────────────────────── */}
      <section className="bg-cream-2 py-16">
        <div className="max-w-5xl mx-auto px-5">
          <h2 className="text-3xl md:text-4xl text-center font-bold mt-0">This week's second looks</h2>
          <p className="text-center text-ink/70 mt-3">Real checks from real people, anonymised.</p>
          <div className="grid md:grid-cols-3 gap-6 mt-9">
            {[
              [
                "🚨 Likely scam",
                "“Missed delivery” text asking for a small redelivery fee",
                "The link led to a copycat site built to harvest card details. We said: delete it, and never pay a fee from a text.",
              ],
              [
                "🚨 Likely scam",
                "A call from “the bank's fraud team” urging a transfer to a safe account",
                "Banks never ask you to move money. We said: hang up, wait five minutes, then call the number on the back of your card.",
              ],
              [
                "✅ Safe",
                "A text from a GP surgery about a health check",
                "Genuine sender, no links asking for details. Our member replied with total confidence — that's the whole point.",
              ],
            ].map(([tag, h, t]) => (
              <div key={h} className="bg-white border border-gold/20 rounded-2xl p-6 shadow-sm">
                <div className="text-sm font-bold text-green-soft">{tag}</div>
                <h3 className="text-lg font-bold mt-1">{h}</h3>
                <p className="text-ink/80 m-0 text-sm">{t}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-ink/70 mt-8 mb-0">
            Most checks come back safe — and knowing for certain is exactly why people send them.
          </p>
        </div>
      </section>

      {/* ── PRICING ────────────────────────────────────────────────── */}
      <section id="peace-of-mind" className="py-16">
        <div className="max-w-5xl mx-auto px-5">
          <h2 className="text-3xl md:text-4xl text-center font-bold mt-0">Simple, honest pricing</h2>
          <p className="text-center text-ink/70 mt-3">Start free. Only pay if you want it for good.</p>
          <div className="grid md:grid-cols-2 gap-6 mt-10 max-w-3xl mx-auto">
            <div className="bg-white border border-gold/20 rounded-2xl p-7 shadow-sm text-center flex flex-col">
              <h3 className="text-xl font-bold mt-0">Your first check</h3>
              <div className="font-display text-5xl font-bold text-green">Free</div>
              <p className="text-ink/80 flex-1">
                Send the message that's worrying you right now and see exactly how it works. No card,
                no account, no catch.
              </p>
              <a
                href="/check"
                onClick={() => track(EVENTS.startCheck, { from: "pricing" })}
                className="inline-block border-2 border-green text-green font-semibold px-5 py-3 rounded-full no-underline hover:bg-green hover:text-cream transition-colors"
              >
                Send it over
              </a>
            </div>
            <div className="bg-green text-cream rounded-2xl p-7 shadow-md text-center flex flex-col">
              <h3 className="text-xl font-bold mt-0 text-cream">Peace of Mind</h3>
              <div className="font-display text-5xl font-bold text-gold">
                {SITE.membershipPrice}
                <span className="text-lg">/month</span>
              </div>
              <ul className="text-left text-cream/90 text-sm space-y-2 my-5 list-none p-0 flex-1">
                <li>✓ Unlimited checks for your whole household</li>
                <li>✓ A real person reviewing every one before you act</li>
                <li>✓ Priority review — members go to the front of the queue</li>
                <li>✓ Your Family Safe Word set up with Kieran, step by step</li>
                <li>✓ Cancel any time, in under a minute</li>
              </ul>
              <a
                href={SITE.paymentLink}
                onClick={() => track(EVENTS.clickMembership, { from: "pricing" })}
                className="inline-block bg-gold hover:bg-gold-soft text-green-deep font-semibold px-5 py-3 rounded-full no-underline transition-colors"
              >
                Join Peace of Mind
              </a>
              <p className="text-xs text-cream/70 mt-3 mb-0">Less than a coffee a week</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOR FAMILIES ───────────────────────────────────────────── */}
      <section className="bg-cream-2 py-16">
        <div className="max-w-3xl mx-auto px-5 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mt-0">Worried about Mum or Dad?</h2>
          <p className="text-lg text-ink/80">
            You can't check every message that reaches your parents — but we can. Set up Peace of
            Mind for them and they get a friendly expert to ask <em>before</em> they click, pay or
            reply, without ever feeling watched over or judged. You get to stop bracing every time
            the phone rings.
          </p>
          <a
            href={SITE.paymentLink}
            onClick={() => track(EVENTS.clickMembership, { from: "families" })}
            className="inline-block bg-green hover:bg-green-deep text-cream font-semibold px-7 py-3.5 rounded-full no-underline mt-3 transition-colors"
          >
            Set it up for someone you love
          </a>
          <p className="text-sm text-green-soft mt-4 mb-0">
            {SITE.membershipPrice} a month · Cancel any time · The most caring gift there is
          </p>
        </div>
      </section>

      {/* ── SAFE WORD ──────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-5 py-16 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mt-0">One word beats a cloned voice</h2>
        <p className="text-lg text-ink/80">
          A voice on the phone that sounds exactly like your son or your granddaughter, asking for
          urgent help, is today's most convincing scam. The defence is beautifully simple: a code
          word only your family knows, agreed in advance, asked for on any unexpected call. Every
          Peace of Mind member gets theirs set up with Kieran — it takes ten minutes, and it works.
        </p>
      </section>

      {/* ── ONE-TO-ONE SESSION ─────────────────────────────────────── */}
      <section id="safety-session" className="pb-16">
        <div className="max-w-5xl mx-auto px-5">
          <div className="bg-green text-cream rounded-2xl overflow-hidden shadow-md grid md:grid-cols-2">
            <img
              src="/session-kieran.jpg"
              alt="Kieran teaching an AI scam safety session one-to-one at a laptop"
              className="w-full h-56 md:h-full object-cover"
            />
            <div className="p-8 md:p-10">
              <p className="uppercase tracking-widest text-gold font-bold text-xs mt-0 mb-3">
                One-to-one with Kieran · 60 minutes
              </p>
              <h2 className="text-3xl font-bold text-cream mt-0">AI Scam Safety Session</h2>
              <p className="text-cream/90 text-lg">
                An hour that makes scams stop working on you. How they use AI, what to look for, and
                exactly what to do before you reply, click or pay — calmly explained, no jargon, no
                scare tactics.
              </p>
              <ul className="text-left text-cream/90 space-y-2 my-5 list-none p-0">
                <li>✓ Spot cloned voices and deepfake video</li>
                <li>✓ Verify any urgent message safely, step by step</li>
                <li>✓ Leave with your Family Safe Word Plan done</li>
              </ul>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="font-display text-4xl font-bold text-gold">{SITE.sessionPrice}</span>
                <a
                  href="/session"
                  onClick={() => track(EVENTS.viewSession, { from: "home" })}
                  className="inline-block bg-gold hover:bg-gold-soft text-green-deep font-semibold px-6 py-3 rounded-full no-underline transition-colors"
                >
                  See times & book
                </a>
              </div>
              <p className="text-sm mt-4 mb-0 text-cream/70">
                Pick your slot and pay right here on the site · A lovely gift for parents and grandparents
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── GROUP TALKS ────────────────────────────────────────────── */}
      <section className="bg-cream-2 py-16">
        <div className="max-w-4xl mx-auto px-5 text-center">
          <p className="uppercase tracking-widest text-gold font-bold text-xs mb-3 mt-0">
            For charities, community groups & business
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mt-0">
            Bring the second look to your whole group
          </h2>
          <p className="text-lg text-ink/80">
            I speak to U3As, church groups, housing associations, charities and corporate teams
            across the UK — showing real AI scams, cloning a voice live in the room, and leaving
            everyone with defences they'll actually use. Warm, plain-English, and never frightening.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-7">
            <a
              href="/talks"
              onClick={() => track(EVENTS.viewTalks, { from: "home" })}
              className="inline-block bg-green hover:bg-green-deep text-cream font-semibold px-7 py-3.5 rounded-full no-underline text-lg transition-colors"
            >
              See the talks
            </a>
            <a
              href="/talks/enquire"
              onClick={() => track(EVENTS.startTalkEnquiry, { from: "home" })}
              className="inline-block border-2 border-green text-green font-semibold px-6 py-3.5 rounded-full no-underline hover:bg-green hover:text-cream transition-colors"
            >
              Ask about a talk
            </a>
          </div>
          <p className="text-sm text-green-soft mt-4 mb-0">
            Charity and community rates available · In person or online
          </p>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-5">
          <h2 className="text-3xl md:text-4xl text-center font-bold mt-0">Questions people ask us</h2>
          <div className="mt-9 space-y-3">
            {[
              [
                "Is my information private?",
                "Yes. What you send us is used only to check the message, and is never shared or sold. You can ask us to delete it at any time.",
              ],
              [
                "What if it turns out to be nothing?",
                "That's the best outcome there is. Most checks come back safe — and knowing for certain is exactly what you're here for. Nobody will ever make you feel silly for asking.",
              ],
              [
                "Do I need to download or install anything?",
                "No. There's nothing to install and nothing technical to learn. You send us the message and we do the rest.",
              ],
              [
                "How quickly will I hear back?",
                "Usually the same day, often within a couple of hours. Peace of Mind members go to the front of the queue.",
              ],
              [
                "What if I've already clicked or paid?",
                "Send it over anyway — straight away. Your report will tell you exactly what to do next, and acting fast makes a real difference.",
              ],
              [
                "What does it cost?",
                `Your first check is completely free, with no card details. After that, Peace of Mind is ${SITE.membershipPrice} a month for unlimited checks for your whole household — cancel any time.`,
              ],
              [
                "I'm a Peace of Mind member — how do you know it's me?",
                "There's no login and nothing to remember. Just use the same email address you joined with, and we recognise you automatically.",
              ],
              [
                "How do I cancel?",
                `Any time, in under a minute, with no phone call needed. Use the "Manage or cancel your plan" link at the bottom of this page. Prefer to just ask? Email ${SITE.email} and we'll sort it the same day.`,
              ],
            ].map(([q, a]) => (
              <details key={q} className="bg-white border border-gold/20 rounded-2xl px-6 py-4 shadow-sm">
                <summary className="font-bold text-green cursor-pointer">{q}</summary>
                <p className="text-ink/80 mt-2 mb-0">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHO ────────────────────────────────────────────────────── */}
      <section className="bg-cream-2 py-16">
        <div className="max-w-3xl mx-auto px-5 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mt-0">A real person, not a helpline</h2>
          <p className="text-lg text-ink/80">
            Second Look Protect is run by Kieran — the friendly AI guide behind{" "}
            <a href={SITE.learnAiFast} className="text-green font-semibold">Learn AI Fast</a> in
            Northampton. Every report is personally reviewed before it reaches you. The people who
            get scammed aren't silly — they're unfamiliar. A second look changes that.
          </p>
          <a
            href="/about"
            className="inline-block border-2 border-green text-green font-semibold px-6 py-3 rounded-full no-underline hover:bg-green hover:text-cream transition-colors mt-2"
          >
            More about Kieran
          </a>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────────── */}
      <section className="bg-green text-cream-2">
        <div className="max-w-2xl mx-auto px-5 py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-cream mt-0">
            Got something worrying you right now?
          </h2>
          <p className="text-lg text-cream/90">
            Don't sit with it and don't act on it. Send it over and you'll have a straight answer
            today — free, and from a real person.
          </p>
          <a
            href="/check"
            onClick={() => track(EVENTS.startCheck, { from: "final_cta" })}
            className="inline-block bg-gold hover:bg-gold-soft text-green-deep font-semibold px-8 py-4 rounded-full no-underline text-lg mt-3 transition-colors"
          >
            Check it free — right now
          </a>
          <p className="text-sm text-cream/70 mt-4 mb-0">Takes 60 seconds · No card · No account</p>
        </div>
      </section>
    </Page>
  );
}
