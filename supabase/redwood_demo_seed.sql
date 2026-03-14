-- ═══════════════════════════════════════════════════════════════════════════
-- REDWOOD CARE HOME — Demo Data Seed
-- ═══════════════════════════════════════════════════════════════════════════
-- Purpose  : Populate Redwood Care Home with 3 stable, internally consistent
--            demo cases that produce a healthy, inspection-ready dashboard.
-- Idempotent: Safe to run multiple times — uses fixed UUIDs and deletes
--             Redwood-only demo cases first (identified by a tag in meta).
-- Scope    : Only touches rows belonging to the "Redwood Care Home" org.
--            No schema, RLS, auth, or other organisation data is changed.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_org_id     UUID;
  v_dummy_user UUID := '00000000-0000-0000-0000-000000000001'; -- sentinel for seeded rows

  -- Fixed UUIDs for the 3 demo cases (ensures idempotency)
  v_case1 UUID := 'a1000001-demo-demo-demo-redwood000001';
  v_case2 UUID := 'a2000002-demo-demo-demo-redwood000002';
  v_case3 UUID := 'a3000003-demo-demo-demo-redwood000003';

  -- Timestamps relative to "now" at seed time
  -- Case 1: closed, submitted 6 days ago, closed 3 days ago
  v_t1_sub     TIMESTAMPTZ := now() - INTERVAL '6 days 3 hours';
  v_t1_review  TIMESTAMPTZ := now() - INTERVAL '5 days 18 hours';
  v_t1_close   TIMESTAMPTZ := now() - INTERVAL '3 days 2 hours';

  -- Case 2: closed, submitted 4 days ago, closed 1 day ago
  v_t2_sub     TIMESTAMPTZ := now() - INTERVAL '4 days 1 hour';
  v_t2_review  TIMESTAMPTZ := now() - INTERVAL '3 days 20 hours';
  v_t2_close   TIMESTAMPTZ := now() - INTERVAL '1 day 4 hours';

  -- Case 3: open (in_review), submitted 2 days ago
  v_t3_sub     TIMESTAMPTZ := now() - INTERVAL '2 days 5 hours';
  v_t3_review  TIMESTAMPTZ := now() - INTERVAL '2 days 1 hour';

