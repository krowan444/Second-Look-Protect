import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    BarChart3, Loader2, AlertTriangle, Calendar, ShieldAlert, PieChart,
    CheckCircle2, TrendingUp, Info, Printer, Save, Lock, Eye,
    ClipboardList, Clock, FileText, Download, Activity,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface CaseRow {
    id: string;
    submitted_at: string;
    submission_type: string | null;
    channel: string | null;
    status: string | null;
    risk_level: string | null;
    decision: string | null;
    category: string | null;
    outcome: string | null;
    reviewed_at: string | null;
    closed_at: string | null;
}

interface SavedReport {
    id: string;
    organisation_id: string;
    period_start: string;
    period_end: string;
    status: string;
    locked: boolean | null;
    metrics: any;
    ai_summary: string | null;
    recommendations: string | null;
    generated_by: string | null;
    created_at: string;
    pdf_url: string | null;
}

interface AuditLogEntry {
    id: string;
    action: string;
    actor_type: string | null;
    created_at: string;
}

interface OrgOption {
    id: string;
    name: string;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function buildMonthOptions(): { value: string; label: string }[] {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        opts.push({
            value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
            label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        });
    }
    return opts;
}

function monthBoundaries(yearMonth: string): { start: string; end: string } {
    const [y, m] = yearMonth.split('-').map(Number);
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 1);
    return { start: startDate.toISOString(), end: endDate.toISOString() };
}

function capitalize(s: string): string {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
    } catch { return '—'; }
}

function avgHours(pairs: { start: string; end: string | null }[]): string {
    const valid = pairs.filter(p => p.end);
    if (valid.length === 0) return '—';
    const totalMs = valid.reduce((sum, p) => sum + (new Date(p.end!).getTime() - new Date(p.start).getTime()), 0);
    const avgMs = totalMs / valid.length;
    const hours = Math.round((avgMs / (1000 * 60 * 60)) * 10) / 10;
    return `${hours}h`;
}

/* ─── Print CSS (scoped) ─────────────────────────────────────────────────── */

const PRINT_STYLE = `
@media print {
  @page { margin: 12mm; }

  .dashboard-shell > *:not(.dashboard-content) { display: none !important; }
  .dashboard-topbar, .dashboard-sidebar, .dashboard-sidebar-toggle,
  .reports-no-print { display: none !important; }

  .dashboard-content { margin: 0 !important; padding: 0 !important; }
  .dashboard-main { padding: 0 !important; }
  .reports-page { max-width: 100% !important; }

  .dashboard-panel,
  .dashboard-stat-card,
  .dashboard-overview-cards,
  .dashboard-page-header {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`;

/* ─── Reports Page ───────────────────────────────────────────────────────── */

