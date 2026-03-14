// /api/email-dispatch.js
// ── Shared Email Notification Dispatcher ─────────────────────────────────
// Central endpoint for all event-based email alerts.
// Input: { event_type, organisation_id, case_id?, actor_id?, context? }
// Flow: auth → load settings → check enabled → resolve recipients → send → log

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const EMAIL_FROM = process.env.EMAIL_FROM;
    const SLP_SECRET = process.env.SLP_WEBHOOK_SECRET;

    if (!SUPABASE_URL || !SERVICE_KEY) {
        return res.status(500).json({ ok: false, error: 'Missing Supabase env vars' });
    }
    if (!RESEND_API_KEY || !EMAIL_FROM) {
        return res.status(500).json({ ok: false, error: 'Missing email env vars (RESEND_API_KEY, EMAIL_FROM)' });
    }

    // ── Auth: x-slp-secret (server-to-server) OR Bearer JWT (frontend) ────
    const secret = req.headers['x-slp-secret'];
    const authHeader = req.headers['authorization'] || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    let authed = false;

    if (secret && secret === SLP_SECRET) {
        authed = true;
    } else if (bearerToken) {
        // Verify the JWT is a valid Supabase user session
        try {
            const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
                headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${bearerToken}` },
            });
            if (userRes.ok) authed = true;
        } catch { /* auth failed */ }
    }

    if (!authed) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    // ── Developer Feedback (Stape-Lee) — direct send, no org pipeline ─────
    const { event_type, organisation_id, case_id, actor_id, context } = req.body || {};

    if (event_type === 'developer_feedback') {
        const FEEDBACK_RECIPIENTS = [
            'hello@secondlookprotect.co.uk',
            'reports@secondlookprotect.co.uk',
        ];
        const feedbackContext = context || {};
        const senderName = feedbackContext.userName || 'Unknown user';
        const senderEmail = feedbackContext.userEmail || '—';
        const orgName = feedbackContext.organisationName || '—';
        const timestamp = new Date().toISOString();

        console.log('[stape-lee-feedback] ═══ FEEDBACK SEND REQUESTED ═══');
        console.log(`[stape-lee-feedback] Recipients: ${FEEDBACK_RECIPIENTS.join(', ')}`);
        console.log(`[stape-lee-feedback] Sender: ${senderName} (${senderEmail}) | Org: ${orgName}`);
        console.log(`[stape-lee-feedback] Category: ${feedbackContext.category || 'General'} | Page: ${feedbackContext.page || 'unknown'} | Priority: ${feedbackContext.priority || 'Medium'}`);

        const fbSubject = `[${feedbackContext.category || 'Feedback'}] Dashboard Feedback — ${feedbackContext.page || 'Dashboard'}`;
        const fbBody =
            `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto">` +
            `<div style="background:#1e293b;color:#f1f5f9;padding:16px 20px;border-radius:10px 10px 0 0">` +
            `<strong>🔧 Developer Feedback via Stape-Lee</strong></div>` +
            `<div style="background:#f8fafc;padding:20px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px">` +
            `<table style="width:100%;border-collapse:collapse;font-size:14px">` +
            `<tr><td style="padding:6px 0;color:#64748b;width:110px"><strong>From</strong></td><td>${escapeHtml(senderName)}${senderEmail !== '—' ? ` (${escapeHtml(senderEmail)})` : ''}</td></tr>` +
            `<tr><td style="padding:6px 0;color:#64748b"><strong>Organisation</strong></td><td>${escapeHtml(orgName)}</td></tr>` +
            `<tr><td style="padding:6px 0;color:#64748b"><strong>Type</strong></td><td>${feedbackContext.category || 'General'}</td></tr>` +
            `<tr><td style="padding:6px 0;color:#64748b"><strong>Page</strong></td><td>${feedbackContext.page || 'Unknown'}</td></tr>` +
            `<tr><td style="padding:6px 0;color:#64748b"><strong>Priority</strong></td><td>${feedbackContext.priority || 'Medium'}</td></tr>` +
            `</table>` +
            `<hr style="border:none;border-top:1px solid #e2e8f0;margin:14px 0"/>` +
            `<div style="font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(feedbackContext.description || '(No description)')}</div>` +
            `<hr style="border:none;border-top:1px solid #e2e8f0;margin:14px 0"/>` +
            `<div style="font-size:12px;color:#94a3b8">` +
            `Sent from: ${feedbackContext.sourceUrl || 'Dashboard'}<br/>` +
            `Timestamp: ${timestamp}` +
            `</div></div></div>`;

        console.log(`[stape-lee-feedback] Payload built: subject="${fbSubject}" | html_length=${fbBody.length}`);

        try {
            const fbRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${RESEND_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: EMAIL_FROM,
                    to: FEEDBACK_RECIPIENTS,
                    subject: fbSubject,
                    html: fbBody,
                }),
            });
            const fbData = await fbRes.json();

            if (fbRes.ok) {
                console.log(`[stape-lee-feedback] ✔ EMAIL SENT — provider_id: ${fbData?.id} | recipients: ${FEEDBACK_RECIPIENTS.join(', ')}`);
                return res.status(200).json({ ok: true, sent: true, provider_message_id: fbData?.id });
            } else {
                console.error(`[stape-lee-feedback] ✖ EMAIL FAILED — status: ${fbRes.status} | error: ${fbData?.message || 'unknown'}`);
                return res.status(500).json({ ok: false, error: fbData?.message || `Provider error (${fbRes.status})`, step: 'resend' });
            }
        } catch (fbErr) {
            console.error(`[stape-lee-feedback] ✖ EXCEPTION — ${fbErr.message}`);
            return res.status(500).json({ ok: false, error: fbErr.message || 'Send failed', step: 'exception' });
        }
    }

    // ── Standard event dispatch continues below ──────────────────────────
    if (!event_type || !organisation_id) {
        return res.status(400).json({ ok: false, error: 'Missing required: event_type, organisation_id' });
    }

    const sbHeaders = {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
    };

    // ── Diagnostic trace flag (admin_case_created only) ──────────────────
    const trace = (event_type === 'admin_case_created');
    if (trace) console.log('[SLP-DIAG] Route entered — event_type:', event_type, '| case_id:', case_id, '| organisation_id:', organisation_id);

    // ── Event type → settings column mapping ─────────────────────────────
    const EVENT_CONFIG = {
        // Admin events → alert_recipients
        admin_case_created: { col: 'email_admin_case_created', type: 'admin', subject: 'New Case Created', icon: '📋' },
        admin_case_updated: { col: 'email_admin_case_updated', type: 'staff', subject: 'Case Updated by Admin', icon: '✏️' },
        admin_high_risk_alert: { col: 'email_admin_high_risk_alert', type: 'admin', subject: 'High-Risk Case Flagged', icon: '🔴' },
        admin_critical_case: { col: 'email_admin_critical_case', type: 'admin', subject: 'Critical Case Flagged', icon: '🚨' },
        admin_sla_breach: { col: 'email_admin_sla_breach', type: 'admin', subject: 'SLA Breach Alert', icon: '⏱️' },
        admin_overdue_review: { col: 'email_admin_overdue_review', type: 'admin', subject: 'Overdue Review Alert', icon: '⏳' },
        admin_escalation_notice: { col: 'email_admin_escalation_notice', type: 'admin', subject: 'Escalation Notice', icon: '📢' },
        admin_new_evidence: { col: 'email_admin_new_evidence', type: 'admin', subject: 'New Evidence Uploaded', icon: '📎' },
        admin_inspection_pack_generated: { col: 'email_admin_inspection_pack_generated', type: 'admin', subject: 'Inspection Pack Generated', icon: '📦' },
        admin_inspection_pack_sent: { col: 'email_admin_inspection_pack_sent', type: 'admin', subject: 'Inspection Pack Sent', icon: '📨' },
        admin_repeat_targeting: { col: 'email_admin_repeat_targeting', type: 'admin', subject: 'Repeat Targeting Detected', icon: '🔁' },
        admin_loss_threshold: { col: 'email_admin_loss_threshold', type: 'admin', subject: 'Loss Threshold Reached', icon: '💰' },
        admin_new_user: { col: 'email_admin_new_user', type: 'admin', subject: 'New User Added', icon: '👤' },
        // Staff events → assigned staff/submitter
        staff_case_assigned: { col: 'email_staff_case_assigned', type: 'staff', subject: 'Case Assigned to You', icon: '📌' },
        staff_case_moved_to_review: { col: 'email_staff_case_moved_to_review', type: 'staff', subject: 'Your Case Moved to Review', icon: '🔍' },
        staff_case_closed: { col: 'email_staff_case_closed', type: 'staff', subject: 'Your Case Has Been Closed', icon: '✅' },
        staff_information_requested: { col: 'email_staff_information_requested', type: 'staff', subject: 'Information Requested', icon: '❓' },
        staff_evidence_requested: { col: 'email_staff_evidence_requested', type: 'staff', subject: 'Evidence Requested', icon: '📋' },
        staff_evidence_added: { col: 'email_staff_evidence_added', type: 'staff', subject: 'Evidence Added to Your Case', icon: '📎' },
    };

    const config = EVENT_CONFIG[event_type];
    if (!config) {
        return res.status(400).json({ ok: false, error: `Unknown event_type: ${event_type}` });
    }

    try {
        // 1) Load organisation settings
        const settingsRes = await fetch(
            `${SUPABASE_URL}/rest/v1/organisation_settings?organisation_id=eq.${organisation_id}&select=*&limit=1`,
            { headers: sbHeaders }
        );
        if (!settingsRes.ok) {
            throw new Error(`Failed to load settings: ${settingsRes.status}`);
        }
        const settingsRows = await settingsRes.json();
        const settings = settingsRows?.[0] ?? {};

        // 2) Check if this email event is enabled (admin operational alert toggle)
        const isEnabled = settings[config.col] ?? false;
        if (trace) console.log('[SLP-DIAG] Settings loaded —', config.col, ':', isEnabled, '| alert_recipients:', settings.alert_recipients);

        // For admin_case_created: the admin alert toggle and the personal user path
        // are INDEPENDENT. The admin toggle only controls the operational alert.
        // The personal path uses notify_admin_case_created (in-app master) as its gate.
        // So we must NOT early-return here for admin_case_created.
        if (!isEnabled && event_type !== 'admin_case_created') {
            if (trace) console.log('[SLP-DIAG] Event disabled — skipping');
            await logEmail(SUPABASE_URL, sbHeaders, {
                organisation_id,
                case_id: case_id || null,
                event_type,
                recipient_email: '(skipped — disabled)',
                subject: config.subject,
                status: 'skipped',
                meta: { reason: 'skipped_org_disabled' },
            });
            return res.status(200).json({ ok: true, skipped: true, reason: 'Event disabled in settings' });
        }

        // 3) Resolve recipients for the admin operational alert path
        let recipients = [];
        let recipientRole = null;
        let adminAlertSkipped = false;

        // ── Guard: admin_case_updated special checks ─────────────────────────
        // Only send if: updater is an admin, case is not closed, actor ≠ recipient
        if (event_type === 'admin_case_updated' && case_id) {
            // Check updater is an admin
            if (actor_id) {
                const actorRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${actor_id}&select=role&limit=1`,
                    { headers: sbHeaders }
                );
                if (actorRes.ok) {
                    const actorRows = await actorRes.json();
                    const actorRole = actorRows?.[0]?.role;
                    if (actorRole !== 'org_admin' && actorRole !== 'super_admin') {
                        console.log('[SLP-DIAG] admin_case_updated: actor', actor_id, 'is not admin (role:', actorRole, ') — skipping');
                        await logEmail(SUPABASE_URL, sbHeaders, {
                            organisation_id, case_id, event_type,
                            recipient_email: '(skipped — updater not admin)',
                            subject: config.subject, status: 'skipped',
                            meta: { reason: 'skipped_not_admin_updater', actor_id, actor_role: actorRole },
                        });
                        return res.status(200).json({ ok: true, skipped: true, reason: 'Updater is not an admin' });
                    }
                }
            }

            // Check case is not closed
            const caseStatusRes = await fetch(
                `${SUPABASE_URL}/rest/v1/cases?id=eq.${case_id}&select=status&limit=1`,
                { headers: sbHeaders }
            );
            if (caseStatusRes.ok) {
                const caseStatusRows = await caseStatusRes.json();
                const caseStatus = caseStatusRows?.[0]?.status?.toLowerCase();
                if (caseStatus === 'closed') {
                    console.log('[SLP-DIAG] admin_case_updated: case', case_id, 'is closed — skipping staff email');
                    await logEmail(SUPABASE_URL, sbHeaders, {
                        organisation_id, case_id, event_type,
                        recipient_email: '(skipped — case closed)',
                        subject: config.subject, status: 'skipped',
                        meta: { reason: 'skipped_case_closed' },
                    });
                    return res.status(200).json({ ok: true, skipped: true, reason: 'Case is closed' });
                }
            }
        }

        if (config.type === 'admin') {
            recipientRole = 'admin';

            if (!isEnabled) {
                // Admin operational alert is disabled — skip it, but continue to personal path
                if (trace) console.log('[SLP-DIAG] Admin alert disabled — skipping operational alert, continuing to personal path');
                await logEmail(SUPABASE_URL, sbHeaders, {
                    organisation_id,
                    case_id: case_id || null,
                    event_type,
                    recipient_email: '(admin alert skipped — disabled)',
                    subject: config.subject,
                    status: 'skipped',
                    meta: { reason: 'skipped_org_disabled' },
                });
                adminAlertSkipped = true;
            } else {
                // Use alert_recipients from settings
                if (Array.isArray(settings.alert_recipients)) {
                    recipients = settings.alert_recipients.filter(Boolean);
                }
                if (trace) console.log('[SLP-DIAG] alert_recipients from settings:', recipients);
                // Fallback: org_admin profile emails (resolved from auth.users)
                // When using fallback, also filter by personal preferences per user
                if (recipients.length === 0) {
                    if (trace) console.log('[SLP-DIAG] No alert_recipients — falling back to org_admin profiles');
                    const adminRes = await fetch(
                        `${SUPABASE_URL}/rest/v1/profiles?organisation_id=eq.${organisation_id}&role=eq.org_admin&is_active=eq.true&select=id&limit=20`,
                        { headers: sbHeaders }
                    );
                    if (adminRes.ok) {
                        const adminRows = await adminRes.json();
                        for (const row of (adminRows || [])) {
                            // Check personal email preferences before including this admin
                            const userPrefOk = await checkUserEmailPref(SUPABASE_URL, sbHeaders, row.id, event_type);
                            if (!userPrefOk) {
                                if (trace) console.log('[SLP-DIAG] Admin user', row.id, 'opted out of', event_type, '— skipping');
                                await logEmail(SUPABASE_URL, sbHeaders, {
                                    organisation_id,
                                    case_id: case_id || null,
                                    event_type,
                                    recipient_email: `(admin ${row.id})`,
                                    recipient_role: 'admin',
                                    subject: config.subject,
                                    status: 'skipped',
                                    meta: { reason: 'skipped_user_disabled', user_id: row.id },
                                });
                                continue;
                            }
                            const email = await resolveEmailFromAuth(SUPABASE_URL, SERVICE_KEY, row.id);
                            if (email) recipients.push(email);
                        }
                        if (trace) console.log('[SLP-DIAG] Fallback org_admin emails (after pref filter):', recipients);
                    }
                }
            }
        } else {
            // Staff events: resolve target staff member(s)
            recipientRole = 'staff';

            // Events where the case has progressed/updated — notify BOTH assigned_to AND submitted_by
            const CASE_UPDATE_EVENTS = [
                'admin_case_updated',
                'staff_case_moved_to_review',
                'staff_case_closed',
                'staff_information_requested',
                'staff_evidence_requested',
                'staff_evidence_added',
            ];
            const isUpdateEvent = CASE_UPDATE_EVENTS.includes(event_type);

            // Resolve candidate user IDs
            let candidateUserIds = [];

            // For admin_case_updated, the actor is the admin — do NOT add them as a recipient
            if (actor_id && event_type !== 'admin_case_updated') {
                candidateUserIds.push(actor_id);
            }

            // For case-related staff events, look up assigned_to and submitted_by
            if (case_id) {
                const caseRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/cases?id=eq.${case_id}&select=assigned_to,submitted_by&limit=1`,
                    { headers: sbHeaders }
                );
                if (caseRes.ok) {
                    const caseRows = await caseRes.json();
                    const c = caseRows?.[0];
                    if (c) {
                        if (isUpdateEvent) {
                            // For update events: include both assigned_to and submitted_by
                            if (c.assigned_to) candidateUserIds.push(c.assigned_to);
                            if (c.submitted_by) candidateUserIds.push(c.submitted_by);
                        } else {
                            // For staff_case_assigned: only the assigned person
                            if (c.assigned_to) candidateUserIds.push(c.assigned_to);
                            else if (c.submitted_by) candidateUserIds.push(c.submitted_by);
                        }
                    }
                }
            }

            // Deduplicate user IDs and exclude the acting user (prevent self-notification)
            candidateUserIds = [...new Set(candidateUserIds)].filter(uid => uid !== actor_id);

            // Check each candidate's personal preferences and resolve email
            for (const uid of candidateUserIds) {
                const userPrefOk = await checkUserEmailPref(SUPABASE_URL, sbHeaders, uid, event_type);
                if (!userPrefOk) {
                    await logEmail(SUPABASE_URL, sbHeaders, {
                        organisation_id,
                        case_id: case_id || null,
                        event_type,
                        recipient_email: `(user ${uid})`,
                        recipient_role: 'staff',
                        subject: config.subject,
                        status: 'skipped',
                        meta: { reason: 'skipped_user_disabled', user_id: uid },
                    });
                    continue;
                }

                const staffEmail = await resolveEmailFromAuth(SUPABASE_URL, SERVICE_KEY, uid);
                if (staffEmail && !recipients.includes(staffEmail)) {
                    recipients.push(staffEmail);
                }
            }
        }

        // For non-admin_case_created events: no recipients = skip
        if (recipients.length === 0 && !adminAlertSkipped) {
            if (trace) console.log('[SLP-DIAG] No recipients found — skipping');
            await logEmail(SUPABASE_URL, sbHeaders, {
                organisation_id,
                case_id: case_id || null,
                event_type,
                recipient_email: '(no recipients)',
                subject: config.subject,
                status: 'skipped',
                meta: { reason: 'skipped_no_recipient' },
            });
            // For admin_case_created, still continue to personal path
            if (event_type !== 'admin_case_created') {
                return res.status(200).json({ ok: true, skipped: true, reason: 'No recipients found' });
            }
        }

        // 4) Deduplication check — same (org, event_type, case_id) within 1 hour
        // Only applies to the admin operational alert, not the personal path
        if (case_id && recipients.length > 0) {
            const dedupRes = await fetch(
                `${SUPABASE_URL}/rest/v1/email_logs?organisation_id=eq.${organisation_id}&event_type=eq.${event_type}&case_id=eq.${case_id}&status=eq.sent&created_at=gte.${new Date(Date.now() - 3600000).toISOString()}&select=id&limit=1`,
                { headers: sbHeaders }
            );
            if (dedupRes.ok) {
                const dedupRows = await dedupRes.json();
                if (Array.isArray(dedupRows) && dedupRows.length > 0) {
                    await logEmail(SUPABASE_URL, sbHeaders, {
                        organisation_id,
                        case_id: case_id || null,
                        event_type,
                        recipient_email: recipients.join(', '),
                        subject: config.subject,
                        status: 'skipped',
                        meta: { reason: 'skipped_deduped' },
                    });
                    // For admin_case_created, dedup only skips the admin alert, not personal path
                    if (event_type !== 'admin_case_created') {
                        return res.status(200).json({ ok: true, skipped: true, reason: 'Duplicate within 1 hour' });
                    }
                    adminAlertSkipped = true;
                    recipients = [];
                }
            }
        }

        // 5) Fetch org name for email template
        let orgName = 'Your Organisation';
        const orgRes = await fetch(
            `${SUPABASE_URL}/rest/v1/organisations?id=eq.${organisation_id}&select=name&limit=1`,
            { headers: sbHeaders }
        );
        if (orgRes.ok) {
            const orgRows = await orgRes.json();
            if (orgRows?.[0]?.name) orgName = orgRows[0].name;
        }

        // 6) Build email HTML
        const subject = `${config.subject} — ${orgName}`;
        const html = buildAlertEmailHtml({
            icon: config.icon,
            subject: config.subject,
            orgName,
            eventType: event_type,
            caseId: case_id,
            context: context || {},
            dashboardUrl: `https://secondlookprotect.co.uk/dashboard`,
        });

        // 7-10) Send admin operational alert (only if not skipped)
        let providerMessageId = null;
        if (recipients.length > 0 && !adminAlertSkipped) {
            // 7) Insert initial email_logs row (status: dispatching) — case-created only
            let dispatchLogId = null;
            if (trace) {
                console.log('[SLP-DIAG] Sending via Resend to:', recipients);
                try {
                    const initLogRes = await fetch(`${SUPABASE_URL}/rest/v1/email_logs`, {
                        method: 'POST',
                        headers: { ...sbHeaders, Prefer: 'return=representation' },
                        body: JSON.stringify({
                            organisation_id,
                            case_id: case_id || null,
                            event_type,
                            recipient_email: recipients.join(', '),
                            recipient_role: recipientRole,
                            subject,
                            status: 'dispatching',
                            meta: context || {},
                        }),
                    });
                    if (initLogRes.ok) {
                        const initLogRows = await initLogRes.json();
                        dispatchLogId = initLogRows?.[0]?.id || null;
                        console.log('[SLP-DIAG] Initial email_logs row created — id:', dispatchLogId);
                    }
                } catch (logErr) {
                    console.log('[SLP-DIAG] Failed to create initial email_logs row:', logErr.message);
                }
            }

            // 8) Send via Resend
            const emailPayload = {
                from: EMAIL_FROM,
                to: recipients,
                subject,
                html,
            };

            const emailRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${RESEND_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(emailPayload),
            });

            const emailData = await emailRes.json();
            if (trace) console.log('[SLP-DIAG] Resend response — status:', emailRes.status, '| id:', emailData?.id, '| error:', emailData?.message || 'none');

            if (!emailRes.ok) {
                if (trace) console.log('[SLP-DIAG] Send FAILED — error:', emailData?.message || `Resend error ${emailRes.status}`);
                if (dispatchLogId) {
                    try {
                        await fetch(`${SUPABASE_URL}/rest/v1/email_logs?id=eq.${dispatchLogId}`, {
                            method: 'PATCH',
                            headers: { ...sbHeaders, Prefer: 'return=minimal' },
                            body: JSON.stringify({
                                status: 'failed',
                                error_message: emailData?.message || `Resend error ${emailRes.status}`,
                            }),
                        });
                    } catch { /* best-effort update */ }
                }
                for (const email of recipients) {
                    await logEmail(SUPABASE_URL, sbHeaders, {
                        organisation_id,
                        case_id: case_id || null,
                        event_type,
                        recipient_email: email,
                        recipient_role: recipientRole,
                        subject,
                        status: 'failed',
                        error_message: emailData?.message || `Resend error ${emailRes.status}`,
                        meta: context || {},
                    });
                }
                // Don't throw for admin_case_created — still run the personal path
                if (event_type !== 'admin_case_created') {
                    throw new Error(emailData?.message || `Resend error ${emailRes.status}`);
                }
            } else {
                // 9) Update initial log row to sent
                providerMessageId = emailData?.id || null;
                if (trace) console.log('[SLP-DIAG] Send SUCCEEDED — provider_message_id:', providerMessageId);
                if (dispatchLogId) {
                    try {
                        await fetch(`${SUPABASE_URL}/rest/v1/email_logs?id=eq.${dispatchLogId}`, {
                            method: 'PATCH',
                            headers: { ...sbHeaders, Prefer: 'return=minimal' },
                            body: JSON.stringify({
                                status: 'sent',
                                provider_message_id: providerMessageId,
                                sent_at: new Date().toISOString(),
                            }),
                        });
                    } catch { /* best-effort update */ }
                }

                // 10) Log success for each recipient
                for (const email of recipients) {
                    await logEmail(SUPABASE_URL, sbHeaders, {
                        organisation_id,
                        case_id: case_id || null,
                        event_type,
                        recipient_email: email,
                        recipient_role: recipientRole,
                        subject,
                        status: 'sent',
                        provider_message_id: providerMessageId,
                        meta: context || {},
                    });
                }
            }
        }

        // ── 11) Personal user-targeted emails for admin_case_created ─────────
        // Runs INDEPENDENTLY of the admin operational alert above.
        // Uses email_admin_case_created as the org-level gate (the email toggle).
        // Each user's personal preferences are also checked independently.
        if (event_type === 'admin_case_created') {
            // Check the org-level EMAIL master for case created (email_admin_case_created)
            // This is the correct gate — the email toggle, not the in-app toggle
            const personalMasterEnabled = settings.email_admin_case_created ?? false;
            console.log('[SLP-PERSONAL] Phase started — org_id:', organisation_id, '| actor_id:', actor_id, '| org_master email_admin_case_created:', personalMasterEnabled);

            if (!personalMasterEnabled) {
                console.log('[SLP-PERSONAL] Org master email_admin_case_created is OFF — skipping all personal emails');
                await logEmail(SUPABASE_URL, sbHeaders, {
                    organisation_id,
                    case_id: case_id || null,
                    event_type: 'personal_case_created',
                    recipient_email: '(all personal skipped — org master disabled)',
                    subject,
                    status: 'skipped',
                    meta: { reason: 'skipped_org_disabled' },
                });
            } else {
                try {
                    // Resolve true submitter if actor_id is missing (e.g. from SubmitCasePage.tsx)
                    let trueSubmitterId = actor_id;
                    if (!trueSubmitterId && case_id) {
                        const caseRes = await fetch(`${SUPABASE_URL}/rest/v1/cases?id=eq.${case_id}&select=submitted_by&limit=1`, { headers: sbHeaders });
                        if (caseRes.ok) {
                            const caseRow = await caseRes.json();
                            if (caseRow?.[0]?.submitted_by) {
                                trueSubmitterId = caseRow[0].submitted_by;
                                console.log('[SLP-PERSONAL] Fetched true submitter from case:', trueSubmitterId);
                            }
                        }
                    }

                    // Fetch all active users in this org (id + role only — email is in auth.users)
                    let eligibleUrl = `${SUPABASE_URL}/rest/v1/profiles?organisation_id=eq.${organisation_id}&is_active=eq.true&select=id,role&limit=200`;

                    const eligibleRes = await fetch(eligibleUrl, { headers: sbHeaders });
                    const eligibleUsers = eligibleRes.ok ? await eligibleRes.json() : [];
                    console.log(`[SLP-PERSONAL] Total active profiles found in org ${organisation_id}:`, eligibleUsers.length);

                    // Resolve each user's email from auth.users and attach it
                    for (const user of eligibleUsers) {
                        user.email = await resolveEmailFromAuth(SUPABASE_URL, SERVICE_KEY, user.id);
                    }

                    // Exclude any emails that were already sent via the admin alert path
                    const adminAlertEmails = new Set(recipients.map(e => e.toLowerCase()));
                    let excludedAdminCount = 0;
                    let finalEligibleUserIds = [];

                    for (const user of eligibleUsers) {
                        if (!user.email) {
                            console.log('[SLP-PERSONAL] User', user.id, '— no email in auth.users, skipping');
                            continue;
                        }

                        // Exclude the true submitter
                        if (trueSubmitterId && user.id === trueSubmitterId) {
                            console.log('[SLP-PERSONAL] User', user.id, '(', user.email, ') — is the case submitter, skipping');
                            continue;
                        }

                        // Exclude users already receiving the operational admin alert
                        if (adminAlertEmails.has(user.email.toLowerCase())) {
                            console.log('[SLP-PERSONAL] User', user.id, '(', user.email, ') — already in admin alert, skipping');
                            excludedAdminCount++;
                            continue;
                        }

                        // Fetch this user's personal prefs directly for logging
                        let userEmailEnabled = true;
                        let userPrefNewCase = true;
                        try {
                            const upRes = await fetch(
                                `${SUPABASE_URL}/rest/v1/user_notification_preferences?user_id=eq.${user.id}&select=email_enabled,pref_new_case_submitted&limit=1`,
                                { headers: sbHeaders }
                            );
                            if (upRes.ok) {
                                const upRows = await upRes.json();
                                if (upRows && upRows.length > 0) {
                                    userEmailEnabled = upRows[0].email_enabled ?? true;
                                    userPrefNewCase = upRows[0].pref_new_case_submitted ?? true;
                                }
                            }
                        } catch { /* default to true */ }

                        console.log('[SLP-PERSONAL] Evaluating user:', user.id, '| email:', user.email, '| role:', user.role, '| email_enabled:', userEmailEnabled, '| pref_new_case_submitted:', userPrefNewCase);

                        if (!userEmailEnabled || !userPrefNewCase) {
                            console.log('[SLP-PERSONAL] SKIP user', user.id, '— email_enabled:', userEmailEnabled, 'pref_new_case_submitted:', userPrefNewCase);
                            await logEmail(SUPABASE_URL, sbHeaders, {
                                organisation_id,
                                case_id: case_id || null,
                                event_type: 'personal_case_created',
                                recipient_email: user.email,
                                recipient_role: user.role || 'user',
                                subject,
                                status: 'skipped',
                                meta: { reason: 'skipped_user_disabled', user_id: user.id, email_enabled: userEmailEnabled, pref_new_case_submitted: userPrefNewCase },
                            });
                            continue;
                        }

                        // Add to final list
                        finalEligibleUserIds.push(user.id);

                        // Send individual email to this user
                        try {
                            const userEmailRes = await fetch('https://api.resend.com/emails', {
                                method: 'POST',
                                headers: {
                                    Authorization: `Bearer ${RESEND_API_KEY}`,
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ from: EMAIL_FROM, to: [user.email], subject, html }),
                            });
                            const userEmailData = await userEmailRes.json();

                            if (userEmailRes.ok) {
                                console.log('[SLP-PERSONAL] SENT to', user.email, '— provider_id:', userEmailData?.id);
                                await logEmail(SUPABASE_URL, sbHeaders, {
                                    organisation_id,
                                    case_id: case_id || null,
                                    event_type: 'personal_case_created',
                                    recipient_email: user.email,
                                    recipient_role: user.role || 'user',
                                    subject,
                                    status: 'sent',
                                    provider_message_id: userEmailData?.id || null,
                                    meta: { user_id: user.id },
                                });
                            } else {
                                console.log('[SLP-PERSONAL] FAILED for', user.email, '—', userEmailData?.message);
                                await logEmail(SUPABASE_URL, sbHeaders, {
                                    organisation_id,
                                    case_id: case_id || null,
                                    event_type: 'personal_case_created',
                                    recipient_email: user.email,
                                    recipient_role: user.role || 'user',
                                    subject,
                                    status: 'failed',
                                    error_message: userEmailData?.message || `Resend error ${userEmailRes.status}`,
                                    meta: { user_id: user.id },
                                });
                            }
                        } catch (sendErr) {
                            console.log('[SLP-PERSONAL] EXCEPTION for', user.email, '—', sendErr.message);
                            await logEmail(SUPABASE_URL, sbHeaders, {
                                organisation_id,
                                case_id: case_id || null,
                                event_type: 'personal_case_created',
                                recipient_email: user.email,
                                recipient_role: user.role || 'user',
                                subject,
                                status: 'failed',
                                error_message: sendErr.message || 'Send error',
                                meta: { user_id: user.id },
                            });
                        }
                    }

                    // Log final summary
                    console.log(`[SLP-PERSONAL] DIAGNOSTIC SUMMARY for org ${organisation_id}:`, {
                        actor_or_submitter_id: trueSubmitterId,
                        total_active_profiles: eligibleUsers.length,
                        excluded_admin_alerts: excludedAdminCount,
                        final_eligible_user_count: finalEligibleUserIds.length,
                        final_eligible_user_ids: finalEligibleUserIds
                    });

                } catch (personalErr) {
                    console.error('[SLP-PERSONAL] Phase error:', personalErr.message);
                }
            }
        }

        return res.status(200).json({
            ok: true,
            sent: true,
            recipients,
            provider_message_id: providerMessageId,
        });
    } catch (err) {
        if (trace) console.log('[SLP-DIAG] EXCEPTION in handler:', err.message || err);
        console.error('[email-dispatch] Error:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Unknown error' });
    }
}


