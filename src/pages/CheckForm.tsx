import { useState } from "react";
import { supabase } from "../lib/supabase";

type Phase = "form" | "uploading" | "analyzing" | "done" | "error";

/* ── The scam types and their tailored follow-up questions ─────────── */
const TYPES = [
  { id: "phone_call", icon: "📞", label: "A phone call", hint: "Someone rang me" },
  { id: "text", icon: "💬", label: "A text or WhatsApp", hint: "A message on my phone" },
  { id: "email", icon: "📧", label: "An email", hint: "Something in my inbox" },
  { id: "website", icon: "🌐", label: "A website or advert", hint: "A site, pop-up or online ad" },
  { id: "social", icon: "👥", label: "Social media or dating", hint: "Facebook, Instagram, dating apps…" },
  { id: "letter", icon: "✉️", label: "A letter or document", hint: "Something through the post" },
  { id: "in_person", icon: "🚪", label: "Someone in person", hint: "Doorstep, phone shop, street…" },
  { id: "other", icon: "❓", label: "Something else", hint: "Not sure? That's fine too" },
] as const;

type TypeId = (typeof TYPES)[number]["id"];

const TYPE_FIELDS: Record<TypeId, { key: string; label: string; placeholder?: string }[]> = {
  phone_call: [
    { key: "caller_number", label: "What number called you? (if you have it)", placeholder: "e.g. 020 3926 1847 or Unknown" },
    { key: "claimed_to_be", label: "Who did they say they were?", placeholder: "e.g. my bank, HMRC, Microsoft…" },
  ],
  text: [
    { key: "sender_number", label: "What number or name did it come from?", placeholder: "e.g. +44 7… or 'EVRi'" },
  ],
  email: [
    { key: "sender_email", label: "What email address did it come from?", placeholder: "Tap the sender's name to see the real address" },
    { key: "subject", label: "What was the subject line?", placeholder: "e.g. 'Your account has been suspended'" },
  ],
  website: [
    { key: "website_url", label: "What's the website address (URL)?", placeholder: "Copy it from the address bar if you can" },
  ],
  social: [
    { key: "platform", label: "Which app or site?", placeholder: "e.g. Facebook, Instagram, a dating app" },
    { key: "profile_name", label: "Their name or profile?", placeholder: "The account that contacted you" },
  ],
  letter: [
    { key: "claimed_to_be", label: "Who does the letter say it's from?", placeholder: "e.g. the council, a bank, a prize company" },
  ],
  in_person: [
    { key: "claimed_to_be", label: "Who did they say they were?", placeholder: "e.g. a water company engineer, a charity collector" },
  ],
  other: [],
};

const PASTE_LABEL: Partial<Record<TypeId, string>> = {
  text: "Paste the exact message here (if you can)",
  email: "Paste the email text here (if you can)",
  social: "Paste the messages here (if you can)",
  website: "Paste any text from the site that worried you",
};

const DESC_PLACEHOLDER: Record<TypeId, string> = {
  phone_call: "e.g. They said my account was compromised and I needed to move money to a 'safe account'. They knew my name…",
  text: "e.g. It says I missed a delivery and need to pay a fee — but I am expecting a parcel…",
  email: "e.g. It says my subscription failed and to update my card details…",
  website: "e.g. I found this site selling gadgets very cheap and want to know if it's safe to order…",
  social: "e.g. Someone I've been chatting to is now asking me to help them with money…",
  letter: "e.g. It says I've won a prize but need to pay a release fee…",
  in_person: "e.g. Someone knocked saying my roof needs urgent work and wants a deposit today…",
  other: "Describe what happened the way you'd tell a friend — no jargon needed.",
};

