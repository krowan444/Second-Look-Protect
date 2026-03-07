import React, { useState, useEffect } from 'react';
import {
    Settings, Loader2, AlertTriangle, CheckCircle2, Save,
    Lock, Mail, Bell, Globe, Clock, ShieldAlert, Zap, Calendar, Send, Building2,
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

    // Operational settings
    const [autoSendInspection, setAutoSendInspection] = useState(false);
    const [escalationHours, setEscalationHours] = useState<number | ''>(48);
    const [highRiskThreshold, setHighRiskThreshold] = useState<number | ''>(3);
    const [lossAlertThreshold, setLossAlertThreshold] = useState<number | ''>(1);
    const [monthlyReportDay, setMonthlyReportDay] = useState<number | ''>(1);

    // Group awareness
    const [groupName, setGroupName] = useState<string | null>(null);

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

                if (profErr) {
                    setError('Could not load profile.');
                    setLoading(false);
                    return;
                }

                // Resolve org: super_admin can use the org switcher
                let resolvedOrgId = profile?.organisation_id ?? null;
                if (profile?.role === 'super_admin') {
                    const switcherOrg =
                        localStorage.getItem('slp_viewing_as_org_id') ||
                        localStorage.getItem('slp_active_org_id');
                    if (switcherOrg) resolvedOrgId = switcherOrg;
                }

                if (!resolvedOrgId) {
                    setError('No organisation selected. Use the \u201cViewing as\u201d selector to choose one.');
                    setLoading(false);
                    return;
                }

                if (!cancelled) {
                    setOrgId(resolvedOrgId);
                    setUserRole(profile.role as UserRole);
                }

                // Get settings
                const { data: settings } = await supabase
                    .from('organisation_settings')
                    .select('report_recipients, alert_recipients, timezone, auto_send_inspection_pack, escalation_hours, high_risk_threshold, loss_alert_threshold, monthly_report_day')
                    .eq('organisation_id', resolvedOrgId)
                    .single();

                if (!cancelled && settings) {
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
                    setAutoSendInspection(!!settings.auto_send_inspection_pack);
                    setEscalationHours(settings.escalation_hours ?? 48);
                    setHighRiskThreshold(settings.high_risk_threshold ?? 3);
                    setLossAlertThreshold(settings.loss_alert_threshold ?? 1);
                    setMonthlyReportDay(settings.monthly_report_day ?? 1);
                }

                // Fetch group name if organisation has a group_id
                const { data: orgRow } = await supabase
                    .from('organisations')
                    .select('group_id')
                    .eq('id', resolvedOrgId)
                    .single();

                if (!cancelled && orgRow?.group_id) {
                    const { data: grp } = await supabase
                        .from('organisation_groups')
                        .select('name')
                        .eq('id', orgRow.group_id)
                        .single();
                    if (grp?.name) setGroupName(grp.name);
                }

                if (!cancelled) setLoading(false);
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
                    auto_send_inspection_pack: autoSendInspection,
                    escalation_hours: escalationHours === '' ? null : escalationHours,
                    high_risk_threshold: highRiskThreshold === '' ? null : highRiskThreshold,
                    loss_alert_threshold: lossAlertThreshold === '' ? null : lossAlertThreshold,
                    monthly_report_day: monthlyReportDay === '' ? null : monthlyReportDay,
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

                {/* ── Group Affiliation ────────────────────────────────────── */}
                {groupName && (
                    <div className="dashboard-settings-field">
                        <label className="dashboard-settings-label">
                            <Building2 size={16} />
                            Organisation Group
                        </label>
                        <p style={{ fontSize: '0.88rem', color: '#1e293b', fontWeight: 500, margin: '0.25rem 0 0' }}>
                            {groupName}
                        </p>
                        <p className="dashboard-settings-hint" style={{ marginTop: '0.25rem' }}>
                            This organisation is part of a multi-site group.
                        </p>
                    </div>
                )}

                {/* ── Operational Settings ─────────────────────────────────── */}
                <div style={{ borderTop: '1px solid #e2e8f0', margin: '1rem 0', paddingTop: '1rem' }}>
                    <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
                        Operational Settings
                    </p>
                </div>

                {/* Auto-send Inspection Pack */}
                <div className="dashboard-settings-field">
                    <label className="dashboard-settings-label">
                        <Send size={16} />
                        Auto-send Inspection Pack
                    </label>
                    <p className="dashboard-settings-hint">
                        Automatically email the inspection pack to recipients when the monthly report is locked.
                    </p>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                        <input
                            type="checkbox"
                            checked={autoSendInspection}
                            onChange={(e) => setAutoSendInspection(e.target.checked)}
                            style={{ width: 18, height: 18, accentColor: '#C9A84C' }}
                        />
                        Enabled
                    </label>
                </div>

                {/* Escalation Hours */}
                <div className="dashboard-settings-field">
                    <label className="dashboard-settings-label">
                        <Clock size={16} />
                        Escalation Hours
                    </label>
                    <p className="dashboard-settings-hint">
                        Hours before an unreviewed case is automatically escalated.
                    </p>
                    <input
                        type="number"
                        min={1}
                        max={720}
                        className="dashboard-settings-select"
                        style={{ maxWidth: '120px' }}
                        value={escalationHours}
                        onChange={(e) => setEscalationHours(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                </div>

                {/* High Risk Threshold */}
                <div className="dashboard-settings-field">
                    <label className="dashboard-settings-label">
                        <ShieldAlert size={16} />
                        High Risk Threshold
                    </label>
                    <p className="dashboard-settings-hint">
                        Number of high-risk cases in a rolling window that triggers an executive alert.
                    </p>
                    <input
                        type="number"
                        min={1}
                        max={100}
                        className="dashboard-settings-select"
                        style={{ maxWidth: '120px' }}
                        value={highRiskThreshold}
                        onChange={(e) => setHighRiskThreshold(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                </div>

                {/* Loss Alert Threshold */}
                <div className="dashboard-settings-field">
                    <label className="dashboard-settings-label">
                        <Zap size={16} />
                        Loss Alert Threshold
                    </label>
                    <p className="dashboard-settings-hint">
                        Number of financial-loss cases that triggers a loss alert.
                    </p>
                    <input
                        type="number"
                        min={1}
                        max={100}
                        className="dashboard-settings-select"
                        style={{ maxWidth: '120px' }}
                        value={lossAlertThreshold}
                        onChange={(e) => setLossAlertThreshold(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                </div>

                {/* Monthly Report Day */}
                <div className="dashboard-settings-field">
                    <label className="dashboard-settings-label">
                        <Calendar size={16} />
                        Monthly Report Day
                    </label>
                    <p className="dashboard-settings-hint">
                        Day of the month when the safeguarding report is generated (1–28).
                    </p>
                    <input
                        type="number"
                        min={1}
                        max={28}
                        className="dashboard-settings-select"
                        style={{ maxWidth: '120px' }}
                        value={monthlyReportDay}
                        onChange={(e) => setMonthlyReportDay(e.target.value === '' ? '' : Number(e.target.value))}
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
