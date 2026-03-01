// /api/sla-reminders.js

export default async function handler(req, res) {
  // Only allow GET (Vercel Cron hits with GET)
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 🔐 Protect cron endpoint
  const secret = req.headers["x-cron-secret"];
  if (!secret || secret !== process.env.SLA_CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "Missing Supabase env vars" });
  }

  // Helper: Supabase REST call
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
    try {
      json = text ? JSON.parse(text) : null;
    } catch {}

    return { ok: r.ok, status: r.status, json, text };
  }

  // Helper: Telegram
  async function sendTelegram(message) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      throw new Error("Missing Telegram env vars");
    }

    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        disable_web_page_preview: true,
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Telegram error ${r.status}: ${t}`);
    }
  }

  // 🔔 SLA stages (minutes)
  const STAGES = [30, 60, 120, 180, 240];

  const now = new Date();
  let totalSent = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // ✅ Pull NEW cases ordered oldest first
  // Uses submitted_at (your real column)
  const query =
    "cases?select=id,organisation_id,status,submitted_at" +
    "&status=eq.new" +
    "&order=submitted_at.asc" +
    "&limit=200";

  const { ok, status, json, text } = await supabaseFetch(query);

  if (!ok) {
    return res.status(500).json({
      error: "Failed to query cases",
      status,
      detail: text,
    });
  }

  const rows = Array.isArray(json) ? json : [];

  for (const row of rows) {
    try {
      if (!row.submitted_at) continue;

      const createdAt = new Date(row.submitted_at);
      const ageMins = Math.floor((now - createdAt) / 60000);

      // Stop immediately if status changes away from new
      // (extra defensive – although query already filters status=new)
      if (row.status !== "new") continue;

      for (const stage of STAGES) {
        if (ageMins < stage) continue;

        // 🔎 Check alert_log first (dedupe)
        const checkPath =
          `alert_log?select=id` +
          `&entity_type=eq.case` +
          `&entity_id=eq.${row.id}` +
          `&event_type=eq.sla_reminder` +
          `&stage_minutes=eq.${stage}` +
          `&limit=1`;

        const check = await supabaseFetch(checkPath);

        if (!check.ok) {
          totalErrors++;
          continue;
        }

        if (Array.isArray(check.json) && check.json.length > 0) {
          totalSkipped++;
          continue; // already sent
        }

        // 📝 Insert into alert_log (unique index protects against race)
        const insert = await supabaseFetch("alert_log", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            organisation_id: row.organisation_id ?? null,
            entity_type: "case",
            entity_id: row.id,
            event_type: "sla_reminder",
            stage_minutes: stage,
            sent_at: new Date().toISOString(),
          }),
        });

        if (!insert.ok) {
          // 409 = unique constraint hit (safe to ignore)
          if (insert.status === 409) {
            totalSkipped++;
            continue;
          }
          totalErrors++;
          continue;
        }

        // 📲 Send Telegram
        await sendTelegram(
          `⏱️ SLA REMINDER (${stage}m)\n` +
            `Case ${row.id} is still NEW.\n` +
            `Org: ${row.organisation_id ?? "—"}`
        );

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
