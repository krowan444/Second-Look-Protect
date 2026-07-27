import { useEffect } from "react";
import { Page } from "../components/Layout";
import CalEmbed from "../components/CalEmbed";
import { SITE } from "../lib/site";
import { track, EVENTS } from "../lib/analytics";
import { usePageMeta } from "../lib/meta";

const INCLUDED = [
  ["Spot a cloned voice in seconds", "The exact questions to ask when a familiar voice asks for something urgent — and why hanging up is always safe."],
  ["Check anything before you act", "A simple three-step habit for texts, emails and calls that works even when the message looks perfect."],
  ["Your Family Safe Word Plan", "We set up a code word with you there and then, and agree who else needs to know it."],
  ["Lock down the obvious gaps", "Two-factor authentication, bank alerts and the settings that actually matter — done with you, not explained at you."],
  ["Written summary afterwards", "A one-page reminder in plain English, so you don't have to remember any of it."],
];

export default function Session() {
  usePageMeta(
    "AI Scam Safety Session — 1-to-1 with Kieran | Second Look Protect",
    "A 60-minute one-to-one session that makes AI scams stop working on you. Spot cloned voices, verify urgent messages, and set up your Family Safe Word. £79.99, booked and paid online."
  );
  useEffect(() => {
    track(EVENTS.viewSession);
  }, []);

  return (
    <Page>
      {/* HERO */}
      <section className="bg-cream-2 border-b border-gold/15">
        <div className="max-w-5xl mx-auto px-5 py-12 md:py-16 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="uppercase tracking-widest text-gold font-bold text-xs mb-3 mt-0">
              AI Scam Safety Session · One-to-one with Kieran · 60 minutes
            </p>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight m-0">
              An hour that makes scams <span className="text-gold italic">stop working</span> on you.
            </h1>
            <p className="mt-4 text-base font-semibold text-green-soft mb-0">
              The AI Scam Safety Session · Zoom or in person around Northampton
            </p>
            <p className="mt-5 text-lg text-ink/80">
              Not a lecture and not a sales pitch — a calm, friendly hour where we go through the
              scams that are actually catching people right now, and set up the handful of defences
              that stop them. You'll leave knowing exactly what to do when something feels off.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <span className="font-display text-4xl font-bold text-green">{SITE.sessionPrice}</span>
              <a
                href="#book"
                onClick={() => track(EVENTS.bookSessionOpened, { from: "hero" })}
                className="inline-block bg-green text-cream font-semibold px-7 py-3.5 rounded-full no-underline text-lg"
              >
                Pick your time below ↓
              </a>
            </div>
            <p className="text-sm text-green-soft font-semibold mt-4 mb-0">
              Choose a slot and pay securely — all on this page, no account needed.
            </p>
          </div>
          <img
            src="/session-kieran.jpg"
            alt="Kieran teaching an AI scam safety session one-to-one at a laptop"
            className="w-full rounded-2xl border border-gold/20 shadow-md object-cover max-h-[420px]"
          />
        </div>
      </section>

      {/* WHAT'S INCLUDED */}
      <section className="max-w-5xl mx-auto px-5 py-14">
        <h2 className="text-3xl text-center font-bold mt-0">What we'll cover</h2>
        <p className="text-center text-ink/70 mt-2 max-w-2xl mx-auto">
          Everything is at your pace, in plain English. Ask anything — nobody has ever asked me a
          silly question, and you won't be the first.
        </p>
        <div className="grid md:grid-cols-2 gap-5 mt-9">
          {INCLUDED.map(([h, t]) => (
            <div key={h} className="bg-white border border-gold/20 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mt-0 mb-1.5">✓ {h}</h3>
              <p className="text-ink/80 m-0 text-[15px]">{t}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="bg-green text-cream-2">
        <div className="max-w-3xl mx-auto px-5 py-14 text-center">
          <h2 className="text-3xl font-bold text-cream mt-0">Booking it for someone else?</h2>
          <p className="text-lg text-cream/90">
            Most of these sessions are bought by sons and daughters for a parent, and it's one of
            the kindest things you can do. Book the slot in your own name and add theirs in the
            notes — I'll make sure they feel looked after, never lectured. Gift confirmations are
            available on request.
          </p>
        </div>
      </section>

      {/* BOOKING — the calendar and the card payment both live here */}
      <section id="book" className="max-w-4xl mx-auto px-5 py-14 scroll-mt-20">
        <h2 className="text-3xl text-center font-bold mt-0">Pick a time that suits you</h2>
        <p className="text-center text-ink/70 mt-2 mb-8">
          Choose a slot, pay securely by card, and you'll have a confirmation in your inbox within a
          minute. Need to move it later? One click in that email.
        </p>
        <CalEmbed calLink={SITE.sessionCalLink} namespace="session" minHeight={680} />
        <p className="text-center text-sm text-green-soft mt-6 mb-0">
          Secure card payment · Free rescheduling · Full refund if you cancel more than 24 hours ahead
        </p>
      </section>

      {/* FAQ */}
      <section className="bg-cream-2 py-14">
        <div className="max-w-3xl mx-auto px-5">
          <h2 className="text-3xl text-center font-bold mt-0">Before you book</h2>
          <div className="mt-8 space-y-3">
            {[
              ["Do I need to be good with computers?", "Not at all — most people who book aren't, and that's exactly the point. We go at whatever pace suits you and nothing gets skipped over."],
              ["What do I need to have ready?", "Just the device you use most. If it's a Zoom session, I'll send a link you click — there's nothing to install."],
              ["Can we do it in person?", "Yes, if you're in or around Northampton. Mention it in the booking notes and I'll confirm."],
              ["Can two of us join?", "Of course — couples and family pairs are very welcome at no extra cost. It often works better with two."],
              ["What if I need to change the time?", "Reschedule from your confirmation email any time. Cancel more than 24 hours ahead and you're refunded in full."],
            ].map(([q, a]) => (
              <details key={q} className="bg-white border border-gold/20 rounded-2xl px-6 py-4 shadow-sm">
                <summary className="font-bold text-green cursor-pointer">{q}</summary>
                <p className="text-ink/80 mt-2 mb-0">{a}</p>
              </details>
            ))}
          </div>
          <div className="text-center mt-9">
            <p className="text-ink/70">Still deciding? Try a free scam check first — no card, no catch.</p>
            <a
              href="/check"
              className="inline-block border-2 border-green text-green font-semibold px-6 py-3 rounded-full no-underline"
            >
              Check something free
            </a>
          </div>
        </div>
      </section>
    </Page>
  );
}
