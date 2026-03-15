-- Migration: add logo_preset column to organisations table
-- Safe: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS pattern
-- This column stores the selected preset symbol key for organisation branding.

ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS logo_preset TEXT DEFAULT NULL;

-- Allow org admins and super admins to update this field (RLS should already
-- permit updates to organisations rows by authenticated admins — no new policy needed
-- unless your policy restricts specific columns explicitly).

COMMENT ON COLUMN organisations.logo_preset IS
  'Optional preset symbol key for organisation branding (e.g. shield, heart). Overrides logo_url when set.';
