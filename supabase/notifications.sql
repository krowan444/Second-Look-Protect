-- ═══════════════════════════════════════════════════════════════════════════
-- Notifications table + auto-create trigger
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Create the notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organisation_id uuid NOT NULL,
    user_id     uuid NOT NULL,
    type        text NOT NULL DEFAULT 'new_case',
    case_id     uuid,
    title       text NOT NULL,
    is_read     boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_org
    ON notifications (organisation_id, created_at DESC);

-- 2) Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update (mark read) their own notifications
CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- Allow inserts from triggers (service role / database functions)
CREATE POLICY "Service can insert notifications"
    ON notifications FOR INSERT
    WITH CHECK (true);

-- 3) DEPRECATED: The notify_on_new_case() trigger function is now defined in
--    enforce_user_notification_prefs.sql which includes personal preference checks,
--    org settings, and deduplication. Do NOT re-run this old version.
--    The canonical trigger source is: supabase/enforce_user_notification_prefs.sql
