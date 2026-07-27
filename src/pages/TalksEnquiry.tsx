import { useState } from "react";
import { Page } from "../components/Layout";
import { SITE } from "../lib/site";
import { track, EVENTS } from "../lib/analytics";
import { usePageMeta } from "../lib/meta";

const ORG_TYPES = [
  { id: "charity", icon: "🤝", label: "Charity or voluntary organisation" },
  { id: "community", icon: "☕", label: "Community group, club or U3A" },
  { id: "corporate", icon: "🏢", label: "Business or corporate team" },
  { id: "school", icon: "🎓", label: "School, college or university" },
  { id: "public_sector", icon: "🏛️", label: "Council or public sector" },
  { id: "other", icon: "✨", label: "Something else" },
];

const FORMATS = [
  { id: "in_person", label: "In person", hint: "You host, I travel to you" },
  { id: "online", label: "Online", hint: "Zoom or Teams, anywhere in the UK" },
  { id: "either", label: "Either is fine", hint: "Whatever works best" },
];

const SIZES = ["Under 20", "20–50", "50–100", "100–250", "250+", "Not sure yet"];

const inputCls =
  "w-full border-2 border-green/20 focus:border-gold focus:ring-4 focus:ring-gold/15 rounded-xl px-4 py-3.5 bg-white outline-none text-base transition-colors";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block font-semibold mb-1">
        {label} {required && <span className="text-gold">*</span>}
      </span>
      {hint && <span className="block text-sm text-green-soft mb-1.5">{hint}</span>}
      {children}
    </label>
  );
}

