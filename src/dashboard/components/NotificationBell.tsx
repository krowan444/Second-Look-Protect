import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell } from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

interface Notification {
    id: string;
    type: string;
    case_id: string | null;
    message: string;
    read: boolean;
    created_at: string;
}

interface NotificationBellProps {
    userId: string;
    onNavigate: (path: string) => void;
}

export function NotificationBell({ userId, onNavigate }: NotificationBellProps) {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [clearingAll, setClearingAll] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    /* ── Fetch notifications ─────────────────────────────────────────────── */
    const fetchNotifications = useCallback(async () => {
        console.log('[SLP] NotificationBell received userId:', userId);
        try {
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from('notifications')
                .select('id, type, case_id, message, read, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) { console.error('[SLP] Notification fetch error:', error); return; }

            const items = (data ?? []) as Notification[];
            console.log('[SLP] Notifications loaded:', items.length, items);
            setNotifications(items);
            setUnreadCount(items.filter(n => !n.read).length);
        } catch (err) {
            console.error('[SLP] Notification fetch exception:', err);
        }
    }, [userId]);

    /* ── Poll periodically ───────────────────────────────────────────────── */
    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30_000); // every 30s
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    /* ── Close dropdown on outside click ──────────────────────────────── */
    useEffect(() => {
        if (!open) return;
        function handleClick(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    /* ── Close dropdown on Escape ─────────────────────────────────────── */
    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setOpen(false);
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    /* ── Mark as read + navigate ──────────────────────────────────────── */
    async function handleClick(notif: Notification) {
        if (!notif.read) {
            try {
                const supabase = getSupabase();
                await supabase
                    .from('notifications')
                    .update({ read: true })
                    .eq('id', notif.id);

                setNotifications(prev =>
                    prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
                );
                setUnreadCount(prev => Math.max(0, prev - 1));
            } catch (err) {
                console.error('[SLP] Mark-read error:', err);
            }
        }

        setOpen(false);

        if (notif.case_id) {
            onNavigate(`/dashboard/cases/${notif.case_id}`);
        }
    }

    /* ── Clear all notifications (mark all as read) ───────────────────── */
    async function handleClearAll() {
        if (clearingAll || unreadCount === 0) return;
        setClearingAll(true);
        try {
            const supabase = getSupabase();
            await supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', userId)
                .eq('read', false);

            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('[SLP] Clear-all error:', err);
        } finally {
            setClearingAll(false);
        }
    }

    /* ── Time formatting ─────────────────────────────────────────────── */
    function timeAgo(dateStr: string): string {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60_000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    return (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
            {/* Bell button */}
            <button
                onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
                aria-label="Notifications"
                style={{
                    position: 'relative',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '6px',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span
                        style={{
                            position: 'absolute',
                            top: '2px',
                            right: '1px',
                            minWidth: '16px',
                            height: '16px',
                            borderRadius: '9999px',
                            backgroundColor: '#ef4444',
                            color: '#fff',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 4px',
                            lineHeight: 1,
                        }}
                    >
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        width: '340px',
                        maxHeight: '420px',
                        overflowY: 'auto',
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                        zIndex: 50,
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            padding: '0.75rem 1rem',
                            borderBottom: '1px solid #f1f5f9',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            color: '#1e293b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <span>Notifications</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            {unreadCount > 0 && (
                                <span style={{
                                    fontSize: '0.7rem',
                                    color: '#64748b',
                                    fontWeight: 500,
                                }}>
                                    {unreadCount} unread
                                </span>
                            )}
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleClearAll}
                                    disabled={clearingAll}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: clearingAll ? 'default' : 'pointer',
                                        fontSize: '0.7rem',
                                        color: clearingAll ? '#94a3b8' : '#C9A84C',
                                        fontWeight: 500,
                                        padding: '2px 0',
                                        opacity: clearingAll ? 0.6 : 1,
                                        transition: 'opacity 0.15s',
                                    }}
                                >
                                    {clearingAll ? 'Clearing…' : 'Clear all'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* List */}
                    {notifications.length === 0 ? (
                        <div style={{
                            padding: '2rem 1rem',
                            textAlign: 'center',
                            color: '#94a3b8',
                            fontSize: '0.82rem',
                        }}>
                            No notifications yet
                        </div>
                    ) : (
                        notifications.map(notif => (
                            <button
                                key={notif.id}
                                onClick={() => handleClick(notif)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '0.6rem',
                                    width: '100%',
                                    padding: '0.65rem 1rem',
                                    border: 'none',
                                    borderBottom: '1px solid #f8fafc',
                                    background: notif.read ? '#fff' : '#fffbeb',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'background-color 0.12s',
                                    fontSize: '0.82rem',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; setHoveredId(notif.id); }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = notif.read ? '#fff' : '#fffbeb'; setHoveredId(null); }}
                            >
                                {/* Unread dot */}
                                <div style={{
                                    width: '7px',
                                    height: '7px',
                                    borderRadius: '50%',
                                    backgroundColor: notif.read ? 'transparent' : '#C9A84C',
                                    flexShrink: 0,
                                    marginTop: '5px',
                                }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        color: '#1e293b',
                                        fontWeight: notif.read ? 400 : 500,
                                        lineHeight: 1.4,
                                        overflow: 'hidden',
                                        textOverflow: hoveredId === notif.id ? 'clip' : 'ellipsis',
                                        whiteSpace: hoveredId === notif.id ? 'normal' : 'nowrap',
                                        transition: 'all 0.15s ease',
                                    }}>
                                        {notif.message}
                                    </div>
                                    <div style={{
                                        color: '#94a3b8',
                                        fontSize: '0.72rem',
                                        marginTop: '2px',
                                    }}>
                                        {timeAgo(notif.created_at)}
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
