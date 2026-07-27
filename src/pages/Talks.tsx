import { useEffect } from "react";
import { Page } from "../components/Layout";
import { SITE } from "../lib/site";
import { track, EVENTS } from "../lib/analytics";
import { usePageMeta } from "../lib/meta";

function CTA({ where, label = "Ask about a talk", variant = "gold" }: { where: string; label?: string; variant?: "gold" | "green" | "outline" }) {
  const cls =
    variant === "gold"
      ? "bg-gold hover:bg-gold-soft text-green-deep"
      : variant === "green"
      ? "bg-green hover:bg-green-deep text-cream"
      : "border-2 border-cream text-cream hover:bg-cream hover:text-green";
  return (
    <a
      href="/talks/enquire"
      onClick={() => track(EVENTS.startTalkEnquiry, { from: where })}
      className={`inline-block font-semibold px-7 py-3.5 rounded-full no-underline text-lg transition-colors ${cls}`}
    >
      {label}
    </a>
  );
}

const AUDIENCES = [
  {
    tag: "Charities, community groups & clubs",
    icon: "🤝",
    head: "For the people who trust you already",
    body:
      "U3A groups, WIs, church and faith groups, residents' associations, befriending charities, sheltered housing, libraries and Age UK branches. Your members will believe a warning that comes from you long before they'll believe one from a bank leaflet — and that trust is exactly what makes this work.",
    points: [
      "Warm, jargon-free and genuinely enjoyable — not a fear session",
      "Works for 12 people in a village hall or 200 in a theatre",
      "Charity and community rates, because budgets are real",
      "Printed take-home cards so nobody has to remember anything",
    ],
  },
  {
    tag: "Businesses & corporate teams",
    icon: "🏢",
    head: "Your staff are the attack surface",
    body:
      "Cloned voices are now used to authorise payments, and AI-written phishing sails past the training your team did three years ago. One convincing call to someone in finance is all it takes. This session shows your people what the current attacks actually look and sound like — and gives them permission to slow down and verify.",
    points: [
      "Live examples of AI voice cloning and deepfake video",
      "The verification habits that stop invoice and CEO fraud",
      "Tailored to your sector and the way your team really works",
      "Lunch-and-learn, all-staff briefing, or a leadership session",
    ],
  },
];

const COVERED = [
  ["What AI actually changed", "Why the old advice — bad spelling, odd links, 'you'll spot it' — stopped working, and what replaced it."],
  ["Cloned voices, live", "Hearing a voice clone in the room is the moment it lands. Three seconds of audio is all it takes."],
  ["The scams working right now", "Bank impersonation, delivery texts, invoice fraud, romance and investment scams — current, UK, real."],
  ["The pause that beats all of them", "One habit, easy to remember, that works on any message, any call, any channel."],
  ["Safe words and verification", "How to agree a family or team code word, and how to check an urgent request without causing offence."],
  ["What to do if it's already happened", "The first hour matters most. Who to call, in what order, and how to stop the shame that keeps people quiet."],
];

const FORMATS = [
  ["Guest slot", "20–30 minutes", "Drops into an existing meeting or AGM. The essentials, a live demo, and time for questions."],
  ["The full talk", "45–60 minutes", "The most popular choice. Everything covered above, plus proper Q&A and take-home cards.", true],
  ["Workshop", "Half day", "Talk plus hands-on: we set up safe words, check settings and run scenarios together in small groups."],
];