export default function CheckForm() {
  const [step, setStep] = useState(0); // 0 = type, 1 = details, 2 = contact
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState("");
  const [type, setType] = useState<TypeId | null>(null);
  const [details, setDetails] = useState<Record<string, string>>({});
  const [description, setDescription] = useState("");
  const [pasted, setPasted] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [wantsSms, setWantsSms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const pickType = (t: TypeId) => {
    setType(t);
    setStep(1);
    window.scrollTo({ top: 0 });
  };

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 3));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!termsAccepted) {
      setError("Please tick the box to confirm you understand this is guidance, not financial or legal advice.");
      return;
    }
    if (wantsSms && !contact.phone.trim()) {
      setError("Please add your mobile number so we can text your report — or untick the text option.");
      return;
    }
    try {
      setPhase("uploading");
      const image_paths: string[] = [];
      for (const f of files.slice(0, 3)) {
        const path = `submissions/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("uploads").upload(path, f);
        if (upErr) throw new Error("Photo upload failed — you can also submit without photos.");
        image_paths.push(path);
      }
      const subRes = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          category: type,
          description,
          pasted_text: pasted || null,
          details,
          wants_sms: wantsSms,
          terms_accepted: termsAccepted,
          image_paths,
        }),
      });
      const subData = await subRes.json().catch(() => ({ ok: false, error: "Something went wrong" }));
      if (!subData.ok) throw new Error(subData.error || "Something went wrong");

      /* AI analysis is deliberately NOT triggered here — Kieran approves each
         check in /admin first, so the public form can't burn API credits. */
      setPhase("done");
    } catch (err: any) {
      setError(err.message || "Something went wrong — please try again, or email hello@learnaifast.co.uk.");
      setPhase("error");
    }
  }

  if (phase === "done") {
    return (
      <Shell>
        <div className="text-center py-16 max-w-xl mx-auto">
          <div className="text-5xl mb-4">🌱</div>
          <h1 className="text-3xl font-bold">It's with us — well done for checking first.</h1>
          <p className="text-lg text-ink/80">
            Your request is in and Kieran has been notified. You'll get your plain-English
            report by email — usually the same day, often much sooner.
          </p>
          <p className="text-green-soft">
            Important: until you hear back, don't click any links, don't call any numbers
            from the message, and don't send any money.
          </p>
          <a href="/" className="inline-block mt-4 border-2 border-green text-green font-semibold px-5 py-2.5 rounded-full no-underline">Back to home</a>
        </div>
      </Shell>
    );
  }

  const busy = phase === "uploading" || phase === "analyzing";
  const typeMeta = TYPES.find((t) => t.id === type);

  return (
    <Shell>
      <div className="max-w-xl mx-auto py-8 px-1">
        {/* progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`w-2.5 h-2.5 rounded-full ${i <= step ? "bg-gold" : "bg-green/15"}`} />
          ))}
        </div>

        {/* ── STEP 0: what are you checking? ── */}
        {step === 0 && (
          <>
            <h1 className="text-3xl font-bold text-center">What would you like us to check?</h1>
            <p className="text-center text-ink/80 mb-6">Tap the one that fits best — we'll guide you from there.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => pickType(t.id)}
                  className="flex items-center gap-4 bg-white border-2 border-green/15 hover:border-gold rounded-2xl px-5 py-4 text-left"
                >
                  <span className="text-3xl">{t.icon}</span>
                  <span>
                    <span className="block font-bold">{t.label}</span>
                    <span className="block text-sm text-green-soft">{t.hint}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="text-center text-sm text-green-soft mt-6">First check free · Reviewed by a real person · Nothing is shared</p>
          </>
        )}

        {/* ── STEP 1: guided details ── */}
        {step === 1 && type && (
          <>
            <button onClick={() => setStep(0)} className="text-sm text-green-soft mb-2">← Change type</button>
            <h1 className="text-2xl font-bold">
              {typeMeta?.icon} Tell us what happened
            </h1>
            <div className="mt-5 space-y-5">
              {TYPE_FIELDS[type].map((f) => (
                <Field key={f.key} label={f.label}>
                  <input
                    className={inputCls}
                    placeholder={f.placeholder}
                    value={details[f.key] || ""}
                    onChange={(e) => setDetails({ ...details, [f.key]: e.target.value })}
                  />
                </Field>
              ))}
              <Field label="What happened? *">
                <textarea required rows={4} className={inputCls} placeholder={DESC_PLACEHOLDER[type]} value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
              {PASTE_LABEL[type] && (
                <Field label={PASTE_LABEL[type]!}>
                  <textarea rows={4} className={inputCls} value={pasted} onChange={(e) => setPasted(e.target.value)} />
                </Field>
              )}
              <Field label="Photos or screenshots (optional, up to 3)">
                <label className="flex items-center justify-center gap-3 border-2 border-dashed border-green/25 hover:border-gold rounded-2xl px-4 py-6 cursor-pointer bg-white">
                  <span className="text-2xl">📸</span>
                  <span className="font-semibold text-green">Tap to add a photo or screenshot</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
                </label>
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-3">
                    {files.map((f, i) => (
                      <div key={i} className="relative">
                        <img src={URL.createObjectURL(f)} alt="" className="w-24 h-24 object-cover rounded-xl border border-green/20" />
                        <button
                          type="button"
                          onClick={() => setFiles(files.filter((_, j) => j !== i))}
                          className="absolute -top-2 -right-2 bg-green text-cream rounded-full w-6 h-6 text-xs font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Field>
              <button
                onClick={() => description.trim() ? (setStep(2), window.scrollTo({ top: 0 })) : setError("Please tell us what happened first.")}
                className="w-full bg-green text-cream font-bold text-lg py-3.5 rounded-full"
              >
                Continue
              </button>
              {error && <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
            </div>
          </>
        )}

        {/* ── STEP 2: contact + submit ── */}
        {step === 2 && (
          <>
            <button onClick={() => { setError(""); setStep(1); }} className="text-sm text-green-soft mb-2">← Back</button>
            <h1 className="text-2xl font-bold">Where should the report go?</h1>
            <form onSubmit={submit} className="mt-5 space-y-5">
              <Field label="Your first name *">
                <input required className={inputCls} autoComplete="given-name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
              </Field>
              <Field label="Your email (we'll send the report here) *">
                <input required type="email" className={inputCls} autoComplete="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
              </Field>
              <Field label={wantsSms ? "Your mobile number *" : "Phone (optional — if you'd rather talk)"}>
                <input type="tel" className={inputCls} autoComplete="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
              </Field>
              <label className="flex items-start gap-3 bg-white border-2 border-green/15 rounded-xl px-4 py-3 cursor-pointer">
                <input type="checkbox" className="mt-1 w-5 h-5 accent-[#c9932b]" checked={wantsSms} onChange={(e) => setWantsSms(e.target.checked)} />
                <span className="text-sm">
                  <strong>Also text my report to my phone</strong>
                  <span className="block text-green-soft">We'll send the verdict by text message as well as the full email report.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 bg-cream-2 border-2 border-gold/30 rounded-xl px-4 py-3 cursor-pointer">
                <input type="checkbox" required className="mt-1 w-5 h-5 accent-[#c9932b]" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
                <span className="text-sm">
                  <strong>I understand this is guidance, not advice *</strong>
                  <span className="block text-green-soft">
                    My report is guidance based on the information I provide. It is not legal or
                    financial advice and cannot guarantee whether something is or isn't a scam.
                    Any decisions I take — including payments or sharing information — remain my
                    own responsibility.
                  </span>
                </span>
              </label>
              {error && <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
              <button type="submit" disabled={busy} className="w-full bg-gold hover:bg-gold-soft text-green-deep font-bold text-lg py-3.5 rounded-full disabled:opacity-60">
                {phase === "uploading" ? "Sending securely…" : phase === "analyzing" ? "Analysing — about 30 seconds…" : "Get my second look"}
              </button>
              <p className="text-center text-sm text-green-soft m-0">First check free · Reviewed by a real person · Nothing is shared with anyone else</p>
            </form>
          </>
        )}
      </div>
    </Shell>
  );
}

const inputCls =
  "w-full border-2 border-green/20 focus:border-gold rounded-xl px-4 py-3 bg-white outline-none text-base";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block font-semibold mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="bg-white/90 border-b border-green/10">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-5 py-3">
          <a href="/" className="no-underline font-display font-bold text-xl text-green">
            Second Look <em className="text-gold not-italic">Protect</em>
          </a>
          <span className="text-sm font-semibold text-green-soft">A calm second opinion before you act</span>
        </div>
      </header>
      <main className="px-5">{children}</main>
    </div>
  );
}
