// api/_notify.js — shared helper: email + WhatsApp notifications to Kieran.
// (SMS via The SMS Works is reserved for customer reports — see approve-send.js.)
// (Files starting with "_" are not exposed as routes by Vercel.)
import { ADMIN_EMAIL, EMAIL_FROM, SUPPORT_EMAIL } from "./_config.js";

export async function notifyKieran({ subject, html, whatsappText, to }) {
  const results = { email: false, whatsapp: false };
  const recipient = to || ADMIN_EMAIL;

  /* Email to the Second Look Protect inbox via Resend */
  try {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (RESEND_API_KEY && EMAIL_FROM) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [recipient],
          reply_to: SUPPORT_EMAIL,
          subject,
          html,
        }),
      });
      results.email = res.ok;
      if (!res.ok) console.error("[notify] Resend error:", res.status, await res.text().catch(() => ""));
    } else {
      console.warn("[notify] Email skipped — RESEND_API_KEY not set");
    }
  } catch (e) {
    console.error("[notify] Email error:", e.message || e);
  }

  /* WhatsApp ping via CallMeBot (free personal notifications) */
  try {
    const PHONE = process.env.CALLMEBOT_PHONE;
    const APIKEY = process.env.CALLMEBOT_APIKEY;
    if (PHONE && APIKEY && whatsappText) {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(
        PHONE
      )}&apikey=${encodeURIComponent(APIKEY)}&text=${encodeURIComponent(whatsappText)}`;
      const res = await fetch(url);
      results.whatsapp = res.ok;
      if (!res.ok) console.error("[notify] CallMeBot error:", res.status);
    } else if (!PHONE || !APIKEY) {
      console.warn("[notify] WhatsApp skipped — CALLMEBOT_PHONE / CALLMEBOT_APIKEY not set");
    }
  } catch (e) {
    console.error("[notify] WhatsApp error:", e.message || e);
  }

  return results;
}

/* WhatsApp-only ping — used by the chase reminders so an unread email
   doesn't get buried under a second copy of the same alert. */
export async function whatsappKieran(text) {
  const PHONE = process.env.CALLMEBOT_PHONE;
  const APIKEY = process.env.CALLMEBOT_APIKEY;
  if (!PHONE || !APIKEY || !text) {
    console.warn("[notify] WhatsApp-only ping skipped — credentials or text missing");
    return false;
  }
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(
      PHONE
    )}&apikey=${encodeURIComponent(APIKEY)}&text=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) console.error("[notify] CallMeBot error:", res.status);
    return res.ok;
  } catch (e) {
    console.error("[notify] WhatsApp error:", e.message || e);
    return false;
  }
}
