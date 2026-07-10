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
    const { name, email, phone, channel, category, description, pasted_text, image_paths } = req.body || {};
    if (!name || !email || !description) {
      return res.status(400).json({ ok: false, error: "name, email and description are required" });
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
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
      method: "POST",
      headers: { ...sb, Prefer: "return=representation" },
      body: JSON.stringify({
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
      }),
    });
    if (!insertRes.ok) {
      const t = await insertRes.text();
      console.error("[submit] Insert failed:", insertRes.status, t);
      return res.status(500).json({ ok: false, error: "Could not save your request" });
    }
    const [row] = await insertRes.json();

    /* 3. Ping Kieran (non-blocking failure) */
    const badge =
      memberStatus === "member" ? "🟢 MEMBER" : memberStatus === "free" ? "🔵 Free check" : "🟠 Free check already used";
    await notifyKieran({
      subject: `🔍 New scam check from ${row.name} (${badge})`,
      html:
        `<h2>New Second Look request</h2>` +
        `<p><strong>${row.name}</strong> &lt;${row.email}&gt; ${row.phone ? "· " + row.phone : ""}</p>` +
        `<p>Status: <strong>${badge}</strong> · Type: ${row.category}</p>` +
        `<p style="white-space:pre-wrap">${(row.description || "").slice(0, 1000)}</p>` +
        `<p>${Array.isArray(row.image_paths) && row.image_paths.length ? row.image_paths.length + " screenshot(s) attached" : "No screenshots"}</p>` +
        `<p>The AI report is being generated now — review it in your dashboard.</p>`,
      whatsappText: `🔍 New scam check from ${row.name} (${badge}). AI report generating — check the dashboard.`,
    });

    return res.status(200).json({ ok: true, id: row.id, member_status: memberStatus });
  } catch (e) {
    console.error("[submit] Error:", e.message || e);
    return res.status(500).json({ ok: false, error: "Unexpected error" });
  }
}
