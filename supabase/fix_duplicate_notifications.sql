-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: Duplicate admin notifications for new case submission
-- ═══════════════════════════════════════════════════════════════════════════
-- ROOT CAUSE:
--   The live notify_on_new_case() function in your Supabase database still
--   has the old code that appends submission_type to the message:
--
--       notif_msg := 'New case submitted';
--       IF NEW.submission_type IS NOT NULL THEN
--           notif_msg := notif_msg || ' – ' || REPLACE(NEW.submission_type, '_', ' ');
--       END IF;
--
--   For a 'general_safeguarding_note' case this produces TWO notifications:
--       "New case submitted"             (from one path)
--       "New case submitted – general safeguarding note"  (from the old path)
--
-- HOW TO APPLY:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this entire file
--   3. Click Run
-- ═══════════════════════════════════════════════════════════════════════════


-- ── STEP 0: DIAGNOSTIC — run this FIRST to confirm the live problem ──────────
-- This shows you the current live function body. If you see "submission_type"
-- in the function body, that confirms the old version is still active.
SELECT prosrc
FROM pg_proc
WHERE proname = 'notify_on_new_case';


-- ── STEP 1: Replace the live trigger function ────────────────────────────────
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


-- ── STEP 2: Re-attach the trigger cleanly ───────────────────────────────────
DROP TRIGGER IF EXISTS trg_notify_on_new_case ON cases;
CREATE TRIGGER trg_notify_on_new_case
    AFTER INSERT ON cases
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_new_case();


-- ── STEP 3: VERIFICATION — run after to confirm the fix ─────────────────────
-- This should show the UPDATED function body WITHOUT "submission_type" in it.
SELECT prosrc
FROM pg_proc
WHERE proname = 'notify_on_new_case';

-- This should show exactly ONE INSERT trigger on the cases table.
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'cases'
  AND event_manipulation = 'INSERT';
