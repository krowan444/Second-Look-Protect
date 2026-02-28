export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // 1) Verify secret header
    const secret = req.headers["x-slp-secret"];
    if (!secret || secret !== process.env.SLP_WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 2) Supabase webhook payload (shape can vary a bit)
    const payload = req.body || {};
    const type = (payload.type || payload.eventType || "unknown").toString().toUpperCase();
    const table = (payload.table || "unknown").toString();
    const record = payload.record || payload.new_record || payload.data?.record || null;
    const oldRecord = payload.old_record || payload.old || payload.data?.old_record || null;

    // 3) Decide event name + filter spam
    let eventName = `${table}:${type}`;

    // Approval required = submissions status transitions to needs_review
    if (table === "submissions" && type === "UPDATE") {
      const newStatus = record?.status;
      const oldStatus = oldRecord?.status;

      if (newStatus === "needs_review" && oldStatus !== "needs_review") {
        eventName = "approval_required";
      } else {
        // ignore other updates (prevents spam)
        return res.status(200).json({ ok: true, ignored: true });
      }
    }

    // 4) Message fields
    const orgId = record?.organisation_id ?? "—";
    const id = record?.id ?? "—";
    const createdAt = record?.created_at ?? "—";

    const text =
      `🛡️ Second Look Protect Alert\n` +
      `• Event: ${eventName}\n` +
      `• Table: ${table}\n` +
      `• Org: ${orgId}\n` +
      `• ID: ${id}\n` +
      `• Time: ${createdAt}\n` +
      `• Dashboard: https://secondlookprotect.co.uk/dashboard`;

    // 5) Send Telegram
    const tgResp = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text,
        disable_web_page_preview: true,
      }),
    });

    if (!tgResp.ok) {
      const details = await tgResp.text();
      return res.status(500).json({ error: "Telegram failed", details });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
