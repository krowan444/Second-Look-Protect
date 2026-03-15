import React, { useState, useEffect } from 'react';
import {
    Settings, Loader2, AlertTriangle, CheckCircle2, Save,
    Lock, Mail, Bell, Globe, Clock, ShieldAlert, Zap, Calendar, Send, Building2, User,
    Image, X, Palette, RefreshCw,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import type { UserRole } from '../types';
import { ORG_LOGO_PRESETS, PresetSvg, findPreset } from '../orgLogoPresets';

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
    const [userId, setUserId] = useState<string | null>(null);
    const [orgId, setOrgId] = useState<string | null>(null);
    const [orgName, setOrgName] = useState<string | null>(null);

    // Personal notification preferences
    const [personalInapp, setPersonalInapp] = useState(true);
    const [personalEmail, setPersonalEmail] = useState(true);
    const [personalNewCase, setPersonalNewCase] = useState(true);
    const [personalCaseUpdated, setPersonalCaseUpdated] = useState(true);
    const [personalReviewDue, setPersonalReviewDue] = useState(true);
    const [personalEscalation, setPersonalEscalation] = useState(true);
    const [personalMonthlySummary, setPersonalMonthlySummary] = useState(true);
    const [personalSaving, setPersonalSaving] = useState(false);
    const [personalSaveError, setPersonalSaveError] = useState<string | null>(null);
    const [personalSaveSuccess, setPersonalSaveSuccess] = useState(false);
    const [notificationEmail, setNotificationEmail] = useState('');

    // Settings fields
    const [reportRecipients, setReportRecipients] = useState('');
    const [inspectionPackRecipients, setInspectionPackRecipients] = useState('');
    const [alertRecipients, setAlertRecipients] = useState('');
    const [timezone, setTimezone] = useState('Europe/London');

    // Operational settings
    const [autoSendInspection, setAutoSendInspection] = useState(false);
    const [escalationHours, setEscalationHours] = useState<number | ''>(48);
    const [highRiskThreshold, setHighRiskThreshold] = useState<number | ''>(3);
    const [lossAlertThreshold, setLossAlertThreshold] = useState<number | ''>(1);
    const [monthlyReportDay, setMonthlyReportDay] = useState<number | ''>(1);
    const [reportSendTime, setReportSendTime] = useState('09:00');
    const [inspectionPackSendTime, setInspectionPackSendTime] = useState('09:00');

    // Notification preferences (default true = opted-in)
    const [notifyAdminCaseCreated, setNotifyAdminCaseCreated] = useState(true);
    const [notifyAdminHighRisk, setNotifyAdminHighRisk] = useState(true);
    const [notifyAdminCritical, setNotifyAdminCritical] = useState(true);
    const [notifyAdminSlaBreach, setNotifyAdminSlaBreach] = useState(true);
    const [notifyAdminNewEvidence, setNotifyAdminNewEvidence] = useState(true);
    const [notifyAdminInspectionGenerated, setNotifyAdminInspectionGenerated] = useState(true);
    const [notifyAdminInspectionSent, setNotifyAdminInspectionSent] = useState(true);
    const [notifyAdminRepeatTargeting, setNotifyAdminRepeatTargeting] = useState(true);
    const [notifyAdminLossThreshold, setNotifyAdminLossThreshold] = useState(true);
    const [notifyAdminNewUser, setNotifyAdminNewUser] = useState(true);
    const [notifyStaffCaseAssigned, setNotifyStaffCaseAssigned] = useState(true);
    const [notifyStaffCaseInReview, setNotifyStaffCaseInReview] = useState(true);
    const [notifyStaffCaseClosed, setNotifyStaffCaseClosed] = useState(true);
    const [notifyStaffInfoRequested, setNotifyStaffInfoRequested] = useState(true);
    const [notifyStaffEvidenceRequested, setNotifyStaffEvidenceRequested] = useState(true);
    const [notifyStaffEvidenceAdded, setNotifyStaffEvidenceAdded] = useState(true);

    // Email notification preferences (admin operational alerts)
    const [emailAdminCaseCreated, setEmailAdminCaseCreated] = useState(false);
    const [emailAdminCaseUpdated, setEmailAdminCaseUpdated] = useState(false);
    const [emailAdminNewEvidence, setEmailAdminNewEvidence] = useState(false);
    const [emailAdminOverdueReview, setEmailAdminOverdueReview] = useState(false);
    const [emailAdminEscalationNotice, setEmailAdminEscalationNotice] = useState(false);

    // Group awareness
    const [groupName, setGroupName] = useState<string | null>(null);

    // UI state
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // ── Branding state ─────────────────────────────────────────────────────
    const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
    const [currentLogoPreset, setCurrentLogoPreset] = useState<string | null>(null);
    const [pendingLogoUrl, setPendingLogoUrl] = useState<string | null>(null);    // preview of uploaded image
    const [pendingPreset, setPendingPreset] = useState<string | null>(null);      // selected preset key
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [brandingSaving, setBrandingSaving] = useState(false);
    const [brandingError, setBrandingError] = useState<string | null>(null);
    const [brandingSuccess, setBrandingSuccess] = useState(false);
    const [pendingFile, setPendingFile] = useState<File | null>(null);

    /* ── Load current settings ─────────────────────────────────────────────── */
    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const supabase = getSupabase();

                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) { setError('Not authenticated'); setLoading(false); return; }

                const currentUserId = session.user.id;
                if (!cancelled) setUserId(currentUserId);

                // Get profile
                const { data: profile, error: profErr } = await supabase
                    .from('profiles')
                    .select('organisation_id, role, notification_email')
                    .eq('id', currentUserId)
                    .single();

                if (profErr) {
                    setError('Could not load profile.');
                    setLoading(false);
                    return;
                }

                if (!cancelled) {
                    setNotificationEmail(profile.notification_email ?? '');
                }

                // Load personal notification preferences (for ALL users)
                try {
                    const { data: personalPrefs } = await supabase
                        .from('user_notification_preferences')
                        .select('*')
                        .eq('user_id', currentUserId)
                        .maybeSingle();

                    if (!cancelled && personalPrefs) {
                        setPersonalInapp(personalPrefs.inapp_enabled ?? true);
                        setPersonalEmail(personalPrefs.email_enabled ?? true);
                        setPersonalNewCase(personalPrefs.pref_new_case_submitted ?? true);
                        setPersonalCaseUpdated(personalPrefs.pref_case_updated ?? true);
                        setPersonalReviewDue(personalPrefs.pref_review_due ?? true);
                        setPersonalEscalation(personalPrefs.pref_escalation_notice ?? true);
                        setPersonalMonthlySummary(personalPrefs.pref_monthly_summary ?? true);
                    }
                } catch {
                    // Personal prefs are best-effort — don't block page load
                }

                // Resolve org: super_admin uses the same key as Reports page
                let resolvedOrgId = profile?.organisation_id ?? null;
                if (profile?.role === 'super_admin') {
                    const switcherOrg =
                        localStorage.getItem('slp_active_org_id') ||
                        localStorage.getItem('slp_viewing_as_org_id');
                    if (switcherOrg) resolvedOrgId = switcherOrg;
                }

                if (!resolvedOrgId) {
                    // Still allow page to load for personal prefs
                    if (!cancelled) {
                        setUserRole(profile.role as UserRole);
                        setLoading(false);
                    }
                    return;
                }

                if (!cancelled) {
                    setOrgId(resolvedOrgId);
                    setUserRole(profile.role as UserRole);
                }

                // Fetch org name for display
                const { data: orgNameRow } = await supabase
                    .from('organisations')
                    .select('name, logo_url, logo_preset')
                    .eq('id', resolvedOrgId)
                    .single();
                if (!cancelled && orgNameRow?.name) setOrgName(orgNameRow.name);
                if (!cancelled) {
                    setCurrentLogoUrl(orgNameRow?.logo_url ?? null);
                    setCurrentLogoPreset(orgNameRow?.logo_preset ?? null);
                    setPendingPreset(orgNameRow?.logo_preset ?? null);
                }

                // Get settings
                const { data: settings } = await supabase
                    .from('organisation_settings')
                    .select('*')
                    .eq('organisation_id', resolvedOrgId)
                    .single();

                if (!cancelled && settings) {
                    setReportRecipients(
                        Array.isArray(settings.report_recipients)
                            ? settings.report_recipients.join('\n')
                            : ''
                    );
                    setInspectionPackRecipients(
                        Array.isArray((settings as any).inspection_pack_recipients)
                            ? (settings as any).inspection_pack_recipients.join('\n')
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
                    setReportSendTime(settings.report_send_time ?? '09:00');
                    setInspectionPackSendTime(settings.inspection_pack_send_time ?? '09:00');

                    // Notification prefs (default true if column is null)
                    const s = settings as any;
                    setNotifyAdminCaseCreated(s.notify_admin_case_created ?? true);
                    setNotifyAdminHighRisk(s.notify_admin_high_risk_case ?? true);
                    setNotifyAdminCritical(s.notify_admin_critical_case ?? true);
                    setNotifyAdminSlaBreach(s.notify_admin_sla_breach ?? true);
                    setNotifyAdminNewEvidence(s.notify_admin_new_evidence ?? true);
                    setNotifyAdminInspectionGenerated(s.notify_admin_inspection_pack_generated ?? true);
                    setNotifyAdminInspectionSent(s.notify_admin_inspection_pack_sent ?? true);
                    setNotifyAdminRepeatTargeting(s.notify_admin_repeat_targeting ?? true);
                    setNotifyAdminLossThreshold(s.notify_admin_loss_threshold ?? true);
                    setNotifyAdminNewUser(s.notify_admin_new_user ?? true);
                    setNotifyStaffCaseAssigned(s.notify_staff_case_assigned ?? true);
                    setNotifyStaffCaseInReview(s.notify_staff_case_in_review ?? true);
                    setNotifyStaffCaseClosed(s.notify_staff_case_closed ?? true);
                    setNotifyStaffInfoRequested(s.notify_staff_info_requested ?? true);
                    setNotifyStaffEvidenceRequested(s.notify_staff_evidence_requested ?? true);
                    setNotifyStaffEvidenceAdded(s.notify_staff_evidence_added ?? true);

                    // Email notification prefs (admin operational alerts)
                    setEmailAdminCaseCreated(s.email_admin_case_created ?? false);
                    setEmailAdminCaseUpdated(s.email_admin_case_updated ?? false);
                    setEmailAdminNewEvidence(s.email_admin_new_evidence ?? false);
                    setEmailAdminOverdueReview(s.email_admin_overdue_review ?? false);
                    setEmailAdminEscalationNotice(s.email_admin_escalation_notice ?? false);
                }

                // Fetch group name if organisation has a organisation_group_id
                const { data: orgRow } = await supabase
                    .from('organisations')
                    .select('organisation_group_id')
                    .eq('id', resolvedOrgId)
                    .single();

                if (!cancelled && orgRow?.organisation_group_id) {
                    const { data: grp } = await supabase
                        .from('organisation_groups')
                        .select('name')
                        .eq('id', orgRow.organisation_group_id)
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

    /* ── Save personal notification preferences ──────────────────────────── */
    async function handleSavePersonal() {
        if (!userId) return;
        setPersonalSaving(true);
        setPersonalSaveError(null);
        setPersonalSaveSuccess(false);

        try {
            const supabase = getSupabase();

            const { error: upsertErr } = await supabase
                .from('user_notification_preferences')
                .upsert({
                    user_id: userId,
                    inapp_enabled: personalInapp,
                    email_enabled: personalEmail,
                    pref_new_case_submitted: personalNewCase,
                    pref_case_updated: personalCaseUpdated,
                    pref_review_due: personalReviewDue,
                    pref_escalation_notice: personalEscalation,
                    pref_monthly_summary: personalMonthlySummary,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id' });

            if (upsertErr) throw upsertErr;

            // Also save notification_email to profiles
            const trimmedEmail = notificationEmail.trim();
            const { error: profileErr } = await supabase
                .from('profiles')
                .update({ notification_email: trimmedEmail || null })
                .eq('id', userId);

            if (profileErr) throw profileErr;

            setPersonalSaveSuccess(true);
            setTimeout(() => setPersonalSaveSuccess(false), 3000);
        } catch (err: any) {
            setPersonalSaveError(err?.message ?? 'Failed to save preferences');
        } finally {
            setPersonalSaving(false);
        }
    }

    /* ── Save branding ────────────────────────────────────────────────────── */
    async function handleSaveBranding() {
        if (!orgId) return;
        setBrandingSaving(true);
        setBrandingError(null);
        setBrandingSuccess(false);
        try {
            const supabase = getSupabase();
            let finalLogoUrl: string | null = currentLogoUrl;

            // Upload new file if one was selected
            if (pendingFile) {
                setUploadingLogo(true);
                const ext = pendingFile.name.split('.').pop() ?? 'png';
                const path = `${orgId}/logo.${ext}`;
                const { error: upErr } = await supabase.storage
                    .from('org-logos')
                    .upload(path, pendingFile, { upsert: true, contentType: pendingFile.type });
                setUploadingLogo(false);
                if (upErr) throw upErr;
                const { data: urlData } = supabase.storage.from('org-logos').getPublicUrl(path);
                finalLogoUrl = urlData.publicUrl + `?v=${Date.now()}`; // cache-bust
            }

            // If a preset was chosen, clear the uploaded logo (preset takes priority signal)
            const finalPreset = pendingPreset ?? null;
            // If preset selected, don't store a logo_url (preset overrides)
            const logoUrlToSave = finalPreset ? null : (finalLogoUrl ?? null);

            const { error: updErr } = await supabase
                .from('organisations')
                .update({ logo_url: logoUrlToSave, logo_preset: finalPreset })
                .eq('id', orgId);

            if (updErr) throw updErr;

            setCurrentLogoUrl(logoUrlToSave);
            setCurrentLogoPreset(finalPreset);
            setPendingFile(null);
            setPendingLogoUrl(null);
            setBrandingSuccess(true);
            setTimeout(() => setBrandingSuccess(false), 3000);
            // Reload so the header pill refreshes immediately
            setTimeout(() => window.location.reload(), 1200);
        } catch (err: any) {
            setUploadingLogo(false);
            setBrandingError(err?.message ?? 'Failed to save branding');
        } finally {
            setBrandingSaving(false);
        }
    }

    async function handleResetBranding() {
        if (!orgId) return;
        setBrandingSaving(true);
        setBrandingError(null);
        try {
            const supabase = getSupabase();
            await supabase.from('organisations').update({ logo_url: null, logo_preset: null }).eq('id', orgId);
            setCurrentLogoUrl(null);
            setCurrentLogoPreset(null);
            setPendingPreset(null);
            setPendingFile(null);
            setPendingLogoUrl(null);
            setBrandingSuccess(true);
            setTimeout(() => setBrandingSuccess(false), 3000);
            setTimeout(() => window.location.reload(), 1200);
        } catch (err: any) {
            setBrandingError(err?.message ?? 'Failed to reset branding');
        } finally {
            setBrandingSaving(false);
        }
    }

    /* ── Save org settings handler ─────────────────────────────────────────── */
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

            const inspectionPackList = inspectionPackRecipients
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
                    inspection_pack_recipients: inspectionPackList,
                    alert_recipients: alertList,
                    timezone,
                    auto_send_inspection_pack: autoSendInspection,
                    escalation_hours: escalationHours === '' ? null : escalationHours,
                    high_risk_threshold: highRiskThreshold === '' ? null : highRiskThreshold,
                    loss_alert_threshold: lossAlertThreshold === '' ? null : lossAlertThreshold,
                    monthly_report_day: monthlyReportDay === '' ? null : monthlyReportDay,
                    report_send_time: reportSendTime || '09:00',
                    inspection_pack_send_time: inspectionPackSendTime || '09:00',
                    // Notification preferences
                    notify_admin_case_created: notifyAdminCaseCreated,
                    notify_admin_high_risk_case: notifyAdminHighRisk,
                    notify_admin_critical_case: notifyAdminCritical,
                    notify_admin_sla_breach: notifyAdminSlaBreach,
                    notify_admin_new_evidence: notifyAdminNewEvidence,
                    notify_admin_inspection_pack_generated: notifyAdminInspectionGenerated,
                    notify_admin_inspection_pack_sent: notifyAdminInspectionSent,
                    notify_admin_repeat_targeting: notifyAdminRepeatTargeting,
                    notify_admin_loss_threshold: notifyAdminLossThreshold,
                    notify_admin_new_user: notifyAdminNewUser,
                    notify_staff_case_assigned: notifyStaffCaseAssigned,
                    notify_staff_case_in_review: notifyStaffCaseInReview,
                    notify_staff_case_closed: notifyStaffCaseClosed,
                    notify_staff_info_requested: notifyStaffInfoRequested,
                    notify_staff_evidence_requested: notifyStaffEvidenceRequested,
                    notify_staff_evidence_added: notifyStaffEvidenceAdded,
                    // Email notification preferences (admin operational alerts)
                    email_admin_case_created: emailAdminCaseCreated,
                    email_admin_case_updated: emailAdminCaseUpdated,
                    email_admin_new_evidence: emailAdminNewEvidence,
                    email_admin_overdue_review: emailAdminOverdueReview,
                    email_admin_escalation_notice: emailAdminEscalationNotice,
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

    // Check if user can access org settings
    const canEditOrgSettings = userRole && ALLOWED_ROLES.includes(userRole);

    return (
        <div>
            <div className="dashboard-page-header">
                <h1 className="dashboard-page-title">Settings</h1>
                <p className="dashboard-page-subtitle">
                    {canEditOrgSettings
                        ? 'Manage your notification preferences and organisation settings.'
                        : 'Manage your personal notification preferences.'
                    }
                    {canEditOrgSettings && orgName && (
                        <span style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                            Editing: <strong style={{ color: '#64748b' }}>{orgName}</strong>
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#cbd5e1' }}>({orgId})</span>
                        </span>
                    )}
                </p>
            </div>

            {/* ── Personal Notification Preferences (visible to ALL users) ──── */}
            <div className="dashboard-settings-card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ marginBottom: '0.75rem' }}>
                    <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <User size={14} />
                        My Email Preferences
                    </p>
                    <p className="dashboard-settings-hint">
                        Control which notifications you personally receive. Organisation-level settings may override these if an event type is disabled by your admin.
                    </p>
                </div>

                {/* Master channel toggles */}
                <div className="dashboard-settings-field">
                    <label className="dashboard-settings-label">
                        <Bell size={16} />
                        In-App Notifications
                    </label>
                    <p className="dashboard-settings-hint">
                        Receive in-app bell notifications in the dashboard.
                    </p>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                        <input
                            type="checkbox"
                            checked={personalInapp}
                            onChange={(e) => setPersonalInapp(e.target.checked)}
                            style={{ width: 18, height: 18, accentColor: '#C9A84C' }}
                        />
                        Enabled
                    </label>
                </div>

                <div className="dashboard-settings-field">
                    <label className="dashboard-settings-label">
                        <Mail size={16} />
                        Email Notifications
                    </label>
                    <p className="dashboard-settings-hint">
                        Receive email alerts for events you are subscribed to.
                    </p>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                        <input
                            type="checkbox"
                            checked={personalEmail}
                            onChange={(e) => setPersonalEmail(e.target.checked)}
                            style={{ width: 18, height: 18, accentColor: '#C9A84C' }}
                        />
                        Enabled
                    </label>
                </div>

                {/* Notification destination email */}
                <div className="dashboard-settings-field">
                    <label className="dashboard-settings-label">
                        <Mail size={16} />
                        Preferred Notification Email <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.78rem' }}>(Optional)</span>
                    </label>
                    <p className="dashboard-settings-hint">
                        Choose the email address where you want to receive your personal notification emails. Leave blank to use your normal account email. This only affects your own notifications.
                    </p>
                    <input
                        type="email"
                        className="dashboard-settings-select"
                        style={{ maxWidth: '340px' }}
                        value={notificationEmail}
                        onChange={(e) => setNotificationEmail(e.target.value)}
                        placeholder="yourname@example.com"
                    />
                </div>

                {/* Per-event toggles */}
                <div className="dashboard-settings-field">
                    <label className="dashboard-settings-label">
                        <Settings size={16} />
                        Email Updates About My Cases
                    </label>
                    <p className="dashboard-settings-hint">
                        Choose which important case emails you want to receive.
                    </p>
                    {[
                        { key: 'p_new_case', label: 'Case submitted confirmation', val: personalNewCase, set: setPersonalNewCase },
                        { key: 'p_case_updated', label: 'Case updated by admin', val: personalCaseUpdated, set: setPersonalCaseUpdated },
                        { key: 'p_info_requested', label: 'Information requested', val: personalReviewDue, set: setPersonalReviewDue },
                        { key: 'p_evidence_requested', label: 'Evidence requested', val: personalEscalation, set: setPersonalEscalation },
                    ].map(item => (
                        <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                            <input
                                type="checkbox"
                                checked={item.val}
                                onChange={(e) => item.set(e.target.checked)}
                                style={{ width: 18, height: 18, accentColor: '#C9A84C' }}
                            />
                            {item.label}
                        </label>
                    ))}
                </div>

                {/* Personal save feedback */}
                {personalSaveError && (
                    <div className="dsf-error">
                        <AlertTriangle size={14} />
                        <span>{personalSaveError}</span>
                    </div>
                )}
                {personalSaveSuccess && (
                    <div className="dashboard-settings-success">
                        <CheckCircle2 size={14} />
                        <span>Preferences saved successfully.</span>
                    </div>
                )}

                {/* Personal save button */}
                <button
                    className="dashboard-settings-save-btn"
                    onClick={handleSavePersonal}
                    disabled={personalSaving}
                >
                    {personalSaving ? (
                        <><Loader2 size={16} className="dsf-spinner" /> Saving…</>
                    ) : (
                        <><Save size={16} /> Save Preferences</>
                    )}
                </button>
            </div>

            {/* ── Organisation Settings (admin-only) ─────────────────────────── */}
            {!canEditOrgSettings ? (
                <div className="dashboard-settings-locked">
                    <Lock size={24} />
                    <p>Organisation settings require admin access.</p>
                    <span>Contact an organisation admin to change organisation-wide notification and operational settings.</span>
                </div>
            ) : (
                <>
                    <div className="dashboard-settings-card" style={{ marginBottom: '1.5rem' }}>
                        <div style={{ marginBottom: '0.75rem' }}>
                            <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Palette size={14} />
                                Organisation Branding
                            </p>
                            <p className="dashboard-settings-hint">
                                Personalise the dashboard with your organisation's logo or a sector-appropriate symbol. It will appear in the top-right account area for all users in your organisation.
                            </p>
                        </div>

                        {/* ── Live preview ─────────────────────────────────────── */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.25rem' }}>
                            {/* Preview square */}
                            <div style={{
                                width: 72, height: 72,
                                borderRadius: 12,
                                background: '#0B1E36',
                                border: '2px solid rgba(201,168,76,0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                overflow: 'hidden', flexShrink: 0,
                            }}>
                                {(() => {
                                    // pendingLogoUrl = just-uploaded file preview
                                    if (pendingLogoUrl) {
                                        return <img src={pendingLogoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
                                    }
                                    // pendingPreset chosen
                                    const preset = findPreset(pendingPreset);
                                    if (preset) return <PresetSvg preset={preset} color="#C9A84C" size={38} />;
                                    // currentLogoUrl from DB (no new file)
                                    if (currentLogoUrl) {
                                        return <img src={currentLogoUrl} alt="Current logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
                                    }
                                    // fall back to initials placeholder
                                    return <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#C9A84C', letterSpacing: '-0.02em' }}>{orgName?.slice(0, 2).toUpperCase() ?? 'ORG'}</span>;
                                })()}
                            </div>
                            <div>
                                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', margin: '0 0 0.2rem' }}>Preview</p>
                                <p className="dashboard-settings-hint" style={{ margin: 0 }}>This is how the logo will appear in the top-right header pill.</p>
                                {(currentLogoUrl || currentLogoPreset) && (
                                    <button
                                        type="button"
                                        onClick={handleResetBranding}
                                        disabled={brandingSaving}
                                        style={{
                                            marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                            background: 'none', border: '1px solid #e2e8f0', borderRadius: 6,
                                            padding: '0.28rem 0.65rem', fontSize: '0.75rem', color: '#64748b',
                                            cursor: 'pointer', fontFamily: 'inherit',
                                        }}
                                    >
                                        <RefreshCw size={11} /> Reset to default
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* ── Upload ───────────────────────────────────────────── */}
                        <div className="dashboard-settings-field">
                            <label className="dashboard-settings-label">
                                <Image size={16} />
                                Upload logo
                            </label>
                            <p className="dashboard-settings-hint">PNG, JPEG, WebP, or SVG. Max 512 KB. Square images work best.</p>
                            <label style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                marginTop: '0.4rem', padding: '0.45rem 1rem',
                                background: '#f1f5f9', border: '1px solid #e2e8f0',
                                borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem',
                                color: '#334155', fontFamily: 'inherit', fontWeight: 500,
                            }}>
                                <Image size={14} />
                                {pendingFile ? pendingFile.name : 'Choose image…'}
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        if (file.size > 524288) { setBrandingError('Image must be under 512 KB.'); return; }
                                        setBrandingError(null);
                                        setPendingFile(file);
                                        setPendingPreset(null);  // uploading clears preset selection
                                        const reader = new FileReader();
                                        reader.onload = (ev) => setPendingLogoUrl(ev.target?.result as string);
                                        reader.readAsDataURL(file);
                                    }}
                                />
                            </label>
                            {pendingFile && (
                                <button
                                    type="button"
                                    onClick={() => { setPendingFile(null); setPendingLogoUrl(null); }}
                                    style={{
                                        marginLeft: '0.5rem', background: 'none', border: 'none',
                                        cursor: 'pointer', color: '#94a3b8', padding: '0.4rem', borderRadius: 6,
                                    }}
                                    title="Remove selected file"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* ── Preset gallery ───────────────────────────────────── */}
                        <div className="dashboard-settings-field">
                            <label className="dashboard-settings-label">
                                <Palette size={16} />
                                Or choose a preset symbol
                            </label>
                            <p className="dashboard-settings-hint">Select a professional symbol suited to care and safeguarding.</p>
                            <div style={{
                                display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.6rem',
                            }}>
                                {ORG_LOGO_PRESETS.map((preset) => {
                                    const selected = pendingPreset === preset.key && !pendingFile;
                                    return (
                                        <button
                                            key={preset.key}
                                            type="button"
                                            title={preset.label}
                                            onClick={() => {
                                                setPendingPreset(preset.key);
                                                setPendingFile(null);
                                                setPendingLogoUrl(null);
                                            }}
                                            style={{
                                                width: 52, height: 52,
                                                borderRadius: 10,
                                                border: selected ? '2px solid #C9A84C' : '2px solid transparent',
                                                background: selected ? '#0B1E36' : '#f1f5f9',
                                                display: 'flex', flexDirection: 'column',
                                                alignItems: 'center', justifyContent: 'center',
                                                cursor: 'pointer', gap: '4px',
                                                boxShadow: selected ? '0 0 0 3px rgba(201,168,76,0.18)' : 'none',
                                                transition: 'all 0.12s',
                                                padding: 0,
                                            }}
                                        >
                                            <PresetSvg
                                                preset={preset}
                                                color={selected ? '#C9A84C' : '#64748b'}
                                                size={22}
                                            />
                                            <span style={{
                                                fontSize: '0.6rem', fontWeight: 500,
                                                color: selected ? '#C9A84C' : '#94a3b8',
                                                lineHeight: 1, textAlign: 'center',
                                            }}>
                                                {preset.label.split(' ')[0]}
                                            </span>
                                        </button>
                                    );
                                })}
                                {/* None option */}
                                {pendingPreset && !pendingFile && (
                                    <button
                                        type="button"
                                        title="Clear preset"
                                        onClick={() => setPendingPreset(null)}
                                        style={{
                                            width: 52, height: 52, borderRadius: 10,
                                            border: '2px dashed #e2e8f0', background: '#fff',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <X size={16} style={{ color: '#94a3b8' }} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Branding feedback */}
                        {brandingError && (
                            <div className="dsf-error" style={{ marginTop: '0.5rem' }}>
                                <AlertTriangle size={14} /><span>{brandingError}</span>
                            </div>
                        )}
                        {brandingSuccess && (
                            <div className="dashboard-settings-success" style={{ marginTop: '0.5rem' }}>
                                <CheckCircle2 size={14} /><span>Branding saved. Refreshing…</span>
                            </div>
                        )}

                        {/* Save button */}
                        <button
                            className="dashboard-settings-save-btn"
                            style={{ marginTop: '0.75rem' }}
                            onClick={handleSaveBranding}
                            disabled={brandingSaving || uploadingLogo || (!pendingFile && pendingPreset === currentLogoPreset && !pendingLogoUrl)}
                        >
                            {brandingSaving || uploadingLogo ? (
                                <><Loader2 size={16} className="dsf-spinner" /> {uploadingLogo ? 'Uploading…' : 'Saving…'}</>
                            ) : (
                                <><Save size={16} /> Save Branding</>
                            )}
                        </button>
                    </div>

                    <div className="dashboard-settings-card">
                        <div style={{ marginBottom: '0.75rem' }}>
                            <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Building2 size={14} />
                                Organisation Email Controls
                            </p>
                            <p className="dashboard-settings-hint">
                                Manage organisation-wide notification settings, recipients, and operational controls. These settings apply to all members of this organisation.
                            </p>
                        </div>

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
                                These people receive the monthly safeguarding report by email on the scheduled report day. One email per line.
                            </p>
                            <textarea
                                className="dashboard-settings-textarea"
                                rows={4}
                                value={reportRecipients}
                                onChange={(e) => setReportRecipients(e.target.value)}
                                placeholder="admin@example.com&#10;manager@example.com"
                            />
                        </div>

                        {/* Inspection Pack Recipients */}
                        <div className="dashboard-settings-field">
                            <label className="dashboard-settings-label">
                                <Send size={16} />
                                Inspection Pack Recipients
                            </label>
                            <p className="dashboard-settings-hint">
                                These people receive inspection pack PDFs when sent manually or auto-sent on schedule. Falls back to report recipients if empty. One email per line.
                            </p>
                            <textarea
                                className="dashboard-settings-textarea"
                                rows={4}
                                value={inspectionPackRecipients}
                                onChange={(e) => setInspectionPackRecipients(e.target.value)}
                                placeholder="inspector@example.com&#10;compliance@example.com"
                            />
                        </div>

                        {/* Alert Recipients */}
                        <div className="dashboard-settings-field">
                            <label className="dashboard-settings-label">
                                <Bell size={16} />
                                Alert Recipients
                            </label>
                            <p className="dashboard-settings-hint">
                                These people receive immediate email alerts for admin events such as new cases, high-risk flags, SLA breaches, and more. One email per line.
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
                                Automatically email the inspection pack PDF to inspection pack recipients when the monthly snapshot is locked.
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
                                Day of the month when the safeguarding report is generated and sent (1–28).
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

                        {/* Report Send Time */}
                        <div className="dashboard-settings-field">
                            <label className="dashboard-settings-label">
                                <Clock size={16} />
                                Report Send Time
                            </label>
                            <p className="dashboard-settings-hint">
                                Preferred time of day for scheduled monthly report emails. Reports sent manually use the current time.
                            </p>
                            <input
                                type="time"
                                className="dashboard-settings-select"
                                style={{ maxWidth: '140px' }}
                                value={reportSendTime}
                                onChange={(e) => setReportSendTime(e.target.value)}
                            />
                        </div>

                        {/* Inspection Pack Send Time */}
                        <div className="dashboard-settings-field">
                            <label className="dashboard-settings-label">
                                <Clock size={16} />
                                Inspection Pack Send Time
                            </label>
                            <p className="dashboard-settings-hint">
                                Preferred time of day for auto-sent inspection packs. Manual sends use the current time.
                            </p>
                            <input
                                type="time"
                                className="dashboard-settings-select"
                                style={{ maxWidth: '140px' }}
                                value={inspectionPackSendTime}
                                onChange={(e) => setInspectionPackSendTime(e.target.value)}
                            />
                        </div>

                        {/* ── Notification Preferences ──────────────────────────── */}
                        <div style={{ borderTop: '1px solid #e2e8f0', margin: '1rem 0', paddingTop: '1rem' }}>
                            <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
                                Notification Preferences
                            </p>
                        </div>

                        {/* Admin Notifications */}
                        <div className="dashboard-settings-field">
                            <label className="dashboard-settings-label">
                                <Bell size={16} />
                                Admin Notifications
                            </label>
                            <p className="dashboard-settings-hint">
                                In-app bell notifications sent to organisation admins when these events occur.
                            </p>
                            {[
                                { key: 'case_created', label: 'New case created', val: notifyAdminCaseCreated, set: setNotifyAdminCaseCreated },
                                { key: 'high_risk', label: 'High-risk case flagged', val: notifyAdminHighRisk, set: setNotifyAdminHighRisk },
                                { key: 'critical', label: 'Critical case flagged', val: notifyAdminCritical, set: setNotifyAdminCritical },
                                { key: 'sla_breach', label: 'SLA breach', val: notifyAdminSlaBreach, set: setNotifyAdminSlaBreach },
                                { key: 'new_evidence', label: 'New evidence uploaded', val: notifyAdminNewEvidence, set: setNotifyAdminNewEvidence },
                                { key: 'insp_generated', label: 'Inspection pack generated', val: notifyAdminInspectionGenerated, set: setNotifyAdminInspectionGenerated },
                                { key: 'insp_sent', label: 'Inspection pack sent', val: notifyAdminInspectionSent, set: setNotifyAdminInspectionSent },
                                { key: 'repeat_targeting', label: 'Repeat targeting detected', val: notifyAdminRepeatTargeting, set: setNotifyAdminRepeatTargeting },
                                { key: 'loss_threshold', label: 'Loss threshold reached', val: notifyAdminLossThreshold, set: setNotifyAdminLossThreshold },
                                { key: 'new_user', label: 'New user added', val: notifyAdminNewUser, set: setNotifyAdminNewUser },
                            ].map(item => (
                                <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={item.val}
                                        onChange={(e) => item.set(e.target.checked)}
                                        style={{ width: 18, height: 18, accentColor: '#C9A84C' }}
                                    />
                                    {item.label}
                                </label>
                            ))}
                        </div>

                        {/* Staff Notifications */}
                        <div className="dashboard-settings-field">
                            <label className="dashboard-settings-label">
                                <Bell size={16} />
                                Staff Notifications
                            </label>
                            <p className="dashboard-settings-hint">
                                In-app bell notifications sent to the assigned staff member or case submitter when these events occur.
                            </p>
                            {[
                                { key: 'case_assigned', label: 'Case assigned to me', val: notifyStaffCaseAssigned, set: setNotifyStaffCaseAssigned },
                                { key: 'case_in_review', label: 'Case moved to review', val: notifyStaffCaseInReview, set: setNotifyStaffCaseInReview },
                                { key: 'case_closed', label: 'Case closed', val: notifyStaffCaseClosed, set: setNotifyStaffCaseClosed },
                                { key: 'info_requested', label: 'Information requested', val: notifyStaffInfoRequested, set: setNotifyStaffInfoRequested },
                                { key: 'evidence_requested', label: 'Evidence requested', val: notifyStaffEvidenceRequested, set: setNotifyStaffEvidenceRequested },
                                { key: 'evidence_added', label: 'Evidence added to case', val: notifyStaffEvidenceAdded, set: setNotifyStaffEvidenceAdded },
                            ].map(item => (
                                <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={item.val}
                                        onChange={(e) => item.set(e.target.checked)}
                                        style={{ width: 18, height: 18, accentColor: '#C9A84C' }}
                                    />
                                    {item.label}
                                </label>
                            ))}
                        </div>

                        {/* ── Admin Action Emails ──────────────────────────────── */}
                        <div style={{ borderTop: '1px solid #e2e8f0', margin: '1rem 0', paddingTop: '1rem' }}>
                            <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
                                Admin Action Emails
                            </p>
                            <p className="dashboard-settings-hint" style={{ marginBottom: '0.25rem' }}>
                                These emails are sent to the organisation's admin alert email addresses listed above. Turn on the emails you want the admin team to receive when attention or action may be needed.
                            </p>
                            <p className="dashboard-settings-hint" style={{ marginBottom: '0.75rem', fontStyle: 'italic' }}>
                                These settings do not control your personal email preferences. They control organisation-level admin alert emails.
                            </p>
                        </div>

                        <div className="dashboard-settings-field">
                            <label className="dashboard-settings-label">
                                <Mail size={16} />
                                Email the admin team when:
                            </label>
                            {[
                                { key: 'ea_case_created', label: 'New case submitted', val: emailAdminCaseCreated, set: setEmailAdminCaseCreated },
                                { key: 'ea_new_evidence', label: 'New evidence uploaded', val: emailAdminNewEvidence, set: setEmailAdminNewEvidence },
                                { key: 'ea_overdue_review', label: 'Overdue review', val: emailAdminOverdueReview, set: setEmailAdminOverdueReview },
                                { key: 'ea_escalation', label: 'Escalation notice', val: emailAdminEscalationNotice, set: setEmailAdminEscalationNotice },
                            ].map(item => (
                                <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={item.val}
                                        onChange={(e) => item.set(e.target.checked)}
                                        style={{ width: 18, height: 18, accentColor: '#0f766e' }}
                                    />
                                    {item.label}
                                </label>
                            ))}
                            <p className="dashboard-settings-hint" style={{ marginTop: '0.6rem', fontSize: '0.75rem' }}>
                                These emails help the admin team spot new cases, missed reviews, new evidence, and escalations.
                            </p>
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
                </>
            )}
        </div>
    );
}
