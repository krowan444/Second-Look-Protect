-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: Duplicate admin notifications for new case submission
-- ═══════════════════════════════════════════════════════════════════════════
-- PROBLEM:
--   The old notify_on_new_case() function appends submission_type to the
--   message, creating wording like "New case submitted – general safeguarding note".
--   Combined with the base "New case submitted", admins see TWO notifications.
--
-- FIX:
--   Replace the function with a clean version that:
--   1) Always uses the exact wording "New case submitted" (no suffix)
--   2) Removes high-risk / critical-risk duplicate notification blocks
--   3) Adds a NOT EXISTS dedupe guard so even if somehow triggered twice,
--      only one notification row is ever created per user per case
--   4) Notifies both org_admin and staff roles (respecting personal prefs)
--
-- HOW TO APPLY:
--   Paste this entire file into Supabase SQL Editor and click Run.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── Step 1: Replace the trigger function ────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_on_new_case()
RETURNS TRIGGER AS $$
DECLARE
    r           RECORD;
    settings    RECORD;
    user_pref   RECORD;
BEGIN
    -- Fetch organisation notification settings
    SELECT
        COALESCE(os.notify_admin_case_created, true) AS case_created
    INTO settings
    FROM organisation_settings os
    WHERE os.organisation_id = NEW.organisation_id;

    IF NOT FOUND THEN
        settings.case_created := true;
    END IF;

    -- ── Admin: new case created ────────────────────────────────────────────
    IF settings.case_created THEN
        FOR r IN
            SELECT id FROM profiles
            WHERE organisation_id = NEW.organisation_id
              AND role = 'org_admin'
              AND is_active = true
              AND id <> NEW.submitted_by
        LOOP
            -- Check user personal notification preferences
            SELECT
                COALESCE(unp.inapp_enabled, true) AS inapp_on,
                COALESCE(unp.pref_new_case_submitted, true) AS event_on
            INTO user_pref
            FROM user_notification_preferences unp
            WHERE unp.user_id = r.id;

            IF NOT FOUND THEN
                user_pref.inapp_on := true;
                user_pref.event_on := true;
            END IF;

            IF user_pref.inapp_on AND user_pref.event_on THEN
                -- Dedupe guard: only insert if not already notified for this case
                IF NOT EXISTS (
                    SELECT 1 FROM notifications
                    WHERE user_id = r.id AND case_id = NEW.id AND type = 'new_case'
                ) THEN
                    INSERT INTO notifications (organisation_id, user_id, type, case_id, message)
                    VALUES (NEW.organisation_id, r.id, 'new_case', NEW.id, 'New case submitted');
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- ── Staff: new case created ───────────────────────────────────────────
    IF settings.case_created THEN
        FOR r IN
            SELECT id FROM profiles
            WHERE organisation_id = NEW.organisation_id
              AND role = 'staff'
              AND is_active = true
              AND id <> NEW.submitted_by
        LOOP
            SELECT
                COALESCE(unp.inapp_enabled, true) AS inapp_on,
                COALESCE(unp.pref_new_case_submitted, true) AS event_on
            INTO user_pref
            FROM user_notification_preferences unp
            WHERE unp.user_id = r.id;

            IF NOT FOUND THEN
                user_pref.inapp_on := true;
                user_pref.event_on := true;
            END IF;

            IF user_pref.inapp_on AND user_pref.event_on THEN
                IF NOT EXISTS (
                    SELECT 1 FROM notifications
                    WHERE user_id = r.id AND case_id = NEW.id AND type = 'new_case'
                ) THEN
                    INSERT INTO notifications (organisation_id, user_id, type, case_id, message)
                    VALUES (NEW.organisation_id, r.id, 'new_case', NEW.id, 'New case submitted');
                END IF;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── Step 2: Re-attach the trigger (ensure only one trigger for this event) ──
DROP TRIGGER IF EXISTS trg_notify_on_new_case ON cases;
CREATE TRIGGER trg_notify_on_new_case
    AFTER INSERT ON cases
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_new_case();


-- ── Step 3: Verify — list all INSERT triggers on the cases table ────────────
-- This should show exactly ONE row for trg_notify_on_new_case.
-- If you see any other INSERT triggers that also create notifications,
-- they are the duplicate source and should be dropped.
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'cases'
  AND event_manipulation = 'INSERT';
