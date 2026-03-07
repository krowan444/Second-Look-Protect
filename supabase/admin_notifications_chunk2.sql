-- ═══════════════════════════════════════════════════════════════════════════
-- Admin notification triggers: SLA breach, inspection pack, loss threshold
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0) Ensure required settings columns exist ──────────────────────────────
ALTER TABLE organisation_settings
  ADD COLUMN IF NOT EXISTS notify_admin_sla_breach                 boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_admin_inspection_pack_generated  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_admin_inspection_pack_sent       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_admin_loss_threshold             boolean NOT NULL DEFAULT true;


-- ═══════════════════════════════════════════════════════════════════════════
-- 1) SLA BREACH — case open longer than escalation_hours without being closed
--    Fires on UPDATE to cases. If status transitions to 'in_review' or stays
--    'new'/'submitted' and the case age exceeds the org's escalation_hours
--    threshold, a one-time 'sla_breach' notification is sent to org_admin.
--    To avoid duplicates we check for an existing sla_breach notification.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION notify_on_sla_breach()
RETURNS TRIGGER AS $$
DECLARE
    r               RECORD;
    should_send     BOOLEAN;
    esc_hours       INTEGER;
    case_age_hours  DOUBLE PRECISION;
    already_sent    BOOLEAN;
BEGIN
    -- Only check un-closed cases
    IF LOWER(COALESCE(NEW.status, '')) = 'closed' THEN RETURN NEW; END IF;

    -- Calculate age in hours
    case_age_hours := EXTRACT(EPOCH FROM (now() - NEW.submitted_at)) / 3600.0;

    -- Fetch escalation_hours and setting
    SELECT
        COALESCE(os.escalation_hours, 48)            AS hours,
        COALESCE(os.notify_admin_sla_breach, true)   AS enabled
    INTO esc_hours, should_send
    FROM organisation_settings os
    WHERE os.organisation_id = NEW.organisation_id;

    IF NOT FOUND THEN
        esc_hours   := 48;
        should_send := true;
    END IF;

    -- Not breached yet
    IF case_age_hours < esc_hours THEN RETURN NEW; END IF;
    IF NOT should_send THEN RETURN NEW; END IF;

    -- Check if we already sent an sla_breach notification for this case
    SELECT EXISTS (
        SELECT 1 FROM notifications
        WHERE case_id = NEW.id AND type = 'sla_breach'
        LIMIT 1
    ) INTO already_sent;

    IF already_sent THEN RETURN NEW; END IF;

    -- Send to org_admin users
    FOR r IN
        SELECT id FROM profiles
        WHERE organisation_id = NEW.organisation_id
          AND role = 'org_admin'
          AND is_active = true
    LOOP
        INSERT INTO notifications (organisation_id, user_id, type, case_id, message)
        VALUES (
            NEW.organisation_id, r.id, 'sla_breach', NEW.id,
            'SLA breach – case has exceeded the review deadline'
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_on_sla_breach ON cases;
CREATE TRIGGER trg_notify_on_sla_breach
    AFTER UPDATE ON cases
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_sla_breach();


-- ═══════════════════════════════════════════════════════════════════════════
-- 2) INSPECTION PACK GENERATED — fires when inspection_snapshots gets a row
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION notify_on_inspection_pack_generated()
RETURNS TRIGGER AS $$
DECLARE
    r           RECORD;
    should_send BOOLEAN;
    month_label TEXT;
BEGIN
    SELECT COALESCE(os.notify_admin_inspection_pack_generated, true)
    INTO should_send
    FROM organisation_settings os
    WHERE os.organisation_id = NEW.organisation_id;

    IF NOT FOUND THEN should_send := true; END IF;
    IF NOT should_send THEN RETURN NEW; END IF;

    month_label := TO_CHAR(NEW.month, 'Mon YYYY');

    FOR r IN
        SELECT id FROM profiles
        WHERE organisation_id = NEW.organisation_id
          AND role = 'org_admin'
          AND is_active = true
    LOOP
        INSERT INTO notifications (organisation_id, user_id, type, case_id, message)
        VALUES (
            NEW.organisation_id, r.id, 'inspection_pack_generated', NULL,
            'Inspection pack generated for ' || month_label
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create trigger if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inspection_snapshots') THEN
        DROP TRIGGER IF EXISTS trg_notify_on_inspection_pack_generated ON inspection_snapshots;
        CREATE TRIGGER trg_notify_on_inspection_pack_generated
            AFTER INSERT ON inspection_snapshots
            FOR EACH ROW
            EXECUTE FUNCTION notify_on_inspection_pack_generated();
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3) INSPECTION PACK SENT — fires when inspection_pack_deliveries gets a row
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION notify_on_inspection_pack_sent()
RETURNS TRIGGER AS $$
DECLARE
    r           RECORD;
    should_send BOOLEAN;
