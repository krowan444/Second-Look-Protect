import React, { useState, useEffect } from 'react';
import {
    Settings, Loader2, AlertTriangle, CheckCircle2, Save,
    Lock, Mail, Bell, Globe,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import type { UserRole } from '../types';

/* ─── Constants ───────────────────────────────────────────────────────────── */

const ALLOWED_ROLES: UserRole[] = ['org_admin', 'manager', 'super_admin'];

const TIMEZONE_OPTIONS = [
    'Europe/London',
    'Europe/Dublin',
    'Europe/Belfast',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Amsterdam',
    'Europe/Brussels',
    'Europe/Madrid',
    'Europe/Rome',
    'Europe/Lisbon',
    'Europe/Zurich',
    'Europe/Vienna',
    'Europe/Stockholm',
    'Europe/Oslo',
    'Europe/Copenhagen',
    'Europe/Helsinki',
    'Europe/Warsaw',
    'Europe/Prague',
    'Europe/Athens',
    'Europe/Bucharest',
    'Europe/Istanbul',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Asia/Hong_Kong',
    'Asia/Tokyo',
    'Australia/Sydney',
    'Pacific/Auckland',
    'UTC',
];

/* ─── Settings Page ──────────────────────────────────────────────────────── */

export function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [orgId, setOrgId] = useState<string | null>(null);

    // Settings fields
    const [reportRecipients, setReportRecipients] = useState('');
    const [alertRecipients, setAlertRecipients] = useState('');
    const [timezone, setTimezone] = useState('Europe/London');

    // UI state
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    /* ── Load current settings ─────────────────────────────────────────────── */
    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const supabase = getSupabase();

                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) { setError('Not authenticated'); setLoading(false); return; }

                // Get profile
                const { data: profile, error: profErr } = await supabase
                    .from('profiles')
                    .select('organisation_id, role')
                    .eq('id', session.user.id)
                    .single();

                if (profErr || !profile?.organisation_id) {
                    setError('Could not determine your organisation.');
                    setLoading(false);
                    return;
                }

                if (!cancelled) {
                    setOrgId(profile.organisation_id);
                    setUserRole(profile.role as UserRole);
                }

                // Get settings
                const { data: settings } = await supabase
                    .from('organisation_settings')
                    .select('report_recipients, alert_recipients, timezone')
                    .eq('organisation_id', profile.organisation_id)
                    .single();

                if (!cancelled) {
                    if (settings) {
                        setReportRecipients(
                            Array.isArray(settings.report_recipients)
                                ? settings.report_recipients.join('\n')
                                : ''
                        );
                        setAlertRecipients(
                            Array.isArray(settings.alert_recipients)
                                ? settings.alert_recipients.join('\n')
                                : ''
                        );
                        setTimezone(settings.timezone ?? 'Europe/London');
                    }
                    setLoading(false);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setError(err?.message ?? 'Failed to load settings');
                    setLoading(false);
                }
            }
        }

        load();
        return () => { cancelled = true; };
    }, []);

    /* ── Save handler ──────────────────────────────────────────────────────── */
    async function handleSave() {
        if (!orgId) return;
        setSaving(true);
        setSaveError(null);
        setSaveSuccess(false);

        try {
            const supabase = getSupabase();

            const reportList = reportRecipients
                .split('\n')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            const alertList = alertRecipients
                .split('\n')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            const { error: upsertErr } = await supabase
                .from('organisation_settings')
                .upsert({
                    organisation_id: orgId,
                    report_recipients: reportList,
                    alert_recipients: alertList,
                    timezone,
                }, { onConflict: 'organisation_id' });

            if (upsertErr) throw upsertErr;

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err: any) {
            setSaveError(err?.message ?? 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    }

    /* ── Render ─────────────────────────────────────────────────────────────── */

    if (loading) {
        return (
            <div className="dashboard-overview-loading">
                <Loader2 className="dashboard-overview-spinner-icon" />
                <p>Loading settings…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <div className="dashboard-page-header">
                    <h1 className="dashboard-page-title">Settings</h1>
                </div>
                <div className="dashboard-overview-error">
                    <AlertTriangle size={20} />
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    // Role gate
    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
        return (
            <div>
                <div className="dashboard-page-header">
                    <h1 className="dashboard-page-title">Settings</h1>
                    <p className="dashboard-page-subtitle">
                        Organisation settings and notification preferences.
                    </p>
                </div>
                <div className="dashboard-settings-locked">
                    <Lock size={24} />
                    <p>You do not have permission to edit settings.</p>
                    <span>Contact an organisation admin to make changes.</span>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="dashboard-page-header">
                <h1 className="dashboard-page-title">Settings</h1>
                <p className="dashboard-page-subtitle">
                    Manage notification recipients and organisation preferences.
                </p>
            </div>

            <div className="dashboard-settings-card">

                {/* Timezone */}
                <div className="dashboard-settings-field">
                    <label className="dashboard-settings-label">
                        <Globe size={16} />
                        Timezone
                    </label>
                    <p className="dashboard-settings-hint">
                        Used for report date boundaries and display.
                    </p>
                    <select
                        className="dashboard-settings-select"
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                    >
                        {TIMEZONE_OPTIONS.map(tz => (
                            <option key={tz} value={tz}>{tz}</option>
                        ))}
                    </select>
                </div>

                {/* Report Recipients */}
                <div className="dashboard-settings-field">
                    <label className="dashboard-settings-label">
                        <Mail size={16} />
                        Report Recipients
                    </label>
                    <p className="dashboard-settings-hint">
                        Email addresses that receive monthly safeguarding reports. One per line.
                    </p>
                    <textarea
                        className="dashboard-settings-textarea"
                        rows={4}
                        value={reportRecipients}
                        onChange={(e) => setReportRecipients(e.target.value)}
                        placeholder="admin@example.com&#10;manager@example.com"
                    />
                </div>

                {/* Alert Recipients */}
                <div className="dashboard-settings-field">
                    <label className="dashboard-settings-label">
                        <Bell size={16} />
                        Alert Recipients
                    </label>
                    <p className="dashboard-settings-hint">
                        Email addresses that receive high-risk case alerts. One per line.
                    </p>
                    <textarea
                        className="dashboard-settings-textarea"
                        rows={4}
                        value={alertRecipients}
                        onChange={(e) => setAlertRecipients(e.target.value)}
                        placeholder="safeguarding@example.com&#10;lead@example.com"
                    />
                </div>

                {/* Feedback */}
                {saveError && (
                    <div className="dsf-error">
                        <AlertTriangle size={14} />
                        <span>{saveError}</span>
                    </div>
                )}
                {saveSuccess && (
                    <div className="dashboard-settings-success">
                        <CheckCircle2 size={14} />
                        <span>Settings saved successfully.</span>
                    </div>
                )}

                {/* Save button */}
                <button
                    className="dashboard-settings-save-btn"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <>
                            <Loader2 size={16} className="dsf-spinner" />
                            Saving…
                        </>
                    ) : (
                        <>
                            <Save size={16} />
                            Save Settings
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
