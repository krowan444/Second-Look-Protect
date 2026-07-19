// api/_notify.js — shared helper: email + WhatsApp + SMS notifications to Kieran.
// (Files starting with "_" are not exposed as routes by Vercel.)

export async function notifyKieran({ subject, html, whatsappText, smsText }) {
  const results = { email: false, whatsapp: false, sms: false };

  /* Email to hello@learnaifast.co.uk via Resend */
  try {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const EMAIL_FROM = process.env.EMAIL_FROM;
    const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || "hello@learnaifast.co.uk";
    if (RESEND_API_KEY && EMAIL_FROM) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({ from: EMAIL_FROM, to: [ADMIN_EMAIL], subject, html }),
      });
      results.email = res.ok;
      if (!res.ok) console.error("[notify] Resend error:", res.status, await res.text().catch(() => ""));
    } else {
      console.warn("[notify] Email skipped — RESEND_API_KEY / EMAIL_FROM not set");
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

  /* SMS to Kieran's phone via The SMS Works */
  try {
    const SMSWORKS_JWT = process.env.SMSWORKS_JWT;
    const ADMIN_SMS_PHONE = process.env.ADMIN_SMS_PHONE; // e.g. 447563887804
    const SMS_SENDER = process.env.SMS_SENDER || "SecondLook";
    const body = smsText || whatsappText;
    if (SMSWORKS_JWT && ADMIN_SMS_PHONE && body) {
      const res = await fetch("https://api.thesmsworks.co.uk/v1/message/send", {
        method: "POST",
        headers: { Authorization: SMSWORKS_JWT, "Content-Type": "application/json" },
        body: JSON.stringify({ sender: SMS_SENDER, destination: ADMIN_SMS_PHONE, content: body.slice(0, 640) }),
      });
      results.sms = res.ok;
      if (!res.ok) console.error("[notify] SMS Works error:", res.status, await res.text().catch(() => ""));
    } else if (!SMSWORKS_JWT || !ADMIN_SMS_PHONE) {
      console.warn("[notify] SMS skipped — SMSWORKS_JWT / ADMIN_SMS_PHONE not set");
    }
  } catch (e) {
    console.error("[notify] SMS error:", e.message || e);
  }

  return results;
}