// ── Helper: resolve email from Supabase Auth (auth.users) ────────────────
// Prefers profiles.notification_email if set, else falls back to auth.users.email.
async function resolveEmailFromAuth(supabaseUrl, serviceKey, userId) {
    try {
        // 1) Check profiles.notification_email first
        const profileRes = await fetch(
            `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=notification_email&limit=1`,
            {
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        if (profileRes.ok) {
            const profileRows = await profileRes.json();
            const notifEmail = profileRows?.[0]?.notification_email;
            if (notifEmail && notifEmail.trim()) {
                return notifEmail.trim();
            }
        }

        // 2) Fallback to auth.users.email
        const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
            },
        });
        if (res.ok) {
            const data = await res.json();
            return data?.email || null;
        }
        return null;
    } catch {
        return null;
    }
}


// ── Helper: write email_logs entry ───────────────────────────────────────
async function logEmail(supabaseUrl, headers, row) {
    try {
        await fetch(`${supabaseUrl}/rest/v1/email_logs`, {
            method: 'POST',
            headers: { ...headers, Prefer: 'return=minimal' },
            body: JSON.stringify({
                organisation_id: row.organisation_id,
                case_id: row.case_id || null,
                event_type: row.event_type,
                recipient_email: row.recipient_email,
                recipient_role: row.recipient_role || null,
                subject: row.subject || '',
                status: row.status,
                provider_message_id: row.provider_message_id || null,
                error_message: row.error_message || null,
                meta: row.meta || {},
                sent_at: row.status === 'sent' ? new Date().toISOString() : null,
            }),
        });
    } catch {
        // Non-blocking — don't fail the request if logging fails
        console.error('[email-dispatch] Failed to write email_logs entry');
    }
}


