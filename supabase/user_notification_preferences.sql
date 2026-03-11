-- ═══════════════════════════════════════════════════════════════════════════
-- Personal User Notification Preferences
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Create the user_notification_preferences table
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    user_id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Master channel toggles
    inapp_enabled           boolean NOT NULL DEFAULT true,
    email_enabled           boolean NOT NULL DEFAULT true,
    -- Per-event toggles (default true = opted-in)
    pref_new_case_submitted boolean NOT NULL DEFAULT true,
    pref_case_updated       boolean NOT NULL DEFAULT true,
    pref_review_due         boolean NOT NULL DEFAULT true,
    pref_escalation_notice  boolean NOT NULL DEFAULT true,
    pref_monthly_summary    boolean NOT NULL DEFAULT true,
    -- Timestamps
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

-- 2) Enable RLS
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read their own preferences
CREATE POLICY "Users can read own notification preferences"
    ON user_notification_preferences FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own notification preferences"
    ON user_notification_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own notification preferences"
    ON user_notification_preferences FOR UPDATE
    USING (auth.uid() = user_id);

-- Service role can read all (for dispatch logic)
CREATE POLICY "Service can read all notification preferences"
    ON user_notification_preferences FOR SELECT
    USING (true);
