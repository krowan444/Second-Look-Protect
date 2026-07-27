import { Page } from "../components/Layout";
import { SITE } from "../lib/site";
import { track, EVENTS } from "../lib/analytics";
import { usePageMeta } from "../lib/meta";

export default function About() {
  usePageMeta(
    "About Kieran | Second Look Protect",
    "Why Second Look Protect exists, and the person behind it. AI has made scams convincing — a calm second opinion changes that."
  );
  return (
    <Page>
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
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="/check"
                onClick={() => track(EVENTS.startCheck, { from: "about" })}
                className="bg-green hover:bg-green-deep text-cream font-semibold px-7 py-3.5 rounded-full no-underline transition-colors"
              >
                Get a free Second Look
              </a>
              <a
                href="/#peace-of-mind"
                onClick={() => track(EVENTS.clickMembership, { from: "about" })}
                className="border-2 border-green text-green font-semibold px-6 py-3.5 rounded-full no-underline hover:bg-green hover:text-cream transition-colors"
              >
                Peace of Mind · {SITE.membershipPrice}/mo
              </a>
            </div>
          </div>
        </div>
      </section>

    </Page>
  );
}
