// api/approve-send.js — Kieran approves a reviewed report; the customer
// gets a branded email. Auth: a valid Supabase session token (only the
// admin account exists).
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const EMAIL_FROM = process.env.EMAIL_FROM;
  if (!SUPABASE_URL || !SERVICE_KEY || !RESEND_API_KEY || !EMAIL_FROM) {
    return res.status(500).json({ ok: false, error: "Server not configured" });
  }
  const sb = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };

  /* Verify the caller is a logged-in admin */
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ ok: false, error: "Not authorised" });
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return res.status(401).json({ ok: false, error: "Not authorised" });

  try {
    const { submission_id, headline, explanation, indicators, actions, personal_note } = req.body || {};
    if (!submission_id) return res.status(400).json({ ok: false, error: "submission_id required" });

    /* Fetch submission + report */
    const subRes = await fetch(`${SUPABASE_URL}/rest/v1/submissions?id=eq.${encodeURIComponent(submission_id)}&limit=1`, {
      headers: { ...sb, Accept: "application/vnd.pgrst.object+json" },
    });
    if (!subRes.ok) return res.status(404).json({ ok: false, error: "Submission not found" });
    const sub = await subRes.json();

    const repRes = await fetch(
      `${SUPABASE_URL}/rest/v1/ai_reports?submission_id=eq.${encodeURIComponent(submission_id)}&limit=1`,
      { headers: { ...sb, Accept: "application/vnd.pgrst.object+json" } }
    );
    if (!repRes.ok) return res.status(404).json({ ok: false, error: "Report not found" });
    const rep = await repRes.json();

    /* Apply Kieran's edits (if any) and persist them */
    const finalHeadline = headline ?? rep.headline;
    const finalExplanation = explanation ?? rep.explanation;
    const finalIndicators = indicators ?? rep.indicators ?? [];
    const finalActions = actions ?? rep.actions ?? [];
    await fetch(`${SUPABASE_URL}/rest/v1/ai_reports?id=eq.${rep.id}`, {
      method: "PATCH",
      headers: sb,
      body: JSON.stringify({
        headline: finalHeadline,
        explanation: finalExplanation,
        indicators: finalIndicators,
        actions: finalActions,
      }),
    });

    /* Build the customer email */
    const verdictLabel = {
      likely_scam: { label: "Very likely a scam", color: "#b3261e", emoji: "🚨" },
      suspicious: { label: "Suspicious — treat with caution", color: "#a05a00", emoji: "⚠️" },
      likely_safe: { label: "Looks genuine", color: "#1c6b37", emoji: "✅" },
      insufficient_info: { label: "We need a little more detail", color: "#444", emoji: "❓" },
    }[rep.verdict] || { label: "Report", color: "#444", emoji: "🔍" };

    const li = (arr) => (arr || []).map((x) => `<li style="margin-bottom:6px">${x}</li>`).join("");
    const upsell =
      sub.member_status === "member"
        ? `<p style="color:#555">Thanks for being a Peace of Mind member — send over anything suspicious, any time.</p>`
        : `<div style="background:#f6f1e4;border-radius:10px;padding:16px;margin-top:20px">
             <p style="margin:0 0 8px"><strong>That was your free Second Look.</strong></p>
             <p style="margin:0">For unlimited checks for your whole household — plus help setting up your Family Safe Word — join <strong>Peace of Mind for £9.99/month</strong>. Reply to this email or visit the website to join.</p>
           </div>`;

    const html = `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#222">
  <div style="background:#1c3527;color:#f6f1e4;padding:22px 26px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:20px">Second Look Protect</h1>
    <p style="margin:4px 0 0;font-size:13px;opacity:.85">Your personal scam check — reviewed by Kieran</p>
  </div>
  <div style="border:1px solid #e5decf;border-top:0;padding:26px;border-radius:0 0 12px 12px">
    <p>Hi ${sub.name},</p>
    <p>Thanks for sending this over — here's your report.</p>
    <div style="border-left:5px solid ${verdictLabel.color};background:#faf7f0;padding:14px 18px;margin:18px 0">
      <p style="margin:0;font-size:17px"><strong>${verdictLabel.emoji} ${verdictLabel.label}</strong></p>
      <p style="margin:8px 0 0">${finalHeadline}</p>
    </div>
    <p style="white-space:pre-wrap">${finalExplanation}</p>
    ${finalIndicators.length ? `<h3 style="margin-bottom:6px">What we spotted</h3><ul>${li(finalIndicators)}</ul>` : ""}
    ${finalActions.length ? `<h3 style="margin-bottom:6px">What to do now</h3><ul>${li(finalActions)}</ul>` : ""}
    ${personal_note ? `<p style="background:#eef3ee;border-radius:10px;padding:14px"><strong>A note from Kieran:</strong> ${personal_note}</p>` : ""}
    ${upsell}
    <p style="margin-top:22px">If anything else feels off — even something small — you know where I am.</p>
    <p>Kieran<br/><span style="color:#777">Second Look Protect · part of Learn AI Fast · 07563 887804</span></p>
    <p style="font-size:11px;color:#888;border-top:1px solid #eee;padding-top:12px;margin-top:18px">
      Important: this report is guidance only, based on the information you provided. It is not
      legal or financial advice and cannot guarantee whether something is or isn't a scam.
      Decisions — including any payments or sharing of information — remain your own
      responsibility. If you have lost money, contact your bank immediately and report it to
      Action Fraud on 0300 123 2040 (actionfraud.police.uk).
    </p>
  </div>
</div>`;

    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [sub.email],
        reply_to: process.env.ADMIN_NOTIFY_EMAIL || "hello@learnaifast.co.uk",
        subject: `${verdictLabel.emoji} Your Second Look report — ${verdictLabel.label}`,
        html,
      }),
    });
    if (!sendRes.ok) {
      const t = await sendRes.text();
      console.error("[approve-send] Resend failed:", sendRes.status, t);
      return res.status(500).json({ ok: false, error: "Email failed to send" });
    }

    /* Optional SMS copy of the verdict (The SMS Works, env-gated) */
    let smsResult = "not_requested";
    const wantsSms = sub.details && sub.details._wants_sms === "yes" && sub.phone;
    if (wantsSms) {
      const SMSWORKS_JWT = process.env.SMSWORKS_JWT;
      const SMS_SENDER = process.env.SMS_SENDER || "SecondLook";
      if (SMSWORKS_JWT) {
        try {
          let to = String(sub.phone).replace(/[\s()+-]/g, "");
          if (to.startsWith("07")) to = "44" + to.slice(1);
          /* No emojis in SMS — they force UTF-16 encoding (70-char segments = 4x cost) */
          const smsBody =
            `Second Look Protect: ${verdictLabel.label}. ` +
            `${finalHeadline} Your full report + what to do now is in your email. ` +
            `Guidance only, not financial advice. Lost money? Call your bank & Action Fraud 0300 123 2040.`;
          const sw = await fetch("https://api.thesmsworks.co.uk/v1/message/send", {
            method: "POST",
            headers: {
              Authorization: SMSWORKS_JWT,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ sender: SMS_SENDER, destination: to, content: smsBody }),
          });
          smsResult = sw.ok ? "sent" : "failed";
          if (!sw.ok) console.error("[approve-send] SMS Works failed:", sw.status, await sw.text().catch(() => ""));
        } catch (e) {
          smsResult = "failed";
          console.error("[approve-send] SMS Works error:", e.message || e);
        }
      } else {
        smsResult = "skipped_no_provider";
        console.warn("[approve-send] SMS requested but SMSWORKS_JWT not set — email sent only");
      }
    }

    await fetch(`${SUPABASE_URL}/rest/v1/submissions?id=eq.${sub.id}`, {
      method: "PATCH",
      headers: sb,
      body: JSON.stringify({ status: "sent", sent_at: new Date().toISOString() }),
    });

    return res.status(200).json({ ok: true, sms: smsResult });
  } catch (e) {
    console.error("[approve-send] Error:", e.message || e);
    return res.status(500).json({ ok: false, error: "Unexpected error" });
  }
}
