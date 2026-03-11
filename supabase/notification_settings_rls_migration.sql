-- ═══════════════════════════════════════════════════════════════════════════
-- RLS Policies for organisation_settings
-- Ensures only org_admin / super_admin can UPDATE/INSERT organisation_settings.
-- All same-org members can READ (needed for UI display).
-- Service role (used by email-dispatch.js) bypasses RLS automatically.
-- Run this in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Enable RLS on organisation_settings (idempotent)
ALTER TABLE organisation_settings ENABLE ROW LEVEL SECURITY;

-- 2) Drop any existing policies with these names to make this migration re-runnable
DROP POLICY IF EXISTS "Same-org members can read organisation_settings" ON organisation_settings;
DROP POLICY IF EXISTS "Admins can update organisation_settings" ON organisation_settings;
DROP POLICY IF EXISTS "Admins can insert organisation_settings" ON organisation_settings;

-- 3) SELECT: any authenticated user whose profile belongs to the same organisation
CREATE POLICY "Same-org members can read organisation_settings"
    ON organisation_settings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.organisation_id = organisation_settings.organisation_id
        )
    );

-- 4) UPDATE: only org_admin or super_admin within the same organisation
CREATE POLICY "Admins can update organisation_settings"
    ON organisation_settings FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.organisation_id = organisation_settings.organisation_id
              AND profiles.role IN ('org_admin', 'super_admin')
        )
    );

-- 5) INSERT: only org_admin or super_admin (for upsert operations)
CREATE POLICY "Admins can insert organisation_settings"
    ON organisation_settings FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.organisation_id = organisation_settings.organisation_id
              AND profiles.role IN ('org_admin', 'super_admin')
        )
    );
