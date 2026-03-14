/* ═══════════════════════════════════════════════════════════════════════════
   Stape-Lee — Premium Right-Edge Assistant Panel
   ═══════════════════════════════════════════════════════════════════════════
   A branded, context-aware assistant docked to the right edge of the
   dashboard. Features clickable recommendation chips, guided feedback flow,
   session memory, progressive reply rendering, and resizable panel.
   ═══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';
import { usePageContext } from './usePageContext';
import { askStapeLee, SessionMemory } from './stapeLeeBrain';
import { pageGuides } from './stapeLeeKnowledge';

/* ── Types ────────────────────────────────────────────────────────────────── */

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: number;
    streaming?: boolean;
    chips?: string[];
    showFeedbackButtons?: boolean;
}

interface FeedbackDraft {
    category: string;
    page: string;
    description: string;
    priority: string;
}

interface Props {
    currentPath: string;
}

/* ── Constants ────────────────────────────────────────────────────────────── */

const MIN_PANEL_WIDTH = 260;
const MAX_PANEL_WIDTH = 600;
const DEFAULT_PANEL_WIDTH = 340;
const STORAGE_KEY = 'stapeLee_panelWidth';

/* ── Stapler Character SVG ───────────────────────────────────────────────── */

function StaplerIcon({ size = 28 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="38" width="48" height="10" rx="4" fill="#475569" />
            <rect x="10" y="40" width="44" height="6" rx="3" fill="#64748b" />
            <path d="M12 38 L12 26 Q12 22 16 22 L52 22 Q56 22 56 26 L56 38" fill="#1e293b" />
            <path d="M14 36 L14 27 Q14 24 17 24 L53 24 Q55 24 55 27 L55 36" fill="#334155" />
            <circle cx="12" cy="38" r="3.5" fill="#0f172a" />
            <circle cx="12" cy="38" r="2" fill="#475569" />
            <ellipse cx="30" cy="30" rx="3.5" ry="4" fill="white" />
            <ellipse cx="42" cy="30" rx="3.5" ry="4" fill="white" />
            <ellipse cx="31" cy="31" rx="1.8" ry="2.2" fill="#0f172a" />
            <ellipse cx="43" cy="31" rx="1.8" ry="2.2" fill="#0f172a" />
            <circle cx="29.5" cy="29" r="1" fill="white" opacity="0.9" />
            <circle cx="41.5" cy="29" r="1" fill="white" opacity="0.9" />
            <path d="M33 35 Q36 37.5 39 35" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <rect x="22" y="42" width="20" height="2" rx="1" fill="#334155" />
        </svg>
    );
}

function StaplerIconSmall() {
    return (
        <svg width="18" height="18" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="38" width="48" height="10" rx="4" fill="#cbd5e1" />
            <path d="M12 38 L12 26 Q12 22 16 22 L52 22 Q56 22 56 26 L56 38" fill="#f1f5f9" />
            <circle cx="12" cy="38" r="3" fill="#94a3b8" />
            <ellipse cx="30" cy="30" rx="3" ry="3.5" fill="white" />
            <ellipse cx="42" cy="30" rx="3" ry="3.5" fill="white" />
            <ellipse cx="31" cy="31" rx="1.5" ry="2" fill="#334155" />
            <ellipse cx="43" cy="31" rx="1.5" ry="2" fill="#334155" />
        </svg>
    );
}

/* ── Typing indicator ────────────────────────────────────────────────────── */

function TypingDots() {
    return (
        <div style={{
            alignSelf: 'flex-start',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.6rem 0.85rem',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px 14px 14px 4px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        }}>
            <StaplerIconSmall />
            <div style={{ display: 'flex', gap: '3px', paddingLeft: '2px' }}>
                {[0, 1, 2].map(i => (
                    <span key={i} style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        background: '#94a3b8',
                        animation: `stapeleeDot 1.2s ease-in-out ${i * 0.15}s infinite`,
                    }} />
                ))}
            </div>
        </div>
    );
}

/* ── Progressive text renderer ───────────────────────────────────────────── */

