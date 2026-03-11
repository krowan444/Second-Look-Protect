-- ═══════════════════════════════════════════════════════════════════════════
-- Enforce personal user notification preferences in all in-app triggers
-- Run this in the Supabase SQL Editor AFTER user_notification_preferences.sql
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1) notify_on_new_case — respect personal prefs ─────────────────────────
CREATE OR REPLACE FUNCTION notify_on_new_case()
RETURNS TRIGGER AS $$
DECLARE
    r           RECORD;
    settings    RECORD;
    notif_msg   TEXT;
    risk        TEXT;
    user_pref   RECORD;
BEGIN
    -- Fetch organisation notification settings (all default true if missing)
    SELECT
        COALESCE(os.notify_admin_case_created, true)       AS case_created,
        COALESCE(os.notify_admin_high_risk_case, true)     AS high_risk,
        COALESCE(os.notify_admin_critical_case, true)      AS critical
    INTO settings
    FROM organisation_settings os
    WHERE os.organisation_id = NEW.organisation_id;

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
            -- Check user personal preferences
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
                INSERT INTO notifications (organisation_id, user_id, type, case_id, message)
                VALUES (NEW.organisation_id, r.id, 'new_case', NEW.id, notif_msg);
            END IF;
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
                INSERT INTO notifications (organisation_id, user_id, type, case_id, message)
                VALUES (
                    NEW.organisation_id, r.id, 'high_risk_case', NEW.id,
                    'High-risk case submitted – requires urgent review'
                );
            END IF;
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
                INSERT INTO notifications (organisation_id, user_id, type, case_id, message)
                VALUES (
                    NEW.organisation_id, r.id, 'critical_case', NEW.id,
                    'Critical-risk case submitted – immediate attention required'
                );
            END IF;
        END LOOP;
    END IF;

    -- ── Staff: new case created ───────────────────────────────────────────
    -- Notify other active staff in the same organisation (excluding submitter)
    IF settings.case_created THEN
        IF notif_msg IS NULL THEN
            notif_msg := 'New case submitted';
            IF NEW.submission_type IS NOT NULL AND NEW.submission_type <> '' THEN
                notif_msg := notif_msg || ' – ' || REPLACE(NEW.submission_type, '_', ' ');
            END IF;
        END IF;

        FOR r IN
            SELECT id FROM profiles
            WHERE organisation_id = NEW.organisation_id
              AND role = 'staff'
              AND is_active = true
              AND id <> NEW.submitted_by
        LOOP
            -- Check user personal preferences
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
                INSERT INTO notifications (organisation_id, user_id, type, case_id, message)
                VALUES (NEW.organisation_id, r.id, 'new_case', NEW.id, notif_msg);
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 2) notify_on_case_status_change — respect personal prefs ───────────────
CREATE OR REPLACE FUNCTION notify_on_case_status_change()
RETURNS TRIGGER AS $$
DECLARE
    settings      RECORD;
    user_pref     RECORD;
    new_status    TEXT;
    submitter_id  UUID;
    notif_msg     TEXT;
    notif_type    TEXT;
    should_send   BOOLEAN;
    pref_col_val  BOOLEAN;
BEGIN
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;

    new_status   := LOWER(COALESCE(NEW.status, ''));
    submitter_id := NEW.submitted_by;

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
        -- Check user personal preferences
        SELECT
            COALESCE(unp.inapp_enabled, true) AS inapp_on,
            COALESCE(unp.pref_case_updated, true) AS event_on
        INTO user_pref
        FROM user_notification_preferences unp
        WHERE unp.user_id = submitter_id;

        IF NOT FOUND THEN
            user_pref.inapp_on := true;
            user_pref.event_on := true;
        END IF;

        IF user_pref.inapp_on AND user_pref.event_on THEN
            INSERT INTO notifications (organisation_id, user_id, type, case_id, message)
            VALUES (NEW.organisation_id, submitter_id, notif_type, NEW.id, notif_msg);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 3) notify_on_case_assigned — respect personal prefs ────────────────────