// ── Helper: check user personal email preferences ────────────────────────
// Returns true if the user allows this email event, false if they opted out.
// If no preferences row exists, defaults to true (opted-in).
async function checkUserEmailPref(supabaseUrl, headers, userId, eventType) {
    // Map event_type → user_notification_preferences column
    const EVENT_TO_PREF = {
        // Events mapped to pref_new_case_submitted
        admin_case_created: 'pref_new_case_submitted',
        // Events mapped to pref_case_updated
        admin_case_updated: 'pref_case_updated',
        staff_case_assigned: 'pref_case_updated',
        staff_case_moved_to_review: 'pref_case_updated',
        staff_case_closed: 'pref_case_updated',
        staff_information_requested: 'pref_case_updated',
        staff_evidence_requested: 'pref_case_updated',
        staff_evidence_added: 'pref_case_updated',
        admin_new_evidence: 'pref_case_updated',
        // Events mapped to pref_review_due
        admin_overdue_review: 'pref_review_due',
        admin_sla_breach: 'pref_review_due',
        // Events mapped to pref_escalation_notice
        admin_escalation_notice: 'pref_escalation_notice',
        admin_high_risk_alert: 'pref_escalation_notice',
        admin_critical_case: 'pref_escalation_notice',
        admin_repeat_targeting: 'pref_escalation_notice',
        admin_loss_threshold: 'pref_escalation_notice',
        // Events mapped to pref_monthly_summary
        admin_inspection_pack_generated: 'pref_monthly_summary',
        admin_inspection_pack_sent: 'pref_monthly_summary',
        admin_new_user: 'pref_monthly_summary',
    };

    try {
        const prefRes = await fetch(
            `${supabaseUrl}/rest/v1/user_notification_preferences?user_id=eq.${userId}&select=email_enabled,${EVENT_TO_PREF[eventType] || 'email_enabled'}&limit=1`,
            { headers }
        );
        if (!prefRes.ok) return true; // Can't check → default allow

        const rows = await prefRes.json();
        if (!rows || rows.length === 0) return true; // No pref row → default allow

        const pref = rows[0];
        // Master email toggle
        if (pref.email_enabled === false) return false;
        // Event-specific toggle
        const col = EVENT_TO_PREF[eventType];
        if (col && pref[col] === false) return false;

        return true;
    } catch {
        return true; // On error, default to allowing
    }
}


