-- ═══════════════════════════════════════════════════════════════════════════
-- CLEANUP: Remove duplicate "Redwood demo" organisation
-- ═══════════════════════════════════════════════════════════════════════════
--
-- PURPOSE:  Delete the duplicate demo org while preserving the main
--           "Redwood Care Home" organisation and all its data.
--
-- HOW TO USE:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Run STEP 1 first to identify the orgs
--   3. Confirm which org is the duplicate
--   4. Replace <DUPLICATE_ORG_ID> in STEP 2 with the actual UUID
--   5. Run STEP 2 to preview linked records (DRY RUN — no deletions)
--   6. Run STEP 3 to delete (inside a transaction for safety)
--
-- ═══════════════════════════════════════════════════════════════════════════

-- ┌──────────────────────────────────────────────────────────────────────┐
-- │  STEP 1: Identify all Redwood-related organisations                │
-- │  Run this first — do NOT skip.                                     │
-- └──────────────────────────────────────────────────────────────────────┘

SELECT id, name, slug, status, created_at
FROM organisations
WHERE name ILIKE '%redwood%'
ORDER BY created_at;

-- Expected output:
--   Row 1: "Redwood Care Home"  ← KEEP THIS (main demo environment)
--   Row 2: "Redwood demo"       ← DELETE THIS (the duplicate)
--
-- Copy the `id` UUID from the "Redwood demo" row.


-- ┌──────────────────────────────────────────────────────────────────────┐
-- │  STEP 2: DRY RUN — Preview linked records that will be removed     │
-- │  Replace <DUPLICATE_ORG_ID> with the actual UUID from Step 1.      │
-- └──────────────────────────────────────────────────────────────────────┘

-- ⚠️  Replace this placeholder with the real UUID:
-- SET my.dup_org = '<DUPLICATE_ORG_ID>';

-- Preview counts of linked records:
DO $$
DECLARE
    dup_id uuid := '<DUPLICATE_ORG_ID>';  -- ← REPLACE THIS
BEGIN
    RAISE NOTICE '── Linked record counts for organisation % ──', dup_id;
    RAISE NOTICE 'cases: %',              (SELECT count(*) FROM cases              WHERE organisation_id = dup_id);
    RAISE NOTICE 'profiles: %',           (SELECT count(*) FROM profiles           WHERE organisation_id = dup_id);
    RAISE NOTICE 'notifications: %',      (SELECT count(*) FROM notifications      WHERE organisation_id = dup_id);
    RAISE NOTICE 'ai_triage_results: %',  (SELECT count(*) FROM ai_triage_results  WHERE case_id IN (SELECT id FROM cases WHERE organisation_id = dup_id));
    RAISE NOTICE 'safeguarding_alerts: %',(SELECT count(*) FROM safeguarding_alerts WHERE organisation_id = dup_id);
    RAISE NOTICE 'organisation_settings: %', (SELECT count(*) FROM organisation_settings WHERE organisation_id = dup_id);

    -- Check for email_logs if the table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_logs') THEN
        RAISE NOTICE 'email_logs: %',     (SELECT count(*) FROM email_logs         WHERE organisation_id = dup_id);
    END IF;

    -- Check for inspection_pack_deliveries if the table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inspection_pack_deliveries') THEN
        RAISE NOTICE 'inspection_pack_deliveries: %', (SELECT count(*) FROM inspection_pack_deliveries WHERE organisation_id = dup_id);
    END IF;

    RAISE NOTICE '── End of preview ──';
END $$;


-- ┌──────────────────────────────────────────────────────────────────────┐
-- │  STEP 3: DELETE — Run only after confirming Step 2 looks correct    │
-- │  Replace <DUPLICATE_ORG_ID> with the same UUID from Step 1.        │
-- │  Everything runs in a single transaction — ROLLBACK if unsure.     │
-- └──────────────────────────────────────────────────────────────────────┘

BEGIN;

DO $$
DECLARE
    dup_id uuid := '<DUPLICATE_ORG_ID>';  -- ← REPLACE THIS
    org_name text;
BEGIN
    -- Safety check: confirm this is NOT "Redwood Care Home"
    SELECT name INTO org_name FROM organisations WHERE id = dup_id;

    IF org_name IS NULL THEN
        RAISE EXCEPTION 'Organisation % not found — aborting.', dup_id;
    END IF;

    IF org_name ILIKE '%redwood care home%' THEN
        RAISE EXCEPTION 'SAFETY STOP: This looks like the MAIN org (%). Aborting to protect data.', org_name;
    END IF;

    RAISE NOTICE 'Deleting organisation: "%" (%)', org_name, dup_id;

    -- Delete in dependency order (children first, parent last)

    -- 1. AI triage results linked to this org's cases
    DELETE FROM ai_triage_results WHERE case_id IN (SELECT id FROM cases WHERE organisation_id = dup_id);
    RAISE NOTICE '  ✓ ai_triage_results deleted';

    -- 2. Notifications
    DELETE FROM notifications WHERE organisation_id = dup_id;
    RAISE NOTICE '  ✓ notifications deleted';

    -- 3. Safeguarding alerts
    DELETE FROM safeguarding_alerts WHERE organisation_id = dup_id;
    RAISE NOTICE '  ✓ safeguarding_alerts deleted';

    -- 4. Email logs (if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_logs') THEN
        DELETE FROM email_logs WHERE organisation_id = dup_id;
        RAISE NOTICE '  ✓ email_logs deleted';
    END IF;

    -- 5. Inspection pack deliveries (if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inspection_pack_deliveries') THEN
        DELETE FROM inspection_pack_deliveries WHERE organisation_id = dup_id;
        RAISE NOTICE '  ✓ inspection_pack_deliveries deleted';
    END IF;

    -- 6. Organisation settings
    DELETE FROM organisation_settings WHERE organisation_id = dup_id;
    RAISE NOTICE '  ✓ organisation_settings deleted';

    -- 7. Cases (must come after triage results and notifications)
    DELETE FROM cases WHERE organisation_id = dup_id;
    RAISE NOTICE '  ✓ cases deleted';

    -- 8. Profiles linked to the org
    DELETE FROM profiles WHERE organisation_id = dup_id;
    RAISE NOTICE '  ✓ profiles deleted';

    -- 9. The organisation itself
    DELETE FROM organisations WHERE id = dup_id;
    RAISE NOTICE '  ✓ organisation deleted';

    RAISE NOTICE '── Done. All linked records for "%" removed. ──', org_name;
END $$;

-- If everything looks correct in the NOTICE output:
COMMIT;

-- If something looks wrong, run this instead:
-- ROLLBACK;