export default function TalksEnquiry() {
  usePageMeta(
    "Ask about an AI Safety Talk | Second Look Protect",
    "Tell us about your group and get dates and a straightforward price back within one working day. No obligation. Charity and community rates available."
  );
  const [form, setForm] = useState({
    org_name: "",
    org_type: "",
    contact_name: "",
    email: "",
    phone: "",
    audience_size: "",
    preferred_format: "",
    preferred_date: "",
    location: "",
    budget: "",
    message: "",
    hear_about: "",
    company_website: "", // honeypot — hidden from real people
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.org_name.trim() || !form.contact_name.trim() || !form.email.trim()) {
      setError("Please fill in your name, email and the name of your organisation.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/talk-enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({ ok: false, error: "Something went wrong" }));
      if (!data.ok) throw new Error(data.error || "Something went wrong");
      track(EVENTS.submitTalkEnquiry, { org_type: form.org_type || "unspecified" });
      window.location.href = "/talks/thank-you";
    } catch (err: any) {
      setError(
        err.message ||
          `Something went wrong sending that. Please email ${SITE.email} and I'll pick it up straight away.`
      );
      setBusy(false);
    }
  }

  return (
    <Page>
      <section className="bg-green text-cream-2">
        <div className="max-w-3xl mx-auto px-5 py-12 text-center">
          <p className="uppercase tracking-widest text-gold font-bold text-xs mb-3 mt-0">
            AI Scam Safety Talks
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-cream m-0">
            Tell me about your group
          </h1>
          <p className="mt-4 text-cream/90 text-lg mb-0">
            Two minutes now, and you'll have dates and a straightforward price back within one
            working day. No obligation, and I won't chase you.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-5 py-12 grid lg:grid-cols-[1fr_320px] gap-10 items-start">
        {/* FORM */}
        <form onSubmit={submit} className="space-y-7 min-w-0">
          {/* Honeypot — invisible to people, catches bots */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute left-[-9999px] w-px h-px opacity-0"
            value={form.company_website}
            onChange={(e) => set("company_website", e.target.value)}
          />

          {/* 1 — who you are */}
          <fieldset className="bg-white border border-gold/20 rounded-2xl p-6 md:p-7 shadow-sm space-y-5 m-0">
            <legend className="font-display text-xl font-bold text-green px-2">
              1. Who's asking
            </legend>

            <Field label="Your organisation" required hint="Group, charity, company or club name">
              <input
                className={inputCls}
                value={form.org_name}
                onChange={(e) => set("org_name", e.target.value)}
                placeholder="e.g. Northampton U3A, Willow Housing, Barratt & Co"
              />
            </Field>

            <Field label="What kind of organisation is it?">
              <div className="grid sm:grid-cols-2 gap-2.5 mt-1">
                {ORG_TYPES.map((t) => {
                  const active = form.org_type === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => set("org_type", t.id)}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left border-2 transition-all ${
                        active
                          ? "border-gold bg-gold/10 shadow-sm"
                          : "border-green/15 bg-white hover:border-gold/50"
                      }`}
                    >
                      <span className="text-xl">{t.icon}</span>
                      <span className="text-sm font-semibold">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Your name" required>
                <input
                  className={inputCls}
                  autoComplete="name"
                  value={form.contact_name}
                  onChange={(e) => set("contact_name", e.target.value)}
                />
              </Field>
              <Field label="Your email" required>
                <input
                  type="email"
                  className={inputCls}
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
            </div>

            <Field label="Phone" hint="Optional — often quicker for sorting out dates">
              <input
                type="tel"
                className={inputCls}
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
          </fieldset>

          {/* 2 — the talk */}
          <fieldset className="bg-white border border-gold/20 rounded-2xl p-6 md:p-7 shadow-sm space-y-5 m-0">
            <legend className="font-display text-xl font-bold text-green px-2">
              2. About the talk
            </legend>

            <Field label="Roughly how many people?">
              <div className="flex flex-wrap gap-2 mt-1">
                {SIZES.map((s) => {
                  const active = form.audience_size === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set("audience_size", s)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold border-2 transition-all ${
                        active
                          ? "border-gold bg-gold/10"
                          : "border-green/15 bg-white hover:border-gold/50"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="In person or online?">
              <div className="grid sm:grid-cols-3 gap-2.5 mt-1">
                {FORMATS.map((f) => {
                  const active = form.preferred_format === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => set("preferred_format", f.id)}
                      className={`rounded-xl px-4 py-3 text-left border-2 transition-all ${
                        active
                          ? "border-gold bg-gold/10 shadow-sm"
                          : "border-green/15 bg-white hover:border-gold/50"
                      }`}
                    >
                      <span className="block font-semibold text-sm">{f.label}</span>
                      <span className="block text-xs text-green-soft">{f.hint}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="When were you thinking?" hint="A date, a month, or just 'flexible'">
                <input
                  className={inputCls}
                  value={form.preferred_date}
                  onChange={(e) => set("preferred_date", e.target.value)}
                  placeholder="e.g. a Tuesday in October"
                />
              </Field>
              <Field label="Where are you?" hint="Town or postcode is plenty">
                <input
                  className={inputCls}
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="e.g. Northampton"
                />
              </Field>
            </div>

            <Field
              label="Anything I should know?"
              hint="Your audience, what's worrying them, anything that's already happened, or what a good session would look like for you."
            >
              <textarea
                rows={5}
                className={inputCls}
                value={form.message}
                onChange={(e) => set("message", e.target.value)}
                placeholder="e.g. Most of our members are over 70 and several have had scam calls claiming to be from their bank…"
              />
            </Field>

            <Field
              label="Budget"
              hint="Optional, and there's no wrong answer — it just helps me suggest a format that fits rather than one that doesn't."
            >
              <input
                className={inputCls}
                value={form.budget}
                onChange={(e) => set("budget", e.target.value)}
                placeholder="e.g. up to £300, or 'not sure yet'"
              />
            </Field>

            <Field label="How did you hear about me?" hint="Optional — genuinely useful to know">
              <input
                className={inputCls}
                value={form.hear_about}
                onChange={(e) => set("hear_about", e.target.value)}
                placeholder="e.g. Facebook, a friend, another group"
              />
            </Field>
          </fieldset>

          {error && (
            <p className="text-red-800 bg-red-50 border border-red-200 rounded-xl p-4 m-0">{error}</p>
          )}

          <div>
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-gold hover:bg-gold-soft text-green-deep font-bold text-lg py-4 rounded-full shadow-sm transition-colors disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send my enquiry →"}
            </button>
            <p className="text-center text-sm text-green-soft mt-3 mb-0">
              No obligation · Reply within one working day · Your details are never shared
            </p>
          </div>
        </form>

        {/* SIDEBAR */}
        <aside className="lg:sticky lg:top-24 space-y-4">
          <div className="bg-green text-cream rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-cream mt-0 mb-3">What happens next</h2>
            <ol className="list-none p-0 m-0 space-y-3 text-sm text-cream/90">
              {[
                ["Today", "Your enquiry lands with me directly — not a call centre."],
                ["Within one working day", "A reply with format options, dates that work, and a clear price."],
                ["When you're ready", "We confirm a date. No deposit, no long contract."],
              ].map(([when, what]) => (
                <li key={when} className="flex gap-3">
                  <span className="text-gold font-bold shrink-0">▸</span>
                  <span>
                    <strong className="block text-gold">{when}</strong>
                    {what}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="bg-white border border-gold/20 rounded-2xl p-6 shadow-sm">
            <p className="font-semibold mt-0 mb-2">Would rather just talk?</p>
            <p className="text-sm text-ink/70 mt-0">
              Some things are easier said out loud. Call or email and you'll get me, not a form.
            </p>
            <p className="m-0 text-sm">
              <a href={`tel:${SITE.phoneDial}`} className="text-green font-semibold block">
                {SITE.phoneDisplay}
              </a>
              <a href={`mailto:${SITE.email}`} className="text-green font-semibold break-all">
                {SITE.email}
              </a>
            </p>
          </div>

          <div className="bg-cream-2 border border-gold/20 rounded-2xl p-6">
            <p className="text-sm text-ink/75 m-0">
              <strong className="block mb-1">Small budget?</strong>
              Charities and community groups pay a different rate to corporate bookings. Please ask
              anyway — I'd rather find a way than have your members find out the hard way.
            </p>
          </div>
        </aside>
      </div>
    </Page>
  );
}
