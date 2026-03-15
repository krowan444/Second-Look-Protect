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
    scamThemeInsight?: string;
    defensiveRecommendations?: string;
    recommendedActions?: string;
    inspectionSummary?: string;
    leadershipSummary?: string;
    [key: string]: string | undefined;
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

// ─── PREMIUM EXPORT RENDERER — Phase 9 ────────────────────────────────────────
// Two-mode print system:
//   MODE A: Main-page print (window.print() without overlay) — body:not(.slp-rv-printing)
//   MODE B: View Report overlay print (body.slp-rv-printing)
// Inspection pack migration: when Send Inspection Pack adopts this renderer (Phase 10),
// it should call /api/reports-generate-pdf.js with the same data payload used here.
// ─────────────────────────────────────────────────────────────────────────────
const PRINT_STYLE = `
@media print {
  /* ── PAGE SETUP ───────────────────────────────────────────────────────────── */
  @page { margin: 14mm 12mm; size: A4 portrait; }

  /* ── COLOUR PRESERVATION — required for premium coloured cards ─────────────── */
  body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }

  /* ══════════════════════════════════════════════════════════════════════════════
     MODE A — Main page export (no overlay open)
  ══════════════════════════════════════════════════════════════════════════════ */
  body:not(.slp-rv-printing) .dashboard-topbar,
  body:not(.slp-rv-printing) .dashboard-sidebar,
  body:not(.slp-rv-printing) .dashboard-sidebar-toggle,
  body:not(.slp-rv-printing) .reports-no-print,
  body:not(.slp-rv-printing) .dashboard-page-header,
  body:not(.slp-rv-printing) .dashboard-reports-actions,
  body:not(.slp-rv-printing) .dashboard-reports-month-select,
  body:not(.slp-rv-printing) .report-view-overlay { display: none !important; }

  body:not(.slp-rv-printing) .dashboard-shell > *:not(.dashboard-content) { display: none !important; }
  body:not(.slp-rv-printing) .dashboard-content  { margin: 0 !important; padding: 0 !important; }
  body:not(.slp-rv-printing) .dashboard-main     { padding: 0 !important; }
  body:not(.slp-rv-printing) .reports-page       { max-width: 100% !important; padding: 0.5rem 0 !important; }

  /* Fix overflow/scrollbar artefacts — no clipped containers in export */
  body:not(.slp-rv-printing) *,
  body:not(.slp-rv-printing) *::before,
  body:not(.slp-rv-printing) *::after { overflow: visible !important; max-height: none !important; }

  /* Fix table wrapper heights that cause scrollbar ghost space */
  body:not(.slp-rv-printing) .dashboard-panel-table-wrap { height: auto !important; max-height: none !important; overflow: visible !important; }

  /* Remove fixed-height spacers */
  body:not(.slp-rv-printing) [style*="height: 84px"] { display: none !important; }

  /* Hide inspector-mode banner in export — it is a UI-only cue */
  body:not(.slp-rv-printing) .inspection-mode-banner { display: none !important; }

  /* KPI & narrative card page break rules */
  body:not(.slp-rv-printing) .report-kpi-strip     { break-inside: avoid; page-break-inside: avoid; }
  body:not(.slp-rv-printing) .report-kpi-box       { break-inside: avoid; page-break-inside: avoid; }
  body:not(.slp-rv-printing) .report-narrative-card { break-inside: avoid; page-break-inside: avoid; }
  body:not(.slp-rv-printing) .report-section-divider { break-after: avoid; page-break-after: avoid; }
  body:not(.slp-rv-printing) .dashboard-panel       { break-inside: avoid; page-break-inside: avoid; }
  body:not(.slp-rv-printing) .dashboard-reports-breakdowns { break-inside: auto; }

  /* Branded header must not split */
  body:not(.slp-rv-printing) [style*="linear-gradient(135deg,#0B1E36"] { break-inside: avoid; page-break-inside: avoid; }

  /* Table print hygiene */
  body:not(.slp-rv-printing) table   { border-collapse: collapse; width: 100%; }
  body:not(.slp-rv-printing) thead   { display: table-header-group; }
  body:not(.slp-rv-printing) tfoot   { display: table-footer-group; }
  body:not(.slp-rv-printing) tr      { break-inside: avoid; page-break-inside: avoid; }

  /* Typography orphan/widow protection */
  body:not(.slp-rv-printing) p,
  body:not(.slp-rv-printing) li { orphans: 3; widows: 3; }

  /* Hide interactive controls in print output */
  body:not(.slp-rv-printing) button,
  body:not(.slp-rv-printing) select,
  body:not(.slp-rv-printing) input { display: none !important; }

  /* Overlay narrative print improvements */
  body.slp-rv-printing .report-view-overlay p,
  body.slp-rv-printing .report-view-overlay li { orphans: 3; widows: 3; }
  body.slp-rv-printing .report-view-overlay .report-narrative-card { break-inside: avoid; page-break-inside: avoid; }

  /* Min-height on narrative card body causes blank space in export — collapse it */
  body:not(.slp-rv-printing) .report-narrative-card > div:last-child { min-height: 0 !important; }

  /* ══════════════════════════════════════════════════════════════════════════════
     MODE B — View Report overlay export (body.slp-rv-printing)
  ══════════════════════════════════════════════════════════════════════════════ */

  /* Hide main page entirely — the overlay is the document */
  body.slp-rv-printing .reports-page,
  body.slp-rv-printing .dashboard-topbar,
  body.slp-rv-printing .dashboard-sidebar,
  body.slp-rv-printing .dashboard-sidebar-toggle { display: none !important; }
  body.slp-rv-printing .dashboard-shell > *:not(.dashboard-content) { display: none !important; }
  body.slp-rv-printing .dashboard-content { margin: 0 !important; padding: 0 !important; }
  body.slp-rv-printing .dashboard-main    { padding: 0 !important; }

  /* Make overlay behave as document flow, not fixed viewport layer */
  body.slp-rv-printing .report-view-overlay {
    position: static !important;
    inset: auto !important;
    overflow: visible !important;
    background: #fff !important;
    z-index: auto !important;
    font-family: Inter, system-ui, sans-serif;
  }

  /* Hide overlay sticky chrome — top bar, close/print buttons */
  body.slp-rv-printing .report-view-overlay .reports-no-print { display: none !important; }

  /* Fix all overflow inside overlay */
  body.slp-rv-printing .report-view-overlay *,
  body.slp-rv-printing .report-view-overlay *::before,
  body.slp-rv-printing .report-view-overlay *::after { overflow: visible !important; max-height: none !important; }

  /* Overlay body content — no padding from fixed-overlay context */
  body.slp-rv-printing .report-view-overlay > div:last-child { padding-top: 0 !important; }

  /* Page break rules inside overlay */
  body.slp-rv-printing .report-view-overlay .report-kpi-box      { break-inside: avoid; page-break-inside: avoid; }
  body.slp-rv-printing .report-view-overlay .report-kpi-strip    { break-inside: avoid; page-break-inside: avoid; }
  body.slp-rv-printing .report-view-overlay .report-narrative-card { break-inside: avoid; page-break-inside: avoid; }
  body.slp-rv-printing .report-view-overlay .report-section-divider { break-after: avoid; page-break-after: avoid; }
  body.slp-rv-printing .report-view-overlay .report-narrative-card > div:last-child { min-height: 0 !important; }

  /* Table hygiene in overlay */
  body.slp-rv-printing .report-view-overlay table  { border-collapse: collapse; width: 100%; }
  body.slp-rv-printing .report-view-overlay thead  { display: table-header-group; }
  body.slp-rv-printing .report-view-overlay tr     { break-inside: avoid; page-break-inside: avoid; }
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
    const [orgResolved, setOrgResolved] = useState(false); // true once the org resolution useEffect has finished
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
    // Premium report view overlay (replaces legacy "Open PDF" action — Phase 8)
    const [reportViewOpen, setReportViewOpen] = useState(false);

    // Report history
    const [reportHistory, setReportHistory] = useState<SavedReport[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Audit logs
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

    // AI narrative
    const [aiNarrative, setAiNarrative] = useState<AiNarrative | null>(null);
    const [regeneratingAi, setRegeneratingAi] = useState(false);
    const [aiCooldownUntil, setAiCooldownUntil] = useState<number | null>(null);
    const [cooldownRemaining, setCooldownRemaining] = useState(0);
    const [aiError, setAiError] = useState<string | null>(null);
    // Raw metrics snapshot from the DB — used for ai_generated_at, cooldown restore etc.
    const [reportMetricsSnapshot, setReportMetricsSnapshot] = useState<Record<string, any> | null>(null);

    // Live countdown ticker — ticks once per second while cooldown is active
    useEffect(() => {
        if (!aiCooldownUntil) { setCooldownRemaining(0); return; }
        const tick = () => {
            const remaining = Math.max(0, Math.ceil((aiCooldownUntil - Date.now()) / 1000));
            setCooldownRemaining(remaining);
            if (remaining === 0) clearInterval(id);
        };
        tick(); // immediate first tick
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [aiCooldownUntil]);

    // Restore cooldown from DB on report load — if ai_generated_at is within the 5-min window,
    // re-apply the cooldown so it persists across page refreshes.
    useEffect(() => {
        const generatedAt = reportMetricsSnapshot?.ai_generated_at;
        if (!generatedAt) return;
        const COOLDOWN_MS = 5 * 60 * 1000;
        const generatedTime = new Date(generatedAt).getTime();
        const expiresAt = generatedTime + COOLDOWN_MS;
        if (Date.now() < expiresAt) {
            setAiCooldownUntil(expiresAt);
        }
    }, [reportMetricsSnapshot]);

    // ESC key closes the View Report overlay
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setReportViewOpen(false); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, []);

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
            // Signal that org resolution is complete (orgId may still be '' for super admin with no org selected)
            setOrgResolved(true);
        })();
    }, []);

    /* ── Fetch cases + saved report + SLA overdue NOW ─────────────────────── */
    const fetchData = useCallback(async () => {
        // Wait for org resolution to complete before attempting to fetch
        if (!orgResolved) return;
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
                setReportMetricsSnapshot(savedReport.metrics ?? null);

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
                setReportMetricsSnapshot(null);
            }
        } catch (err: any) {
            setError(err?.message ?? 'Failed to load report data');
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, orgId, orgResolved]);

    useEffect(() => { fetchData(); }, [fetchData, orgResolved]);

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
                const retryAfter = result.retryAfterSeconds ?? 300;
                setAiCooldownUntil(Date.now() + retryAfter * 1000);
                const mins = Math.ceil(retryAfter / 60);
                setAiError(`Narrative was refreshed recently. Please wait ${mins > 1 ? `${mins} minutes` : 'a moment'} before refreshing again.`);
                return;
            }
            if (result.fallback) {
                setAiError('AI narrative generation is temporarily unavailable. Your structured report data is complete and visible below.');
                return;
            }
            if (!resp.ok) {
                setAiError(result.error ?? 'Could not generate AI narrative.');
                return;
            }
            if (result.aiNarrative) {
                setAiNarrative(result.aiNarrative);
                // 5-minute cooldown matching server
                setAiCooldownUntil(Date.now() + 5 * 60 * 1000);
            }
        } catch {
            setAiError('Narrative refresh encountered an issue. Your existing report content is preserved.');
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

    // Phase 11 derived display variables — computed from selectedMonth and report state
    const isCurrentPeriod = (() => {
        const now = new Date();
        const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return selectedMonth === currentYM;
    })();

    const selectedDateRange = (() => {
        if (!selectedMonth) return '';
        const [y, m] = selectedMonth.split('-').map(Number);
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 0); // last day of month
        const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        return `${fmt(start)} – ${fmt(end)}`;
    })();

    const dataSourceLabel = isCurrentPeriod ? 'Live data' : 'Historical snapshot';

    const statusLabelFull = reportStatus === 'approved'
        ? 'Approved'
        : reportStatus === 'locked'
            ? 'Locked'
            : reportStatus === 'draft'
                ? 'Draft'
                : null;

    const aiLastRefresh = (() => {
        const ts = reportMetricsSnapshot?.ai_generated_at;
        if (!ts) return null;
        const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
        if (diff < 1) return 'just now';
        if (diff < 60) return `${diff}m ago`;
        return `${Math.floor(diff / 60)}h ago`;
    })();

    /**
     * AI quality filter — returns null if the text is absent, too short to be
     * meaningful (< 40 chars), or matches known stub phrases that indicate a
     * weak or placeholder model response. Consumers fall back to deterministic
     * copy when this returns null.
     */
    function goodAiText(v: string | null | undefined): string | null {
        if (!v || typeof v !== 'string') return null;
        const t = v.trim();
        if (t.length < 40) return null;
        // Known stub/placeholder patterns from weak model responses
        const stubs = [
            /^no (data|content|information)/i,
            /^n\/a$/i,
            /^none\.?$/i,
            /^not available/i,
            /^(this section|this report|the report) (will|has not)/i,
        ];
        if (stubs.some(re => re.test(t))) return null;
        return t;
    }

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

    const rvOverlay = !reportViewOpen ? null : (() => {
        const [rvY, rvM] = selectedMonth.split('-').map(Number);
        const rvFirst = new Date(rvY, rvM - 1, 1);
        const rvLast = new Date(rvY, rvM, 0);
        const fmtRv = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const rvRange = `${fmtRv(rvFirst)} \u2013 ${fmtRv(rvLast)}`;
        const rvIsLocked = reportStatus === 'locked' || reportStatus === 'approved' || reportLocked;
        const rvStatus = reportStatus === 'approved' ? 'Approved and locked'
            : reportStatus === 'locked' ? 'Locked for review'
                : reportStatus === 'draft' ? 'Draft'
                    : 'Current data \u2014 unsaved';
        const rvDataSource = rvIsLocked ? 'Monthly inspection snapshot (locked)' : 'Live case data';
        const hasAiNarrative = !!aiNarrative && Object.values(aiNarrative).some(v => !!goodAiText(v as string));
        const rvAiGenAt = reportMetricsSnapshot?.ai_generated_at;
        const rvAiFmt = rvAiGenAt ? new Date(rvAiGenAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
        const closureRvPct = metrics.total > 0 ? Math.round((metrics.byStatus.closed / metrics.total) * 100) : null;
        const aiExecRv = goodAiText(aiNarrative?.execSummary);
        const execRv = aiExecRv || goodAiText(execSummary) || (metrics.total === 0
            ? `No cases were submitted during ${selectedMonthLabel}. Safeguarding protocols remained active throughout this period.`
            : `${metrics.total} case${metrics.total !== 1 ? 's' : ''} were recorded during ${selectedMonthLabel}.${metrics.highRisk > 0 ? ` ${metrics.highRisk} classified as high or critical risk.` : ' No high-risk cases identified.'}${closureRvPct !== null ? ` Closure rate: ${closureRvPct}%.` : ''}`);
        const openRv = metrics.byStatus.new + metrics.byStatus.in_review;
        const rvReadyBadge = metrics.total === 0 || (metrics.byStatus.closed / metrics.total >= 0.9 && slaOverdueNow === 0);
        const fb5: Record<string, string> = {
            safeguardingTrends: goodAiText(keyTrends ? keyTrends.split('\n').filter(l => l.trim()).join(' ') : null) ?? (metrics.total === 0 ? `No submissions were recorded during ${selectedMonthLabel}.` : `${metrics.total} case${metrics.total !== 1 ? 's' : ''} were recorded during ${selectedMonthLabel}.`),
            emergingRisks: metrics.highRisk > 0 ? `${metrics.highRisk} case${metrics.highRisk !== 1 ? 's' : ''} classified as high or critical risk during ${selectedMonthLabel}.` : metrics.total === 0 ? 'No cases submitted \u2014 no elevated risk signals present.' : 'No high or critical risk cases were recorded.',
            operationalPressure: metrics.total === 0 ? 'No active cases \u2014 no operational pressure metrics apply.' : `Avg time to review: ${metrics.avgReview}. Avg time to close: ${metrics.avgClose}.${slaOverdueNow > 0 ? ` ${slaOverdueNow} case${slaOverdueNow !== 1 ? 's' : ''} overdue.` : ' All cases within SLA.'}`,
            positiveSignals: closureRvPct !== null && closureRvPct >= 60 ? `${closureRvPct}% closure rate \u2014 strong review throughput.` : metrics.highRisk === 0 ? 'No high-risk cases reported \u2014 positive safeguarding indicator.' : 'Case processing continued within normal parameters.',
            recommendedActions: recommendations || '- Progress all open cases promptly.\n- Confirm SLA compliance across active cases.\n- Review any high-risk cases with the safeguarding lead.',
        };
        type RvSection = { key: string; title: string; icon: React.ReactNode; isList?: boolean };
        const grid5rv: RvSection[] = [
            { key: 'safeguardingTrends', title: 'Safeguarding Trends', icon: <TrendingUp size={13} /> },
            { key: 'emergingRisks', title: 'Emerging Risks', icon: <ShieldAlert size={13} /> },
            { key: 'operationalPressure', title: 'Operational Pressure', icon: <Clock size={13} /> },
            { key: 'positiveSignals', title: 'Positive Signals', icon: <CheckCircle2 size={13} /> },
            { key: 'scamThemeInsight', title: 'Scam-Theme Intelligence', icon: <ShieldAlert size={13} />, accentColor: '#d97706' },
            { key: 'defensiveRecommendations', title: 'Defensive Recommendations', icon: <ClipboardList size={13} />, isList: true, accentColor: '#0B1E36' },
            { key: 'recommendedActions', title: 'Recommended Actions', icon: <ClipboardList size={13} />, isList: true },
        ];
        const inspRv = goodAiText(aiNarrative?.inspectionSummary) || 'This report has been prepared in accordance with safeguarding reporting standards. All case records, review timelines, decisions, and supporting evidence are available for inspection.';
        const leaderRv = goodAiText(aiNarrative?.leadershipSummary) || (metrics.total === 0 ? `No safeguarding cases were recorded during ${selectedMonthLabel}. No escalation required.` : metrics.highRisk > 0 ? `${metrics.total} case${metrics.total !== 1 ? 's' : ''} were managed, including ${metrics.highRisk} high or critical risk. Leadership review recommended.` : `${metrics.total} case${metrics.total !== 1 ? 's' : ''} managed during ${selectedMonthLabel}. No high-risk cases. No immediate escalation required.`);
        const AiBadgeRv = () => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: '#7c3aed', background: 'rgba(124,58,237,0.08)', borderRadius: 4, padding: '0.1rem 0.4rem', marginLeft: 'auto', flexShrink: 0 }}><Sparkles size={9} /> AI</span>;
        return (
            <div className="report-view-overlay" style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#f1f5f9', overflowY: 'auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
                {/* Sticky top bar */}
                <div className="reports-no-print" style={{ position: 'sticky', top: 0, zIndex: 100, background: '#0B1E36', padding: '0.7rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                        <span style={{ color: '#C9A84C', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0 }}>Report View</span>
                        <span style={{ color: '#475569' }}>·</span>
                        <span style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{orgName}</span>
                        <span style={{ color: '#475569' }}>·</span>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', flexShrink: 0 }}>{selectedMonthLabel}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexShrink: 0 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.65rem', borderRadius: 99, fontSize: '0.68rem', fontWeight: 700, background: rvIsLocked ? 'rgba(22,101,52,0.35)' : 'rgba(71,85,105,0.4)', color: rvIsLocked ? '#86efac' : '#94a3b8', border: `1px solid ${rvIsLocked ? 'rgba(134,239,172,0.25)' : 'rgba(148,163,184,0.15)'}` }}>
                            {rvIsLocked && <Lock size={9} />}{rvStatus}
                        </span>
                        <button type="button" onClick={() => { document.body.classList.add('slp-rv-printing'); window.print(); window.addEventListener('afterprint', () => document.body.classList.remove('slp-rv-printing'), { once: true }); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.38rem 0.9rem', borderRadius: 7, fontSize: '0.78rem', fontWeight: 600, background: '#1e40af', color: '#fff', border: 'none', cursor: 'pointer' }}><Printer size={13} /> Print</button>
                        <button type="button" onClick={() => setReportViewOpen(false)} aria-label="Close report view" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.38rem 0.9rem', borderRadius: 7, fontSize: '0.78rem', fontWeight: 600, background: 'rgba(255,255,255,0.07)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>&#x2715; Close</button>
                    </div>
                </div>

                <div style={{ maxWidth: 920, margin: '0 auto', padding: '2rem 1.5rem 5rem' }}>

                    {/* ── PREMIUM CONTEXT HEADER ── */}
                    <div style={{ background: 'linear-gradient(135deg,#0B1E36 0%,#162d4a 100%)', borderRadius: 14, padding: '2rem 2.25rem', marginBottom: '1.75rem', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#C9A84C,#e6c96e,#C9A84C)' }} />
                        <div style={{ position: 'absolute', right: 28, top: '50%', transform: 'translateY(-50%)', opacity: 0.04, fontSize: '6rem', fontWeight: 900, color: '#fff', pointerEvents: 'none', userSelect: 'none' }}>SLP</div>
                        {/* Zone A — Identity */}
                        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                            <p style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.13em', color: '#C9A84C', margin: '0 0 0.4rem' }}>Second Look Protect · Safeguarding Report</p>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 0.3rem', letterSpacing: '-0.03em', lineHeight: 1.2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{orgName || 'Organisation Report'}</h1>
                            <p style={{ fontSize: '0.88rem', color: '#94a3b8', margin: 0 }}>Monthly Safeguarding Summary · {selectedMonthLabel}</p>
                        </div>
                        {/* Zone B — Metadata grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem 2rem', marginBottom: '1.25rem', position: 'relative' }}>
                            {([
                                { label: 'Reporting Month', value: selectedMonthLabel, color: '#e2e8f0' },
                                { label: 'Reporting Range', value: rvRange, color: '#e2e8f0' },
                                { label: 'Report Status', value: rvStatus, color: rvIsLocked ? '#86efac' : '#fbbf24' },
                                { label: 'Data Source', value: rvDataSource, color: rvIsLocked ? '#93c5fd' : '#a5b4fc' },
                            ] as { label: string; value: string; color: string }[]).map(item => (
                                <div key={item.label}>
                                    <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569', marginBottom: '0.2rem' }}>{item.label}</div>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: item.color }}>{item.value}</div>
                                </div>
                            ))}
                        </div>
                        {/* Zone C — AI context */}
                        <div style={{ position: 'relative', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                                <Sparkles size={12} style={{ color: '#a78bfa' }} />
                                <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a78bfa' }}>AI Report Intelligence</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                                {([
                                    { label: hasAiNarrative ? 'AI Narrative: Generated' : 'AI Narrative: Not yet generated', ok: hasAiNarrative },
                                    { label: `Coverage: ${selectedMonthLabel} case activity`, ok: true },
                                    rvAiFmt ? { label: `Last refreshed: ${rvAiFmt}`, ok: true } : null,
                                    rvIsLocked ? { label: 'Report locked — narrative frozen at approval', ok: false } : null,
                                ] as ({ label: string; ok: boolean } | null)[]).filter(Boolean).map((chip) => (
                                    <span key={chip!.label} style={{ display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.65rem', borderRadius: 99, fontSize: '0.68rem', fontWeight: 600, background: chip!.ok ? 'rgba(124,58,237,0.2)' : 'rgba(71,85,105,0.3)', color: chip!.ok ? '#c4b5fd' : '#94a3b8', border: `1px solid ${chip!.ok ? 'rgba(167,139,250,0.3)' : 'rgba(148,163,184,0.15)'}` }}>{chip!.label}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── INSPECTION READY + KPI STRIP ── */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.28rem 0.75rem', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, background: rvReadyBadge ? '#f0fdf4' : '#fffbeb', border: `1px solid ${rvReadyBadge ? '#bbf7d0' : '#fde68a'}`, color: rvReadyBadge ? '#16a34a' : '#d97706' }}>
                                <CheckCircle2 size={12} />{rvReadyBadge ? 'Inspection Ready' : 'Attention Required'}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{rvReadyBadge ? 'SLA compliance and case review within expected thresholds.' : `${slaOverdueNow} case${slaOverdueNow !== 1 ? 's' : ''} overdue · review required.`}</span>
                        </div>
                        <div className="report-kpi-strip">
                            {([
                                { label: 'Total Cases', value: metrics.total, accent: '#0B1E36' },
                                { label: 'Open Cases', value: openRv, accent: '#d97706' },
                                { label: 'High / Critical', value: metrics.highRisk, accent: '#dc2626' },
                                { label: 'SLA Overdue', value: slaOverdueNow, accent: slaOverdueNow > 0 ? '#dc2626' : '#16a34a' },
                                { label: 'Closure Rate', value: closureRvPct !== null ? `${closureRvPct}%` : '—', accent: closureRvPct !== null && closureRvPct >= 70 ? '#16a34a' : '#C9A84C' },
                            ] as { label: string; value: string | number; accent: string }[]).map(kpi => (
                                <div key={kpi.label} className="report-kpi-box">
                                    <div style={{ height: 3, background: kpi.accent, borderRadius: '4px 4px 0 0', margin: '-1px -1px 0' }} />
                                    <div style={{ padding: '0.85rem 1rem 0.75rem' }}>
                                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.04em', lineHeight: 1 }}>{kpi.value}</div>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.3rem' }}>{kpi.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── EXECUTIVE SUMMARY ── */}
                    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', borderLeft: '4px solid #0B1E36', padding: '1.5rem 1.75rem', marginBottom: '1rem', boxShadow: '0 1px 4px rgba(11,30,54,0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <FileText size={15} style={{ color: aiExecRv ? '#7c3aed' : '#64748b' }} />
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>Executive Summary</span>
                            {aiExecRv && <AiBadgeRv />}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.97rem', color: '#0f172a', lineHeight: 1.8, fontWeight: 450 }}>{execRv}</p>
                    </div>

                    {/* ── INTELLIGENCE & ANALYSIS ── */}
                    <div className="report-section-divider"><span>Intelligence &amp; Analysis</span><span style={{ fontWeight: 400, fontSize: '0.65rem', color: '#94a3b8', marginLeft: '0.6rem', letterSpacing: 0 }}>{selectedMonthLabel} &middot; {dataSourceLabel}</span></div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 390px), 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                        {grid5rv.map(section => {
                            const aiText = goodAiText(aiNarrative?.[section.key as keyof typeof aiNarrative] as string);
                            const text = aiText || fb5[section.key] || '';
                            const isAi = !!aiText;
                            return (
                                <div key={section.key} className="report-narrative-card" style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                    <div style={{ padding: '0.85rem 1rem 0.65rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span style={{ color: isAi ? '#7c3aed' : '#94a3b8', flexShrink: 0, display: 'flex' }}>{section.icon}</span>
                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#374151', flex: 1 }}>{section.title}</span>
                                        {isAi && <AiBadgeRv />}
                                    </div>
                                    <div style={{ padding: '1rem', fontSize: '0.875rem', color: '#334155', lineHeight: 1.75, minHeight: '7rem' }}>
                                        {section.isList ? (
                                            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                {(text || '').split('\n').filter(l => l.trim()).map((line, i) => (
                                                    <li key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                                        <span style={{ color: '#C9A84C', flexShrink: 0, marginTop: 2, fontWeight: 700 }}>›</span>
                                                        <span>{line.replace(/^[-–—•]\s*/, '')}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : <p style={{ margin: 0 }}>{text}</p>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ── INSPECTION & LEADERSHIP ── */}
                    <div className="report-section-divider"><span>Inspection &amp; Leadership</span></div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                        <div style={{ background: '#0B1E36', borderRadius: 10, padding: '1.25rem 1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                                <Lock size={13} style={{ color: '#C9A84C' }} />
                                <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#C9A84C' }}>Inspection Summary</span>
                                {goodAiText(aiNarrative?.inspectionSummary) && <AiBadgeRv />}
                            </div>
                            <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.8, color: '#cbd5e1' }}>{inspRv}</p>
                        </div>
                        <div style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', padding: '1.25rem 1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                                <Building2 size={13} style={{ color: '#0B1E36' }} />
                                <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0B1E36' }}>Leadership Summary</span>
                                {goodAiText(aiNarrative?.leadershipSummary) && <AiBadgeRv />}
                            </div>
                            <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.8, color: '#334155' }}>{leaderRv}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    })();

    return (
        <>
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

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div className="dashboard-reports-month-select">
                                <Calendar size={16} />
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="dashboard-reports-select"
                                    aria-label="Select reporting period"
                                >
                                    {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            {/* Phase 11 — period helper text */}
                            <p style={{ margin: 0, fontSize: '0.67rem', color: '#94a3b8', paddingLeft: '0.2rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                <span>{selectedDateRange}</span>
                                <span style={{ color: isLocked ? '#16a34a' : isCurrentPeriod ? '#C9A84C' : '#64748b', fontWeight: 600 }}>
                                    {isLocked ? '· Snapshot' : isCurrentPeriod ? '· Live' : '· Historical'}
                                </span>
                            </p>
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

                        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                        1. BRANDED REPORT HEADER
                    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                        <div style={{ background: 'linear-gradient(135deg,#0B1E36 0%,#162d4a 100%)', borderRadius: 14, padding: '1.75rem 2rem', marginBottom: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#C9A84C,#e6c96e,#C9A84C)' }} />
                            <div style={{ position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', opacity: 0.04, fontSize: '7rem', fontWeight: 900, color: '#fff', pointerEvents: 'none', userSelect: 'none', letterSpacing: '-0.05em' }}>SLP</div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', position: 'relative' }}>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <p style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#C9A84C', margin: '0 0 0.4rem' }}>Second Look Protect · Safeguarding Report</p>
                                    <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 0.4rem', letterSpacing: '-0.03em', lineHeight: 1.2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{orgName || 'Organisation Report'}</h1>
                                    <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>Monthly Safeguarding Summary · {selectedMonthLabel}</p>
                                    {/* Phase 11 — reporting range + data source */}
                                    <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                                        <div>
                                            <p style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', margin: '0 0 2px' }}>Reporting Range</p>
                                            <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>{selectedDateRange}</p>
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', margin: '0 0 2px' }}>Data Source</p>
                                            <p style={{ fontSize: '0.78rem', fontWeight: 600, color: isLocked ? '#86efac' : '#94a3b8', margin: 0 }}>{dataSourceLabel}</p>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    {reportStatus && (
                                        <span style={{ display: 'inline-block', padding: '0.3rem 0.9rem', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, background: isLocked ? 'rgba(34,197,94,0.15)' : 'rgba(201,168,76,0.15)', color: isLocked ? '#4ade80' : '#C9A84C', border: `1px solid ${isLocked ? 'rgba(34,197,94,0.3)' : 'rgba(201,168,76,0.3)'}`, letterSpacing: '0.03em' }}>
                                            {reportStatus === 'approved' ? '✓ Approved' : reportStatus === 'locked' ? '⊘ Locked' : '✎ Draft'}
                                        </span>
                                    )}
                                    <p style={{ fontSize: '0.68rem', color: '#475569', margin: '0.4rem 0 0', whiteSpace: 'nowrap' }}>
                                        Generated {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* AI error alert */}
                        {aiError && (
                            <div style={{ marginBottom: '1rem', padding: '0.65rem 0.9rem', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', fontSize: '0.8rem', color: '#92400e' }}>
                                {aiError}
                            </div>
                        )}

                        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                        REFRESH AI NARRATIVE PANEL
                        Shown to org_admin / super_admin only, when not in inspection mode
                    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                        {reportId && (userRole === 'org_admin' || userRole === 'super_admin') && !inspectionMode && (() => {
                            const onCooldown = cooldownRemaining > 0;
                            const aiGeneratedAt: string | undefined =
                                reportMetricsSnapshot?.ai_generated_at ?? undefined;
                            const fmtLastRefresh = aiGeneratedAt
                                ? new Date(aiGeneratedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                : null;

                            // Format cooldown as "4m 23s" or "42s"
                            const fmtCooldown = onCooldown
                                ? cooldownRemaining >= 60
                                    ? `${Math.floor(cooldownRemaining / 60)}m ${cooldownRemaining % 60}s`
                                    : `${cooldownRemaining}s`
                                : null;

                            const hasNarrative = !!aiNarrative;

                            return (
                                <div
                                    className="reports-no-print"
                                    style={{
                                        background: '#fafafa',
                                        border: '1px solid #e2e8f0',
                                        borderLeft: '4px solid #5b21b6',
                                        borderRadius: 10,
                                        padding: '1rem 1.25rem',
                                        marginBottom: '1.25rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '1rem',
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    {/* Left — label + context */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                                        <Sparkles size={15} style={{ color: '#5b21b6', flexShrink: 0 }} />
                                        <div>
                                            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', color: '#1e1b4b' }}>
                                                {hasNarrative ? 'Refresh AI Narrative' : 'Generate AI Narrative'}
                                            </p>
                                            <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                                                {regeneratingAi
                                                    ? `Refreshing narrative from ${selectedMonthLabel} case data…`
                                                    : onCooldown
                                                        ? `Available in ${fmtCooldown} — narrative refreshed recently.`
                                                        : hasNarrative
                                                            ? `Narrative informed by ${selectedMonthLabel} case data. Re-run to update.`
                                                            : `Generate AI-informed narrative from ${selectedMonthLabel} case data.`}
                                            </p>
                                            {/* Phase 11 — coverage period */}
                                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.67rem', color: '#94a3b8' }}>
                                                Coverage: {selectedDateRange} &middot; {dataSourceLabel}
                                                {aiLastRefresh && !regeneratingAi ? ` · Last refreshed ${aiLastRefresh}` : ''}
                                            </p>
                                            {fmtLastRefresh && !regeneratingAi && (
                                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.68rem', color: '#94a3b8' }}>
                                                    Last refreshed {fmtLastRefresh}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right — action button */}
                                    <button
                                        type="button"
                                        onClick={handleGenerateAiNarrative}
                                        disabled={regeneratingAi || onCooldown}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            padding: '0.5rem 1.1rem',
                                            borderRadius: 7,
                                            fontSize: '0.82rem',
                                            fontWeight: 600,
                                            border: 'none',
                                            cursor: (regeneratingAi || onCooldown) ? 'not-allowed' : 'pointer',
                                            background: (regeneratingAi || onCooldown) ? '#e2e8f0' : '#5b21b6',
                                            color: (regeneratingAi || onCooldown) ? '#94a3b8' : '#fff',
                                            transition: 'background 0.15s, color 0.15s',
                                            flexShrink: 0,
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {regeneratingAi
                                            ? <><Loader2 size={14} className="dsf-spinner" /> Refreshing…</>
                                            : onCooldown
                                                ? <><RefreshCw size={14} /> Cooling down…</>
                                                : <><Sparkles size={14} /> {hasNarrative ? 'Refresh Narrative' : 'Generate Narrative'}</>}
                                    </button>
                                </div>
                            );
                        })()}

                        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                        2. EXECUTIVE SUMMARY (prominent, full-width)
                    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                        {(() => {
                            const closureRateEs = metrics.total > 0 ? Math.round((metrics.byStatus.closed / metrics.total) * 100) : null;
                            const aiExecText = goodAiText(aiNarrative?.execSummary);
                            const execText = aiExecText || goodAiText(execSummary) || (
                                metrics.total === 0
                                    ? `No cases were submitted during ${selectedMonthLabel}. Safeguarding protocols remained active throughout this period, with no submissions requiring review. This report is available for record and inspection purposes.`
                                    : `${metrics.total} case${metrics.total !== 1 ? 's' : ''} were recorded during ${selectedMonthLabel}.${metrics.highRisk > 0
                                        ? ` ${metrics.highRisk} ${metrics.highRisk !== 1 ? 'were' : 'was'} classified as high or critical risk.`
                                        : ' No high-risk cases were identified during this period.'
                                    }${closureRateEs !== null
                                        ? ` The closure rate for the period was ${closureRateEs}%.`
                                        : ''
                                    }${slaOverdueNow > 0
                                        ? ` ${slaOverdueNow} case${slaOverdueNow !== 1 ? 's remain' : ' remains'} open beyond the standard 3-day review threshold.`
                                        : ''
                                    }`
                            );
                            const isAiExecText = !!aiExecText;
                            return (
                                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', borderLeft: '4px solid #0B1E36', padding: '1.5rem 1.75rem', marginBottom: '1rem', boxShadow: '0 1px 4px rgba(11,30,54,0.06)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                        <FileText size={15} style={{ color: isAiExecText ? '#7c3aed' : '#64748b' }} />
                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>Executive Summary</span>
                                        {isAiExecText && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#7c3aed', background: 'rgba(124,58,237,0.08)', borderRadius: 4, padding: '0.1rem 0.4rem' }}>
                                                <Sparkles size={9} /> AI
                                            </span>
                                        )}
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.97rem', color: '#0f172a', lineHeight: 1.8, fontWeight: 450 }}>
                                        {regeneratingAi ? (
                                            <span style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {[90, 78, 60].map((w, i) => (
                                                    <span key={i} style={{ display: 'block', height: 12, borderRadius: 4, width: `${w}%`, background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'dashboard-shimmer 1.5s infinite linear' }} />
                                                ))}
                                            </span>
                                        ) : execText}
                                    </p>
                                </div>
                            );
                        })()}

                        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                        3. INSPECTION STATUS + KPI STRIP
                    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                        {(() => {
                            const ready = metrics.total === 0 || (metrics.byStatus.closed / metrics.total >= 0.9 && slaOverdueNow === 0);
                            const closureRateKpi = metrics.total > 0 ? Math.round((metrics.byStatus.closed / metrics.total) * 100) : null;
                            const openCount = metrics.byStatus.new + metrics.byStatus.in_review;
                            return (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.28rem 0.75rem', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, background: ready ? '#f0fdf4' : '#fffbeb', border: `1px solid ${ready ? '#bbf7d0' : '#fde68a'}`, color: ready ? '#16a34a' : '#d97706' }}>
                                            <CheckCircle2 size={12} />
                                            {ready ? 'Inspection Ready' : 'Attention Required'}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                            {ready ? 'SLA compliance and case review within expected thresholds.' : `${slaOverdueNow} case${slaOverdueNow !== 1 ? 's' : ''} overdue · review required.`}
                                        </span>
                                    </div>
                                    <div className="report-kpi-strip">
                                        {[
                                            { label: 'Total Cases', value: metrics.total, accent: '#0B1E36' },
                                            { label: 'Open Cases', value: openCount, accent: '#d97706' },
                                            { label: 'High / Critical Risk', value: metrics.highRisk, accent: '#dc2626' },
                                            { label: 'SLA Overdue', value: slaOverdueNow, accent: slaOverdueNow > 0 ? '#dc2626' : '#16a34a' },
                                            { label: 'Closure Rate', value: closureRateKpi !== null ? `${closureRateKpi}%` : '—', accent: closureRateKpi !== null && closureRateKpi >= 70 ? '#16a34a' : '#C9A84C' },
                                        ].map(kpi => (
                                            <div key={kpi.label} className="report-kpi-box">
                                                <div style={{ height: 3, background: kpi.accent, borderRadius: '4px 4px 0 0', margin: '-1px -1px 0' }} />
                                                <div style={{ padding: '0.85rem 1rem 0.75rem' }}>
                                                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.04em', lineHeight: 1 }}>{kpi.value}</div>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.3rem' }}>{kpi.label}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                        4. AI NARRATIVE — 5 SECTION GRID
                    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                        {(() => {
                            const n = aiNarrative;
                            // hasAi: true only when at least one section passes the quality filter
                            const hasAi = !!n && Object.values(n).some(v => !!goodAiText(v as string));
                            const closureRateFb = metrics.total > 0 ? Math.round((metrics.byStatus.closed / metrics.total) * 100) : null;
                            const AiBadge = () => (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#7c3aed', background: 'rgba(124,58,237,0.08)', borderRadius: 4, padding: '0.1rem 0.4rem', marginLeft: 'auto', flexShrink: 0 }}>
                                    <Sparkles size={9} /> AI
                                </span>
                            );
                            const Skeleton = () => (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0.25rem 0' }}>
                                    {[85, 95, 70].map((w, i) => (
                                        <div key={i} style={{ height: 11, borderRadius: 4, width: `${w}%`, background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'dashboard-shimmer 1.5s infinite linear' }} />
                                    ))}
                                </div>
                            );
                            // Deterministic fallbacks — calm, professional, non-apologetic
                            const hasPrevComparison = prevMonthMetrics?.total != null;
                            const fb = {
                                safeguardingTrends: goodAiText(keyTrends
                                    ? keyTrends.split('\n').filter(l => l.trim()).join(' ')
                                    : null) ??
                                    (metrics.total === 0
                                        ? `No submissions were recorded during ${selectedMonthLabel}. Historic comparison data will become available as further reporting periods are recorded.`
                                        : hasPrevComparison
                                            ? `${metrics.total} case${metrics.total !== 1 ? 's' : ''} were recorded during ${selectedMonthLabel}, compared with ${prevMonthMetrics!.total} in the previous period.`
                                            : `${metrics.total} case${metrics.total !== 1 ? 's' : ''} were recorded during ${selectedMonthLabel}. Historic comparison data is still building for this organisation — comparative trend confidence will increase as further periods are recorded.`),
                                emergingRisks: metrics.highRisk > 0
                                    ? `${metrics.highRisk} case${metrics.highRisk !== 1 ? 's' : ''} were classified as high or critical risk during ${selectedMonthLabel}${metrics.categories[0]
                                        ? `, with ${metrics.categories[0][0].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} as the most frequently recorded concern category`
                                        : ''
                                    }. These cases are recommended for priority review.`
                                    : metrics.total === 0
                                        ? 'No cases were submitted during this period, so no elevated risk signals were present.'
                                        : 'No high or critical risk cases were recorded during this period — a positive indicator for the organisation.',
                                operationalPressure: metrics.total === 0
                                    ? 'No active cases were recorded during this period, so no operational pressure metrics apply.'
                                    : `Average time to first review: ${metrics.avgReview}. Average time to close: ${metrics.avgClose}.${slaOverdueNow > 0
                                        ? ` ${slaOverdueNow} case${slaOverdueNow !== 1 ? 's remain' : ' remains'} open beyond the standard 3-day review threshold and should be progressed promptly.`
                                        : ' All cases are within SLA thresholds, reflecting sustained operational throughput.'
                                    }`,
                                positiveSignals: metrics.total === 0
                                    ? `No safeguarding cases were submitted during ${selectedMonthLabel}. This may reflect a quiet period or effective early intervention within the organisation.`
                                    : closureRateFb !== null && closureRateFb >= 60
                                        ? `${closureRateFb}% of cases recorded during this period were closed, reflecting strong case review throughput and effective team response.`
                                        : metrics.highRisk === 0
                                            ? 'No high or critical risk cases were reported during this period, which is a positive indicator of a well-managed safeguarding environment.'
                                            : 'Case processing continued within normal operational parameters during this period.',
                                // Only use hardcoded default if no saved recommendations exist
                                recommendedActions: recommendations || '- Ensure all open cases are reviewed and progressed promptly.\n- Confirm SLA compliance across all active cases.\n- Review any high-risk cases with the safeguarding lead.',
                            };
                            type Grid5 = { key: keyof AiNarrative; title: string; icon: React.ReactNode; isList?: boolean };
                            const grid5: Grid5[] = [
                                { key: 'safeguardingTrends', title: 'Safeguarding Trends', icon: <TrendingUp size={14} /> },
                                { key: 'emergingRisks', title: 'Emerging Risks', icon: <ShieldAlert size={14} /> },
                                { key: 'operationalPressure', title: 'Operational Pressure', icon: <Clock size={14} /> },
                                { key: 'positiveSignals', title: 'Positive Signals', icon: <CheckCircle2 size={14} /> },
                                { key: 'scamThemeInsight', title: 'Scam-Theme Intelligence', icon: <ShieldAlert size={14} />, accentColor: '#d97706' },
                                { key: 'defensiveRecommendations', title: 'Defensive Recommendations', icon: <ClipboardList size={14} />, isList: true, accentColor: '#0B1E36' },
                                { key: 'recommendedActions', title: 'Recommended Actions', icon: <ClipboardList size={14} />, isList: true },
                            ];
                            const canGenerateAi = userRole === 'org_admin' || userRole === 'super_admin' || userRole === 'safeguarding_lead';
                            return (
                                <>
                                    <div className="report-section-divider"><span>Intelligence &amp; Analysis</span></div>
                                    {!hasAi && !regeneratingAi && reportId && canGenerateAi && (
                                        <div style={{ marginBottom: '1rem', padding: '0.85rem 1.1rem', borderRadius: 10, border: '1px dashed #c4b5fd', background: 'rgba(124,58,237,0.03)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <Sparkles size={18} style={{ color: '#7c3aed', flexShrink: 0 }} />
                                            <div>
                                                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#5b21b6' }}>AI-enhanced narrative available</p>
                                                <p style={{ margin: '0.1rem 0 0', fontSize: '0.78rem', color: '#7c3aed' }}>Use the &ldquo;Generate AI Narrative&rdquo; button below to produce polished, insight-led sections from this period&apos;s data. Structured summaries are shown below in the meantime.</p>
                                            </div>
                                        </div>
                                    )}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 390px), 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                                        {grid5.map(section => {
                                            const aiText = goodAiText(n?.[section.key] as string);
                                            const text = aiText || fb[section.key as keyof typeof fb] || '';
                                            const isAiText = !!aiText;
                                            return (
                                                <div key={section.key} className="report-narrative-card" style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                                    <div style={{ padding: '0.85rem 1rem 0.65rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <span style={{ color: isAiText ? '#7c3aed' : '#94a3b8', flexShrink: 0, display: 'flex' }}>{section.icon}</span>
                                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#374151', flex: 1 }}>{section.title}</span>
                                                        {isAiText && <AiBadge />}
                                                    </div>
                                                    <div style={{ padding: '1rem', fontSize: '0.875rem', color: '#334155', lineHeight: 1.75, minHeight: '7rem' }}>
                                                        {regeneratingAi ? <Skeleton /> : (
                                                            section.isList ? (
                                                                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
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

                        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                        5. INSPECTION + LEADERSHIP CLOSER
                    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                        <div className="report-section-divider"><span>Inspection &amp; Leadership</span></div>
                        {(() => {
                            const n = aiNarrative;
                            const inspText = goodAiText(n?.inspectionSummary) ||
                                'This report has been prepared in accordance with safeguarding reporting standards. All case records, review timelines, decisions, and supporting evidence are available for inspection purposes. Data is organisation-scoped and access-controlled throughout.';
                            const leaderText = goodAiText(n?.leadershipSummary) || (
                                metrics.total === 0
                                    ? `No safeguarding cases were recorded during ${selectedMonthLabel}. No escalation or immediate leadership action is required for this period. The organisation maintained normal safeguarding oversight throughout.`
                                    : metrics.highRisk > 0
                                        ? `${metrics.total} case${metrics.total !== 1 ? 's' : ''} were managed during ${selectedMonthLabel}, including ${metrics.highRisk} classified as high or critical risk. Leadership review of high-risk cases is recommended before this report is finalised.`
                                        : `${metrics.total} case${metrics.total !== 1 ? 's' : ''} were managed during ${selectedMonthLabel}. No high-risk cases were identified, and case review throughput remained within expected parameters. No immediate leadership escalation is required.`
                            );
                            const hasAiCloser = !!(goodAiText(n?.inspectionSummary) || goodAiText(n?.leadershipSummary));
                            const AiBadge = () => (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#7c3aed', background: 'rgba(124,58,237,0.08)', borderRadius: 4, padding: '0.1rem 0.4rem' }}>
                                    <Sparkles size={9} /> AI
                                </span>
                            );
                            return (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                                    <div style={{ background: '#0B1E36', borderRadius: 10, padding: '1.25rem 1.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                                            <Lock size={13} style={{ color: '#C9A84C' }} />
                                            <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#C9A84C' }}>Inspection Summary</span>
                                            {hasAiCloser && n?.inspectionSummary && <AiBadge />}
                                        </div>
                                        {regeneratingAi ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {[90, 75, 85].map((w, i) => (
                                                    <div key={i} style={{ height: 11, borderRadius: 4, width: `${w}%`, background: 'linear-gradient(90deg,rgba(255,255,255,0.1) 25%,rgba(255,255,255,0.2) 50%,rgba(255,255,255,0.1) 75%)', backgroundSize: '200% 100%', animation: 'dashboard-shimmer 1.5s infinite linear' }} />
                                                ))}
                                            </div>
                                        ) : <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.8, color: '#cbd5e1' }}>{inspText}</p>}
                                    </div>
                                    <div style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', padding: '1.25rem 1.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                                            <Building2 size={13} style={{ color: '#0B1E36' }} />
                                            <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0B1E36' }}>Leadership Summary</span>
                                            {hasAiCloser && n?.leadershipSummary && <AiBadge />}
                                        </div>
                                        {regeneratingAi ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {[85, 95, 70].map((w, i) => (
                                                    <div key={i} style={{ height: 11, borderRadius: 4, width: `${w}%`, background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'dashboard-shimmer 1.5s infinite linear' }} />
                                                ))}
                                            </div>
                                        ) : <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.8, color: '#334155' }}>{leaderText}</p>}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                        6. SUPPORTING DATA APPENDIX
                    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                        <div className="report-section-divider"><span>Supporting Detail</span></div>

                        {/* Secondary metrics chips — only shown when there is actual case volume */}
                        {metrics.total > 0 && (
                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                                {[
                                    { label: 'New', value: metrics.byStatus.new, col: '#3b82f6' },
                                    { label: 'In Review', value: metrics.byStatus.in_review, col: '#d97706' },
                                    { label: 'Closed', value: metrics.byStatus.closed, col: '#16a34a' },
                                    { label: 'Review Time', value: metrics.avgReview, col: '#7c3aed' },
                                    { label: 'Close Time', value: metrics.avgClose, col: '#0891b2' },
                                    { label: 'Scam Confirmed', value: metrics.scamConfirmed, col: '#be185d' },
                                ].map(m => (
                                    <div key={m.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.5rem 0.85rem', minWidth: 90, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: m.col, letterSpacing: '-0.02em' }}>{m.value}</div>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{m.label}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Data table breakdowns — only rendered when there is data to show */}
                        {(() => {
                            const hasCategories = metrics.categories.length > 0;
                            const hasChannels = metrics.channels.length > 0;
                            const hasRisk = Object.keys(metrics.riskMap).length > 0;
                            const hasDecisions = metrics.decisions.length > 0;
                            const hasAnyData = hasCategories || hasChannels || hasRisk || hasDecisions;

                            if (!hasAnyData) {
                                // Sparse/quiet period — show a calm note instead of empty shell panels
                                return (
                                    <div style={{ padding: '1.25rem 1.5rem', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                        <BarChart3 size={16} style={{ color: '#94a3b8', flexShrink: 0, marginTop: 2 }} />
                                        <p style={{ margin: 0 }}>
                                            No detailed breakdown data is available for {selectedMonthLabel}. Breakdown tables will populate as case data is recorded for this reporting period.
                                        </p>
                                    </div>
                                );
                            }

                            return (
                                <>
                                    {(hasCategories || hasChannels) && (
                                        <div className="dashboard-reports-breakdowns" style={{ marginBottom: '0.75rem' }}>
                                            {hasCategories && (
                                                <div className="dashboard-panel">
                                                    <div className="dashboard-panel-header">
                                                        <h2 className="dashboard-panel-title"><PieChart size={14} className="dashboard-panel-title-icon" /> Top Categories</h2>
                                                    </div>
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
                                                </div>
                                            )}
                                            {hasChannels && (
                                                <div className="dashboard-panel">
                                                    <div className="dashboard-panel-header">
                                                        <h2 className="dashboard-panel-title"><Activity size={14} className="dashboard-panel-title-icon" /> Submission Channels</h2>
                                                    </div>
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
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {(hasRisk || hasDecisions) && (
                                        <div className="dashboard-reports-breakdowns" style={{ marginBottom: '1.5rem' }}>
                                            {hasRisk && (
                                                <div className="dashboard-panel">
                                                    <div className="dashboard-panel-header">
                                                        <h2 className="dashboard-panel-title"><ShieldAlert size={14} className="dashboard-panel-title-icon" /> Risk Distribution</h2>
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
                                            )}
                                            {hasDecisions && (
                                                <div className="dashboard-panel">
                                                    <div className="dashboard-panel-header">
                                                        <h2 className="dashboard-panel-title"><CheckCircle2 size={14} className="dashboard-panel-title-icon" /> Decisions</h2>
                                                    </div>
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
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            );
                        })()}


                        {/* Phase 11 — Period Context Strip */}
                        <div className="reports-no-print" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', padding: '0.5rem 0.25rem 0.25rem', borderTop: '1px solid #f1f5f9', marginTop: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <Calendar size={11} style={{ color: '#94a3b8' }} />
                                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b' }}>{selectedMonthLabel}</span>
                                <span style={{ fontSize: '0.67rem', color: '#94a3b8' }}>· {selectedDateRange}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                {isLocked
                                    ? <Lock size={10} style={{ color: '#16a34a' }} />
                                    : <FileText size={10} style={{ color: '#C9A84C' }} />}
                                <span style={{ fontSize: '0.67rem', fontWeight: 600, color: isLocked ? '#16a34a' : '#d97706' }}>
                                    {statusLabelFull ?? dataSourceLabel}
                                </span>
                            </div>
                            <span style={{ fontSize: '0.67rem', color: '#94a3b8' }}>
                                {isLocked ? 'Frozen snapshot — inspection integrity preserved' : isCurrentPeriod ? 'Live data — reflects current submissions' : 'Historical period — read only'}
                            </span>
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
                            {/* Generate / Refresh AI Narrative — org_admin + super_admin only — compact secondary shortcut */}
                            {reportId && (userRole === 'org_admin' || userRole === 'super_admin') && !inspectionMode && (() => {
                                const onCooldown = cooldownRemaining > 0;
                                return (
                                    <button
                                        type="button"
                                        className="dashboard-reports-action-btn"
                                        onClick={handleGenerateAiNarrative}
                                        disabled={regeneratingAi || onCooldown}
                                        title={onCooldown ? `Refresh available in ${cooldownRemaining}s` : 'Refresh AI Narrative'}
                                        style={{ background: '#5b21b6', color: '#fff', minWidth: 148, gap: '0.4rem', opacity: onCooldown ? 0.55 : 1 }}
                                    >
                                        {regeneratingAi
                                            ? <><Loader2 size={15} className="dsf-spinner" /> Refreshing…</>
                                            : onCooldown
                                                ? <><RefreshCw size={15} /> In cooldown</>
                                                : <><Sparkles size={15} /> Refresh Narrative</>}
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

                            {/* B) Draft + PDF exists → Approve Report (View Report is universal button below) */}
                            {reportStatus === 'draft' && reportPdfUrl && userRole !== 'read_only' && (
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

                            {/* View Report — premium on-screen viewer, replaces legacy Open PDF — Phase 8 */}
                            {reportId && (
                                <button
                                    type="button"
                                    className="dashboard-reports-action-btn"
                                    onClick={() => setReportViewOpen(true)}
                                    aria-label="View premium report"
                                    title="View the premium report in a full-screen overlay"
                                    style={{ gap: '0.4rem' }}
                                >
                                    <Eye size={16} /> View Report
                                </button>
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

            {reportViewOpen && rvOverlay}
        </>
    );
}
