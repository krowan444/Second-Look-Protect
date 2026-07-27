// api/reminders.js — chase pings so a check never gets forgotten.
//
// Runs on a Vercel cron every 10 minutes. Any submission that hasn't been
// sent to the customer yet gets an escalating WhatsApp nudge at roughly
// 30, 60 and 90 minutes after it arrived. Each stage fires once only.
//
// Secured with CRON_SECRET: Vercel cron sends it as a Bearer token, and you
// can also trigger it by hand with /api/reminders?key=<CRON_SECRET>.
import { whatsappKieran, notifyKieran } from "./_notify.js";
import { SITE_URL } from "./_config.js";

/* Minutes after arrival at which each nudge fires, and how it reads. */
const STAGES = [
  { minutes: 30, tone: "Gentle nudge", prefix: "⏰" },
  { minutes: 60, tone: "Getting on", prefix: "⚠️" },
  { minutes: 90, tone: "Please pick this up", prefix: "🚨" },
];

/* Statuses that mean the job is finished and needs no more chasing. */
const CLOSED = ["sent", "dismissed"];

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ ok: false, error: "Server not configured" });
  }

  /* Auth — only Vercel cron (or you, with the key) may run this. */
  if (CRON_SECRET) {
    const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const key = req.query?.key;
    if (bearer !== CRON_SECRET && key !== CRON_SECRET) {
      return res.status(401).json({ ok: false, error: "Not authorised" });
    }
  } else {
    console.warn("[reminders] CRON_SECRET not set — endpoint is unauthenticated");
  }

  const sb = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };

  try {
    /* Anything still open and at least the first threshold old. */
    const cutoff = new Date(Date.now() - STAGES[0].minutes * 60_000).toISOString();
    const url =
      `${SUPABASE_URL}/rest/v1/submissions` +
      `?status=not.in.(${CLOSED.join(",")})` +
      `&created_at=lt.${encodeURIComponent(cutoff)}` +
      `&select=id,created_at,name,email,category,status,member_status,reminder_stage` +
      `&order=created_at.asc&limit=100`;

    const listRes = await fetch(url, { headers: sb });
    if (!listRes.ok) {
      const t = await listRes.text().catch(() => "");
      console.error("[reminders] Query failed:", listRes.status, t);
      /* If the migration hasn't been run yet the column is missing — say so clearly. */
      if (t.includes("reminder_stage")) {
        return res.status(500).json({
          ok: false,
          error: "Run the reminder_stage migration in supabase/schema.sql first",
        });
      }
      return res.status(500).json({ ok: false, error: "Could not read the queue" });
    }
    const rows = await listRes.json();

    const fired = [];
    for (const row of rows) {
      const ageMins = Math.floor((Date.now() - new Date(row.created_at).getTime()) / 60_000);
      const already = Number(row.reminder_stage || 0);

      /* Highest threshold this submission has now passed. */
      const due = STAGES.filter((s) => ageMins >= s.minutes).pop();
      if (!due || due.minutes <= already) continue;

      const isMember = row.member_status === "member";
      const caseUrl = `${SITE_URL}/admin?case=${row.id}`;
      const text =
        `${due.prefix} ${due.tone}: ${row.name}'s ${String(row.category || "check").replace(/_/g, " ")} ` +
        `has been waiting ${ageMins} minutes and the report still hasn't gone out` +
        `${isMember ? " — this one's a MEMBER" : ""}. ${caseUrl}`;

      const ok = await whatsappKieran(text);

      /* At 90 minutes also send an email, in case the phone is face-down. */
      if (due.minutes >= 90) {
        await notifyKieran({
          subject: `🚨 Still unsent after ${ageMins} min — ${row.name}`,
          html:
            `<h2>This check is still waiting</h2>` +
            `<p><strong>${row.name}</strong> &lt;${row.email}&gt; sent a ${String(row.category || "check").replace(/_/g, " ")} ` +
            `<strong>${ageMins} minutes ago</strong> and the report hasn't been approved yet.</p>` +
            `${isMember ? `<p><strong>They are a Peace of Mind member.</strong></p>` : ""}` +
            `<p><a href="${caseUrl}">Open this case and send the report</a></p>`,
        });
      }

      await fetch(`${SUPABASE_URL}/rest/v1/submissions?id=eq.${row.id}`, {
        method: "PATCH",
        headers: sb,
        body: JSON.stringify({ reminder_stage: due.minutes }),
      });

      fired.push({ id: row.id, name: row.name, stage: due.minutes, age_mins: ageMins, whatsapp: ok });
    }

    return res.status(200).json({ ok: true, checked: rows.length, reminded: fired.length, fired });
  } catch (e) {
    console.error("[reminders] Error:", e.message || e);
    return res.status(500).json({ ok: false, error: "Unexpected error" });
  }
}
