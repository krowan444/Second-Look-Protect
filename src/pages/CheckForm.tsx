import { useState } from "react";
import { supabase } from "../lib/supabase";

type Phase = "form" | "uploading" | "analyzing" | "done" | "error";

export default function CheckForm() {
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    category: "message",
    description: "",
    pasted_text: "",
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      setPhase("uploading");

      /* 1. Upload screenshots to Supabase storage */
      const image_paths: string[] = [];
      for (const f of files.slice(0, 3)) {
        const path = `submissions/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("uploads").upload(path, f);
        if (upErr) throw new Error("Screenshot upload failed — you can also submit without images.");
        image_paths.push(path);
      }

      /* 2. Create the submission */
      const subRes = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, image_paths }),
      });
      const subData = await subRes.json();
      if (!subData.ok) throw new Error(subData.error || "Something went wrong");

      /* 3. Kick off the AI analysis (we wait so Kieran gets a ready report) */
      setPhase("analyzing");
      await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: subData.id }),
      }).catch(() => {}); // analysis failure is recoverable from the dashboard

      setPhase("done");
    } catch (err: any) {
      setError(err.message || "Something went wrong — please try again or call 07563 887804.");
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

  return (
    <Shell>
      <div className="max-w-xl mx-auto py-10 px-1">
        <h1 className="text-3xl font-bold text-center">Let's take a second look</h1>
        <p className="text-center text-ink/80">
          Tell us what's worrying you. No jargon needed — just describe it the way you'd tell a friend.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <Field label="Your first name *">
            <input required value={form.name} onChange={set("name")} className={inputCls} autoComplete="given-name" />
          </Field>
          <Field label="Your email (where we send the report) *">
            <input required type="email" value={form.email} onChange={set("email")} className={inputCls} autoComplete="email" />
          </Field>
          <Field label="Phone (optional — if you'd rather talk)">
            <input type="tel" value={form.phone} onChange={set("phone")} className={inputCls} autoComplete="tel" />
          </Field>
          <Field label="What is it?">
            <select value={form.category} onChange={set("category")} className={inputCls}>
              <option value="message">A text / WhatsApp message</option>
              <option value="email">An email</option>
              <option value="phone_call">A phone call I received</option>
              <option value="letter">A letter or document</option>
              <option value="website">A website or advert</option>
              <option value="other">Something else</option>
            </select>
          </Field>
          <Field label="What happened? *">
            <textarea
              required
              rows={4}
              value={form.description}
              onChange={set("description")}
              placeholder="e.g. I got a text saying my parcel couldn't be delivered and to pay £2.99 — but I am expecting a parcel, so I'm not sure…"
              className={inputCls}
            />
          </Field>
          <Field label="Paste the message itself (if you can)">
            <textarea rows={4} value={form.pasted_text} onChange={set("pasted_text")} className={inputCls} placeholder="Copy and paste the exact message here" />
          </Field>
          <Field label="Screenshots or photos (optional, up to 3)">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 3))}
              className="block w-full text-sm"
            />
            {files.length > 0 && <p className="text-sm text-green-soft m-0">{files.length} image(s) ready to send</p>}
          </Field>

          {error && <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-gold hover:bg-gold-soft text-green-deep font-bold text-lg py-3.5 rounded-full disabled:opacity-60"
          >
            {phase === "uploading" ? "Sending securely…" : phase === "analyzing" ? "Analysing — this takes about 30 seconds…" : "Get my second look"}
          </button>
          <p className="text-center text-sm text-green-soft m-0">
            First check free · Reviewed by a real person · Nothing is shared with anyone else
          </p>
        </form>
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
          <a href="tel:07563887804" className="text-sm font-bold text-green no-underline">07563 887804</a>
        </div>
      </header>
      <main className="px-5">{children}</main>
    </div>
  );
}