BEGIN
    SELECT COALESCE(os.notify_admin_inspection_pack_sent, true)
    INTO should_send
    FROM organisation_settings os
    WHERE os.organisation_id = NEW.organisation_id;

    IF NOT FOUND THEN should_send := true; END IF;
    IF NOT should_send THEN RETURN NEW; END IF;

    FOR r IN
        SELECT id FROM profiles
        WHERE organisation_id = NEW.organisation_id
          AND role = 'org_admin'
          AND is_active = true
    LOOP
        INSERT INTO notifications (organisation_id, user_id, type, case_id, message)
        VALUES (
            NEW.organisation_id, r.id, 'inspection_pack_sent', NULL,
            'Inspection pack has been sent to recipients'
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inspection_pack_deliveries') THEN
        DROP TRIGGER IF EXISTS trg_notify_on_inspection_pack_sent ON inspection_pack_deliveries;
        CREATE TRIGGER trg_notify_on_inspection_pack_sent
            AFTER INSERT ON inspection_pack_deliveries
            FOR EACH ROW
            EXECUTE FUNCTION notify_on_inspection_pack_sent();
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4) LOSS THRESHOLD EXCEEDED — fires on cases UPDATE when outcome = 'lost'
--    and total loss_amount for the org in a rolling 30-day window exceeds
--    the org's loss_alert_threshold. One-time per threshold breach.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION notify_on_loss_threshold()
RETURNS TRIGGER AS $$
DECLARE
    r               RECORD;
    should_send     BOOLEAN;
    threshold_count INTEGER;
    loss_cases_30d  INTEGER;
    already_sent    BOOLEAN;
BEGIN
    -- Only fire when outcome changes to 'lost'
    IF LOWER(COALESCE(NEW.outcome, '')) <> 'lost' THEN RETURN NEW; END IF;
    IF OLD.outcome IS NOT DISTINCT FROM NEW.outcome THEN RETURN NEW; END IF;

    -- Fetch threshold and setting
    SELECT
        COALESCE(os.loss_alert_threshold, 1)          AS t,
        COALESCE(os.notify_admin_loss_threshold, true) AS enabled
    INTO threshold_count, should_send
    FROM organisation_settings os
    WHERE os.organisation_id = NEW.organisation_id;

    IF NOT FOUND THEN
        threshold_count := 1;
        should_send     := true;
    END IF;

    IF NOT should_send THEN RETURN NEW; END IF;

    -- Count loss cases in rolling 30-day window
    SELECT COUNT(*) INTO loss_cases_30d
    FROM cases
    WHERE organisation_id = NEW.organisation_id
      AND outcome = 'lost'
      AND submitted_at >= (now() - INTERVAL '30 days');

    -- Not yet at threshold
    IF loss_cases_30d < threshold_count THEN RETURN NEW; END IF;

    -- Avoid duplicate: check if a loss_threshold notification was already sent today
    SELECT EXISTS (
        SELECT 1 FROM notifications
        WHERE organisation_id = NEW.organisation_id
          AND type = 'loss_threshold'
          AND created_at >= CURRENT_DATE
        LIMIT 1
    ) INTO already_sent;

    IF already_sent THEN RETURN NEW; END IF;

    FOR r IN
        SELECT id FROM profiles
        WHERE organisation_id = NEW.organisation_id
          AND role = 'org_admin'
          AND is_active = true
    LOOP
        INSERT INTO notifications (organisation_id, user_id, type, case_id, message)
        VALUES (
            NEW.organisation_id, r.id, 'loss_threshold', NEW.id,
            'Loss threshold reached – ' || loss_cases_30d || ' loss cases in the last 30 days'
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_on_loss_threshold ON cases;
CREATE TRIGGER trg_notify_on_loss_threshold
    AFTER UPDATE ON cases
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_loss_threshold();
