import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    BarChart3, Loader2, AlertTriangle, Calendar, ShieldAlert, PieChart,
    CheckCircle2, TrendingUp, Info, Printer, Save, Lock, Eye,
    ClipboardList, Clock, FileText, Download, Activity, Mail,
    Sparkles, RefreshCw, Building2,
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

interface AiNarrative {
    execSummary?: string;
    safeguardingTrends?: string;
    emergingRisks?: string;
    operationalPressure?: string;
    positiveSignals?: string;
    recommendedActions?: string;
    inspectionSummary?: string;
    leadershipSummary?: string;
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

    // AI narrative
    const [aiNarrative, setAiNarrative] = useState<AiNarrative | null>(null);
    const [regeneratingAi, setRegeneratingAi] = useState(false);
    const [aiCooldownUntil, setAiCooldownUntil] = useState<number | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);

    // Inspection mode
    const [inspectionMode, setInspectionMode] = useState(false);

    // Send inspection pack
    const [sendingPack, setSendingPack] = useState(false);
    const [sendPackMsg, setSendPackMsg] = useState<string | null>(null);

    // Send report email
    const [sendingReport, setSendingReport] = useState(false);
    const [sendReportMsg, setSendReportMsg] = useState<string | null>(null);
    const [deliveries, setDeliveries] = useState<{ id: string; status: string; sent_at: string | null; created_at: string; recipients: string[] | null }[]>([]);

    const isLocked = reportStatus === 'locked' || reportStatus === 'approved' || reportLocked;
    const fieldsDisabled = isLocked || inspectionMode || userRole === 'read_only';
    const canSendPack = userRole === 'super_admin' || userRole === 'org_admin';
    const canSendReportEmail = userRole === 'super_admin' || userRole === 'org_admin' || userRole === 'safeguarding_lead';

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

                // Check both localStorage keys used by different parts of the dashboard
                const stored = localStorage.getItem('slp_active_org_id')
                    || localStorage.getItem('slp_viewing_as_org_id');
                if (stored) {
                    setOrgId(stored);
                    const match = (orgs ?? []).find(o => o.id === stored);
                    setOrgName(match?.name ?? '');
                }
                console.log('[ReportsPage] Mount — super_admin, resolved orgId:', stored ?? '(none)', 'slp_active_org_id:', localStorage.getItem('slp_active_org_id'), 'slp_viewing_as_org_id:', localStorage.getItem('slp_viewing_as_org_id'));
            } else if (profile?.organisation_id) {
                // For org_admin: check if dashboard "Viewing As" override is set
                const viewingAs = localStorage.getItem('slp_viewing_as_org_id')
                    || localStorage.getItem('slp_active_org_id');
                const resolvedOrg = viewingAs || profile.organisation_id;
                setOrgId(resolvedOrg);
                setUserRole(profile.role ?? '');
                console.log('[ReportsPage] Mount — role:', profile.role, 'profile.organisation_id:', profile.organisation_id, 'viewingAs:', viewingAs, 'resolved orgId:', resolvedOrg);

                const { data: org } = await supabase
                    .from('organisations')
                    .select('name')
                    .eq('id', resolvedOrg)
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
                setAiNarrative(savedReport.metrics?.aiNarrative ?? null);
            } else {
                setReportId(null);
                setReportStatus(null);
                setReportLocked(false);
                setReportPdfUrl(null);
                setExecSummary('');
                setRecommendations('');
                setKeyTrends('');
                setAiNarrative(null);
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

    /* ── Previous month metrics from report history (for trend comparison) ──── */
    const prevMonthMetrics = useMemo(() => {
        if (reportHistory.length < 2) return null;
        // reportHistory is sorted descending — index 0 is current or most recent,
        // index 1 is the prior period.
        const prev = reportHistory[1];
        if (!prev?.metrics) return null;
        return prev.metrics as {
            total?: number;
            highRisk?: number;
            slaOverdueNow?: number;
            categories?: [string, number][];
        };
    }, [reportHistory]);

    /* ── Rich report payload for AI composer ───────────────────────────────── */
    const reportPayload = useMemo(() => {
        const closureRate = metrics.total > 0
            ? Math.round((metrics.byStatus.closed / metrics.total) * 100)
            : null;
        const openBacklog = metrics.byStatus.new + metrics.byStatus.in_review;
        const trendSignals: { label: string; value: string }[] = [];
        if (metrics.categories[0]) {
            trendSignals.push({
                label: 'Most Common Concern',
                value: `${metrics.categories[0][0].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} (${metrics.categories[0][1]} cases)`,
            });
        }
        if (metrics.highRisk > 0)
            trendSignals.push({ label: 'High-Risk Signal', value: `${metrics.highRisk} high or critical risk cases` });
        if (slaOverdueNow > 0)
            trendSignals.push({ label: 'Response Pressure', value: `${slaOverdueNow} cases overdue beyond 3 days` });
        if (closureRate !== null && closureRate >= 70)
            trendSignals.push({ label: 'Positive Signal', value: `${closureRate}% closure rate this period` });
        return {
            ...metrics,
            closureRate,
            openBacklog,
            slaOverdueNow,
            trendSignals,
            prev: prevMonthMetrics
                ? { total: prevMonthMetrics.total, highRisk: prevMonthMetrics.highRisk }
                : null,
        };
    }, [metrics, slaOverdueNow, prevMonthMetrics]);

    /* ── Generate AI narrative ──────────────────────────────────────────────── */
    async function handleGenerateAiNarrative() {
        if (!reportId || !orgId || regeneratingAi) return;
        if (aiCooldownUntil && Date.now() < aiCooldownUntil) return;

        setRegeneratingAi(true);
        setAiError(null);
        try {
            const supabase = getSupabase();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Not authenticated');

            const { start, end } = monthBoundaries(selectedMonth);
            const periodStartDate = start.slice(0, 10);
            const periodEndDate = new Date(new Date(end).getTime() - 1).toISOString().slice(0, 10);

            const resp = await fetch('/api/reports-compose-ai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    reportId,
                    organisationId: orgId,
                    periodStart: periodStartDate,
                    periodEnd: periodEndDate,
                    payload: reportPayload,
                }),
            });

            const result = await resp.json();

            if (resp.status === 429) {
                const retryAfter = result.retryAfterSeconds ?? 60;
                setAiCooldownUntil(Date.now() + retryAfter * 1000);
                setAiError(`Please wait ${retryAfter} seconds before regenerating.`);
                return;
            }
            if (result.fallback) {
                setAiError('AI narrative generation is temporarily unavailable. Your report data is complete.');
                return;
            }
            if (!resp.ok) {
                setAiError(result.error ?? 'Could not generate AI narrative.');
                return;
            }
            if (result.aiNarrative) {
                setAiNarrative(result.aiNarrative);
                setAiCooldownUntil(Date.now() + 60_000);
            }
        } catch {
            setAiError('AI generation failed. Please try again.');
        } finally {
            setRegeneratingAi(false);
        }
    }



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
        setKeyTrends(r.metrics?.keyTrends ?? '');
        setSlaOverdueNow(r.metrics?.slaOverdueNow ?? r.metrics?.slaOverdue ?? 0);
        setAiNarrative(r.metrics?.aiNarrative ?? null);

        const d = new Date(r.period_start);
        const monthVal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        setSelectedMonth(monthVal);

        setSaveMsg(`Loaded report from ${fmtDate(r.period_start)}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
                                                    <td>{cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</td>
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
                                                    <td>{ch.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</td>
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
                                                <tr key={dec}><td>{dec.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</td><td>{count}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* REPORT CONTENT — AI-powered narrative */}
                    <div style={{ marginTop: '2rem' }}>

                        {/* Branded report hero */}
                        <div style={{
                            background: 'linear-gradient(135deg, #0B1E36 0%, #16324F 100%)',
                            borderRadius: 14,
                            padding: '1.5rem 1.75rem',
                            marginBottom: '1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem',
                            flexWrap: 'wrap',
                        }}>
                            <div>
                                <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#C9A84C', margin: '0 0 0.3rem' }}>
                                    Second Look Protect
                                </p>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 0.25rem', lineHeight: 1.2 }}>
                                    Safeguarding Monthly Report
                                </h2>
                                <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
                                    <Building2 size={12} style={{ verticalAlign: 'middle', marginRight: 4, color: '#C9A84C' }} />
                                    {orgName}{orgName ? ' · ' : ''}{selectedMonthLabel}
                                </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                {reportStatus && (
                                    <span style={{
                                        display: 'inline-block', padding: '0.3rem 0.85rem',
                                        borderRadius: 99, fontSize: '0.72rem', fontWeight: 600,
                                        background: isLocked ? 'rgba(34,197,94,0.15)' : 'rgba(201,168,76,0.15)',
                                        color: isLocked ? '#4ade80' : '#C9A84C',
                                        border: `1px solid ${isLocked ? 'rgba(34,197,94,0.3)' : 'rgba(201,168,76,0.3)'}`,
                                    }}>
                                        {reportStatus === 'approved' ? '✓ Approved' : reportStatus === 'locked' ? '⊘ Locked' : '✎ Draft'}
                                    </span>
                                )}
                                <p style={{ fontSize: '0.7rem', color: '#64748b', margin: '0.4rem 0 0' }}>
                                    {metrics.total} case{metrics.total !== 1 ? 's' : ''} · {metrics.highRisk} high-risk · {metrics.byStatus.closed} closed
                                </p>
                            </div>
                        </div>

                        {/* AI error message */}
                        {aiError && (
                            <div style={{
                                marginBottom: '1rem', padding: '0.65rem 0.9rem',
                                borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a',
                                fontSize: '0.8rem', color: '#92400e',
                            }}>
                                {aiError}
                            </div>
                        )}

                        {/* AI narrative sections */}
                        {((): React.ReactNode => {
                            const n = aiNarrative;
                            const hasAi = !!n && Object.values(n).some(v => !!v);
                            const closureRate = metrics.total > 0
                                ? Math.round((metrics.byStatus.closed / metrics.total) * 100)
                                : null;

                            const AiBadge = () => (
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 3,
                                    fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase',
                                    letterSpacing: '0.05em', color: '#7c3aed',
                                    background: 'rgba(124,58,237,0.08)', borderRadius: 4,
                                    padding: '0.1rem 0.4rem', marginLeft: 'auto', flexShrink: 0,
                                }}>
                                    <Sparkles size={9} /> AI
                                </span>
                            );

                            const Skeleton = () => (
                                <div style={{ padding: '0.25rem 0' }}>
                                    {[85, 95, 72].map((w, i) => (
                                        <div key={i} style={{
                                            height: 11, borderRadius: 4, marginBottom: 8, width: `${w}%`,
                                            background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'dashboard-shimmer 1.5s infinite linear',
                                        }} />
                                    ))}
                                </div>
                            );

                            // Deterministic fallback per section
                            const fallbacks: Partial<AiNarrative> = {
                                execSummary: execSummary || (metrics.total === 0
                                    ? `No cases were recorded for ${selectedMonthLabel}. The organisation maintained safeguarding protocols throughout this period with no submissions requiring active review.`
                                    : `${metrics.total} case${metrics.total !== 1 ? 's' : ''} were recorded during ${selectedMonthLabel}.${metrics.highRisk > 0 ? ` ${metrics.highRisk} case${metrics.highRisk !== 1 ? 's were' : ' was'} classified as high or critical risk.` : ' No high-risk cases were identified.'} ${closureRate !== null ? `The closure rate for the period was ${closureRate}%.` : ''}`),
                                safeguardingTrends: keyTrends
                                    ? keyTrends.split('\n').filter(l => l.trim()).join(' ')
                                    : `Case volume for ${selectedMonthLabel}: ${metrics.total} total case${metrics.total !== 1 ? 's' : ''}. Generate AI narrative for a full trend analysis.`,
                                emergingRisks: metrics.highRisk > 0
                                    ? `${metrics.highRisk} case${metrics.highRisk !== 1 ? 's' : ''} were classified as high or critical risk this period${metrics.categories[0] ? `, with ${metrics.categories[0][0].replace(/_/g, ' ')} as the most common concern category` : ''}.`
                                    : 'No high or critical risk cases were recorded during this period.',
                                operationalPressure: `Average time to first review: ${metrics.avgReview}. Average time to close: ${metrics.avgClose}.${slaOverdueNow > 0 ? ` ${slaOverdueNow} case${slaOverdueNow !== 1 ? 's remain' : ' remains'} open beyond the 3-day SLA threshold.` : ' All cases are within SLA thresholds.'}`,
                                positiveSignals: closureRate !== null && closureRate >= 60
                                    ? `${closureRate}% of cases were closed during this period, reflecting strong review throughput.`
                                    : metrics.highRisk === 0 && metrics.total > 0
                                        ? 'No high or critical risk cases were reported, reflecting a safe and well-managed period.'
                                        : 'Case processing continued within normal operational parameters.',
                                recommendedActions: recommendations || '- Ensure all open cases are reviewed and progressed promptly.\n- Confirm SLA compliance across all active cases.\n- Review any high-risk cases with the safeguarding lead.',
                                inspectionSummary: 'This report has been prepared in accordance with safeguarding reporting standards. All case records, timelines, and decisions are available for inspection review.',
                                leadershipSummary: metrics.total === 0
                                    ? `No safeguarding cases were recorded in ${selectedMonthLabel}. No escalation action is required at this time.`
                                    : `${metrics.total} case${metrics.total !== 1 ? 's' : ''} were managed during ${selectedMonthLabel}. ${metrics.highRisk > 0 ? 'Leadership attention is recommended for high-risk case review.' : 'No high-risk concerns require immediate leadership action.'}`,
                            };

                            type SectionDef = { key: keyof AiNarrative; title: string; icon: React.ReactNode; isList?: boolean };
                            const sections: SectionDef[] = [
                                { key: 'execSummary', title: 'Executive Summary', icon: <FileText size={15} /> },
                                { key: 'safeguardingTrends', title: 'Safeguarding Trends', icon: <TrendingUp size={15} /> },
                                { key: 'emergingRisks', title: 'Emerging Risks', icon: <ShieldAlert size={15} /> },
                                { key: 'operationalPressure', title: 'Operational Pressure', icon: <Clock size={15} /> },
                                { key: 'positiveSignals', title: 'Positive Signals', icon: <CheckCircle2 size={15} /> },
                                { key: 'recommendedActions', title: 'Recommended Actions', icon: <ClipboardList size={15} />, isList: true },
                                { key: 'inspectionSummary', title: 'Inspection Summary', icon: <Lock size={15} /> },
                                { key: 'leadershipSummary', title: 'Leadership Summary', icon: <Building2 size={15} /> },
                            ];

                            return (
                                <>
                                    {!hasAi && !regeneratingAi && reportId && (userRole === 'org_admin' || userRole === 'super_admin') && (
                                        <div style={{
                                            marginBottom: '1.25rem', padding: '0.9rem 1.1rem',
                                            borderRadius: 10, border: '1px dashed #c4b5fd',
                                            background: 'rgba(124,58,237,0.03)',
                                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                                        }}>
                                            <Sparkles size={18} style={{ color: '#7c3aed', flexShrink: 0 }} />
                                            <div>
                                                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#5b21b6' }}>AI narrative not yet generated</p>
                                                <p style={{ margin: '0.1rem 0 0', fontSize: '0.78rem', color: '#7c3aed' }}>Click &ldquo;Generate AI Narrative&rdquo; in the toolbar below to create polished report sections from this period&apos;s data.</p>
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                                        {sections.map(section => {
                                            const aiText = n?.[section.key];
                                            const text = aiText || fallbacks[section.key] || '';
                                            const isAiText = !!aiText;

                                            return (
                                                <div key={section.key} className="dashboard-panel" style={{ marginBottom: 0 }}>
                                                    <div className="dashboard-panel-header" style={{ borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center' }}>
                                                        <h2 className="dashboard-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1, minWidth: 0 }}>
                                                            <span style={{ color: isAiText ? '#7c3aed' : '#94a3b8', flexShrink: 0 }}>{section.icon}</span>
                                                            {section.title}
                                                        </h2>
                                                        {isAiText && <AiBadge />}
                                                    </div>
                                                    <div style={{ padding: '1rem 1rem', fontSize: '0.875rem', color: '#334155', lineHeight: 1.75 }}>
                                                        {regeneratingAi ? <Skeleton /> : (
                                                            section.isList ? (
                                                                <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                                                    {(text || '').split('\n').filter(l => l.trim()).map((line, i) => (
                                                                        <li key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                                                            <span style={{ color: '#C9A84C', flexShrink: 0, marginTop: 2, fontWeight: 700 }}>›</span>
                                                                            <span>{line.replace(/^[-–—•]\s*/, '')}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            ) : (
                                                                <p style={{ margin: 0 }}>{text}</p>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            );
                        })()}

                        {/* D) Inspection Ready Notes — insight-led summary */}
                        {(() => {
                            const hasData = metrics.total > 0;
                            const monthLabel = selectedMonthLabel;

                            // ── Trend signals from prior month ────────────────────────
                            const prevTotal = prevMonthMetrics?.total ?? null;
                            const prevHighRisk = prevMonthMetrics?.highRisk ?? null;
                            const caseDelta = prevTotal !== null ? metrics.total - prevTotal : null;
                            const highRiskDelta = prevHighRisk !== null ? metrics.highRisk - prevHighRisk : null;
                            const closureRate = metrics.total > 0
                                ? Math.round((metrics.byStatus.closed / metrics.total) * 100)
                                : null;
                            const topCategory = metrics.categories[0]?.[0] ?? null;
                            const topCategoryCount = metrics.categories[0]?.[1] ?? 0;
                            const topCategoryPct = metrics.total > 0
                                ? Math.round((topCategoryCount / metrics.total) * 100)
                                : 0;
                            const reviewPressure = slaOverdueNow > 0;
                            const highRiskPct = metrics.total > 0
                                ? Math.round((metrics.highRisk / metrics.total) * 100)
                                : 0;

                            // ── Summary sentence ──────────────────────────────────────
                            let summaryLine = '';
                            if (!hasData) {
                                summaryLine = `No cases were recorded for ${monthLabel}. Insights will appear once activity is logged.`;
                            } else {
                                const parts: string[] = [];
                                parts.push(`${metrics.total} ${metrics.total === 1 ? 'case was' : 'cases were'} recorded in ${monthLabel}`);
                                if (caseDelta !== null) {
                                    if (caseDelta > 0) parts.push(`an increase of ${caseDelta} compared to the previous period`);
                                    else if (caseDelta < 0) parts.push(`a reduction of ${Math.abs(caseDelta)} compared to the previous period`);
                                    else parts.push(`consistent with the previous period`);
                                }
                                summaryLine = parts.join(', ') + '.';

                                if (metrics.highRisk > 0) {
                                    summaryLine += ` ${metrics.highRisk} ${metrics.highRisk === 1 ? 'case' : 'cases'} ${metrics.highRisk === 1 ? 'was' : 'were'} classified as high or critical risk`;
                                    if (highRiskDelta !== null && highRiskDelta > 0) summaryLine += `, up ${highRiskDelta} from the prior month`;
                                    else if (highRiskDelta !== null && highRiskDelta < 0) summaryLine += `, down ${Math.abs(highRiskDelta)} from the prior month`;
                                    summaryLine += '.';
                                }
                                if (metrics.byStatus.closed > 0) {
                                    summaryLine += ` ${metrics.byStatus.closed} ${metrics.byStatus.closed === 1 ? 'case' : 'cases'} ${metrics.byStatus.closed === 1 ? 'was' : 'were'} closed this period`;
                                    if (closureRate !== null) summaryLine += ` (${closureRate}% closure rate)`;
                                    summaryLine += '.';
                                }
                            }

                            // ── Insight chips ──────────────────────────────────────────
                            type Chip = { label: string; value: string; tone: 'red' | 'amber' | 'green' | 'blue' | 'neutral' };
                            const chips: Chip[] = [];

                            if (hasData) {
                                // Most common concern
                                if (topCategory) {
                                    chips.push({
                                        label: 'Most Common Concern',
                                        value: `${topCategory.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} — ${topCategoryPct}% of cases`,
                                        tone: 'blue',
                                    });
                                }

                                // High-risk signal
                                if (metrics.highRisk > 0) {
                                    const trend = highRiskDelta === null ? '' :
                                        highRiskDelta > 0 ? ` ▲ up ${highRiskDelta} vs prior month` :
                                            highRiskDelta < 0 ? ` ▼ down ${Math.abs(highRiskDelta)} vs prior month` : ' — stable';
                                    chips.push({
                                        label: 'High-Risk Signal',
                                        value: `${metrics.highRisk} high or critical ${metrics.highRisk === 1 ? 'case' : 'cases'} (${highRiskPct}%)${trend}`,
                                        tone: highRiskPct >= 30 ? 'red' : 'amber',
                                    });
                                }

                                // Response pressure
                                if (reviewPressure) {
                                    chips.push({
                                        label: 'Response Pressure',
                                        value: `${slaOverdueNow} open ${slaOverdueNow === 1 ? 'case' : 'cases'} awaiting review beyond 3 days`,
                                        tone: slaOverdueNow >= 5 ? 'red' : 'amber',
                                    });
                                }

                                // Positive signal — good closure rate or no high-risk
                                if (closureRate !== null && closureRate >= 70) {
                                    chips.push({
                                        label: 'Positive Signal',
                                        value: `${closureRate}% of cases closed this period — strong throughput`,
                                        tone: 'green',
                                    });
                                } else if (metrics.highRisk === 0 && metrics.total > 0) {
                                    chips.push({
                                        label: 'Positive Signal',
                                        value: 'No high or critical risk cases recorded this period',
                                        tone: 'green',
                                    });
                                }

                                // Watch area — open backlog
                                const openBacklog = metrics.byStatus.new + metrics.byStatus.in_review;
                                if (openBacklog > 0 && (closureRate === null || closureRate < 50)) {
                                    chips.push({
                                        label: 'Watch Area',
                                        value: `${openBacklog} ${openBacklog === 1 ? 'case' : 'cases'} still open — consider prioritising review queue`,
                                        tone: 'neutral',
                                    });
                                }
                            }

                            // ── Recommended attention ────────────────────────────────────
                            const attention: string[] = [];
                            if (hasData) {
                                if (slaOverdueNow >= 3) attention.push('Prioritise the review queue — several cases have been open for more than 3 days.');
                                if (metrics.highRisk >= 2) attention.push('Schedule a safeguarding lead review of high-risk cases before month-end.');
                                if (highRiskDelta !== null && highRiskDelta > 2) attention.push('High-risk case volume has increased significantly — consider a team briefing.');
                                if (caseDelta !== null && caseDelta > 5) attention.push('Case volume has risen noticeably — check whether staffing and response capacity remains sufficient.');
                                if (topCategory && topCategoryPct >= 40) {
                                    const readableCat = topCategory.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                                    attention.push(`${readableCat} accounts for a high share of this period's cases — consider a focused review of this concern area.`);
                                }
                                if (attention.length === 0 && metrics.total > 0) {
                                    attention.push('No significant pressure points identified this period. Maintain current response standards and ensure all open cases are reviewed promptly.');
                                }
                            }

                            // ── Tone helpers ───────────────────────────────────────────
                            const chipColors: Record<NonNullable<Chip['tone']>, { bg: string; border: string; label: string; dot: string }> = {
                                red: { bg: '#fef2f2', border: '#fecaca', label: '#991b1b', dot: '#ef4444' },
                                amber: { bg: '#fffbeb', border: '#fde68a', label: '#92400e', dot: '#f59e0b' },
                                green: { bg: '#f0fdf4', border: '#bbf7d0', label: '#166534', dot: '#22c55e' },
                                blue: { bg: '#eff6ff', border: '#bfdbfe', label: '#1e40af', dot: '#3b82f6' },
                                neutral: { bg: '#f8fafc', border: '#e2e8f0', label: '#475569', dot: '#94a3b8' },
                            };

                            return (
                                <div className="dashboard-panel" style={{ marginBottom: '1.5rem' }}>
                                    <div className="dashboard-panel-header" style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <h2 className="dashboard-panel-title">
                                            <CheckCircle2 size={16} className="dashboard-panel-title-icon" />
                                            Inspection Ready Notes
                                        </h2>
                                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: 'auto', fontWeight: 400 }}>
                                            {monthLabel} · auto-generated from live data
                                        </span>
                                    </div>

                                    <div style={{ padding: '1.25rem 1rem' }}>

                                        {/* Summary paragraph */}
                                        <p style={{
                                            fontSize: '0.875rem', color: '#334155',
                                            lineHeight: 1.7, margin: '0 0 1.25rem',
                                            fontWeight: hasData ? 400 : 400,
                                        }}>
                                            {summaryLine}
                                            {!hasData && (
                                                <span style={{ display: 'block', marginTop: '0.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                                                    Insights will strengthen as more cases and reviews are recorded.
                                                </span>
                                            )}
                                        </p>

                                        {/* Insight chips */}
                                        {chips.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                                                {chips.map((chip) => {
                                                    const c = chipColors[chip.tone];
                                                    return (
                                                        <div key={chip.label} style={{
                                                            display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                                                            background: c.bg,
                                                            border: `1px solid ${c.border}`,
                                                            borderRadius: 8,
                                                            padding: '0.6rem 0.85rem',
                                                        }}>
                                                            <span style={{
                                                                width: 8, height: 8, borderRadius: '50%',
                                                                background: c.dot, flexShrink: 0, marginTop: 5,
                                                            }} />
                                                            <div>
                                                                <span style={{
                                                                    fontSize: '0.7rem', fontWeight: 700,
                                                                    textTransform: 'uppercase', letterSpacing: '0.05em',
                                                                    color: c.label, display: 'block', marginBottom: 2,
                                                                }}>
                                                                    {chip.label}
                                                                </span>
                                                                <span style={{ fontSize: '0.83rem', color: '#334155', lineHeight: 1.5 }}>
                                                                    {chip.value}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Recommended attention */}
                                        {attention.length > 0 && (
                                            <div style={{
                                                background: '#0B1E36',
                                                borderRadius: 10,
                                                padding: '0.85rem 1rem',
                                            }}>
                                                <p style={{
                                                    fontSize: '0.7rem', fontWeight: 700,
                                                    textTransform: 'uppercase', letterSpacing: '0.07em',
                                                    color: '#C9A84C', margin: '0 0 0.6rem',
                                                }}>
                                                    Recommended Attention
                                                </p>
                                                <ul style={{ margin: 0, paddingLeft: '1.1rem', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                    {attention.map((item, i) => (
                                                        <li key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                                            <span style={{ color: '#C9A84C', flexShrink: 0, marginTop: 2 }}>›</span>
                                                            <span style={{ fontSize: '0.83rem', color: '#e2e8f0', lineHeight: 1.6 }}>{item}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Low-data fallback note */}
                                        {!hasData && (
                                            <div style={{
                                                marginTop: '0.75rem', padding: '0.75rem 1rem',
                                                background: '#f8fafc', borderRadius: 8,
                                                border: '1px solid #e2e8f0',
                                                fontSize: '0.8rem', color: '#64748b',
                                            }}>
                                                Trend comparisons, insight signals, and recommended actions will appear here once cases are recorded for this organisation and period.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}

                    </div>


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
                        {/* Generate AI Narrative — org_admin + super_admin only */}
                        {reportId && (userRole === 'org_admin' || userRole === 'super_admin') && !inspectionMode && (() => {
                            const cooldownRemaining = aiCooldownUntil
                                ? Math.max(0, Math.ceil((aiCooldownUntil - Date.now()) / 1000))
                                : 0;
                            const onCooldown = cooldownRemaining > 0;
                            return (
                                <button
                                    type="button"
                                    className="dashboard-reports-action-btn"
                                    onClick={handleGenerateAiNarrative}
                                    disabled={regeneratingAi || onCooldown}
                                    style={{ background: '#5b21b6', color: '#fff', minWidth: 164, gap: '0.4rem' }}
                                >
                                    {regeneratingAi
                                        ? <><Loader2 size={15} className="dsf-spinner" /> Generating…</>
                                        : onCooldown
                                            ? <><RefreshCw size={15} /> Wait {cooldownRemaining}s</>
                                            : <><Sparkles size={15} /> Generate AI Narrative</>}
                                </button>
                            );
                        })()}

                        {/* Save Draft — only when not approved/locked and not in inspection mode */}
                        {!isLocked && !inspectionMode && userRole !== 'read_only' && (
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
                                {userRole !== 'read_only' && (
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
                                )}
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
                        {orgId && canSendPack && (
                            <button
                                type="button"
                                className="dashboard-reports-action-btn"
                                disabled={sendingPack}
                                style={{ background: '#7c3aed', color: '#fff' }}
                                onClick={async () => {
                                    if (sendingPack || !orgId) return;
                                    setSendingPack(true);
                                    setSendPackMsg(null);
                                    console.log('[ReportsPage] Send Inspection Pack — orgId:', orgId, 'selectedMonth:', selectedMonth);
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

                        {/* Send Report by Email */}
                        {orgId && canSendReportEmail && reportId && (
                            <button
                                type="button"
                                className="dashboard-reports-action-btn"
                                disabled={sendingReport}
                                style={{ background: '#0f766e', color: '#fff' }}
                                onClick={async () => {
                                    if (sendingReport || !orgId || !reportId) return;
                                    setSendingReport(true);
                                    setSendReportMsg(null);
                                    console.log('[ReportsPage] Send Report Email — orgId:', orgId, 'reportId:', reportId, 'selectedMonth:', selectedMonth);
                                    try {
                                        const supabase = getSupabase();
                                        const { data: { session } } = await supabase.auth.getSession();
                                        if (!session?.access_token) throw new Error('Not authenticated');
                                        const resp = await fetch('/api/send-report-email', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                Authorization: `Bearer ${session.access_token}`,
                                            },
                                            body: JSON.stringify({
                                                organisation_id: orgId,
                                                report_period: selectedMonth,
                                                report_id: reportId,
                                            }),
                                        });
                                        const result = await resp.json().catch(() => null);
                                        if (!resp.ok) throw new Error(result?.error ?? 'Failed to send report email');
                                        setSendReportMsg(result?.message ?? 'Report email sent');
                                        if (reportId) fetchAuditLogs(reportId);
                                    } catch (err: any) {
                                        setSendReportMsg(`Error: ${err?.message ?? 'Send failed'}`);
                                    } finally {
                                        setSendingReport(false);
                                    }
                                }}
                            >
                                {sendingReport ? <Loader2 size={16} className="dsf-spinner" /> : <Mail size={16} />}
                                {sendingReport ? 'Sending…' : 'Send Report by Email'}
                            </button>
                        )}
                        {sendReportMsg && (
                            <span style={{ fontSize: '0.75rem', alignSelf: 'center', color: sendReportMsg.startsWith('Error') ? '#dc2626' : '#16a34a' }}>{sendReportMsg}</span>
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
                                        <td>{log.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</td>
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
