-- ============================================================================
-- Storage Policies for the `evidence` bucket
-- ============================================================================
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
--
-- Prerequisites:
--   1. A storage bucket named `evidence` must exist.
--      If it doesn't, create it via Dashboard → Storage → New Bucket → "evidence"
--      (set it to private unless you want public URLs).
--
--   2. The `profiles` table must have `id` (UUID, matches auth.uid()),
--      `organisation_id` (UUID), and `role` (text) columns.
--
-- Path format: <organisation_id>/<case_id>/<filename>
--   e.g. "abc-123/def-456/1709500000000-screenshot.png"
--
-- Roles:
--   super_admin  → full access across all orgs
--   org_admin    → view + delete within their org
--   staff / *    → upload + view within their org
-- ============================================================================

-- ── DROP existing policies (safe to re-run) ─────────────────────────────────

DROP POLICY IF EXISTS "evidence_select" ON storage.objects;
DROP POLICY IF EXISTS "evidence_insert" ON storage.objects;
DROP POLICY IF EXISTS "evidence_delete" ON storage.objects;

-- ── SELECT: view evidence ───────────────────────────────────────────────────
-- super_admin → all files
-- others      → only files in their org folder (first path segment = org_id)

CREATE POLICY "evidence_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'evidence'
  AND (
    -- super_admin sees everything
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
    OR
    -- others see only their org's folder
    (storage.foldername(name))[1] = (
      SELECT profiles.organisation_id::text
      FROM public.profiles
      WHERE profiles.id = auth.uid()
    )
  )
);

-- ── INSERT: upload evidence ─────────────────────────────────────────────────
-- super_admin → upload anywhere
-- others      → upload only into their org folder

CREATE POLICY "evidence_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'evidence'
  AND (
    -- super_admin uploads anywhere
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
    OR
    -- others upload only to their org folder
    (storage.foldername(name))[1] = (
      SELECT profiles.organisation_id::text
      FROM public.profiles
      WHERE profiles.id = auth.uid()
    )
  )
);

-- ── DELETE: remove evidence ─────────────────────────────────────────────────
-- super_admin → delete anything
-- org_admin   → delete within their org folder
-- staff       → cannot delete

CREATE POLICY "evidence_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'evidence'
  AND (
    -- super_admin deletes anything
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
    OR
    -- org_admin deletes within their org folder
    (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'org_admin'
      )
      AND (storage.foldername(name))[1] = (
        SELECT profiles.organisation_id::text
        FROM public.profiles
        WHERE profiles.id = auth.uid()
      )
    )
  )
);
