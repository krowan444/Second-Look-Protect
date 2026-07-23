// api/submit.js — receives a scam-check request from the public form,
// works out membership status, stores it, and pings Kieran.
import { notifyKieran } from "./_notify.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ ok: false, error: "Server not configured" });
  }
  const sb = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };

  try {
    const { name, email, phone, channel, category, description, pasted_text, image_paths, details, wants_sms, terms_accepted } = req.body || {};
    if (!name || !email || !description) {
      return res.status(400).json({ ok: false, error: "name, email and description are required" });
    }
    /* Server-side enforcement of the guidance-not-advice consent —
       the form requires it, but reject direct API calls without it too. */
    if (!terms_accepted) {
      return res.status(400).json({ ok: false, error: "You must confirm you understand this is guidance, not financial or legal advice." });
    }
    const cleanEmail = String(email).trim().toLowerCase();

    /* 1. Membership status */
    let memberStatus = "free";
    const memberRes = await fetch(
      `${SUPABASE_URL}/rest/v1/members?email=eq.${encodeURIComponent(cleanEmail)}&status=eq.active&limit=1`,
      { headers: sb }
    );
    const memberRows = memberRes.ok ? await memberRes.json() : [];
    if (memberRows.length > 0) {
      memberStatus = "member";
    } else {
      const prevRes = await fetch(
        `${SUPABASE_URL}/rest/v1/submissions?email=eq.${encodeURIComponent(cleanEmail)}&select=id&limit=1`,
        { headers: sb }
      );
      const prevRows = prevRes.ok ? await prevRes.json() : [];
      if (prevRows.length > 0) memberStatus = "free_used";
    }

    /* 2. Store the submission */
    const basePayload = {
      name: String(name).trim(),
      email: cleanEmail,
      phone: phone ? String(phone).trim() : null,
      channel: channel || "email",
      category: category || "message",
      description: String(description).trim(),
      pasted_text: pasted_text ? String(pasted_text) : null,
      image_paths: Array.isArray(image_paths) ? image_paths : [],
      member_status: memberStatus,
      status: "new",
    };
    const cleanDetails = details && typeof details === "object" ? { ...details } : {};
    if (wants_sms) cleanDetails._wants_sms = "yes";
    if (terms_accepted) cleanDetails._terms_accepted_at = new Date().toISOString();

    let insertRes = await fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
      method: "POST",
      headers: { ...sb, Prefer: "return=representation" },
      body: JSON.stringify({ ...basePayload, details: cleanDetails }),
    });
    if (!insertRes.ok) {
      const t = await insertRes.text();
      console.error("[submit] Insert failed:", insertRes.status, t);
      /* fallback: retry without the details column if the DB migration
         hasn't been run yet — the answers get folded into the description */
      if (t.includes("details")) {
        const merged = Object.keys(cleanDetails).length
          ? basePayload.description + "\n\n[Details] " + JSON.stringify(cleanDetails)
          : basePayload.description;
        insertRes = await fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
          method: "POST",
          headers: { ...sb, Prefer: "return=representation" },
          body: JSON.stringify({ ...basePayload, description: merged }),
        });
      }
      if (!insertRes.ok) {
        return res.status(500).json({ ok: false, error: "Could not save your request" });
      }
    }
    const [row] = await insertRes.json();

    /* 3. Ping Kieran (non-blocking failure) */
    const badge =
      memberStatus === "member" ? "🟢 MEMBER" : memberStatus === "free" ? "🔵 Free check" : "🟠 Free check already used";
    const caseUrl = `https://second-look-protect.vercel.app/admin?case=${row.id}`;
    await notifyKieran({
      subject: `🔍 New scam check from ${row.name} (${badge})`,
      html:
        `<h2>New Second Look request</h2>` +
        `<p><strong>${row.name}</strong> &lt;${row.email}&gt; ${row.phone ? "· " + row.phone : ""}</p>` +
        `<p>Status: <strong>${badge}</strong> · Type: ${row.category}</p>` +
        `<p style="white-space:pre-wrap">${(row.description || "").slice(0, 1000)}</p>` +
        `<p>${Array.isArray(row.image_paths) && row.image_paths.length ? row.image_paths.length + " screenshot(s) attached" : "No screenshots"}</p>` +
        `<p><a href="${caseUrl}">Open this case in your dashboard</a></p>`,
      whatsappText: `🔍 New scam check from ${row.name} (${badge}). Approve to run the AI: ${caseUrl}`,
    });

    /* 4. Acknowledge to the customer (non-blocking) — email always, SMS if requested */
    const firstName = String(row.name || "").trim().split(/\s+/)[0] || "there";
    try {
      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      const EMAIL_FROM = process.env.EMAIL_FROM;
      if (RESEND_API_KEY && EMAIL_FROM) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: [row.email],
            reply_to: process.env.ADMIN_NOTIFY_EMAIL || "hello@learnaifast.co.uk",
            subject: `🌱 We've got it, ${firstName} — your Second Look is underway`,
            html:
              `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#26251f">` +
              `<h2 style="color:#1c3527">It's safely with us — well done for checking first.</h2>` +
              `<p>Hi ${firstName},</p>` +
              `<p>Your request has come through and I'm personally looking at it. You'll get your ` +
              `plain-English report by email${row.details && row.details._wants_sms === "yes" ? " (and a text with the verdict)" : ""} — usually within a few hours, always the same day.</p>` +
              `<p style="background:#f6f1e4;border-radius:10px;padding:14px"><strong>While you wait:</strong> ` +
              `it's safest to hold off clicking any links, calling any numbers from the message, or sending any money — just until you have your answer. ` +
              `And if you've already shared bank details, it's worth calling your bank now on the number on the back of your card, just to be safe.</p>` +
              `<p>Checking first is exactly the right thing to do — most scams rely on people rushing. You didn't.</p>` +
              `<p>Kieran<br/><span style="color:#777">Second Look Protect · A calm second opinion before you act</span></p>` +
              `<p style="font-size:11px;color:#888;border-top:1px solid #eee;padding-top:12px">` +
              `Our reports are guidance based on the information you provide — not legal or financial advice.</p>` +
              `</div>`,
          }),
        });
      }
    } catch (e) {
      console.error("[submit] Customer ack email failed (non-blocking):", e.message || e);
    }
    try {
      const SMSWORKS_JWT = process.env.SMSWORKS_JWT;
      const SMS_SENDER = process.env.SMS_SENDER || "SecondLook";
      if (SMSWORKS_JWT && wants_sms && row.phone) {
        let to = String(row.phone).replace(/[\s()+-]/g, "");
        if (to.startsWith("07")) to = "44" + to.slice(1);
        await fetch("https://api.thesmsworks.co.uk/v1/message/send", {
          method: "POST",
          headers: { Authorization: SMSWORKS_JWT, "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: SMS_SENDER,
            destination: to,
            content: `Second Look Protect: your check has arrived safely and I'm taking a look now. Your report should be with you within a few hours. Best to wait before clicking anything or paying. Kieran`,
          }),
        });
      }
    } catch (e) {
      console.error("[submit] Customer ack SMS failed (non-blocking):", e.message || e);
    }

    return res.status(200).json({ ok: true, id: row.id, member_status: memberStatus });
  } catch (e) {
    console.error("[submit] Error:", e.message || e);
    return res.status(500).json({ ok: false, error: "Unexpected error" });
  }
}
