-- ═══════════════════════════════════════════════════════════════════════════
-- Email Notification Framework — schema additions
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) email_logs table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_logs (
    id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organisation_id     uuid NOT NULL,
    case_id             uuid,
    event_type          text NOT NULL,
    recipient_email     text NOT NULL,
    recipient_role      text,
    subject             text NOT NULL,
    status              text NOT NULL DEFAULT 'pending',  -- sent | failed | skipped
    provider_message_id text,
    error_message       text,
    meta                jsonb DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    sent_at             timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_org
    ON email_logs (organisation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_logs_event
    ON email_logs (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_logs_dedup
    ON email_logs (organisation_id, event_type, recipient_email, case_id, created_at DESC);

-- ── 2) RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Service role can insert (used by API functions)
CREATE POLICY "Service can insert email_logs"
    ON email_logs FOR INSERT
    WITH CHECK (true);

-- Org admins can read their own org's email logs
CREATE POLICY "Org admins can read email_logs"
    ON email_logs FOR SELECT
    USING (
        organisation_id IN (
            SELECT organisation_id FROM profiles
            WHERE id = auth.uid()
              AND role IN ('org_admin', 'super_admin', 'manager')
        )
    );


-- ── 3) Add send-time columns to organisation_settings ──────────────────────
ALTER TABLE organisation_settings
  ADD COLUMN IF NOT EXISTS report_send_time         time NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS inspection_pack_send_time time NOT NULL DEFAULT '09:00';


-- ── 4) Ensure all email notification boolean columns exist ─────────────────
ALTER TABLE organisation_settings
  ADD COLUMN IF NOT EXISTS email_admin_case_created               boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_admin_case_updated               boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_admin_high_risk_alert            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_admin_overdue_review             boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_admin_escalation_notice          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_admin_critical_case              boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_admin_sla_breach                 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_admin_new_evidence               boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_admin_inspection_pack_generated  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_admin_inspection_pack_sent       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_admin_repeat_targeting           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_admin_loss_threshold             boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_admin_new_user                   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_staff_case_assigned              boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_staff_case_moved_to_review       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_staff_case_closed                boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_staff_information_requested      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_staff_evidence_requested         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_staff_evidence_added             boolean NOT NULL DEFAULT false;
