-- ═══════════════════════════════════════════════════════════════════════════
-- Add notification preference columns to organisation_settings
-- Run this in the Supabase SQL Editor BEFORE using the toggles
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE organisation_settings
  ADD COLUMN IF NOT EXISTS notify_admin_case_created             boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_admin_high_risk_case           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_admin_critical_case            boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_admin_sla_breach               boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_admin_new_evidence             boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_admin_inspection_pack_generated boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_admin_inspection_pack_sent     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_admin_repeat_targeting         boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_admin_loss_threshold           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_admin_new_user                 boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_staff_case_assigned            boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_staff_case_in_review           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_staff_case_closed              boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_staff_info_requested           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_staff_evidence_requested       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_staff_evidence_added           boolean NOT NULL DEFAULT true;
