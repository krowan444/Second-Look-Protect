-- ═══════════════════════════════════════════════════════════════════════════
-- Role-based notification triggers (respecting organisation_settings prefs)
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0) Ensure the notifications table has the columns the bell UI expects ──
-- The bell reads 'message' and 'read'. If the original schema used 'title'
-- and 'is_read', rename them. These are safe no-ops if already renamed.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'notifications' AND column_name = 'title'
    ) THEN
        ALTER TABLE notifications RENAME COLUMN title TO message;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'notifications' AND column_name = 'is_read'
    ) THEN
        ALTER TABLE notifications RENAME COLUMN is_read TO read;
    END IF;
END $$;


-- ── 1) Replace the INSERT trigger: new case → admin notifications ──────────
CREATE OR REPLACE FUNCTION notify_on_new_case()
RETURNS TRIGGER AS $$
DECLARE
    r           RECORD;
    settings    RECORD;
    notif_msg   TEXT;
    risk        TEXT;
BEGIN
    -- Fetch organisation notification settings (all default true if missing)
    SELECT
        COALESCE(os.notify_admin_case_created, true)       AS case_created,
        COALESCE(os.notify_admin_high_risk_case, true)     AS high_risk,
        COALESCE(os.notify_admin_critical_case, true)      AS critical
    INTO settings
    FROM organisation_settings os
    WHERE os.organisation_id = NEW.organisation_id;

    -- If no settings row exists, default everything on
    IF NOT FOUND THEN
        settings.case_created := true;
        settings.high_risk    := true;
        settings.critical     := true;
    END IF;

    risk := LOWER(COALESCE(NEW.risk_level, ''));

    -- ── Admin: new case created ────────────────────────────────────────────
    IF settings.case_created THEN
        notif_msg := 'New case submitted';
        IF NEW.submission_type IS NOT NULL AND NEW.submission_type <> '' THEN
            notif_msg := notif_msg || ' – ' || REPLACE(NEW.submission_type, '_', ' ');
        END IF;

        FOR r IN
            SELECT id FROM profiles
            WHERE organisation_id = NEW.organisation_id
              AND role = 'org_admin'
              AND is_active = true
              AND id <> NEW.submitted_by
        LOOP
            INSERT INTO notifications (organisation_id, user_id, type, case_id, message)
            VALUES (NEW.organisation_id, r.id, 'new_case', NEW.id, notif_msg);
        END LOOP;
    END IF;

    -- ── Admin: high-risk case ──────────────────────────────────────────────
    IF settings.high_risk AND risk = 'high' THEN
        FOR r IN
            SELECT id FROM profiles
            WHERE organisation_id = NEW.organisation_id
              AND role = 'org_admin'
              AND is_active = true
              AND id <> NEW.submitted_by
        LOOP
            INSERT INTO notifications (organisation_id, user_id, type, case_id, message)
            VALUES (
                NEW.organisation_id, r.id, 'high_risk_case', NEW.id,
                'High-risk case submitted – requires urgent review'
            );
        END LOOP;
    END IF;

    -- ── Admin: critical-risk case ──────────────────────────────────────────
    IF settings.critical AND risk = 'critical' THEN
        FOR r IN
            SELECT id FROM profiles
            WHERE organisation_id = NEW.organisation_id
              AND role = 'org_admin'
              AND is_active = true
              AND id <> NEW.submitted_by
        LOOP
            INSERT INTO notifications (organisation_id, user_id, type, case_id, message)
            VALUES (
                NEW.organisation_id, r.id, 'critical_case', NEW.id,
                'Critical-risk case submitted – immediate attention required'
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 2) New UPDATE trigger: status change → staff notifications ─────────────
CREATE OR REPLACE FUNCTION notify_on_case_status_change()
RETURNS TRIGGER AS $$
DECLARE
    settings      RECORD;
    new_status    TEXT;
    submitter_id  UUID;
    notif_msg     TEXT;
    notif_type    TEXT;
    should_send   BOOLEAN;
BEGIN
    -- Only fire when status actually changes
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;

    new_status   := LOWER(COALESCE(NEW.status, ''));
    submitter_id := NEW.submitted_by;

    -- No submitter → nothing to notify
    IF submitter_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Fetch organisation notification settings
    SELECT
        COALESCE(os.notify_staff_case_in_review, true) AS in_review,
        COALESCE(os.notify_staff_case_closed, true)    AS closed
    INTO settings
    FROM organisation_settings os
    WHERE os.organisation_id = NEW.organisation_id;

    IF NOT FOUND THEN
        settings.in_review := true;
        settings.closed    := true;
    END IF;

    -- Determine what to send
    should_send := false;

    IF new_status = 'in_review' AND settings.in_review THEN
        notif_msg   := 'Your case is now under review';
        notif_type  := 'case_in_review';
        should_send := true;
    ELSIF new_status = 'closed' AND settings.closed THEN
        notif_msg   := 'Your case has been closed';
        notif_type  := 'case_closed';
        should_send := true;
    END IF;

    IF should_send THEN
        INSERT INTO notifications (organisation_id, user_id, type, case_id, message)
        VALUES (NEW.organisation_id, submitter_id, notif_type, NEW.id, notif_msg);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach the status-change trigger
DROP TRIGGER IF EXISTS trg_notify_on_case_status_change ON cases;
CREATE TRIGGER trg_notify_on_case_status_change
    AFTER UPDATE ON cases
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_case_status_change();


-- ── 3) Re-attach the insert trigger (ensure latest version is used) ────────
DROP TRIGGER IF EXISTS trg_notify_on_new_case ON cases;
CREATE TRIGGER trg_notify_on_new_case
    AFTER INSERT ON cases
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_new_case();
