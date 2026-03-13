/* ═══════════════════════════════════════════════════════════════════════════
   Stape-Lee — Page Context Hook
   ═══════════════════════════════════════════════════════════════════════════
   Derives structured context from the current dashboard route so Stape-Lee
   can give page-aware answers.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useMemo } from 'react';
import { pageGuides } from './stapeLeeKnowledge';

export interface PageContext {
    /** Human-readable page name, e.g. "Safeguarding Overview" */
    pageName: string;
    /** Raw route segment, e.g. "cases/abc-123" */
    pageRoute: string;
    /** Case ID if currently viewing a case detail page */
    caseId: string | null;
    /** Top-level section key matching pageGuides, e.g. "overview" */
    section: string;
    /** Whether this is a super-admin-only route */
    isSuperAdminRoute: boolean;
}

const SUPER_ADMIN_ROUTES = new Set([
    'platform', 'organisations', 'global-queue', 'global-search', 'billing',
    'group-dashboard', 'group-high-risk', 'group-activity', 'group-intel',
    'group-monthly', 'group-benchmark', 'group-trends', 'group-residents',
    'group-response', 'group-pressure', 'group-alerts',
]);

/**
 * Given the current dashboard path, returns structured page context.
 * Designed to be used by the Stape-Lee chat component.
 */
export function usePageContext(currentPath: string): PageContext {
    return useMemo(() => {
        // Strip /dashboard prefix and leading slash
        const segments = currentPath.replace('/dashboard', '').replace(/^\//, '') || 'overview';
        const parts = segments.split('/');
        const topSegment = parts[0];
        const subSegment = parts[1] || null;

        // Determine if we're on a case detail page
        const caseId = topSegment === 'cases' && subSegment ? subSegment : null;

        // Look up the page guide — case detail has a special key
        const guideKey = caseId ? 'cases/detail' : topSegment;
        const guide = pageGuides[guideKey];

        const pageName = guide?.name ?? formatSegment(topSegment);
        const isSuperAdminRoute = SUPER_ADMIN_ROUTES.has(topSegment);

        return {
            pageName,
            pageRoute: segments,
            caseId,
            section: guideKey,
            isSuperAdminRoute,
        };
    }, [currentPath]);
}

/** Title-case a route segment for display: "review-queue" → "Review Queue" */
function formatSegment(s: string): string {
    return s
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}