function ProgressiveText({ text, onComplete }: { text: string; onComplete: () => void }) {
    const [chars, setChars] = useState(0);
    const completeRef = useRef(onComplete);
    completeRef.current = onComplete;

    useEffect(() => {
        setChars(0);
        const total = text.length;
        const baseSpeed = 12;
        let frame: number;
        let current = 0;

        const tick = () => {
            const chunkSize = current > 120 ? 4 : current > 80 ? 3 : current > 40 ? 2 : 1;
            current = Math.min(current + chunkSize, total);
            setChars(current);
            if (current < total) {
                frame = window.setTimeout(tick, baseSpeed);
            } else {
                completeRef.current();
            }
        };

        frame = window.setTimeout(tick, 60);
        return () => clearTimeout(frame);
    }, [text]);

    const visible = text.slice(0, chars);
    return <>{renderMarkdownLight(visible)}{chars < text.length && <span style={{ opacity: 0.4 }}>▍</span>}</>;
}

/* ── Recommendation Chips ────────────────────────────────────────────────── */

function RecommendationChips({ chips, onSelect, disabled }: { chips: string[]; onSelect: (chip: string) => void; disabled?: boolean }) {
    if (!chips || chips.length === 0) return null;
    return (
        <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '5px',
            marginTop: '6px',
            paddingLeft: '2px',
        }}>
            {chips.map((chip, i) => (
                <button
                    key={i}
                    onClick={() => !disabled && onSelect(chip)}
                    disabled={disabled}
                    style={{
                        padding: '4px 10px',
                        fontSize: '0.68rem',
                        fontWeight: 500,
                        background: disabled ? '#f1f5f9' : '#f1f5f9',
                        color: disabled ? '#94a3b8' : '#475569',
                        border: '1px solid #e2e8f0',
                        borderRadius: '14px',
                        cursor: disabled ? 'default' : 'pointer',
                        transition: 'all 0.15s ease',
                        lineHeight: 1.3,
                        whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => {
                        if (!disabled) {
                            e.currentTarget.style.background = '#e2e8f0';
                            e.currentTarget.style.color = '#1e293b';
                            e.currentTarget.style.borderColor = '#cbd5e1';
                        }
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = '#f1f5f9';
                        e.currentTarget.style.color = disabled ? '#94a3b8' : '#475569';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                    }}
                >
                    {chip}
                </button>
            ))}
        </div>
    );
}

/* ── Feedback Action Buttons ─────────────────────────────────────────────── */

