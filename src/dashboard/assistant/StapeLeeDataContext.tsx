/* ═══════════════════════════════════════════════════════════════════════════
   Stape-Lee — Live Page Data Context
   ═══════════════════════════════════════════════════════════════════════════
   Allows dashboard pages to publish structured data snapshots so Stape-Lee
   can give grounded, data-aware answers about the current page.
   ═══════════════════════════════════════════════════════════════════════════ */

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

/* ── Snapshot shape ──────────────────────────────────────────────────────── */

export interface KpiItem {
    label: string;
    value: string | number;
    /** Optional status hint: 'good' | 'warn' | 'danger' | 'neutral' */
    status?: string;
}

export interface AlertItem {
    severity: string;
    title: string;
    description?: string;
}

export interface TableRowSummary {
    /** e.g. home name, category name */
    label: string;
    [key: string]: string | number | null | undefined;
}

export interface PageDataSnapshot {
    /** Which page published this data (section key) */
    section: string;
    /** Timestamp of the snapshot */
    updatedAt: number;
    /** Optional org/group name context */
    organisationName?: string;
    /** Active filters or date range label */
    activeFilters?: string;

    /** KPI values currently shown on the page */
    kpis?: KpiItem[];
    /** Executive alerts or alert summaries */
    alerts?: AlertItem[];
    /** Summarised table rows (top N) */
    tableRows?: TableRowSummary[];
    /** Chart or section titles */
    chartTitles?: string[];
    /** Free-form insights or status text */
    insights?: string[];
    /** Any extra structured data pages want to share */
    extra?: Record<string, any>;
}

/* ── Context ───────────────────────────────────────────────────────────── */

interface StapeLeeDataCtx {
    snapshot: PageDataSnapshot | null;
    publish: (data: PageDataSnapshot) => void;
    clear: () => void;
}

const DataContext = createContext<StapeLeeDataCtx>({
    snapshot: null,
    publish: () => {},
    clear: () => {},
});

/* ── Provider ──────────────────────────────────────────────────────────── */

export function StapeLeeDataProvider({ children }: { children: ReactNode }) {
    const [snapshot, setSnapshot] = useState<PageDataSnapshot | null>(null);

    const publish = useCallback((data: PageDataSnapshot) => {
        setSnapshot({ ...data, updatedAt: Date.now() });
    }, []);

    const clear = useCallback(() => setSnapshot(null), []);

    return (
        <DataContext.Provider value={{ snapshot, publish, clear }}>
            {children}
        </DataContext.Provider>
    );
}

/* ── Hooks ──────────────────────────────────────────────────────────────── */

/** Used by pages to publish their live data. */
export function usePublishPageData() {
    const { publish, clear } = useContext(DataContext);
    return { publishPageData: publish, clearPageData: clear };
}

/** Used by StapeLeeChat to read the current page data. */
export function usePageDataSnapshot(): PageDataSnapshot | null {
    return useContext(DataContext).snapshot;
}