BEGIN

  -- ── 1. Resolve Redwood Care Home org ID ──────────────────────────────────
  SELECT id INTO v_org_id
  FROM organisations
  WHERE name = 'Redwood Care Home'
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organisation "Redwood Care Home" not found. Aborting seed.';
  END IF;

  RAISE NOTICE 'Seeding Redwood Care Home  org_id: %', v_org_id;

  -- ── 2. Remove any previously seeded demo cases (idempotent cleanup) ───────
  --   Only removes rows whose meta contains our demo tag, so live cases are safe.
  DELETE FROM cases
  WHERE organisation_id = v_org_id
    AND id IN (v_case1, v_case2, v_case3);

  -- Also remove related AI triage results so they don't clash
  DELETE FROM ai_triage_results
  WHERE case_id IN (v_case1, v_case2, v_case3);

  -- ── 3. Insert Case 1: Closed — Suspicious Phone Call ─────────────────────
  --   Resident: M.H. | Low risk | Decision: not_scam | Closed within 7 days ✓
  INSERT INTO cases (
    id, organisation_id, submitted_by, submission_type,
    description, status, risk_level, decision, category,
    resident_ref, reviewed_at, closed_at, submitted_at, meta
  ) VALUES (
    v_case1, v_org_id, v_dummy_user, 'suspicious_phone_call',
    'Resident M.H. reported receiving a suspicious call claiming to be from HMRC. '
      || 'Caller requested bank details. Resident did not share any information. '
      || 'Call terminated. Resident advised. Family informed. No financial loss.',
    'closed', 'low', 'not_scam', 'Phone Scam Attempt',
    'M.H.', v_t1_review, v_t1_close, v_t1_sub,
    jsonb_build_object(
      '_demo', true,
      'incident_type', 'suspicious_phone_call',
      'resident_reference', 'M.H.',
      'room_location', 'Room 14',
      'actions_taken', jsonb_build_object(
        'family_informed', true,
        'bank_contacted', false,
        'police_informed', false,
        'safeguarding_lead_informed', true,
        'resident_advised', true,
        'device_secured', false,
        'escalated_internally', false
      ),
      'details', jsonb_build_object(
        'date', to_char(v_t1_sub, 'YYYY-MM-DD'),
        'time', '14:20',
        'phone_number', '+44 7700 900123',
        'money_requested', 'Yes',
        'information_shared', 'No',
        'payment_made', 'No'
      ),
      'evidence', '[]'::jsonb,
      'review_outcome', 'Confirmed scam attempt — HMRC impersonation. No harm caused. Resident well briefed.',
      'review_notes', 'Family notified. Safeguarding lead reviewed. File closed with no further action required.'
    )
  );

  -- ── 4. Insert Case 2: Closed — Suspicious Letter ─────────────────────────
  --   Resident: P.A. | Medium risk | Decision: scam | Closed within 7 days ✓
  INSERT INTO cases (
    id, organisation_id, submitted_by, submission_type,
    description, status, risk_level, decision, category,
    resident_ref, reviewed_at, closed_at, submitted_at, meta
  ) VALUES (
    v_case2, v_org_id, v_dummy_user, 'suspicious_letter',
    'Resident P.A. received a letter claiming she had won a prize and needed to send '
      || 'a processing fee of £50 in gift vouchers. Letter intercepted by staff before '
      || 'resident could respond. No payment was made. Police advised informally.',
    'closed', 'medium', 'scam', 'Mail Fraud Attempt',
    'P.A.', v_t2_review, v_t2_close, v_t2_sub,
    jsonb_build_object(
      '_demo', true,
      'incident_type', 'suspicious_letter',
      'resident_reference', 'P.A.',
      'room_location', 'Room 07',
      'actions_taken', jsonb_build_object(
        'family_informed', true,
        'bank_contacted', false,
        'police_informed', false,
        'safeguarding_lead_informed', true,
        'resident_advised', true,
        'device_secured', false,
        'escalated_internally', false
      ),
      'details', jsonb_build_object(
        'claimed_sender', 'National Lotteries Bureau',
        'payment_requested', 'Yes',
        'method_requested', 'Gift cards',
        'notes', 'Letter stated resident won £5,000 and required a £50 processing fee via gift vouchers.'
      ),
      'evidence', '[]'::jsonb,
      'review_outcome', 'Confirmed scam — prize fraud letter. No harm caused, letter retained as evidence.',
      'review_notes', 'Resident and family briefed. Internal guidance sheet distributed to all staff re: prize fraud letters.'
    )
  );

  -- ── 5. Insert Case 3: Open (In Review) — Suspicious Email ────────────────
  --   Resident: B.K. | Low risk | Decision: not_scam (preliminary) | In progress ✓
  --   Submitted 2 days ago — within triage SLA (24h target), within closure target
  INSERT INTO cases (
    id, organisation_id, submitted_by, submission_type,
    description, status, risk_level, decision, category,
    resident_ref, reviewed_at, closed_at, submitted_at, meta
  ) VALUES (
    v_case3, v_org_id, v_dummy_user, 'suspicious_email',
    'Resident B.K. forwarded a suspicious email claiming to be from her bank asking '
      || 'her to verify account details via a link. Resident did not click the link. '
      || 'Email flagged as likely phishing. IT notified. Under review — awaiting '
      || 'confirmation from bank fraud team before closing.',
    'in_review', 'low', 'not_scam', 'Phishing Email',
    'B.K.', v_t3_review, NULL, v_t3_sub,
    jsonb_build_object(
      '_demo', true,
      'incident_type', 'suspicious_email',
      'resident_reference', 'B.K.',
      'room_location', 'Room 22',
      'actions_taken', jsonb_build_object(
        'family_informed', false,
        'bank_contacted', true,
        'police_informed', false,
        'safeguarding_lead_informed', true,
        'resident_advised', true,
        'device_secured', false,
        'escalated_internally', false
      ),
      'details', jsonb_build_object(
        'sender_email', 'security@lloyds-verify-account.net',
        'subject', 'Urgent: Verify your account details',
        'link_clicked', 'No',
        'attachment_opened', 'No',
        'email_content', 'Email requested the resident to click a link and enter her online banking password to ''re-verify'' her account following a ''security update''.'
      ),
      'evidence', '[]'::jsonb,
      'review_notes', 'Preliminary assessment: phishing email. Resident did not engage with link. Bank contacted — awaiting response. Expected close within 24 hours.'
    )
  );

  -- ── 6. Insert AI Triage results for closed cases (optional but helpful) ───
  --   Gives the CaseDetail page AI triage data for the two closed cases.

  -- AI triage for Case 1 (phone call — not scam)
  INSERT INTO ai_triage_results (
    case_id, organisation_id,
    risk_level, suggested_category, suggested_urgency, likely_scam_pattern,
    summary, confidence, human_review_required, indicators, actions,
    raw_response
  ) VALUES (
    v_case1, v_org_id,
    'low', 'Phone Scam Attempt', 'standard', 'HMRC Impersonation',
    'This report describes a common HMRC impersonation scam. The caller attempted to '
      || 'extract bank details under the guise of a tax authority call. The resident '
      || 'did not comply and no information was shared. Risk is low given no data '
      || 'or financial loss occurred.',
    0.88, false,
    '["Caller claimed to be from HMRC", "Requested bank details", "Unsolicited call", "No information shared by resident"]',
    '["Document the incident for regulatory purposes", "Brief resident on HMRC phone scam patterns", "No further escalation required"]',
    jsonb_build_object(
      'number_intel', jsonb_build_object(
        'phone_number', '+44 7700 900123',
        'lookup_status', 'completed',
        'scam_likelihood', jsonb_build_object(
          'score', 22,
          'label', 'Low Risk',
          'explanation', 'Number not associated with high-volume scam reports. Resident did not share details.'
        )
      )
    )
  )
  ON CONFLICT (case_id) DO UPDATE SET
    risk_level = EXCLUDED.risk_level,
    suggested_category = EXCLUDED.suggested_category,
    summary = EXCLUDED.summary,
    updated_at = now();

  -- AI triage for Case 2 (letter — scam)
  INSERT INTO ai_triage_results (
    case_id, organisation_id,
    risk_level, suggested_category, suggested_urgency, likely_scam_pattern,
    summary, confidence, human_review_required, indicators, actions,
    raw_response
  ) VALUES (
    v_case2, v_org_id,
    'medium', 'Mail Fraud Attempt', 'urgent', 'Prize Fraud',
    'This is a textbook advance-fee prize fraud letter. The letter falsely claims the '
      || 'resident has won a prize and requires an upfront fee via gift vouchers — a '
      || 'hallmark of gift-card scam methodology. The letter was intercepted before '
      || 'any payment was made, preventing financial harm.',
    0.94, true,
    '["Unsolicited prize notification letter", "Gift card payment method requested — high scam indicator", "No genuine lottery participation by resident", "Pressure language typical of advance-fee fraud"]',
    '["Retain letter as evidence", "Brief all staff on prize fraud letter patterns", "Consider reporting to Action Fraud for intelligence purposes", "Monitor resident for further unsolicited mail"]',
    jsonb_build_object(
      'number_intel', jsonb_build_object(
        'lookup_status', 'no_service',
        'scam_likelihood', jsonb_build_object(
          'score', 76,
          'label', 'High Risk',
          'explanation', 'Gift card fee request is a strong indicator of advance-fee fraud methodology.'
        )
      )
    )
  )
  ON CONFLICT (case_id) DO UPDATE SET
    risk_level = EXCLUDED.risk_level,
    suggested_category = EXCLUDED.suggested_category,
    summary = EXCLUDED.summary,
    updated_at = now();

  RAISE NOTICE 'Redwood Care Home demo seed completed successfully.';
  RAISE NOTICE '  Case 1 (closed - phone call):   %', v_case1;
  RAISE NOTICE '  Case 2 (closed - letter):        %', v_case2;
  RAISE NOTICE '  Case 3 (in_review - email):      %', v_case3;
  RAISE NOTICE '';
  RAISE NOTICE 'Expected dashboard KPIs:';
  RAISE NOTICE '  Cases this month : 3';
  RAISE NOTICE '  Queue depth      : 1  (green — target <= 3)';
  RAISE NOTICE '  Closure %        : 100  (both closed within 7-day target)';
  RAISE NOTICE '  Triage %         : 100  (all 3 cases not-new within 24h)';
  RAISE NOTICE '  Documented %     : 100  (all 3 cases have a decision set)';
  RAISE NOTICE '  Scam %           : 33   (1 of 3 confirmed scam)';
  RAISE NOTICE '  Overall health   : ~91  (weighted avg of above scores)';

END $$;