export default function Talks() {
  usePageMeta(
    "AI Scam Safety Talks for Charities, Groups & Business | Second Look Protect",
    "Engaging AI scam safety talks for charities, community groups, U3As and corporate teams across the UK. Live voice-cloning demonstrations, plain English, charity rates available."
  );
  useEffect(() => {
    track(EVENTS.viewTalks);
  }, []);

  return (
    <Page>
      {/* HERO */}
      <section className="bg-green text-cream-2">
        <div className="max-w-5xl mx-auto px-5 py-16 md:py-20 text-center">
          <p className="uppercase tracking-widest text-gold font-bold text-xs mb-4 mt-0">
            AI Scam Safety Talks · Charities · Community groups · Business
          </p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight m-0 text-cream max-w-3xl mx-auto">
            One hour that stops your people <span className="text-gold italic">falling for it</span>.
          </h1>
          <p className="mt-6 text-lg text-cream/90 max-w-2xl mx-auto">
            AI has made scams sound like family and read like your bank. I come to your group,
            charity or workplace and show people exactly what's happening now — calmly, with live
            demonstrations, and with defences they'll actually use. No fear, no jargon, no slides
            full of statistics.
          </p>
          <div className="mt-9 flex flex-wrap justify-center items-center gap-4">
            <CTA where="hero" label="Ask about a talk" />
            <a href="#what" className="text-cream/90 font-semibold underline underline-offset-4">
              See what's covered
            </a>
          </div>
          <p className="text-sm text-cream/70 mt-5 mb-0">
            Tell me a bit about your group and I'll come back within one working day with dates and a
            straightforward price. No obligation.
          </p>
        </div>
      </section>

      {/* STAT BAND */}
      <section className="bg-cream-2 border-b border-gold/15">
        <div className="max-w-5xl mx-auto px-5 py-10 grid sm:grid-cols-3 gap-6 text-center">
          {[
            ["3 seconds", "of audio is enough to clone someone's voice convincingly"],
            ["37.5%", "how often people correctly spot a cloned voice — worse than guessing"],
            ["£576m", "lost in the UK last year to fraud that talks victims into paying"],
          ].map(([n, t]) => (
            <div key={n}>
              <div className="font-display text-4xl text-green font-bold">{n}</div>
              <div className="text-sm mt-1 text-ink/70">{t}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TWO AUDIENCES */}
      <section className="max-w-5xl mx-auto px-5 py-16">
        <h2 className="text-3xl md:text-4xl text-center font-bold mt-0">Built for your room</h2>
        <p className="text-center text-ink/70 mt-3 max-w-2xl mx-auto">
          The same core message, pitched completely differently depending on who's listening. Tell
          me which you are and the talk is shaped around it.
        </p>
        <div className="grid md:grid-cols-2 gap-6 mt-10">
          {AUDIENCES.map((a) => (
            <div key={a.tag} className="bg-white border border-gold/20 rounded-2xl p-7 shadow-sm flex flex-col">
              <div className="text-3xl">{a.icon}</div>
              <p className="uppercase tracking-wide text-gold font-bold text-[11px] mt-3 mb-1">{a.tag}</p>
              <h3 className="text-2xl font-bold mt-0 mb-3">{a.head}</h3>
              <p className="text-ink/80 text-[15px]">{a.body}</p>
              <ul className="list-none p-0 m-0 mt-2 space-y-2 text-[15px] flex-1">
                {a.points.map((p) => (
                  <li key={p} className="flex gap-2.5">
                    <span className="text-gold font-bold">✓</span>
                    <span className="text-ink/80">{p}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <CTA where={a.tag} label="Ask about a talk" variant="green" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* WHAT'S COVERED */}
      <section id="what" className="bg-cream-2 py-16 scroll-mt-20">
        <div className="max-w-5xl mx-auto px-5">
          <h2 className="text-3xl md:text-4xl text-center font-bold mt-0">What we cover</h2>
          <p className="text-center text-ink/70 mt-3">
            Current, UK-specific, and demonstrated live rather than described.
          </p>
          <div className="grid md:grid-cols-3 gap-5 mt-10">
            {COVERED.map(([h, t]) => (
              <div key={h} className="bg-white border border-gold/20 rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-bold mt-0 mb-2">{h}</h3>
                <p className="text-ink/80 m-0 text-[15px]">{t}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FORMATS */}
      <section className="max-w-5xl mx-auto px-5 py-16">
        <h2 className="text-3xl md:text-4xl text-center font-bold mt-0">Three ways to run it</h2>
        <p className="text-center text-ink/70 mt-3">
          In person across the Midlands and beyond, or online anywhere in the UK.
        </p>
        <div className="grid md:grid-cols-3 gap-5 mt-10">
          {FORMATS.map(([name, len, desc, featured]) => (
            <div
              key={name as string}
              className={`rounded-2xl p-7 shadow-sm border ${
                featured ? "bg-green text-cream border-green" : "bg-white border-gold/20"
              }`}
            >
              {featured && (
                <p className="uppercase tracking-wide text-gold font-bold text-[11px] mt-0 mb-2">
                  Most popular
                </p>
              )}
              <h3 className={`text-xl font-bold mt-0 mb-1 ${featured ? "text-cream" : ""}`}>{name}</h3>
              <p className={`font-semibold text-sm m-0 ${featured ? "text-gold" : "text-green-soft"}`}>{len}</p>
              <p className={`text-[15px] mt-3 mb-0 ${featured ? "text-cream/90" : "text-ink/80"}`}>{desc}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-ink/70 mt-8 max-w-2xl mx-auto">
          Every talk is quoted individually — charities and community groups pay a different rate to
          corporate bookings, and I'd rather give you an honest price for your situation than hide
          behind a menu. Tell me what you need and I'll be straight with you.
        </p>
        <div className="text-center mt-6">
          <CTA where="formats" label="Get a price for your group" />
        </div>
      </section>

      {/* WHY IT LANDS */}
      <section className="bg-green text-cream-2">
        <div className="max-w-3xl mx-auto px-5 py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-cream mt-0">Why people actually listen</h2>
          <p className="text-lg text-cream/90">
            Most scam talks make people feel stupid and frightened, so they switch off and nothing
            changes. Mine starts from the opposite place: the people who get caught aren't silly,
            they're unfamiliar — and unfamiliar is fixable in an hour.
          </p>
          <p className="text-lg text-cream/90">
            I'm Kieran. I run <a href={SITE.learnAiFast} className="text-gold">Learn AI Fast</a> in
            Northampton, teaching people who describe themselves as "hopeless with technology" until
            about twenty minutes in. Second Look Protect grew out of that work — real people sending
            me real messages to check, every week. The examples in your talk aren't from a textbook.
            They're from this month.
          </p>
          <div className="mt-8">
            <CTA where="why" label="Ask about a talk" variant="outline" />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-cream-2 py-16">
        <div className="max-w-3xl mx-auto px-5">
          <h2 className="text-3xl md:text-4xl text-center font-bold mt-0">Organisers usually ask</h2>
          <div className="mt-8 space-y-3">
            {[
              ["How much does it cost?", "It depends on the format, the size of the group and how far I'm travelling — and charities and community groups pay a lower rate than corporate bookings. Send an enquiry and you'll have a clear, itemised price back within one working day, with no obligation and no chasing."],
              ["We're a small group with almost no budget. Is it worth asking?", "Yes — please do ask. Some of the most worthwhile rooms I've spoken in had twelve people and a tea urn. I'd rather find a way to make it work than have your members find out the hard way."],
              ["How far will you travel?", "In person right across the Midlands, and further for larger bookings. Anywhere in the UK online, which also works well if your team is spread out."],
              ["What do you need on the day?", "A screen or projector if there's one available, and somewhere everyone can hear. That's genuinely it — I bring everything else, including the take-home cards."],
              ["Is it suitable for people with no tech confidence at all?", "That's the audience it was written for. There's nothing to install, nothing to follow along on, and no moment where anyone is asked to do something in front of the room."],
              ["Can you tailor it to our sector?", "Yes, and it works much better that way. Finance teams get invoice and payment fraud, housing associations get doorstep and benefits scams, schools get the parent-facing side. Tell me your world in the enquiry form."],
              ["Do you have insurance and a DBS check?", "Yes to both — certificates available on request, which councils, schools and housing providers usually need for their paperwork."],
            ].map(([q, a]) => (
              <details key={q} className="bg-white border border-gold/20 rounded-2xl px-6 py-4 shadow-sm">
                <summary className="font-bold text-green cursor-pointer">{q}</summary>
                <p className="text-ink/80 mt-2 mb-0">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-16">
        <div className="max-w-2xl mx-auto px-5 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mt-0">Let's get a date in</h2>
          <p className="text-lg text-ink/80">
            Two minutes to tell me about your group, and one working day to hear back with dates and
            a price. If it's not right for you, I'll say so — you won't be chased.
          </p>
          <div className="mt-6">
            <CTA where="footer" label="Ask about a talk" />
          </div>
          <p className="text-sm text-green-soft mt-5 mb-0">
            Prefer to talk it through? Call {SITE.phoneDisplay} or email{" "}
            <a href={`mailto:${SITE.email}`} className="text-green font-semibold">{SITE.email}</a>
          </p>
        </div>
      </section>
    </Page>
  );
}
