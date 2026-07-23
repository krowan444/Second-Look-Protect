import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Submission = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  category: string;
  description: string;
  pasted_text: string | null;
  details: Record<string, string> | null;
  image_paths: string[];
  member_status: string;
  status: string;
};

const DETAIL_LABELS: Record<string, string> = {
  caller_number: "Number that called",
  claimed_to_be: "Claimed to be",
  sender_number: "Sender number/name",
  sender_email: "Sender email",
  subject: "Subject line",
  website_url: "Website URL",
  platform: "Platform",
  profile_name: "Profile name",
  _wants_sms: "📱 Wants report by text",
  _terms_accepted_at: "✅ Accepted guidance terms",
};

type Report = {
  id: string;
  submission_id: string;
  verdict: string;
  risk_level: string;
  headline: string;
  explanation: string;
  indicators: string[];
  actions: string[];
  extracted_links: string[];
  extracted_phones: string[];
  corroboration: any;
  ocr_text: string | null;
  confidence: number | null;
};

const badge = (m: string) =>
  m === "member" ? ["🟢 Member", "bg-green text-cream"] : m === "free" ? ["🔵 Free check", "bg-blue-100 text-blue-900"] : ["🟠 Free used", "bg-orange-100 text-orange-900"];

export default function Admin() {
  const [session, setSession] = useState<any>(null);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginErr, setLoginErr] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadQueue();
  }, [session]);

  async function loadQueue() {
    const { data } = await supabase
      .from("submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setSubs((data as Submission[]) || []);
    /* deep link from WhatsApp/email: /admin?case=<id> opens that case */
    const caseId = new URLSearchParams(window.location.search).get("case");
    if (caseId && data) {
      const match = (data as Submission[]).find((s) => s.id === caseId);
      if (match) open(match);
    }
  }

  async function open(s: Submission) {
    setSelected(s);
    setReport(null);
    setNote("");
    const { data } = await supabase.from("ai_reports").select("*").eq("submission_id", s.id).maybeSingle();
    setReport(data as Report | null);
  }

  async function runAnalysis() {
    if (!selected) return;
    setBusy("Running AI analysis…");
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ submission_id: selected.id }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert("Analysis failed: " + (d.error || `server error ${res.status}`));
    }
    await open(selected);
    setBusy("");
  }

  async function approveSend() {
    if (!selected || !report) return;
    setBusy("Sending report…");
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const res = await fetch("/api/approve-send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        submission_id: selected.id,
        headline: report.headline,
        explanation: report.explanation,
        indicators: report.indicators,
        actions: report.actions,
        personal_note: note || undefined,
      }),
    });
    const d = await res.json().catch(() => ({ ok: false, error: `Server error (${res.status})` }));
    setBusy("");
    if (d.ok) {
      alert("Report sent ✓");
      setSelected(null);
      loadQueue();
    } else {
      alert("Failed: " + (d.error || "unknown"));
    }
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginErr("");
    const { error } = await supabase.auth.signInWithPassword(loginForm);
    if (error) setLoginErr(error.message);
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <form onSubmit={login} className="bg-white border border-gold/20 rounded-2xl p-8 w-full max-w-sm shadow-sm">
          <h1 className="text-2xl font-bold mt-0">Review dashboard</h1>
          <input
            className="w-full border-2 border-green/20 rounded-xl px-4 py-3 mb-3"
            placeholder="Email"
            type="email"
            value={loginForm.email}
            onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
          />
          <input
            className="w-full border-2 border-green/20 rounded-xl px-4 py-3 mb-3"
            placeholder="Password"
            type="password"
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
          />
          {loginErr && <p className="text-red-700 text-sm">{loginErr}</p>}
          <button className="w-full bg-green text-cream font-bold py-3 rounded-full">Sign in</button>
        </form>
      </div>
    );
  }

  const storageUrl = (p: string) =>
    `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/uploads/${p}`;

  return (
    <div className="min-h-screen max-w-6xl mx-auto px-4 py-6 overflow-x-hidden">
      <div className="flex items-center justify-between mb-6 gap-3">
        <h1 className="text-xl md:text-2xl font-bold m-0">Review queue</h1>
        <div className="flex gap-3 items-center">
          <button onClick={loadQueue} className="text-sm border-2 border-green/30 rounded-full px-4 py-1.5">Refresh</button>
          <button onClick={() => supabase.auth.signOut()} className="text-sm text-green-soft">Sign out</button>
        </div>
      </div>

      {!selected && (
        <div className="space-y-2">
          {subs.length === 0 && <p className="text-green-soft">No checks yet — the queue is clear. 🌼</p>}
          {subs.map((s) => {
            const [label, cls] = badge(s.member_status);
            return (
              <button
                key={s.id}
                onClick={() => open(s)}
                className="w-full text-left bg-white border border-gold/20 rounded-xl px-4 py-3.5 hover:border-gold active:scale-[0.99] transition-all"
              >
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>
                  <span className="text-[11px] font-bold uppercase tracking-wide text-green-soft">{s.status}</span>
                  <span className="text-[11px] text-ink/45 ml-auto">{new Date(s.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="font-semibold leading-tight">{s.name}</div>
                <div className="text-green-soft text-sm break-all">{s.email}</div>
                <div className="text-xs text-ink/50 mt-0.5">{s.category}</div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="min-w-0">
            <button onClick={() => setSelected(null)} className="text-sm font-semibold text-green-soft mb-3">← Back to queue</button>
            <div className="bg-white border border-gold/20 rounded-2xl p-5 md:p-6 min-w-0">
              <p className="uppercase tracking-wide text-gold font-bold text-[11px] mt-0 mb-1">What the customer sent you</p>
              <h2 className="mt-0 text-lg md:text-xl">{selected.name}</h2>
              <p className="text-sm text-green-soft m-0 break-words">
                <span className="break-all">{selected.email}</span> {selected.phone && `· ${selected.phone}`} · {badge(selected.member_status)[0]} · {selected.category}
              </p>
              {selected.details && Object.keys(selected.details).some((k) => selected.details![k]) && (
                <div className="bg-cream-2 rounded-xl p-4 mt-4">
                  {Object.entries(selected.details).filter(([, v]) => v).map(([k, v]) => (
                    <p key={k} className="m-0 mb-1 text-sm">
                      <strong>{DETAIL_LABELS[k] || k}:</strong> {v}
                    </p>
                  ))}
                </div>
              )}
              <h3 className="text-base mb-1 mt-4">Their description</h3>
              <p className="whitespace-pre-wrap break-words">{selected.description}</p>
              {selected.pasted_text && (
                <>
                  <h3 className="text-base mb-1">Pasted message</h3>
                  <pre className="whitespace-pre-wrap break-words bg-cream-2 rounded-xl p-4 text-sm font-body">{selected.pasted_text}</pre>
                </>
              )}
              {selected.image_paths?.length > 0 && (
                <>
                  <h3 className="text-base mb-1">Screenshots</h3>
                  <div className="flex flex-wrap gap-3">
                    {selected.image_paths.map((p) => (
                      <a key={p} href={storageUrl(p)} target="_blank" rel="noreferrer">
                        <img src={storageUrl(p)} alt="uploaded evidence" className="w-36 rounded-lg border border-green/20" />
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="min-w-0">
            {!report ? (
              <div className="bg-white border border-gold/20 rounded-2xl p-5 md:p-6 text-center min-w-0">
                <p className="font-semibold m-0">Step 1 — run the AI check</p>
                <p className="text-sm text-green-soft mt-1">The AI reads everything the customer sent and drafts a report for you to review. Nothing is sent to them yet.</p>
                <button onClick={runAnalysis} disabled={!!busy} className="bg-green text-cream font-bold px-6 py-3 rounded-full mt-2 disabled:opacity-60">
                  {busy || "Run AI check"}
                </button>
              </div>
            ) : (
              <div className="bg-white border border-gold/20 rounded-2xl p-5 md:p-6 space-y-4 min-w-0">
                <div>
                  <p className="uppercase tracking-wide text-gold font-bold text-[11px] mt-0 mb-2">The AI's draft report — check it, edit if needed, then send</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green text-cream">Verdict: {report.verdict?.replace(/_/g, " ")}</span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-cream-2">Risk: {report.risk_level}</span>
                    {report.confidence != null && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-cream-2">AI confidence: {Math.round(report.confidence * 100)}%</span>
                    )}
                  </div>
                </div>

                <p className="text-sm text-green-soft bg-cream-2 rounded-xl p-3 m-0">
                  Everything below is what the <strong>customer will receive</strong>. You can edit any of it before sending.
                </p>

                <label className="block">
                  <span className="font-semibold text-sm">The verdict, in one line</span>
                  <span className="block text-xs text-green-soft mb-1">The big answer they see first — e.g. "This looks like a scam".</span>
                  <input className="w-full max-w-full border-2 border-green/20 rounded-xl px-3 py-2.5" value={report.headline} onChange={(e) => setReport({ ...report, headline: e.target.value })} />
                </label>
                <label className="block">
                  <span className="font-semibold text-sm">Why — the plain-English explanation</span>
                  <span className="block text-xs text-green-soft mb-1">A few sentences explaining what's going on and why.</span>
                  <textarea rows={6} className="w-full max-w-full border-2 border-green/20 rounded-xl px-3 py-2.5" value={report.explanation} onChange={(e) => setReport({ ...report, explanation: e.target.value })} />
                </label>
                <label className="block">
                  <span className="font-semibold text-sm">Warning signs spotted</span>
                  <span className="block text-xs text-green-soft mb-1">The red flags — one per line. Shown to them as a tick-list.</span>
                  <textarea rows={4} className="w-full max-w-full border-2 border-green/20 rounded-xl px-3 py-2.5" value={(report.indicators || []).join("\n")} onChange={(e) => setReport({ ...report, indicators: e.target.value.split("\n").filter(Boolean) })} />
                </label>
                <label className="block">
                  <span className="font-semibold text-sm">What they should do next</span>
                  <span className="block text-xs text-green-soft mb-1">Clear steps — one per line. Shown as a numbered list.</span>
                  <textarea rows={4} className="w-full max-w-full border-2 border-green/20 rounded-xl px-3 py-2.5" value={(report.actions || []).join("\n")} onChange={(e) => setReport({ ...report, actions: e.target.value.split("\n").filter(Boolean) })} />
                </label>
                <label className="block">
                  <span className="font-semibold text-sm">A personal note from you <span className="text-green-soft font-normal">(optional)</span></span>
                  <span className="block text-xs text-green-soft mb-1">A friendly line added to the bottom of their email, just from you.</span>
                  <textarea rows={2} className="w-full max-w-full border-2 border-green/20 rounded-xl px-3 py-2.5" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. You did exactly the right thing checking this one." />
                </label>

                {report.corroboration?.search_performed && (
                  <div className="bg-cream-2 rounded-xl p-4 text-sm min-w-0">
                    <strong>Automatic web check ({report.corroboration.status?.replace(/_/g, " ")}):</strong> {report.corroboration.summary || "No matches found online."}
                    {(report.corroboration.sources || []).map((u: string) => (
                      <div key={u} className="mt-1"><a href={u} target="_blank" rel="noreferrer" className="text-green break-all">{u}</a></div>
                    ))}
                  </div>
                )}

                <div className="pt-1">
                  <button onClick={approveSend} disabled={!!busy} className="w-full bg-gold hover:bg-gold-soft text-green-deep font-bold text-lg py-3.5 rounded-full disabled:opacity-60 transition-colors">
                    {busy || `✓ Approve & send to ${selected.name}`}
                  </button>
                  <p className="text-xs text-green-soft text-center mt-2 mb-0">This emails the report to the customer{selected.phone ? " (and texts them, if they asked)" : ""}. It can't be undone.</p>
                </div>
                <button onClick={runAnalysis} disabled={!!busy} className="w-full border-2 border-green/30 text-green font-semibold py-2.5 rounded-full text-sm">
                  Re-run the AI check
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