function FeedbackButtons({ onSend, onDiscard, sending }: { onSend: () => void; onDiscard: () => void; sending: boolean }) {
    return (
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            <button
                onClick={onSend}
                disabled={sending}
                style={{
                    flex: 1,
                    padding: '7px 12px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    background: sending ? '#94a3b8' : 'linear-gradient(135deg, #059669, #10b981)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: sending ? 'default' : 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                }}
            >
                <Send size={12} />
                {sending ? 'Sending…' : '✓ Send Feedback'}
            </button>
            <button
                onClick={onDiscard}
                disabled={sending}
                style={{
                    padding: '7px 12px',
                    fontSize: '0.72rem',
                    fontWeight: 500,
                    background: '#f1f5f9',
                    color: '#64748b',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    cursor: sending ? 'default' : 'pointer',
                    transition: 'all 0.15s',
                }}
            >
                ✗ Discard
            </button>
        </div>
    );
}

/* ── Slide animation keyframes ───────────────────────────────────────────── */

const SLIDE_STYLES = `
    @keyframes stapeleeDot {
        0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
        30% { opacity: 1; transform: translateY(-3px); }
    }
    @keyframes stapeleeSlideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes stapeleeTabPulse {
        0%, 100% { box-shadow: -1px 1px 6px rgba(0,0,0,0.06); }
        50% { box-shadow: -1px 1px 10px rgba(30,41,59,0.12); }
    }
`;

/* ── Component ───────────────────────────────────────────────────────────── */

export function StapeLeeChat({ currentPath }: Props) {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [feedbackMode, setFeedbackMode] = useState(false);
    const [feedbackDraft, setFeedbackDraft] = useState<FeedbackDraft | null>(null);
    const [feedbackSending, setFeedbackSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const sessionMemory = useRef(new SessionMemory());

    /* ── Panel width (resizable, persisted) ──────────────────────────── */
    const [panelWidth, setPanelWidth] = useState(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            const w = stored ? parseInt(stored, 10) : DEFAULT_PANEL_WIDTH;
            return (w >= MIN_PANEL_WIDTH && w <= MAX_PANEL_WIDTH) ? w : DEFAULT_PANEL_WIDTH;
        } catch { return DEFAULT_PANEL_WIDTH; }
    });
    const isDragging = useRef(false);

    const ctx = usePageContext(currentPath);

    /* ── Persist panel width ─────────────────────────────────────────── */
    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, String(panelWidth)); } catch { /* noop */ }
    }, [panelWidth]);

    /* ── Auto-scroll on new message / streaming ──────────────────────── */
    useEffect(() => {
        if (scrollRef.current) {
            requestAnimationFrame(() => {
                if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            });
        }
    }, [messages, isThinking]);

    /* ── Focus input when opened ─────────────────────────────────────── */
    useEffect(() => {
        if (open && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 200);
        }
    }, [open]);

    /* ── Resize handlers ─────────────────────────────────────────────── */
    const startResize = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const handleMove = (ev: MouseEvent) => {
            if (!isDragging.current) return;
            const newWidth = window.innerWidth - ev.clientX;
            setPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, newWidth)));
        };
        const handleUp = () => {
            isDragging.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
    }, []);

    /* ── Welcome message on first open ───────────────────────────────── */
    const handleOpen = useCallback(() => {
        setOpen(true);
        // Reset session memory on open
        sessionMemory.current.reset();
        if (messages.length === 0) {
            const guide = pageGuides[ctx.section];
            const chips = guide?.chips ?? ['What is this page?', 'What should I do next?', 'Send feedback'];
            setMessages([{
                id: 'welcome',
                role: 'assistant',
                text: `Hey — I'm Stape-Lee, your Second Look Protect assistant.\n\nYou're on **${ctx.pageName}**. I know this dashboard inside out — ask me anything about this page, workflows, statuses, or the platform.`,
                timestamp: Date.now(),
                streaming: true,
                chips,
            }]);
        }
    }, [messages.length, ctx.pageName, ctx.section]);

    /* ── Mark streaming complete for a message ───────────────────────── */
    const markStreamComplete = useCallback((msgId: string) => {
        setMessages(prev =>
            prev.map(m => m.id === msgId ? { ...m, streaming: false } : m)
        );
    }, []);

    /* ── Add assistant reply with thinking delay + progressive render ── */
    const addAssistantReply = useCallback((text: string, opts?: { action?: string; chips?: string[]; showFeedbackButtons?: boolean }) => {
        setIsThinking(true);
        const delay = 350 + Math.random() * 400;
        setTimeout(() => {
            setIsThinking(false);
            if (opts?.action === 'start_feedback') setFeedbackMode(true);
            setMessages(prev => [...prev, {
                id: `a-${Date.now()}`,
                role: 'assistant',
                text,
                timestamp: Date.now(),
                streaming: true,
                chips: opts?.chips,
                showFeedbackButtons: opts?.showFeedbackButtons,
            }]);
        }, delay);
    }, []);

    /* ── Handle chip click ───────────────────────────────────────────── */
    const handleChipClick = useCallback((chip: string) => {
        if (isThinking) return;
        // Add as user message then process
        setMessages(prev => [...prev, {
            id: `u-${Date.now()}`,
            role: 'user',
            text: chip,
            timestamp: Date.now(),
        }]);

        // Handle special chips
        if (/^(Bug Report|Feature Request|UX Feedback)$/i.test(chip)) {
            // Category chip during feedback mode
            if (feedbackMode) {
                setFeedbackMode(false);
                addAssistantReply(
                    `Got it — **${chip}**. Now describe the issue or suggestion in your own words and I'll draft the full message.`,
                    { action: 'start_feedback' }
                );
                return;
            }
        }

        const response = askStapeLee(chip, ctx, sessionMemory.current);
        addAssistantReply(response.text, { action: response.action, chips: response.chips });
    }, [ctx, feedbackMode, isThinking, addAssistantReply]);

    /* ── Send message ────────────────────────────────────────────────── */
    const handleSend = useCallback(() => {
        const text = input.trim();
        if (!text || isThinking) return;

        setMessages(prev => [...prev, {
            id: `u-${Date.now()}`,
            role: 'user',
            text,
            timestamp: Date.now(),
        }]);
        setInput('');

        if (feedbackMode) {
            const draft: FeedbackDraft = {
                category: detectFeedbackCategory(text),
                page: ctx.pageName,
                description: text,
                priority: 'Medium',
            };
            setFeedbackDraft(draft);
            setFeedbackMode(false);
            addAssistantReply(
                `Here's your feedback draft:\n\n**Type:** ${draft.category}\n**Page:** ${draft.page}\n**Priority:** ${draft.priority}\n**Message:** ${draft.description}`,
                { showFeedbackButtons: true }
            );
            return;
        }

        if (feedbackDraft) {
            if (/^(yes|send|confirm|go ahead|do it|submit|ok)\b/i.test(text)) {
                sendFeedback(feedbackDraft);
                return;
            } else if (/^(no|cancel|edit|change|redo|discard)\b/i.test(text)) {
                setFeedbackDraft(null);
                addAssistantReply('Feedback discarded. Ask me anything else, or say "feedback" to start again.', { chips: pageGuides[ctx.section]?.chips?.slice(0, 3) });
                return;
            }
        }

        const response = askStapeLee(text, ctx, sessionMemory.current);
        addAssistantReply(response.text, { action: response.action, chips: response.chips });
    }, [input, ctx, feedbackMode, feedbackDraft, isThinking, addAssistantReply]);

    /* ── Feedback button handlers ────────────────────────────────────── */
    const handleFeedbackSend = useCallback(() => {
        if (feedbackDraft) sendFeedback(feedbackDraft);
    }, [feedbackDraft]);

    const handleFeedbackDiscard = useCallback(() => {
        setFeedbackDraft(null);
        // Remove the showFeedbackButtons flag from the last message
        setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, showFeedbackButtons: false } : m));
        addAssistantReply('Feedback discarded. What else can I help with?', { chips: pageGuides[ctx.section]?.chips?.slice(0, 3) });
    }, [ctx.section, addAssistantReply]);

    /* ── Send feedback via email-dispatch ─────────────────────────────── */
    const sendFeedback = useCallback(async (draft: FeedbackDraft) => {
        setFeedbackSending(true);
        setIsThinking(true);
        try {
            const { getSupabase } = await import('../../lib/supabaseClient');
            const sb = getSupabase();
            const { data: { session } } = await sb.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                addAssistantReply('⚠ **You appear to be logged out.** Please refresh the page and try again.');
                setFeedbackSending(false);
                return;
            }

            const res = await fetch('/api/email-dispatch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    event_type: 'developer_feedback',
                    context: {
                        category: draft.category,
                        page: draft.page,
                        description: draft.description,
                        priority: draft.priority,
                        sourceUrl: window.location.href,
                    },
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (res.ok && data.ok) {
                setFeedbackDraft(null);
                addAssistantReply('✓ **Feedback sent.** The dev team will review it — thanks for sharing.', {
                    chips: pageGuides[ctx.section]?.chips?.slice(0, 3),
                });
            } else {
                const serverError = data.error || `Server returned ${res.status}`;
                addAssistantReply(`⚠ **Feedback could not be sent** — ${serverError}.\n\nYour draft is still saved.`, {
                    showFeedbackButtons: true,
                });
            }
        } catch (err: any) {
            addAssistantReply(`⚠ **Couldn't reach the server** — ${err.message || 'network error'}.\n\nYour draft is still saved.`, {
                showFeedbackButtons: true,
            });
        } finally {
            setFeedbackSending(false);
        }
    }, [addAssistantReply, ctx.section]);

    /* ── Key handler ──────────────────────────────────────────────────── */
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    /* ── Format time ─────────────────────────────────────────────────── */
    const fmtTime = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    /* ═══════════════════════════ RENDER ══════════════════════════════════ */

    return (
        <>
            <style>{SLIDE_STYLES}</style>

            {/* ── Right-edge launcher tab — slim version ──────────────────── */}
            {!open && (
                <button
                    onClick={handleOpen}
                    aria-label="Open Stape-Lee assistant"
                    style={{
                        position: 'fixed',
                        right: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 1000,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0.5rem 0.2rem',
                        width: '22px',
                        background: 'linear-gradient(180deg, #1e293b 0%, #334155 100%)',
                        color: '#f1f5f9',
                        border: 'none',
                        borderRadius: '8px 0 0 8px',
                        cursor: 'pointer',
                        transition: 'width 0.2s ease, box-shadow 0.2s ease',
                        animation: 'stapeleeTabPulse 3s ease-in-out infinite',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.width = '28px';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.width = '22px';
                    }}
                >
                    <span style={{ writingMode: 'initial', lineHeight: 0 }}>
                        <StaplerIcon size={16} />
                    </span>
                </button>
            )}

            {/* ── Slide-out panel (open state) ───────────────────────────── */}
            {open && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 1000,
                    width: `${panelWidth}px`,
                    maxWidth: '85vw',
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#ffffff',
                    borderLeft: '1px solid #e2e8f0',
                    boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
                    animation: 'stapeleeSlideIn 0.25s ease-out',
                }}>

                    {/* ── Collapse tab (outside left edge of open panel) ─── */}
                    <button
                        onClick={() => setOpen(false)}
                        aria-label="Collapse Stape-Lee"
                        style={{
                            position: 'absolute',
                            left: '-22px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 11,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '22px',
                            padding: '0.5rem 0',
                            background: 'linear-gradient(180deg, #1e293b 0%, #334155 100%)',
                            color: '#f1f5f9',
                            border: 'none',
                            borderRadius: '8px 0 0 8px',
                            cursor: 'pointer',
                            transition: 'width 0.15s ease, opacity 0.15s',
                            opacity: 0.85,
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.width = '28px';
                            e.currentTarget.style.left = '-28px';
                            e.currentTarget.style.opacity = '1';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.width = '22px';
                            e.currentTarget.style.left = '-22px';
                            e.currentTarget.style.opacity = '0.85';
                        }}
                    >
                        <StaplerIcon size={14} />
                    </button>

                    {/* ── Resize handle (left edge) ──────────────────────── */}
                    <div
                        onMouseDown={startResize}
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: '5px',
                            cursor: 'col-resize',
                            zIndex: 10,
                            background: 'transparent',
                            transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(30,41,59,0.08)'; }}
                        onMouseLeave={e => { if (!isDragging.current) e.currentTarget.style.background = 'transparent'; }}
                    >
                        {/* Visual grip dots */}
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '1px',
                            transform: 'translateY(-50%)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px',
                            opacity: 0.25,
                        }}>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{
                                    width: '3px',
                                    height: '3px',
                                    borderRadius: '50%',
                                    background: '#475569',
                                }} />
                            ))}
                        </div>
                    </div>

                    {/* Header */}
                    <div style={{
                        padding: '0.7rem 0.85rem',
                        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                        color: '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexShrink: 0,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                            <StaplerIcon size={30} />
                            <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.01em' }}>Stape-Lee</div>
                                <div style={{ fontSize: '0.6rem', opacity: 0.6 }}>Dashboard Operator</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <span style={{
                                fontSize: '0.58rem',
                                opacity: 0.7,
                                background: 'rgba(255,255,255,0.08)',
                                padding: '2px 7px',
                                borderRadius: '6px',
                                maxWidth: '100px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}>
                                {ctx.pageName}
                            </span>
                            <button
                                onClick={() => setOpen(false)}
                                aria-label="Close assistant"
                                style={{
                                    background: 'rgba(255,255,255,0.06)',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                            >
                                <X size={15} />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div
                        ref={scrollRef}
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '0.65rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.55rem',
                            background: '#f8fafc',
                        }}
                    >
                        {messages.map(msg => (
                            <div key={msg.id} style={{
                                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                maxWidth: '88%',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                            }}>
                                {/* Sender label */}
                                <div style={{
                                    fontSize: '0.58rem',
                                    fontWeight: 600,
                                    color: msg.role === 'user' ? '#64748b' : '#475569',
                                    textAlign: msg.role === 'user' ? 'right' : 'left',
                                    paddingLeft: msg.role === 'assistant' ? '2px' : 0,
                                    paddingRight: msg.role === 'user' ? '2px' : 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                }}>
                                    {msg.role === 'assistant' && <StaplerIconSmall />}
                                    {msg.role === 'user' ? 'You' : 'Stape-Lee'}
                                    <span style={{ fontWeight: 400, opacity: 0.5 }}>· {fmtTime(msg.timestamp)}</span>
                                </div>
                                {/* Bubble */}
                                <div style={{
                                    padding: '0.5rem 0.7rem',
                                    borderRadius: msg.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                                    background: msg.role === 'user'
                                        ? 'linear-gradient(135deg, #1e293b, #334155)'
                                        : '#ffffff',
                                    color: msg.role === 'user' ? '#f1f5f9' : '#1e293b',
                                    fontSize: '0.76rem',
                                    lineHeight: 1.55,
                                    border: msg.role === 'assistant' ? '1px solid #e8ecf1' : 'none',
                                    boxShadow: msg.role === 'assistant'
                                        ? '0 1px 3px rgba(0,0,0,0.03)'
                                        : '0 1px 4px rgba(0,0,0,0.08)',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                }}>
                                    {msg.role === 'assistant' && msg.streaming ? (
                                        <ProgressiveText
                                            key={msg.id}
                                            text={msg.text}
                                            onComplete={() => markStreamComplete(msg.id)}
                                        />
                                    ) : (
                                        renderMarkdownLight(msg.text)
                                    )}
                                </div>
                                {/* Feedback send/discard buttons */}
                                {msg.role === 'assistant' && msg.showFeedbackButtons && !msg.streaming && feedbackDraft && (
                                    <FeedbackButtons
                                        onSend={handleFeedbackSend}
                                        onDiscard={handleFeedbackDiscard}
                                        sending={feedbackSending}
                                    />
                                )}
                                {/* Recommendation chips (shown after streaming completes) */}
                                {msg.role === 'assistant' && msg.chips && !msg.streaming && !msg.showFeedbackButtons && (
                                    <RecommendationChips
                                        chips={msg.chips}
                                        onSelect={handleChipClick}
                                        disabled={isThinking}
                                    />
                                )}
                            </div>
                        ))}

                        {isThinking && <TypingDots />}

                        {feedbackSending && (
                            <div style={{
                                alignSelf: 'flex-start',
                                fontSize: '0.65rem',
                                color: '#64748b',
                                padding: '0.35rem 0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                            }}>
                                <span style={{
                                    width: '4px', height: '4px', borderRadius: '50%',
                                    background: '#94a3b8', animation: 'stapeleeDot 1s ease-in-out infinite',
                                }} />
                                Sending…
                            </div>
                        )}
                    </div>

                    {/* Input area */}
                    <div style={{
                        padding: '0.55rem 0.65rem',
                        borderTop: '1px solid #e8ecf1',
                        display: 'flex',
                        gap: '0.35rem',
                        background: '#ffffff',
                        flexShrink: 0,
                    }}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={feedbackMode ? 'Describe the feedback…' : 'Ask something…'}
                            disabled={isThinking}
                            style={{
                                flex: 1,
                                padding: '0.45rem 0.6rem',
                                border: '1px solid #e2e8f0',
                                borderRadius: '10px',
                                fontSize: '0.76rem',
                                outline: 'none',
                                transition: 'border-color 0.2s ease, background 0.2s',
                                background: isThinking ? '#f1f5f9' : '#fafbfc',
                                color: '#1e293b',
                            }}
                            onFocus={e => { if (!isThinking) e.currentTarget.style.borderColor = '#94a3b8'; }}
                            onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isThinking}
                            aria-label="Send message"
                            style={{
                                padding: '0.45rem 0.55rem',
                                background: (input.trim() && !isThinking) ? 'linear-gradient(135deg, #1e293b, #334155)' : '#e8ecf1',
                                color: (input.trim() && !isThinking) ? '#f1f5f9' : '#94a3b8',
                                border: 'none',
                                borderRadius: '10px',
                                cursor: (input.trim() && !isThinking) ? 'pointer' : 'default',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background 0.2s ease',
                            }}
                        >
                            <Send size={15} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

/* ── Lightweight markdown renderer ───────────────────────────────────────── */

function renderMarkdownLight(text: string): React.ReactNode {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} style={{ fontWeight: 650 }}>{part.slice(2, -2)}</strong>;
        }
        const codeParts = part.split(/(`[^`]+`)/g);
        if (codeParts.length > 1) {
            return codeParts.map((cp, j) => {
                if (cp.startsWith('`') && cp.endsWith('`')) {
                    return (
                        <code key={`${i}-${j}`} style={{
                            background: '#f1f5f9',
                            padding: '1px 4px',
                            borderRadius: '3px',
                            fontSize: '0.72rem',
                            fontFamily: 'ui-monospace, monospace',
                            color: '#334155',
                        }}>
                            {cp.slice(1, -1)}
                        </code>
                    );
                }
                return <React.Fragment key={`${i}-${j}`}>{cp}</React.Fragment>;
            });
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
    });
}

/* ── Feedback category detection ─────────────────────────────────────────── */

function detectFeedbackCategory(text: string): string {
    const t = text.toLowerCase();
    if (/bug|broken|crash|error|not work|wrong|fail/.test(t)) return 'Bug Report';
    if (/feature|add|could you|would be nice|wish|missing|want/.test(t)) return 'Feature Request';
    if (/confus|hard to|unclear|ux|ui|layout|design|look/.test(t)) return 'UX Feedback';
    return 'General';
}