// ── Branded alert email template ─────────────────────────────────────────
function buildAlertEmailHtml({ icon, subject, orgName, eventType, caseId, context, dashboardUrl }) {
    const contextDetails = context.message || context.details || '';
    const caseLink = caseId
        ? `<a href="${dashboardUrl}/cases/${caseId}" style="display: inline-block; margin-top: 16px; padding: 10px 24px; background: #1e40af; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">View Case in Dashboard</a>`
        : `<a href="${dashboardUrl}" style="display: inline-block; margin-top: 16px; padding: 10px 24px; background: #1e40af; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">Open Dashboard</a>`;

    return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f1f5f9; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 32px 16px;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); border-radius: 12px 12px 0 0; padding: 28px 24px; text-align: center;">
            <div style="font-size: 28px; margin-bottom: 6px;">🛡️</div>
            <h1 style="margin: 0; font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">Second Look Protect</h1>
            <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">Email Alert Notification</p>
        </div>

        <!-- Body -->
        <div style="background: #ffffff; padding: 28px 24px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
            <div style="margin-bottom: 20px;">
                <div style="font-size: 24px; margin-bottom: 8px;">${icon}</div>
                <h2 style="margin: 0 0 4px; font-size: 18px; font-weight: 600; color: #0f172a;">${subject}</h2>
                <p style="margin: 0; font-size: 13px; color: #64748b;">${orgName}</p>
            </div>

            ${contextDetails ? `
            <div style="margin: 16px 0; padding: 12px 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #334155;">${contextDetails}</p>
            </div>` : ''}

            ${caseId ? `
            <div style="margin: 12px 0; padding: 8px 12px; background: #eff6ff; border-radius: 6px; border: 1px solid #bfdbfe;">
                <p style="margin: 0; font-size: 12px; color: #1e40af;"><strong>Case ID:</strong> ${caseId}</p>
            </div>` : ''}

            <div style="text-align: center; margin-top: 24px;">
                ${caseLink}
            </div>
        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none; padding: 16px 24px; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                Generated by <strong>Second Look Protect</strong><br>
                You received this because your organisation has email alerts enabled.<br>
                Manage your preferences in <a href="${dashboardUrl}/settings" style="color: #64748b;">Dashboard Settings</a>.
            </p>
        </div>

    </div>
</body>
</html>
    `.trim();
}

// ── Helper: escape HTML special characters ───────────────────────────────
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
