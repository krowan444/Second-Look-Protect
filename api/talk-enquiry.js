// api/talk-enquiry.js — receives a group / corporate AI safety talk enquiry,
// stores it, pings Kieran, and sends the enquirer a warm confirmation.
import { notifyKieran } from "./_notify.js";
import { SUPPORT_EMAIL, TALKS_EMAIL, EMAIL_FROM, SITE_URL, SUPPORT_PHONE } from "./_config.js";

const ORG_TYPE_LABELS = {
  charity: "Charity or voluntary organisation",
  community: "Community group / club / U3A",
  corporate: "Business or corporate team",
  school: "School, college or university",
  public_sector: "Council or public sector",
  other: "Something else",
};

const FORMAT_LABELS = {
  in_person: "In person",
  online: "Online",
  either: "Either — whatever suits",
};

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
    const {
      org_name, org_type, contact_name, email, phone, audience_size,
      preferred_format, preferred_date, location, message, budget,
      hear_about, company_website,
    } = req.body || {};

    /* Honeypot — real people never fill this hidden field in. */
    if (company_website) return res.status(200).json({ ok: true, id: null });

    if (!contact_name || !email || !org_name) {
      return res.status(400).json({ ok: false, error: "Your name, email and organisation are required" });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      return res.status(400).json({ ok: false, error: "That email address doesn't look right" });
    }

    const payload = {
      org_name: String(org_name).trim().slice(0, 200),
      org_type: String(org_type || "other").slice(0, 40),
      contact_name: String(contact_name).trim().slice(0, 120),
      email: cleanEmail,
      phone: phone ? String(phone).trim().slice(0, 40) : null,
      audience_size: audience_size ? String(audience_size).slice(0, 40) : null,
      preferred_format: preferred_format ? String(preferred_format).slice(0, 30) : null,
      preferred_date: preferred_date ? String(preferred_date).slice(0, 80) : null,
      location: location ? String(location).trim().slice(0, 160) : null,
      budget: budget ? String(budget).slice(0, 80) : null,
      message: message ? String(message).trim().slice(0, 4000) : null,
      hear_about: hear_about ? String(hear_about).slice(0, 120) : null,
      status: "new",
    };

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/talk_enquiries`, {
      method: "POST",
      headers: { ...sb, Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    if (!insertRes.ok) {
      const t = await insertRes.text().catch(() => "");
      console.error("[talk-enquiry] Insert failed:", insertRes.status, t);
      if (t.includes("talk_enquiries")) {
        return res.status(500).json({
          ok: false,
          error: "The talks table is missing — run supabase/schema.sql first",
        });
      }
      return res.status(500).json({ ok: false, error: "Could not save your enquiry" });
    }
    const [row] = await insertRes.json();

    const orgTypeLabel = ORG_TYPE_LABELS[row.org_type] || row.org_type;
    const formatLabel = FORMAT_LABELS[row.preferred_format] || row.preferred_format || "Not specified";

    /* Ping Kieran */
    await notifyKieran({
      to: TALKS_EMAIL,
      subject: `🎤 Talk enquiry — ${row.org_name} (${orgTypeLabel})`,
      html:
        `<h2>New AI safety talk enquiry</h2>` +
        `<p><strong>${row.org_name}</strong> — ${orgTypeLabel}</p>` +
        `<p>${row.contact_name} &lt;${row.email}&gt;${row.phone ? " · " + row.phone : ""}</p>` +
        `<table cellpadding="6" style="border-collapse:collapse;font-size:14px">` +
        `<tr><td><strong>Audience size</strong></td><td>${row.audience_size || "—"}</td></tr>` +
        `<tr><td><strong>Format</strong></td><td>${formatLabel}</td></tr>` +
        `<tr><td><strong>When</strong></td><td>${row.preferred_date || "—"}</td></tr>` +
        `<tr><td><strong>Where</strong></td><td>${row.location || "—"}</td></tr>` +
        `<tr><td><strong>Budget</strong></td><td>${row.budget || "—"}</td></tr>` +
        `<tr><td><strong>Heard via</strong></td><td>${row.hear_about || "—"}</td></tr>` +
        `</table>` +
        (row.message ? `<h3>What they said</h3><p style="white-space:pre-wrap">${row.message}</p>` : "") +
        `<p><a href="mailto:${row.email}">Reply to ${row.contact_name}</a></p>`,
      whatsappText:
        `🎤 Talk enquiry: ${row.org_name} (${orgTypeLabel})` +
        `${row.audience_size ? ", ~" + row.audience_size + " people" : ""}` +
        `${row.preferred_date ? ", " + row.preferred_date : ""}. ` +
        `From ${row.contact_name} — ${row.email}`,
    });

    /* Confirmation to the enquirer */
    const firstName = String(row.contact_name || "").trim().split(/\s+/)[0] || "there";
    try {
      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      if (RESEND_API_KEY && EMAIL_FROM) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: [row.email],
            reply_to: SUPPORT_EMAIL,
            subject: `Thanks ${firstName} — your AI safety talk enquiry is with me`,
            html:
              `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#26251f">` +
              `<div style="background:#1c3527;color:#f6f1e4;padding:22px 26px;border-radius:12px 12px 0 0">` +
              `<h1 style="margin:0;font-size:20px">Second Look Protect</h1>` +
              `<p style="margin:4px 0 0;font-size:13px;opacity:.85">AI Scam Safety Talks</p></div>` +
              `<div style="border:1px solid #e5decf;border-top:0;padding:26px;border-radius:0 0 12px 12px">` +
              `<p>Hi ${firstName},</p>` +
              `<p>Thank you for asking about a talk for <strong>${row.org_name}</strong> — it's landed safely with me ` +
              `and I read every one personally.</p>` +
              `<p><strong>What happens next:</strong> I'll come back to you within one working day with a couple of ` +
              `format options, some dates, and a straightforward price. No obligation, and no sales patter.</p>` +
              `<div style="background:#f6f1e4;border-radius:10px;padding:16px;margin:18px 0">` +
              `<p style="margin:0 0 6px"><strong>What you asked about</strong></p>` +
              `<p style="margin:0;font-size:14px">${orgTypeLabel}` +
              `${row.audience_size ? " · around " + row.audience_size + " people" : ""}` +
              `${row.preferred_date ? " · " + row.preferred_date : ""}` +
              `${row.location ? " · " + row.location : ""}</p></div>` +
              `<p>If anything's changed in the meantime, or you'd rather just talk it through, reply to this email ` +
              `or call me on ${SUPPORT_PHONE}.</p>` +
              `<p>Kieran<br/><span style="color:#777">Second Look Protect · ${SUPPORT_EMAIL}</span></p>` +
              `<p style="font-size:12px;color:#888;border-top:1px solid #eee;padding-top:12px;margin-top:18px">` +
              `In the meantime, anyone at ${row.org_name} is welcome to a free scam check at ` +
              `<a href="${SITE_URL}/check" style="color:#1c3527">${SITE_URL.replace(/^https?:\/\//, "")}/check</a>.</p>` +
              `</div></div>`,
          }),
        });
      }
    } catch (e) {
      console.error("[talk-enquiry] Confirmation email failed (non-blocking):", e.message || e);
    }

    return res.status(200).json({ ok: true, id: row.id });
  } catch (e) {
    console.error("[talk-enquiry] Error:", e.message || e);
    return res.status(500).json({ ok: false, error: "Unexpected error" });
  }
}