CREATE OR REPLACE FUNCTION notify_on_case_assigned()
RETURNS TRIGGER AS $$
DECLARE
    should_send BOOLEAN;
    user_pref   RECORD;
    notif_msg   TEXT;
BEGIN
    IF NEW.assigned_to IS NULL THEN RETURN NEW; END IF;
    IF OLD.assigned_to IS NOT DISTINCT FROM NEW.assigned_to THEN RETURN NEW; END IF;

    -- Check org setting
    SELECT COALESCE(os.notify_staff_case_assigned, true)
    INTO should_send
    FROM organisation_settings os
    WHERE os.organisation_id = NEW.organisation_id;

    IF NOT FOUND THEN should_send := true; END IF;

    IF should_send THEN
        -- Check user personal preferences
        SELECT
            COALESCE(unp.inapp_enabled, true) AS inapp_on,
            COALESCE(unp.pref_case_updated, true) AS event_on
        INTO user_pref
        FROM user_notification_preferences unp
        WHERE unp.user_id = NEW.assigned_to;

        IF NOT FOUND THEN
            user_pref.inapp_on := true;
            user_pref.event_on := true;
        END IF;

        IF user_pref.inapp_on AND user_pref.event_on THEN
            notif_msg := 'A case has been assigned to you';
            IF NEW.submission_type IS NOT NULL AND NEW.submission_type <> '' THEN
                notif_msg := notif_msg || ' – ' || REPLACE(NEW.submission_type, '_', ' ');
            END IF;

            INSERT INTO notifications (organisation_id, user_id, type, case_id, message)
            VALUES (NEW.organisation_id, NEW.assigned_to, 'case_assigned', NEW.id, notif_msg);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 4) notify_on_new_evidence — respect personal prefs ─────────────────────
CREATE OR REPLACE FUNCTION notify_on_new_evidence()
RETURNS TRIGGER AS $$
DECLARE
    r           RECORD;
    should_send BOOLEAN;
    user_pref   RECORD;
BEGIN
    IF NEW.evidence_count IS NULL THEN RETURN NEW; END IF;
    IF COALESCE(OLD.evidence_count, 0) >= NEW.evidence_count THEN RETURN NEW; END IF;

    -- Check org setting
    SELECT COALESCE(os.notify_admin_new_evidence, true)
    INTO should_send
    FROM organisation_settings os
    WHERE os.organisation_id = NEW.organisation_id;

    IF NOT FOUND THEN should_send := true; END IF;

    IF should_send THEN
        FOR r IN
            SELECT id FROM profiles
            WHERE organisation_id = NEW.organisation_id
              AND role = 'org_admin'
              AND is_active = true
        LOOP
            -- Check user personal preferences
            SELECT
                COALESCE(unp.inapp_enabled, true) AS inapp_on,
                COALESCE(unp.pref_case_updated, true) AS event_on
            INTO user_pref
            FROM user_notification_preferences unp
            WHERE unp.user_id = r.id;

            IF NOT FOUND THEN
                user_pref.inapp_on := true;
                user_pref.event_on := true;
            END IF;

            IF user_pref.inapp_on AND user_pref.event_on THEN
                INSERT INTO notifications (organisation_id, user_id, type, case_id, message)
                VALUES (
                    NEW.organisation_id, r.id, 'new_evidence', NEW.id,
                    'New evidence uploaded to a case'
                );
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 5) Re-attach all triggers ──────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_notify_on_new_case ON cases;
CREATE TRIGGER trg_notify_on_new_case
    AFTER INSERT ON cases
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_new_case();

DROP TRIGGER IF EXISTS trg_notify_on_case_status_change ON cases;
CREATE TRIGGER trg_notify_on_case_status_change
    AFTER UPDATE ON cases
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_case_status_change();

DROP TRIGGER IF EXISTS trg_notify_on_case_assigned ON cases;
CREATE TRIGGER trg_notify_on_case_assigned
    AFTER UPDATE ON cases
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_case_assigned();

DROP TRIGGER IF EXISTS trg_notify_on_new_evidence ON cases;
CREATE TRIGGER trg_notify_on_new_evidence
    AFTER UPDATE ON cases
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_new_evidence();
