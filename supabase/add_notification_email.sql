-- ═══════════════════════════════════════════════════════════════════════════
-- Add notification_email column to profiles
-- Allows users to set a custom email for notification delivery.
-- Falls back to auth.users.email when NULL or empty.
-- Run this in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS notification_email text DEFAULT NULL;

COMMENT ON COLUMN public.profiles.notification_email
    IS 'Optional user-chosen email for notification delivery. Falls back to auth.users.email when NULL.';
