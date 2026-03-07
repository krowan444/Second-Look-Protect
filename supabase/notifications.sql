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

-- 3) Trigger function: auto-create notifications when a case is inserted
CREATE OR REPLACE FUNCTION notify_on_new_case()
RETURNS TRIGGER AS $$
DECLARE
    r RECORD;
    notif_title TEXT;
BEGIN
    -- Build a human-readable title
    notif_title := 'New case submitted';
    IF NEW.submission_type IS NOT NULL AND NEW.submission_type <> '' THEN
        notif_title := notif_title || ' – ' || REPLACE(NEW.submission_type, '_', ' ');
    END IF;

    -- Insert a notification for every relevant user in the same organisation
    -- (org_admin, safeguarding_lead, manager, staff, carer — everyone except read_only)
    FOR r IN
        SELECT id FROM profiles
        WHERE organisation_id = NEW.organisation_id
          AND id <> NEW.submitted_by
          AND role NOT IN ('read_only')
    LOOP
        INSERT INTO notifications (organisation_id, user_id, type, case_id, title)
        VALUES (NEW.organisation_id, r.id, 'new_case', NEW.id, notif_title);
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Attach the trigger to the cases table
DROP TRIGGER IF EXISTS trg_notify_on_new_case ON cases;
CREATE TRIGGER trg_notify_on_new_case
    AFTER INSERT ON cases
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_new_case();
