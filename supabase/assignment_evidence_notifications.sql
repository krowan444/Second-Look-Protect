-- ═══════════════════════════════════════════════════════════════════════════
-- Case assignment + evidence notification triggers
-- Run this in the Supabase SQL Editor AFTER the role_based_notifications.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0) Ensure assigned_to column exists on cases ───────────────────────────
ALTER TABLE cases ADD COLUMN IF NOT EXISTS assigned_to uuid;

-- ── 1) Ensure evidence_count column exists on cases ────────────────────────
ALTER TABLE cases ADD COLUMN IF NOT EXISTS evidence_count integer NOT NULL DEFAULT 0;

-- ── 2) Ensure notify_admin_new_evidence + notify_staff_case_assigned exist ─
ALTER TABLE organisation_settings
  ADD COLUMN IF NOT EXISTS notify_admin_new_evidence    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_staff_case_assigned   boolean NOT NULL DEFAULT true;


-- ── 3) Trigger: case assignment → notify assigned staff ────────────────────
CREATE OR REPLACE FUNCTION notify_on_case_assigned()
RETURNS TRIGGER AS $$
DECLARE
    should_send BOOLEAN;
    notif_msg   TEXT;
BEGIN
    -- Only fire when assigned_to actually changes and is not null
    IF NEW.assigned_to IS NULL THEN RETURN NEW; END IF;
    IF OLD.assigned_to IS NOT DISTINCT FROM NEW.assigned_to THEN RETURN NEW; END IF;

    -- Check org setting
    SELECT COALESCE(os.notify_staff_case_assigned, true)
    INTO should_send
    FROM organisation_settings os
    WHERE os.organisation_id = NEW.organisation_id;

    IF NOT FOUND THEN should_send := true; END IF;

    IF should_send THEN
        notif_msg := 'A case has been assigned to you';
        IF NEW.submission_type IS NOT NULL AND NEW.submission_type <> '' THEN
            notif_msg := notif_msg || ' – ' || REPLACE(NEW.submission_type, '_', ' ');
        END IF;

        INSERT INTO notifications (organisation_id, user_id, type, case_id, message)
        VALUES (NEW.organisation_id, NEW.assigned_to, 'case_assigned', NEW.id, notif_msg);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_on_case_assigned ON cases;
CREATE TRIGGER trg_notify_on_case_assigned
    AFTER UPDATE ON cases
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_case_assigned();


-- ── 4) Trigger: evidence_count increase → notify org_admin ─────────────────
CREATE OR REPLACE FUNCTION notify_on_new_evidence()
RETURNS TRIGGER AS $$
DECLARE
    r           RECORD;
    should_send BOOLEAN;
BEGIN
    -- Only fire when evidence_count actually increases
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
            INSERT INTO notifications (organisation_id, user_id, type, case_id, message)
            VALUES (
                NEW.organisation_id, r.id, 'new_evidence', NEW.id,
                'New evidence uploaded to a case'
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_on_new_evidence ON cases;
CREATE TRIGGER trg_notify_on_new_evidence
    AFTER UPDATE ON cases
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_new_evidence();