export function ReportsPage() {
    const monthOptions = useMemo(() => buildMonthOptions(), []);
    const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cases, setCases] = useState<CaseRow[]>([]);

    // SLA operational metric (NOT month-limited)
    const [slaOverdueNow, setSlaOverdueNow] = useState<number>(0);

    // Org context
    const [orgId, setOrgId] = useState<string>('');
    const [orgName, setOrgName] = useState<string>('');
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [userRole, setUserRole] = useState<string>('');
    const [allOrgs, setAllOrgs] = useState<OrgOption[]>([]);
    const [uid, setUid] = useState('');

    // Editable sections
    const [execSummary, setExecSummary] = useState('');
    const [keyTrends, setKeyTrends] = useState('');
    const [recommendations, setRecommendations] = useState('');

    // Report persistence
    const [reportStatus, setReportStatus] = useState<'draft' | 'locked' | 'approved' | null>(null);
    const [reportLocked, setReportLocked] = useState(false);
    const [reportPdfUrl, setReportPdfUrl] = useState<string | null>(null);
    const [reportId, setReportId] = useState<string | null>(null);
    const [savingDraft, setSavingDraft] = useState(false);
    const [locking, setLocking] = useState(false);
    const [approving, setApproving] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [saveMsg, setSaveMsg] = useState<string | null>(null);

    // Report history
    const [reportHistory, setReportHistory] = useState<SavedReport[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Audit logs
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

    // Inspection mode
    const [inspectionMode, setInspectionMode] = useState(false);

    // Send inspection pack
    const [sendingPack, setSendingPack] = useState(false);
    const [sendPackMsg, setSendPackMsg] = useState<string | null>(null);
    const [deliveries, setDeliveries] = useState<{ id: string; status: string; sent_at: string | null; created_at: string; recipients: string[] | null }[]>([]);

    // Org inspection pack settings
    const [settingsRecipients, setSettingsRecipients] = useState('');
    const [settingsCc, setSettingsCc] = useState('');
    const [settingsAutoSend, setSettingsAutoSend] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);
    const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

    const isLocked = reportStatus === 'locked' || reportStatus === 'approved' || reportLocked;
    const fieldsDisabled = isLocked || inspectionMode;
    const canEditSettings = userRole === 'super_admin' || userRole === 'org_admin';

    /* ── Resolve org context once on mount ───────────────────────────────── */
    useEffect(() => {
        (async () => {
            const supabase = getSupabase();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;

            setUid(session.user.id);

            const { data: profile } = await supabase
                .from('profiles')
                .select('organisation_id, role')
                .eq('id', session.user.id)
                .single();

            if (profile?.role === 'super_admin') {
                setIsSuperAdmin(true);
                setUserRole('super_admin');

                const { data: orgs } = await supabase
                    .from('organisations')
                    .select('id, name')
                    .order('name');

                setAllOrgs(orgs ?? []);

                const stored = localStorage.getItem('slp_active_org_id');
                if (stored) {
                    setOrgId(stored);
                    const match = (orgs ?? []).find(o => o.id === stored);
                    setOrgName(match?.name ?? '');
                }
            } else if (profile?.organisation_id) {
                setOrgId(profile.organisation_id);
                setUserRole(profile.role ?? '');

                const { data: org } = await supabase
                    .from('organisations')
                    .select('name')
                    .eq('id', profile.organisation_id)
                    .single();

                setOrgName(org?.name ?? '');
            }
        })();
    }, []);

    /* ── Fetch cases + saved report + SLA overdue NOW ─────────────────────── */
    const fetchData = useCallback(async () => {
        if (!orgId) { setLoading(false); return; }

        setLoading(true);
        setError(null);
        setSaveMsg(null);

        try {
            const supabase = getSupabase();
            const { start, end } = monthBoundaries(selectedMonth);

            // 1) Monthly cases for the report period
            const { data: rows, error: cErr } = await supabase
                .from('cases')
                .select('id, submitted_at, submission_type, channel, status, risk_level, decision, category, outcome, reviewed_at, closed_at')
                .eq('organisation_id', orgId)
                .gte('submitted_at', start)
                .lt('submitted_at', end)
                .order('submitted_at', { ascending: false });

            if (cErr) throw cErr;
            setCases(rows ?? []);

            // 2) SLA overdue NOW (operational)
            const slaThresholdDays = 3;
            const thresholdIso = new Date(Date.now() - slaThresholdDays * 24 * 60 * 60 * 1000).toISOString();

            const { data: overdueRows, error: oErr } = await supabase
                .from('cases')
                .select('id')
                .eq('organisation_id', orgId)
                .neq('status', 'closed')
                .lt('submitted_at', thresholdIso);

            if (oErr) throw oErr;
            setSlaOverdueNow(overdueRows?.length ?? 0);

            // 3) Load saved report for this period (match both start + end dates)
            const periodStartDate = start.slice(0, 10);
            const periodEndDate = new Date(new Date(end).getTime() - 1).toISOString().slice(0, 10);

            const { data: savedReport } = await supabase
                .from('reports')
                .select('*')
                .eq('organisation_id', orgId)
                .eq('period_start', periodStartDate)
                .eq('period_end', periodEndDate)
                .maybeSingle();

            if (savedReport) {
                setReportId(savedReport.id);
                setReportStatus(savedReport.status as 'draft' | 'locked' | 'approved');
                setReportLocked(!!savedReport.locked);
                setReportPdfUrl(savedReport.pdf_url ?? null);
                setExecSummary(savedReport.ai_summary ?? '');
                setRecommendations(savedReport.recommendations ?? '');

                if (savedReport.metrics?.keyTrends) setKeyTrends(savedReport.metrics.keyTrends);
            } else {
                setReportId(null);
                setReportStatus(null);
                setReportLocked(false);
                setReportPdfUrl(null);
                setExecSummary('');
                setRecommendations('');
                setKeyTrends('');
            }
        } catch (err: any) {
            setError(err?.message ?? 'Failed to load report data');
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, orgId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    /* ── Fetch report history ────────────────────────────────────────────── */
    const fetchHistory = useCallback(async () => {
        if (!orgId) return;
        setHistoryLoading(true);

        try {
            const supabase = getSupabase();
            const { data } = await supabase
                .from('reports')
                .select('*')
                .eq('organisation_id', orgId)
                .order('period_start', { ascending: false })
                .limit(24);

            setReportHistory(data ?? []);
        } catch {
            // silent
        } finally {
            setHistoryLoading(false);
        }
    }, [orgId]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    /* ── Derived metrics (MONTHLY only) ───────────────────────────────────── */
    const metrics = useMemo(() => {
        const total = cases.length;

        const byStatus = { new: 0, in_review: 0, closed: 0 };
        cases.forEach(c => {
            const s = (c.status ?? '').toLowerCase();
            if (s === 'new') byStatus.new++;
            else if (s === 'in_review') byStatus.in_review++;
            else if (s === 'closed') byStatus.closed++;
        });

        const highRisk = cases.filter(c => ['high', 'critical'].includes((c.risk_level ?? '').toLowerCase())).length;

        // Your DB uses decision = 'scam'
        const scamConfirmed = cases.filter(c => (c.decision ?? '').toLowerCase() === 'scam').length;

        // Outcomes (currently mostly NULL, 'prevented' exists)
        const outcomeMap: Record<string, number> = { prevented: 0, lost: 0, escalated: 0, unknown: 0 };
        cases.forEach(c => {
            const o = (c.outcome ?? '').toLowerCase();
            if (o && outcomeMap[o] !== undefined) outcomeMap[o]++;
            else outcomeMap.unknown++;
        });

        const avgReview = avgHours(cases.map(c => ({ start: c.submitted_at, end: c.reviewed_at })));
        const avgClose = avgHours(cases.map(c => ({ start: c.submitted_at, end: c.closed_at })));

        const categoryMap: Record<string, number> = {};
        cases.forEach(c => {
            const cat = c.category ?? 'Uncategorised';
            categoryMap[cat] = (categoryMap[cat] || 0) + 1;
        });
        const categories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

        const channelMap: Record<string, number> = {};
        cases.forEach(c => {
            const ch = c.submission_type ?? c.channel ?? 'Unknown';
            channelMap[ch] = (channelMap[ch] || 0) + 1;
        });
        const channels = Object.entries(channelMap).sort((a, b) => b[1] - a[1]);

        const riskMap: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
        cases.forEach(c => {
            const r = (c.risk_level ?? '').toLowerCase();
            if (r && riskMap[r] !== undefined) riskMap[r]++;
        });

        const decisionMap: Record<string, number> = {};
        cases.filter(c => c.decision).forEach(c => {
            const d = c.decision!;
            decisionMap[d] = (decisionMap[d] || 0) + 1;
        });
        const decisions = Object.entries(decisionMap).sort((a, b) => b[1] - a[1]);

        return {
            total,
            byStatus,
            highRisk,
            scamConfirmed,
            outcomeMap,
            avgReview,
            avgClose,
            categories,
            channels,
            riskMap,
            decisions,
        };
    }, [cases]);

    /* ── Auto-generate key trends bullet points ──────────────────────────── */
    useEffect(() => {
        if (keyTrends || isLocked) return;
        if (metrics.total === 0) return;

        const lines: string[] = [];
        lines.push(`• ${metrics.total} total case${metrics.total !== 1 ? 's' : ''} submitted this month`);

        if (metrics.highRisk > 0) lines.push(`• ${metrics.highRisk} high/critical risk case${metrics.highRisk !== 1 ? 's' : ''} identified`);
        if (metrics.scamConfirmed > 0) lines.push(`• ${metrics.scamConfirmed} confirmed scam case${metrics.scamConfirmed !== 1 ? 's' : ''}`);

        lines.push(`• Avg time to first review: ${metrics.avgReview}`);
        lines.push(`• Avg time to close: ${metrics.avgClose}`);

        if (slaOverdueNow > 0) lines.push(`• ⚠️ ${slaOverdueNow} open case${slaOverdueNow !== 1 ? 's' : ''} overdue now (>3 days without closure)`);

        if (metrics.categories.length > 0) {
            lines.push(`• Top category: ${capitalize(metrics.categories[0][0])} (${metrics.categories[0][1]})`);
        }

        setKeyTrends(lines.join('\n'));
    }, [metrics, slaOverdueNow, isLocked]); // intentionally not including keyTrends to avoid loop

    /* ── Save Draft ──────────────────────────────────────────────────────── */
    async function handleSaveDraft() {
        if (!orgId) return;

        setSavingDraft(true);
        setSaveMsg(null);

        try {
            const supabase = getSupabase();
            const { start, end } = monthBoundaries(selectedMonth);

            const periodStartDate = start.slice(0, 10);
            const periodEndDate = new Date(new Date(end).getTime() - 1).toISOString().slice(0, 10);

            const metricsSnapshot = { ...metrics, keyTrends, slaOverdueNow };

            const row = {
                organisation_id: orgId,
                period_start: periodStartDate,
                period_end: periodEndDate,
                status: 'draft',
                metrics: metricsSnapshot,
                ai_summary: execSummary || null,
                recommendations: recommendations || null,
                generated_by: uid,
            };

            if (reportId) {
                const { error: updErr } = await supabase.from('reports').update(row).eq('id', reportId);
                if (updErr) throw updErr;
            } else {
                const { data: ins, error: insErr } = await supabase.from('reports').insert(row).select('id').single();
                if (insErr) throw insErr;
                setReportId(ins.id);
            }

            setReportStatus('draft');
            setSaveMsg('Draft saved successfully.');
            fetchHistory();
        } catch (err: any) {
            setSaveMsg(`Error: ${err?.message ?? 'Failed to save'}`);
        } finally {
            setSavingDraft(false);
        }
    }

    /* ── Approve & Lock ──────────────────────────────────────────────────── */
    async function handleLock() {
        if (!reportId) {
            setSaveMsg('Please save a draft first before locking.');
            return;
        }

        setLocking(true);
        setSaveMsg(null);

        try {
            const supabase = getSupabase();
            const metricsSnapshot = { ...metrics, keyTrends, slaOverdueNow };

            const { error: updErr } = await supabase
                .from('reports')
                .update({
                    status: 'locked',
                    metrics: metricsSnapshot,
                    ai_summary: execSummary || null,
                    recommendations: recommendations || null,
                })
                .eq('id', reportId);

            if (updErr) throw updErr;

            setReportStatus('locked');
            setSaveMsg('Report approved and locked.');
            fetchHistory();
        } catch (err: any) {
            setSaveMsg(`Error: ${err?.message ?? 'Failed to lock'}`);
        } finally {
            setLocking(false);
        }
    }

    /* ── Load a saved report ─────────────────────────────────────────────── */
    function loadReport(r: SavedReport) {
        setReportId(r.id);
        setReportStatus(r.status as 'draft' | 'locked' | 'approved');
        setReportLocked(!!r.locked);
        setReportPdfUrl(r.pdf_url ?? null);
        setExecSummary(r.ai_summary ?? '');
        setRecommendations(r.recommendations ?? '');
        if (r.metrics?.keyTrends) setKeyTrends(r.metrics.keyTrends);

        const d = new Date(r.period_start);
        const monthVal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        setSelectedMonth(monthVal);

        setSaveMsg(`Loaded report from ${fmtDate(r.period_start)}`);
    }

    /* ── Approve Report (RPC) ────────────────────────────────────────────── */
    async function handleApproveReport() {
        if (!reportId) return;
        setApproving(true);
        setSaveMsg(null);
        try {
            const supabase = getSupabase();
            const metricsSnapshot = { ...metrics, keyTrends, slaOverdueNow };
            const { error: rpcErr } = await supabase.rpc('approve_report', {
                p_report_id: reportId,
                p_metrics_snapshot: metricsSnapshot,
            });
            if (rpcErr) throw rpcErr;
            setReportStatus('approved');
            setReportLocked(true);
            setSaveMsg('Report approved ✅');
            fetchData();
            fetchHistory();
            fetchAuditLogs(reportId);
        } catch (err: any) {
            setSaveMsg(`Error: ${err?.message ?? 'Failed to approve report'}`);
        } finally {
            setApproving(false);
        }
    }

    /* ── Fetch audit logs for current report ──────────────────────────────── */
    const fetchAuditLogs = useCallback(async (rId: string) => {
        if (!rId) { setAuditLogs([]); return; }
        try {
            const supabase = getSupabase();
            const { data } = await supabase
                .from('audit_logs')
                .select('id, action, actor_type, created_at')
                .eq('entity_type', 'report')
                .eq('entity_id', rId)
                .order('created_at', { ascending: false })
                .limit(10);
            setAuditLogs(data ?? []);
        } catch { setAuditLogs([]); }
    }, []);

    // Re-fetch audit logs when reportId changes
    useEffect(() => {
        if (reportId) fetchAuditLogs(reportId);
        else setAuditLogs([]);
    }, [reportId, fetchAuditLogs]);

    /* ── Handle org switch (super_admin) ─────────────────────────────────── */
    function handleOrgSwitch(newOrgId: string) {
        setOrgId(newOrgId);
        localStorage.setItem('slp_active_org_id', newOrgId);
        const match = allOrgs.find(o => o.id === newOrgId);
        setOrgName(match?.name ?? '');

        setReportId(null);
        setReportStatus(null);
        setReportLocked(false);
        setReportPdfUrl(null);
        setExecSummary('');
        setRecommendations('');
        setKeyTrends('');
    }

    /* ── Inject print styles ─────────────────────────────────────────────── */
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = PRINT_STYLE;
        document.head.appendChild(style);
        return () => { document.head.removeChild(style); };
    }, []);

    // Auto-default inspectionMode for past months
    useEffect(() => {
        const now = new Date();
        const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        setInspectionMode(selectedMonth !== currentYM);
    }, [selectedMonth]);

    const selectedMonthLabel = monthOptions.find(o => o.value === selectedMonth)?.label ?? selectedMonth;

    // Fetch delivery history for the selected month
    const fetchDeliveries = useCallback(async () => {
        if (!orgId || !selectedMonth) { setDeliveries([]); return; }
        try {
            const supabase = getSupabase();
            const monthDate = `${selectedMonth}-01`;
            const { data } = await supabase
                .from('inspection_pack_deliveries')
                .select('id, status, sent_at, created_at, recipients')
                .eq('organisation_id', orgId)
                .eq('snapshot_month', monthDate)
                .order('created_at', { ascending: false })
                .limit(20);
            setDeliveries(data ?? []);
        } catch { setDeliveries([]); }
    }, [orgId, selectedMonth]);

    useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);

    // Fetch organisation_settings when orgId changes
    useEffect(() => {
        if (!orgId) return;
        (async () => {
            try {
                const supabase = getSupabase();
                const { data } = await supabase
                    .from('organisation_settings')
                    .select('*')
                    .eq('organisation_id', orgId)
                    .single();
                if (data) {
                    setSettingsRecipients(Array.isArray(data.report_recipients) ? data.report_recipients.join(', ') : '');
                    setSettingsCc(Array.isArray(data.report_cc) ? data.report_cc.join(', ') : '');
                    setSettingsAutoSend(!!data.auto_send_inspection_pack);
                } else {
                    setSettingsRecipients('');
                    setSettingsCc('');
                    setSettingsAutoSend(false);
                }
            } catch {
                setSettingsRecipients('');
                setSettingsCc('');
                setSettingsAutoSend(false);
            }
            setSettingsMsg(null);
        })();
    }, [orgId]);

    if (!orgId && !loading) {
        return (
            <div>
                <div className="dashboard-page-header">
                    <h1 className="dashboard-page-title">Safeguarding Monthly Report</h1>
                </div>

                {isSuperAdmin ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                        <Eye size={24} style={{ marginBottom: '0.5rem' }} />
                        <p>Select an organisation using the "Viewing as" switcher in the top bar.</p>
                    </div>
                ) : (
                    <div className="dashboard-overview-error">
                        <AlertTriangle size={20} />
                        <span>Could not determine your organisation.</span>
                    </div>
                )}
            </div>
        );
    }

    if (loading) {
        return (
            <div className="dashboard-overview-loading">
                <Loader2 className="dashboard-overview-spinner-icon" />
                <p>Loading report…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <div className="dashboard-page-header"><h1 className="dashboard-page-title">Reports</h1></div>
                <div className="dashboard-overview-error"><AlertTriangle size={20} /><span>{error}</span></div>
            </div>
        );
    }

    return (
        <div className="reports-page">
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div
                className="dashboard-page-header"
                style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}
            >
                <div>
                    <h1 className="dashboard-page-title">Safeguarding Monthly Report</h1>
                    <p className="dashboard-page-subtitle">
                        {orgName}{orgName ? ' — ' : ''}{selectedMonthLabel}
                        {reportStatus && (
                            <span
                                className={`dashboard-status-badge status-${isLocked ? 'closed' : 'new'}`}
                                style={{ marginLeft: '0.75rem', fontSize: '0.72rem' }}
                            >
                                {reportStatus === 'approved' ? 'Approved ✅' : reportStatus === 'locked' ? '🔒 Locked' : '📝 Draft'}
                            </span>
                        )}
                    </p>
                    {isLocked && (
                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                            Locked after approval for inspection integrity.
                        </p>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Super admin org selector */}
                    {isSuperAdmin && allOrgs.length > 0 && (
                        <select
                            value={orgId}
                            onChange={(e) => handleOrgSwitch(e.target.value)}
                            className="dashboard-reports-select"
                            style={{ marginRight: '0.5rem' }}
                        >
                            <option value="">Select org…</option>
                            {allOrgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                    )}

                    <div className="dashboard-reports-month-select">
                        <Calendar size={16} />
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="dashboard-reports-select"
                        >
                            {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>

                    <button
                        type="button"
                        className="dashboard-reports-action-btn"
                        onClick={() => setInspectionMode((v) => !v)}
                        style={{ border: inspectionMode ? '1px solid #dc2626' : undefined, background: inspectionMode ? '#fef2f2' : undefined, color: inspectionMode ? '#dc2626' : undefined }}
                    >
                        {inspectionMode ? 'Exit Inspection Mode' : 'Enter Inspection Mode'}
                    </button>
                </div>
            </div>

            {/* ── Empty state ─────────────────────────────────────────────── */}
            {cases.length === 0 && !reportId ? (
                <div className="dashboard-placeholder-card" style={{ marginTop: '2rem' }}>
                    <div className="dashboard-placeholder-icon"><FileText /></div>
                    <p className="dashboard-page-title" style={{ fontSize: '1.1rem' }}>No cases submitted in this period.</p>
                    <p className="dashboard-page-subtitle" style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                        Select a different month or wait for case data.
                    </p>
                </div>
            ) : (
                <>
                    {/* Inspection Mode banner */}
                    {inspectionMode && (
                        <div style={{ padding: '0.5rem 0.75rem', borderRadius: 6, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', fontSize: '0.78rem', fontWeight: 500, marginBottom: '1rem' }}>
                            Inspection Mode Active (Read-only)
                        </div>
                    )}

                    {/* Inspection Ready indicator */}
                    {(() => {
                        const slaTotal = metrics.total;
                        const slaClosed = metrics.byStatus.closed;
                        const slaCompliancePct = slaTotal > 0 ? Math.round((slaClosed / slaTotal) * 100) : 100;
                        const ready = slaCompliancePct >= 90 && slaOverdueNow === 0;
                        return (
                            <div className="dashboard-stat-card" style={{ marginBottom: '1rem', border: `1px solid ${ready ? '#bbf7d0' : '#fde68a'}`, background: ready ? '#f0fdf4' : '#fffbeb' }}>
                                <div className="dashboard-stat-card-accent" style={{ background: ready ? '#16a34a' : '#d97706' }} />
                                <div className="dashboard-stat-card-body">
                                    <div className="dashboard-stat-icon" style={{ color: ready ? '#16a34a' : '#d97706' }}><CheckCircle2 size={20} /></div>
                                    <div className="dashboard-stat-value" style={{ color: ready ? '#16a34a' : '#d97706', fontSize: '1.1rem' }}>{ready ? '✓ Inspection Ready' : '⚠ Attention Required'}</div>
                                    <div className="dashboard-stat-label">Based on SLA compliance and overdue cases in this report.</div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* METRIC CARDS */}
                    <div className="dashboard-overview-cards">
                        <div className="dashboard-stat-card">
                            <div className="dashboard-stat-card-accent accent-blue" />
                            <div className="dashboard-stat-card-body">
                                <div className="dashboard-stat-icon blue"><BarChart3 size={20} /></div>
                                <div className="dashboard-stat-value">{metrics.total}</div>
                                <div className="dashboard-stat-label">Total Cases</div>
                            </div>
                        </div>

                        <div className="dashboard-stat-card">
                            <div className="dashboard-stat-card-accent accent-amber" />
                            <div className="dashboard-stat-card-body">
                                <div className="dashboard-stat-icon amber"><ClipboardList size={20} /></div>
                                <div className="dashboard-stat-value" style={{ fontSize: '0.95rem' }}>
                                    {metrics.byStatus.new} / {metrics.byStatus.in_review} / {metrics.byStatus.closed}
                                </div>
                                <div className="dashboard-stat-label">New / Review / Closed</div>
                            </div>
                        </div>

                        <div className="dashboard-stat-card">
                            <div className="dashboard-stat-card-accent accent-red" />
                            <div className="dashboard-stat-card-body">
                                <div className="dashboard-stat-icon red"><ShieldAlert size={20} /></div>
                                <div className="dashboard-stat-value">{metrics.highRisk}</div>
                                <div className="dashboard-stat-label">High / Critical Risk</div>
                            </div>
                        </div>

                        <div className="dashboard-stat-card">
                            <div className="dashboard-stat-card-accent accent-gold" />
                            <div className="dashboard-stat-card-body">
                                <div className="dashboard-stat-icon gold"><PieChart size={20} /></div>
                                <div className="dashboard-stat-value">{metrics.scamConfirmed}</div>
                                <div className="dashboard-stat-label">Scam Confirmed</div>
                            </div>
                        </div>
                    </div>

                    {/* Second row */}
                    <div className="dashboard-overview-cards" style={{ marginTop: '0.75rem' }}>
                        <div className="dashboard-stat-card">
                            <div className="dashboard-stat-card-accent accent-blue" />
                            <div className="dashboard-stat-card-body">
                                <div className="dashboard-stat-icon blue"><TrendingUp size={20} /></div>
                                <div className="dashboard-stat-value" style={{ fontSize: '0.95rem' }}>
                                    {metrics.outcomeMap.prevented} / {metrics.outcomeMap.lost} / {metrics.outcomeMap.escalated}
                                </div>
                                <div className="dashboard-stat-label">Prevented / Lost / Escalated</div>
                            </div>
                        </div>

                        <div className="dashboard-stat-card">
                            <div className="dashboard-stat-card-accent accent-amber" />
                            <div className="dashboard-stat-card-body">
                                <div className="dashboard-stat-icon amber"><Clock size={20} /></div>
                                <div className="dashboard-stat-value">{metrics.avgReview}</div>
                                <div className="dashboard-stat-label">Avg Time to Review</div>
                            </div>
                        </div>

                        <div className="dashboard-stat-card">
                            <div className="dashboard-stat-card-accent accent-amber" />
                            <div className="dashboard-stat-card-body">
                                <div className="dashboard-stat-icon amber"><Clock size={20} /></div>
                                <div className="dashboard-stat-value">{metrics.avgClose}</div>
                                <div className="dashboard-stat-label">Avg Time to Close</div>
                            </div>
                        </div>

                        <div className="dashboard-stat-card">
                            <div className="dashboard-stat-card-accent accent-red" />
                            <div className="dashboard-stat-card-body">
                                <div className="dashboard-stat-icon red"><AlertTriangle size={20} /></div>
                                <div className="dashboard-stat-value">{slaOverdueNow}</div>
                                <div className="dashboard-stat-label">SLA Overdue Now (&gt;3 days)</div>
                            </div>
                        </div>
                    </div>

                    {/* BREAKDOWNS */}
                    <div className="dashboard-reports-breakdowns" style={{ marginTop: '1.5rem' }}>
                        {/* Categories */}
                        <div className="dashboard-panel">
                            <div className="dashboard-panel-header">
                                <h2 className="dashboard-panel-title"><PieChart size={16} className="dashboard-panel-title-icon" /> Top Categories</h2>
                            </div>
                            {metrics.categories.length === 0 ? (
                                <div className="dashboard-panel-empty">No data</div>
                            ) : (
                                <div className="dashboard-panel-table-wrap">
                                    <table className="dashboard-panel-table">
                                        <thead><tr><th>Category</th><th>Count</th><th>%</th></tr></thead>
                                        <tbody>
                                            {metrics.categories.map(([cat, count]) => (
                                                <tr key={cat}>
                                                    <td>{capitalize(cat)}</td>
                                                    <td>{count}</td>
                                                    <td>{metrics.total > 0 ? `${Math.round((count / metrics.total) * 100)}%` : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Channels */}
                        <div className="dashboard-panel">
                            <div className="dashboard-panel-header">
                                <h2 className="dashboard-panel-title"><Activity size={16} className="dashboard-panel-title-icon" /> Submission Channels</h2>
                            </div>
                            {metrics.channels.length === 0 ? (
                                <div className="dashboard-panel-empty">No data</div>
                            ) : (
                                <div className="dashboard-panel-table-wrap">
                                    <table className="dashboard-panel-table">
                                        <thead><tr><th>Channel</th><th>Count</th><th>%</th></tr></thead>
                                        <tbody>
                                            {metrics.channels.map(([ch, count]) => (
                                                <tr key={ch}>
                                                    <td>{capitalize(ch)}</td>
                                                    <td>{count}</td>
                                                    <td>{metrics.total > 0 ? `${Math.round((count / metrics.total) * 100)}%` : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="dashboard-reports-breakdowns" style={{ marginTop: '0.75rem' }}>
                        {/* Risk distribution */}
                        <div className="dashboard-panel">
                            <div className="dashboard-panel-header">
                                <h2 className="dashboard-panel-title"><ShieldAlert size={16} className="dashboard-panel-title-icon" /> Risk Distribution</h2>
                            </div>
                            <div className="dashboard-panel-table-wrap">
                                <table className="dashboard-panel-table">
                                    <thead><tr><th>Level</th><th>Count</th></tr></thead>
                                    <tbody>
                                        {Object.entries(metrics.riskMap).map(([level, count]) => (
                                            <tr key={level}><td>{capitalize(level)}</td><td>{count}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Decisions */}
                        <div className="dashboard-panel">
                            <div className="dashboard-panel-header">
                                <h2 className="dashboard-panel-title"><CheckCircle2 size={16} className="dashboard-panel-title-icon" /> Decisions Distribution</h2>
                            </div>
                            {metrics.decisions.length === 0 ? (
                                <div className="dashboard-panel-empty">No decisions recorded</div>
                            ) : (
                                <div className="dashboard-panel-table-wrap">
                                    <table className="dashboard-panel-table">
                                        <thead><tr><th>Decision</th><th>Count</th></tr></thead>
                                        <tbody>
                                            {metrics.decisions.map(([dec, count]) => (
                                                <tr key={dec}><td>{capitalize(dec)}</td><td>{count}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* REPORT CONTENT */}
                    <div style={{ marginTop: '2rem' }}>
                        {/* A) Executive Summary */}
                        <div className="dashboard-panel" style={{ marginBottom: '1rem' }}>
                            <div className="dashboard-panel-header">
                                <h2 className="dashboard-panel-title"><FileText size={16} className="dashboard-panel-title-icon" /> Executive Summary</h2>
                            </div>
                            <div style={{ padding: '1rem' }}>
                                <textarea
                                    className="dsf-textarea"
                                    rows={4}
                                    value={execSummary}
                                    onChange={(e) => setExecSummary(e.target.value)}
                                    placeholder="Write an executive summary for this month's safeguarding report…"
                                    disabled={fieldsDisabled}
                                    style={fieldsDisabled ? { background: '#f8fafc', color: '#475569', opacity: inspectionMode ? 0.6 : 1 } : {}}
                                />
                            </div>
                        </div>

                        {/* B) Key Trends */}
                        <div className="dashboard-panel" style={{ marginBottom: '1rem' }}>
                            <div className="dashboard-panel-header">
                                <h2 className="dashboard-panel-title"><TrendingUp size={16} className="dashboard-panel-title-icon" /> Key Trends This Month</h2>
                            </div>
                            <div style={{ padding: '1rem' }}>
                                <textarea
                                    className="dsf-textarea"
                                    rows={6}
                                    value={keyTrends}
                                    onChange={(e) => setKeyTrends(e.target.value)}
                                    placeholder="Auto-generated bullet points based on this month's data…"
                                    disabled={fieldsDisabled}
                                    style={fieldsDisabled ? { background: '#f8fafc', color: '#475569', opacity: inspectionMode ? 0.6 : 1 } : {}}
                                />
                            </div>
                        </div>

                        {/* C) Recommendations */}
                        <div className="dashboard-panel" style={{ marginBottom: '1rem' }}>
                            <div className="dashboard-panel-header">
                                <h2 className="dashboard-panel-title"><Info size={16} className="dashboard-panel-title-icon" /> Recommendations</h2>
                            </div>
                            <div style={{ padding: '1rem' }}>
                                <textarea
                                    className="dsf-textarea"
                                    rows={4}
                                    value={recommendations}
                                    onChange={(e) => setRecommendations(e.target.value)}
                                    placeholder="Add recommendations for the safeguarding team…"
                                    disabled={fieldsDisabled}
                                    style={fieldsDisabled ? { background: '#f8fafc', color: '#475569', opacity: inspectionMode ? 0.6 : 1 } : {}}
                                />
                            </div>
                        </div>

                        {/* D) Inspection Ready Notes */}
                        <div className="dashboard-panel" style={{ marginBottom: '1.5rem' }}>
                            <div className="dashboard-panel-header">
                                <h2 className="dashboard-panel-title"><CheckCircle2 size={16} className="dashboard-panel-title-icon" /> Inspection Ready Notes</h2>
                            </div>
                            <div style={{ padding: '1rem', fontSize: '0.82rem', color: '#334155' }}>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8 }}>
                                    <li>✅ All case submissions contain timestamped evidence in <code>case_actions</code></li>
                                    <li>✅ Audit timeline shows chronological actions + reviews per case</li>
                                    <li>✅ Row-level security enforced — users cannot access data outside their organisation</li>
                                    <li>✅ Compliance notes are append-only and immutable</li>
                                    <li>✅ Reports can be locked to prevent post-hoc editing</li>
                                    <li>✅ All case statuses and reviews traceable via <code>case_reviews</code></li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Inspection Pack Recipients Settings */}
                    {canEditSettings && orgId && (
                        <div className="dashboard-panel reports-no-print" style={{ marginBottom: '1rem' }}>
                            <div className="dashboard-panel-header">
                                <h2 className="dashboard-panel-title"><Save size={16} className="dashboard-panel-title-icon" /> Inspection Pack Recipients</h2>
                            </div>
                            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Recipients (comma-separated emails)</label>
                                    <input
                                        type="text"
                                        className="dsf-input"
                                        value={settingsRecipients}
                                        onChange={(e) => setSettingsRecipients(e.target.value)}
                                        placeholder="alice@example.com, bob@example.com"
                                        style={{ width: '100%', fontSize: '0.82rem' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>CC (comma-separated emails)</label>
                                    <input
                                        type="text"
                                        className="dsf-input"
                                        value={settingsCc}
                                        onChange={(e) => setSettingsCc(e.target.value)}
                                        placeholder="manager@example.com"
                                        style={{ width: '100%', fontSize: '0.82rem' }}
                                    />
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#334155' }}>
                                    <input
                                        type="checkbox"
                                        checked={settingsAutoSend}
                                        onChange={(e) => setSettingsAutoSend(e.target.checked)}
                                    />
                                    Auto-send inspection pack when generated
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <button
                                        type="button"
                                        className="dashboard-reports-action-btn"
                                        disabled={savingSettings}
                                        onClick={async () => {
                                            setSavingSettings(true);
                                            setSettingsMsg(null);
                                            try {
                                                const supabase = getSupabase();
                                                const recipientsArr = settingsRecipients.split(',').map(s => s.trim()).filter(Boolean);
                                                const ccArr = settingsCc.split(',').map(s => s.trim()).filter(Boolean);
                                                const { error: uErr } = await supabase
                                                    .from('organisation_settings')
                                                    .upsert({
                                                        organisation_id: orgId,
                                                        report_recipients: recipientsArr,
                                                        report_cc: ccArr,
                                                        auto_send_inspection_pack: settingsAutoSend,
                                                        updated_at: new Date().toISOString(),
                                                    }, { onConflict: 'organisation_id' });
                                                if (uErr) throw uErr;
                                                setSettingsMsg('Saved');
                                            } catch (err: any) {
                                                setSettingsMsg(`Error: ${err?.message ?? 'Failed to save'}`);
                                            } finally {
                                                setSavingSettings(false);
                                            }
                                        }}
                                    >
                                        {savingSettings ? <Loader2 size={14} className="dsf-spinner" /> : <Save size={14} />}
                                        {savingSettings ? 'Saving…' : 'Save Settings'}
                                    </button>
                                    {settingsMsg && (
                                        <span style={{ fontSize: '0.75rem', color: settingsMsg.startsWith('Error') ? '#dc2626' : '#16a34a' }}>{settingsMsg}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ACTION BAR */}
                    <div className="reports-no-print" style={{ height: '84px' }} />
                    <div className="dashboard-reports-actions reports-no-print" style={{
                        position: 'sticky',
                        bottom: 0,
                        background: '#ffffff',
                        padding: '1rem',
                        borderTop: '1px solid #e2e8f0',
                        display: 'flex',
                        gap: '0.75rem',
                        justifyContent: 'flex-end',
                        zIndex: 50,
                        marginTop: '1rem'
                    }}>
                        {/* Save Draft — only when not approved/locked and not in inspection mode */}
                        {!isLocked && !inspectionMode && (
                            <button type="button" className="dashboard-reports-action-btn" onClick={handleSaveDraft} disabled={savingDraft}>
                                {savingDraft ? <Loader2 size={16} className="dsf-spinner" /> : <Save size={16} />}
                                {savingDraft ? 'Saving…' : 'Save Draft'}
                            </button>
                        )}

                        {/* A) Draft + no PDF → Generate PDF */}
                        {reportStatus === 'draft' && !reportPdfUrl && reportId && (
                            <button
                                type="button"
                                className="dashboard-reports-action-btn"
                                onClick={async (e) => {
                                    e.preventDefault();
                                    if (!reportId || !orgId || generatingPdf) return;
                                    setGeneratingPdf(true);
                                    setSaveMsg(null);
                                    try {
                                        const supabase = getSupabase();
                                        const { data: { session } } = await supabase.auth.getSession();
                                        if (!session?.access_token) throw new Error('Not authenticated');
                                        const { start, end } = monthBoundaries(selectedMonth);
                                        const resp = await fetch('/api/reports-generate-pdf', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                Authorization: `Bearer ${session.access_token}`,
                                            },
                                            body: JSON.stringify({
                                                reportId,
                                                organisationId: orgId,
                                                periodStart: start.slice(0, 10),
                                                periodEnd: new Date(new Date(end).getTime() - 1).toISOString().slice(0, 10),
                                            }),
                                        });
                                        const result = await resp.json();
                                        if (!resp.ok) throw new Error(result.error ?? 'PDF generation failed');
                                        setSaveMsg('PDF generated successfully.');
                                        setReportPdfUrl(result.pdf_url);
                                        fetchData();
                                        fetchHistory();
                                    } catch (err: any) {
                                        setSaveMsg(`Error: ${err?.message ?? 'PDF generation failed'}`);
                                    } finally {
                                        setGeneratingPdf(false);
                                    }
                                }}
                                disabled={generatingPdf}
                                style={{ background: '#1e40af', color: '#fff' }}
                            >
                                {generatingPdf ? <Loader2 size={16} className="dsf-spinner" /> : <FileText size={16} />}
                                {generatingPdf ? 'Generating…' : 'Generate PDF'}
                            </button>
                        )}

                        {/* B) Draft + PDF exists → Open PDF + Approve Report */}
                        {reportStatus === 'draft' && reportPdfUrl && (
                            <>
                                <a
                                    href={reportPdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="dashboard-reports-action-btn"
                                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                    <Eye size={16} /> Open PDF
                                </a>
                                <button
                                    type="button"
                                    className="dashboard-reports-action-btn"
                                    onClick={handleApproveReport}
                                    disabled={approving}
                                    style={{ background: '#166534', color: '#fff' }}
                                >
                                    {approving ? <Loader2 size={16} className="dsf-spinner" /> : <CheckCircle2 size={16} />}
                                    {approving ? 'Approving…' : 'Approve Report'}
                                </button>
                            </>
                        )}

                        {/* C) Approved or locked → Open PDF + Approved badge */}
                        {isLocked && reportPdfUrl && (
                            <a
                                href={reportPdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="dashboard-reports-action-btn"
                                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                                <Eye size={16} /> Open PDF
                            </a>
                        )}

                        <button type="button" className="dashboard-reports-action-btn" onClick={() => window.print()}>
                            <Printer size={16} /> Print / Save as PDF
                        </button>

                        {/* Send Inspection Pack */}
                        {orgId && (
                            <button
                                type="button"
                                className="dashboard-reports-action-btn"
                                disabled={sendingPack}
                                style={{ background: '#7c3aed', color: '#fff' }}
                                onClick={async () => {
                                    if (sendingPack || !orgId) return;
                                    setSendingPack(true);
                                    setSendPackMsg(null);
                                    try {
                                        const supabase = getSupabase();
                                        const { data: { session } } = await supabase.auth.getSession();
                                        if (!session?.access_token) throw new Error('Not authenticated');
                                        const resp = await fetch('/api/send-inspection-pack', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                Authorization: `Bearer ${session.access_token}`,
                                            },
                                            body: JSON.stringify({ snapshot_month: selectedMonth, organisation_id: orgId }),
                                        });
                                        const result = await resp.json().catch(() => null);
                                        if (!resp.ok) throw new Error(result?.error ?? 'Failed to send');
                                        setSendPackMsg('Sent');
                                        fetchDeliveries();
                                    } catch (err: any) {
                                        setSendPackMsg(`Error: ${err?.message ?? 'Send failed'}`);
                                    } finally {
                                        setSendingPack(false);
                                    }
                                }}
                            >
                                {sendingPack ? <Loader2 size={16} className="dsf-spinner" /> : <Download size={16} />}
                                {sendingPack ? 'Sending…' : 'Send Inspection Pack'}
                            </button>
                        )}
                        {sendPackMsg && (
                            <span style={{ fontSize: '0.75rem', alignSelf: 'center', color: sendPackMsg.startsWith('Error') ? '#dc2626' : '#16a34a' }}>{sendPackMsg}</span>
                        )}
                    </div>

                    {saveMsg && (
                        <div
                            className="reports-no-print"
                            style={{
                                marginTop: '0.75rem',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                background: saveMsg.startsWith('Error') ? '#fef2f2' : '#f0fdf4',
                                color: saveMsg.startsWith('Error') ? '#991b1b' : '#166534',
                                border: `1px solid ${saveMsg.startsWith('Error') ? '#fecaca' : '#bbf7d0'}`,
                            }}
                        >
                            {saveMsg}
                        </div>
                    )}
                </>
            )}

            {/* AUDIT ACTIVITY */}
            {reportId && auditLogs.length > 0 && (
                <div className="dashboard-panel" style={{ marginTop: '2rem' }}>
                    <div className="dashboard-panel-header">
                        <h2 className="dashboard-panel-title"><Activity size={16} className="dashboard-panel-title-icon" /> Recent Activity</h2>
                    </div>
                    <div className="dashboard-panel-table-wrap">
                        <table className="dashboard-panel-table">
                            <thead>
                                <tr><th>Action</th><th>Actor</th><th>Time</th></tr>
                            </thead>
                            <tbody>
                                {auditLogs.map(log => (
                                    <tr key={log.id}>
                                        <td>{capitalize(log.action)}</td>
                                        <td>{log.actor_type ?? '—'}</td>
                                        <td>{new Date(log.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* DELIVERY HISTORY */}
            {orgId && (
                <div className="dashboard-panel reports-no-print" style={{ marginTop: '2rem' }}>
                    <div className="dashboard-panel-header">
                        <h2 className="dashboard-panel-title"><Download size={16} className="dashboard-panel-title-icon" /> Delivery History</h2>
                        <span className="dashboard-panel-count">{deliveries.length}</span>
                    </div>
                    {deliveries.length === 0 ? (
                        <div className="dashboard-panel-empty">No deliveries yet for this month.</div>
                    ) : (
                        <div className="dashboard-panel-table-wrap">
                            <table className="dashboard-panel-table">
                                <thead>
                                    <tr><th>Status</th><th>Sent</th><th>Recipients</th></tr>
                                </thead>
                                <tbody>
                                    {deliveries.map(d => {
                                        const recipientCount = Array.isArray(d.recipients) ? d.recipients.length : 0;
                                        const sentTime = d.sent_at ?? d.created_at;
                                        return (
                                            <tr key={d.id}>
                                                <td>
                                                    <span
                                                        className={`dashboard-status-badge status-${d.status === 'sent' || d.status === 'delivered' ? 'closed' : 'new'}`}
                                                        style={{ fontSize: '0.7rem' }}
                                                    >
                                                        {capitalize(d.status)}
                                                    </span>
                                                </td>
                                                <td>{new Date(sentTime).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                                                <td>Sent to {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* REPORT HISTORY */}
            <div className="dashboard-panel reports-no-print" style={{ marginTop: '2rem' }}>
                <div className="dashboard-panel-header">
                    <h2 className="dashboard-panel-title"><Clock size={16} className="dashboard-panel-title-icon" /> Report History</h2>
                    <span className="dashboard-panel-count">{reportHistory.length}</span>
                </div>

                {historyLoading ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                        <Loader2 size={18} className="dsf-spinner" /> Loading…
                    </div>
                ) : reportHistory.length === 0 ? (
                    <div className="dashboard-panel-empty">No saved reports yet.</div>
                ) : (
                    <div className="dashboard-panel-table-wrap">
                        <table className="dashboard-panel-table">
                            <thead>
                                <tr><th>Period</th><th>Status</th><th>Created</th><th>PDF</th><th></th></tr>
                            </thead>
                            <tbody>
                                {reportHistory.map(r => (
                                    <tr key={r.id}>
                                        <td>{fmtDate(r.period_start)}</td>
                                        <td>
                                            <span
                                                className={`dashboard-status-badge status-${(r.status === 'locked' || r.status === 'approved') ? 'closed' : 'new'}`}
                                                style={{ fontSize: '0.7rem' }}
                                            >
                                                {r.status === 'approved' ? 'Approved ✅' : r.status === 'locked' ? '🔒 Locked' : 'Draft'}
                                            </span>
                                        </td>
                                        <td>{fmtDate(r.created_at)}</td>
                                        <td>
                                            {r.pdf_url ? (
                                                <a
                                                    href={r.pdf_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="dashboard-reports-action-btn"
                                                    style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    <Download size={12} /> PDF
                                                </a>
                                            ) : (
                                                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>—</span>
                                            )}
                                        </td>
                                        <td>
                                            <button
                                                className="dashboard-reports-action-btn"
                                                style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
                                                onClick={() => loadReport(r)}
                                            >
                                                <Download size={12} /> Load
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
