// /api/sla-reminders.js
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  // Protect the cron endpoint
  const secret = req.headers["x-cron-secret"];
  if (!secret || secret !== process.env.SLA_CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // TODO: fill these in based on your exact table column names
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "Missing Supabase env vars" });
  }

  // Helper: call Supabase REST with service key (server-side only)
  async function supabaseFetch(path, options = {}) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const text = await r.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    return { ok: r.ok, status: r.status, json, text };
  }

  // Helper: send Telegram
  async function sendTelegram(message) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) throw new Error("Missing Telegram env vars");
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Telegram error ${r.status}: ${t}`);
    }
  }

  // Stage ladder (minutes)
  const stages = [
    { mins: 30, event: "sla_30m" },
    { mins: 60, event: "sla_60m" },
    { mins: 120, event: "sla_120m" },
    { mins: 180, event: "sla_180m" },
    { mins: 240, event: "sla_240m" },
  ];

  // IMPORTANT: this assumes:
  // - table is "submissions"
  // - timestamp column is "created_at" (we will adjust)
  // - status column "status" where unhandled is "new"
  // - handled statuses are anything != "new"
  //
  // We'll tailor these once you confirm timestamp + org column names.

  const now = new Date();

  let totalSent = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Get all unhandled submissions (status = new)
  // Limit to a sensible number per run
  const query = `submissions?select=id,organisation_id,status,created_at&status=eq.new&order=created_at.asc&limit=200`;
  const { ok, status, json, text } = await supabaseFetch(query);

  if (!ok) {
    return res.status(500).json({ error: "Failed to query submissions", status, detail: text });
  }

  const rows = Array.isArray(json) ? json : [];

  // For each submission, decide which stages should fire
  for (const row of rows) {
    try {
      const createdAt = new Date(row.created_at);
      const ageMins = Math.floor((now - createdAt) / 60000);

      for (const st of stages) {
        if (ageMins < st.mins) continue;

        // Dedupe insert into alert_log (unique constraint will block repeats)
        const logInsert = await supabaseFetch("alert_log", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            organisation_id: row.organisation_id ?? null,
            entity_type: "submission",
            entity_id: row.id,
            event_type: st.event,
          }),
        });

        if (!logInsert.ok) {
          // If unique violation, skip quietly
          if (logInsert.status === 409) {
            totalSkipped++;
            continue;
          }
          totalErrors++;
          continue;
        }

        // Send Telegram
        await sendTelegram(`⏱️ SLA REMINDER (${st.mins}m)\nSubmission ${row.id} is still NEW.\nOrg: ${row.organisation_id}`);

        totalSent++;
      }
    } catch (e) {
      totalErrors++;
    }
  }

  return res.status(200).json({
    ok: true,
    checked: rows.length,
    sent: totalSent,
    skipped: totalSkipped,
    errors: totalErrors,
  });
}
