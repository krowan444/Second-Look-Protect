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
          <div>
            <button onClick={() => setSelected(null)} className="text-sm font-semibold text-green-soft mb-3">← Back to queue</button>
            <div className="bg-white border border-gold/20 rounded-2xl p-5 md:p-6">
              <h2 className="mt-0 text-lg md:text-xl">What {selected.name} sent</h2>
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

          <div>
            {!report ? (
              <div className="bg-white border border-gold/20 rounded-2xl p-5 md:p-6 text-center">
                <p>No AI report yet for this one.</p>
                <button onClick={runAnalysis} disabled={!!busy} className="bg-green text-cream font-bold px-5 py-2.5 rounded-full">
                  {busy || "Run AI analysis"}
                </button>
              </div>
            ) : (
              <div className="bg-white border border-gold/20 rounded-2xl p-5 md:p-6 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-cream-2">{report.verdict}</span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-cream-2">risk: {report.risk_level}</span>
                  {report.confidence != null && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-cream-2">confidence: {Math.round(report.confidence * 100)}%</span>
                  )}
                </div>

                <label className="block">
                  <span className="font-semibold text-sm">Headline (customer sees this)</span>
                  <input className="w-full border-2 border-green/20 rounded-xl px-3 py-2 mt-1" value={report.headline} onChange={(e) => setReport({ ...report, headline: e.target.value })} />
                </label>
                <label className="block">
                  <span className="font-semibold text-sm">Explanation</span>
                  <textarea rows={6} className="w-full border-2 border-green/20 rounded-xl px-3 py-2 mt-1" value={report.explanation} onChange={(e) => setReport({ ...report, explanation: e.target.value })} />
                </label>
                <label className="block">
                  <span className="font-semibold text-sm">Warning signs (one per line)</span>
                  <textarea rows={4} className="w-full border-2 border-green/20 rounded-xl px-3 py-2 mt-1" value={(report.indicators || []).join("\n")} onChange={(e) => setReport({ ...report, indicators: e.target.value.split("\n").filter(Boolean) })} />
                </label>
                <label className="block">
                  <span className="font-semibold text-sm">What to do now (one per line)</span>
                  <textarea rows={4} className="w-full border-2 border-green/20 rounded-xl px-3 py-2 mt-1" value={(report.actions || []).join("\n")} onChange={(e) => setReport({ ...report, actions: e.target.value.split("\n").filter(Boolean) })} />
                </label>
                <label className="block">
                  <span className="font-semibold text-sm">Personal note from you (optional)</span>
                  <textarea rows={2} className="w-full border-2 border-green/20 rounded-xl px-3 py-2 mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Give me a ring if you'd like to talk this one through." />
                </label>

                {report.corroboration?.search_performed && (
                  <div className="bg-cream-2 rounded-xl p-4 text-sm">
                    <strong>Web research ({report.corroboration.status}):</strong> {report.corroboration.summary || "No summary"}
                    {(report.corroboration.sources || []).map((u: string) => (
                      <div key={u}><a href={u} target="_blank" rel="noreferrer" className="text-green break-all">{u}</a></div>
                    ))}
                  </div>
                )}

                <button onClick={approveSend} disabled={!!busy} className="w-full bg-gold text-green-deep font-bold text-lg py-3 rounded-full disabled:opacity-60">
                  {busy || `✓ Approve & send to ${selected.name}`}
                </button>
                <button onClick={runAnalysis} disabled={!!busy} className="w-full border-2 border-green/30 text-green font-semibold py-2 rounded-full text-sm">
                  Re-run AI analysis
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
