// /api/alerts-ingest.js
// ── Webhook receiver for Supabase case events ────────────────────────────
// Receives INSERT/UPDATE webhooks from Supabase, sends Telegram alerts,
// and dispatches email notifications through the shared email-dispatch service.

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const secret = req.headers["x-slp-secret"];
    if (!secret || secret !== process.env.SLP_WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = req.body || {};
    const type = (payload.type || payload.eventType || "unknown").toString().toUpperCase();
    const table = (payload.table || "unknown").toString();
    const record = payload.record || payload.new_record || payload.data?.record || null;
    const oldRecord = payload.old_record || payload.old || payload.data?.old_record || null;

    let eventName = `${table}:${type}`;

    // ── Determine email events to dispatch ───────────────────────────────
    const emailEvents = [];
    const orgId = record?.organisation_id ?? null;
    const caseId = record?.id ?? null;

    if (table === "cases" && type === "INSERT") {
      // New case created
      emailEvents.push({ event_type: "admin_case_created", case_id: caseId, context: { message: `New case submitted (${record?.submission_type || 'general'})` } });

      // Check risk level on insert
      const risk = (record?.risk_level || '').toLowerCase();
      if (risk === 'high') {
        emailEvents.push({ event_type: "admin_high_risk_alert", case_id: caseId, context: { message: `A high-risk case has been flagged and requires urgent review.` } });
      }
      if (risk === 'critical') {
        emailEvents.push({ event_type: "admin_critical_case", case_id: caseId, context: { message: `A critical-risk case has been flagged — immediate attention required.` } });
      }
    }

    if (table === "cases" && type === "UPDATE") {
      const newStatus = record?.status;
      const oldStatus = oldRecord?.status;
      const newRisk = (record?.risk_level || '').toLowerCase();
      const oldRisk = (oldRecord?.risk_level || '').toLowerCase();

      // Case updated (general)
      emailEvents.push({ event_type: "admin_case_updated", case_id: caseId, context: { message: `Case has been updated.` } });

      // Status transitions — for Telegram, only alert on needs_review
      if (newStatus === "needs_review" && oldStatus !== "needs_review") {
        eventName = "approval_required";
      }

      // Status: moved to review → staff notification
      if (newStatus === "in_review" && oldStatus !== "in_review") {
        emailEvents.push({ event_type: "staff_case_moved_to_review", case_id: caseId, context: { message: `Your case has been moved to review.` } });
      }

      // Status: closed → staff notification
      if (newStatus === "closed" && oldStatus !== "closed") {
        emailEvents.push({ event_type: "staff_case_closed", case_id: caseId, context: { message: `Your case has been closed.` } });
      }

      // Risk level escalations
      if (newRisk === 'high' && oldRisk !== 'high') {
        emailEvents.push({ event_type: "admin_high_risk_alert", case_id: caseId, context: { message: `A case has been escalated to high-risk.` } });
      }
      if (newRisk === 'critical' && oldRisk !== 'critical') {
        emailEvents.push({ event_type: "admin_critical_case", case_id: caseId, context: { message: `A case has been escalated to critical-risk — immediate attention required.` } });
      }

      // Assignment change → staff notification
      const newAssigned = record?.assigned_to;
      const oldAssigned = oldRecord?.assigned_to;
      if (newAssigned && newAssigned !== oldAssigned) {
        emailEvents.push({ event_type: "staff_case_assigned", case_id: caseId, actor_id: newAssigned, context: { message: `A case has been assigned to you.` } });
      }

      // Evidence count increase → admin notification
      const newEvidence = record?.evidence_count ?? 0;
      const oldEvidence = oldRecord?.evidence_count ?? 0;
      if (newEvidence > oldEvidence) {
        emailEvents.push({ event_type: "admin_new_evidence", case_id: caseId, context: { message: `New evidence has been uploaded to a case.` } });
        // Also notify assigned staff
        if (record?.assigned_to) {
          emailEvents.push({ event_type: "staff_evidence_added", case_id: caseId, actor_id: record.assigned_to, context: { message: `New evidence has been added to your case.` } });
        }
      }

      // Outcome → loss threshold (the SQL trigger handles the actual threshold check,
      // but we also fire the email event so the dispatcher can act on it)
      const newOutcome = (record?.outcome || '').toLowerCase();
      const oldOutcome = (oldRecord?.outcome || '').toLowerCase();
      if (newOutcome === 'lost' && oldOutcome !== 'lost') {
        emailEvents.push({ event_type: "admin_loss_threshold", case_id: caseId, context: { message: `A loss outcome has been recorded.` } });
      }
    }

    // Inspection pack events
    if (table === "inspection_snapshots" && type === "INSERT") {
      emailEvents.push({ event_type: "admin_inspection_pack_generated", context: { message: `An inspection pack snapshot has been generated.` } });
    }

    if (table === "inspection_pack_deliveries" && type === "INSERT") {
      emailEvents.push({ event_type: "admin_inspection_pack_sent", context: { message: `An inspection pack has been sent to recipients.` } });
    }

    // New user events
    if (table === "profiles" && type === "INSERT") {
      emailEvents.push({ event_type: "admin_new_user", context: { message: `A new user (${record?.email || 'unknown'}) has been added to the organisation.` } });
    }

    // ── Send Telegram (existing behaviour) ───────────────────────────────
    // Only for the events that were originally Telegram-notified
    if (table === "cases" || eventName === "approval_required") {
      // Skip non-needs_review updates for Telegram (original behaviour)
      if (table === "cases" && type === "UPDATE" && eventName !== "approval_required") {
        // Original code returned early here — we skip Telegram but still dispatch emails below
      } else {
        const id = record?.id ?? "—";
        const createdAt = record?.created_at ?? "—";

        const text =
          `🛡️ Second Look Protect Alert\n` +
          `• Event: ${eventName}\n` +
          `• Table: ${table}\n` +
          `• Org: ${orgId ?? "—"}\n` +
          `• ID: ${id}\n` +
          `• Time: ${createdAt}\n` +
          `• Dashboard: https://secondlookprotect.co.uk/dashboard`;

        try {
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
            console.error('[alerts-ingest] Telegram failed:', details);
          }
        } catch (tgErr) {
          console.error('[alerts-ingest] Telegram error:', tgErr);
        }
      }
    }

    // ── Dispatch email events ────────────────────────────────────────────
    if (orgId && emailEvents.length > 0) {
      const host = req.headers['host'] || 'localhost:3000';
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const dispatchUrl = `${protocol}://${host}/api/email-dispatch`;

      for (const ev of emailEvents) {
        try {
          await fetch(dispatchUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-slp-secret': process.env.SLP_WEBHOOK_SECRET,
            },
            body: JSON.stringify({
              event_type: ev.event_type,
              organisation_id: orgId,
              case_id: ev.case_id || null,
              actor_id: ev.actor_id || null,
              context: ev.context || {},
            }),
          });
        } catch (dispatchErr) {
          console.error(`[alerts-ingest] Email dispatch error for ${ev.event_type}:`, dispatchErr);
        }
      }
    }

    return res.status(200).json({ ok: true, emailEventsDispatched: emailEvents.length });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
