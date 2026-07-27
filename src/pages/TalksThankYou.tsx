import { Page } from "../components/Layout";
import { SITE } from "../lib/site";
import { usePageMeta } from "../lib/meta";

export default function TalksThankYou() {
  usePageMeta(
    "Thank you — your talk enquiry is with us | Second Look Protect",
    "Your AI safety talk enquiry has been received. Kieran will reply within one working day with dates and a price."
  );
  return (
    <Page>
      <section className="max-w-2xl mx-auto px-5 py-16 md:py-24">
        <div className="bg-white border border-gold/20 rounded-2xl shadow-md p-8 md:p-12 text-center">
          <div className="text-6xl mb-5">🎤</div>
          <h1 className="text-3xl md:text-4xl font-bold mt-0">
            Thank you — that's landed with me.
          </h1>
          <p className="text-lg text-ink/80">
            Your enquiry has come straight through to my inbox and I read every one personally.
            There's a confirmation on its way to your email now.
          </p>

          <div className="bg-cream-2 rounded-2xl p-6 text-left my-8">
            <p className="font-semibold m-0 mb-3">What happens next</p>
            <ol className="list-none p-0 m-0 space-y-3 text-[15px]">
              {[
                ["Within one working day", "I'll reply with a couple of format options, dates that could work, and a clear price."],
                ["No obligation", "If it's not right for your group, I'll tell you honestly — and you won't be chased."],
                ["Any changes?", "Just reply to the confirmation email and it'll come straight back to me."],
              ].map(([when, what]) => (
                <li key={when} className="flex gap-3">
                  <span className="text-gold font-bold shrink-0">▸</span>
                  <span>
                    <strong className="block text-green">{when}</strong>
                    <span className="text-ink/75">{what}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <p className="text-ink/80">
            In the meantime — anyone in your group who's got a message worrying them right now can
            have it checked free, today. It's often the best possible introduction to what the talk
            covers.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <a
              href="/check"
              className="inline-block bg-green text-cream font-semibold px-6 py-3 rounded-full no-underline"
            >
              Check something free
            </a>
            <a
              href="/"
              className="inline-block border-2 border-green text-green font-semibold px-6 py-3 rounded-full no-underline"
            >
              Back to home
            </a>
          </div>

          <p className="text-sm text-green-soft mt-8 mb-0">
            Need me sooner? Call {SITE.phoneDisplay} or email{" "}
            <a href={`mailto:${SITE.email}`} className="text-green font-semibold break-all">
              {SITE.email}
            </a>
          </p>
        </div>
      </section>
    </Page>
  );
}
