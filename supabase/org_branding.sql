-- ═══════════════════════════════════════════════════════════════════════════
-- Organisation Logo / Branding
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Add logo columns to organisations table
ALTER TABLE organisations
    ADD COLUMN IF NOT EXISTS logo_url     text,
    ADD COLUMN IF NOT EXISTS logo_preset  text;

-- 2) Create the org-logos storage bucket (public so images load via URL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'org-logos',
    'org-logos',
    true,
    524288,   -- 512 KB max
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- 3) Storage policies — org admins can upload/update/delete their own org's file
--    File path convention: {org_id}/logo.{ext}

-- Read — anyone authenticated (so the logo is visible in the header for all users)
CREATE POLICY "Org logos — authenticated read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'org-logos' AND auth.role() = 'authenticated');

-- Upload / replace — only if the path starts with the user's own org_id
CREATE POLICY "Org logos — admin upload"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'org-logos'
        AND (
            -- Service role always allowed
            auth.role() = 'service_role'
            -- Or user's profile org_id matches the first path segment
            OR (split_part(name, '/', 1) = (
                SELECT organisation_id::text FROM profiles WHERE id = auth.uid()
            ))
        )
    );

CREATE POLICY "Org logos — admin update"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'org-logos'
        AND (
            auth.role() = 'service_role'
            OR (split_part(name, '/', 1) = (
                SELECT organisation_id::text FROM profiles WHERE id = auth.uid()
            ))
        )
    );

CREATE POLICY "Org logos — admin delete"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'org-logos'
        AND (
            auth.role() = 'service_role'
            OR (split_part(name, '/', 1) = (
                SELECT organisation_id::text FROM profiles WHERE id = auth.uid()
            ))
        )
    );
