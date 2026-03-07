import { useState, useCallback } from 'react';

const STORAGE_KEY = 'slp_group_home_filter';

/**
 * Shared hook for persisting the selected home filter across group pages.
 * Returns [selectedHomeId, setSelectedHomeId].
 * null = "All Homes".
 */
export function useGroupHomeFilter(): [string | null, (id: string | null) => void] {
    const [homeId, setHomeIdState] = useState<string | null>(() => {
        try { return localStorage.getItem(STORAGE_KEY) || null; } catch { return null; }
    });

    const setHomeId = useCallback((id: string | null) => {
        try {
            if (id) localStorage.setItem(STORAGE_KEY, id);
            else localStorage.removeItem(STORAGE_KEY);
        } catch { /* noop */ }
        setHomeIdState(id);
    }, []);

    return [homeId, setHomeId];
}

/** Navigate within the SPA dashboard without a full page reload. */
export function groupNavigate(path: string) {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
}
