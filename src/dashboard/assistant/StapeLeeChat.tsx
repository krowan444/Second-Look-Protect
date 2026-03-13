/* ═══════════════════════════════════════════════════════════════════════════
   Stape-Lee — Floating Chat UI Component
   ═══════════════════════════════════════════════════════════════════════════
   A calm, premium floating assistant panel anchored to the bottom-right of
   the dashboard. Supports knowledge-base Q&A and developer feedback with
   a draft-then-confirm flow.
   ═══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, ChevronDown, CheckCircle2, AlertTriangle } from 'lucide-react';
import { usePageContext } from './usePageContext';
import { askStapeLee } from './stapeLeeBrain';

/* ── Types ────────────────────────────────────────────────────────────────── */

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: number;
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

/* ── Component ───────────────────────────────────────────────────────────── */

export function StapeLeeChat({ currentPath }: Props) {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [feedbackMode, setFeedbackMode] = useState(false);
    const [feedbackDraft, setFeedbackDraft] = useState<FeedbackDraft | null>(null);
    const [feedbackSending, setFeedbackSending] = useState(false);
    const [feedbackSent, setFeedbackSent] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const ctx = usePageContext(currentPath);

    /* ── Auto-scroll on new message ──────────────────────────────────── */
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    /* ── Focus input when opened ─────────────────────────────────────── */
    useEffect(() => {
        if (open && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [open]);

    /* ── Welcome message on first open ───────────────────────────────── */
    const handleOpen = useCallback(() => {
        setOpen(true);
        if (messages.length === 0) {
            setMessages([{
                id: 'welcome',
                role: 'assistant',
                text: `Hi, I'm **Stape-Lee** — your dashboard assistant.\n\nYou're on the **${ctx.pageName}** page. I can help you understand what's here, guide you through tasks, or send feedback to the dev team.\n\nTry asking:\n• "What is this page?"\n• "How do I submit a case?"\n• "Send feedback"`,
                timestamp: Date.now(),
            }]);
        }
    }, [messages.length, ctx.pageName]);

    /* ── Send message ────────────────────────────────────────────────── */
    const handleSend = useCallback(() => {
        const text = input.trim();
        if (!text) return;

        const userMsg: ChatMessage = {
            id: `u-${Date.now()}`,
            role: 'user',
            text,
            timestamp: Date.now(),
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');

        // If in feedback mode, treat the message as feedback description
        if (feedbackMode) {
            const draft: FeedbackDraft = {
                category: detectFeedbackCategory(text),
                page: ctx.pageName,
                description: text,
                priority: 'Medium',
            };
            setFeedbackDraft(draft);
            setFeedbackMode(false);

            const assistantMsg: ChatMessage = {
                id: `a-${Date.now()}`,
                role: 'assistant',
                text: `Here's your feedback draft:\n\n` +
                    `**Type:** ${draft.category}\n` +
                    `**Page:** ${draft.page}\n` +
                    `**Priority:** ${draft.priority}\n` +
                    `**Description:** ${draft.description}\n\n` +
                    `Would you like me to **send this** to the development team, or would you like to **edit** it?`,
                timestamp: Date.now(),
            };
            setMessages(prev => [...prev, assistantMsg]);
            return;
        }

        // If a feedback draft is pending and user confirms
        if (feedbackDraft) {
            if (/^(yes|send|confirm|go ahead|do it|submit|ok)\b/i.test(text)) {
                sendFeedback(feedbackDraft);
                return;
            } else if (/^(no|cancel|edit|change|redo)\b/i.test(text)) {
                setFeedbackDraft(null);
                const assistantMsg: ChatMessage = {
                    id: `a-${Date.now()}`,
                    role: 'assistant',
                    text: 'No problem — feedback cancelled. You can describe it again whenever you\'re ready, or ask me something else.',
                    timestamp: Date.now(),
                };
                setMessages(prev => [...prev, assistantMsg]);
                return;
            }
        }

        // Normal knowledge-base query
        const response = askStapeLee(text, ctx);

        if (response.action === 'start_feedback') {
            setFeedbackMode(true);
        }

        const assistantMsg: ChatMessage = {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: response.text,
            timestamp: Date.now(),
        };
        setMessages(prev => [...prev, assistantMsg]);
    }, [input, ctx, feedbackMode, feedbackDraft]);

    /* ── Send feedback via email-dispatch ─────────────────────────────── */
    const sendFeedback = useCallback(async (draft: FeedbackDraft) => {
        setFeedbackSending(true);

        try {
            const res = await fetch('/api/email-dispatch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: 'developer-feedback@secondlookprotect.co.uk',
                    subject: `[${draft.category}] Dashboard Feedback — ${draft.page}`,
                    body:
                        `Developer Feedback via Stape-Lee\n` +
                        `────────────────────────────────\n` +
                        `Type: ${draft.category}\n` +
                        `Page: ${draft.page}\n` +
                        `Priority: ${draft.priority}\n` +
                        `────────────────────────────────\n\n` +
                        `${draft.description}\n\n` +
                        `────────────────────────────────\n` +
                        `Sent from: ${window.location.href}\n` +
                        `Timestamp: ${new Date().toISOString()}`,
                }),
            });

            if (res.ok) {
                setFeedbackSent(true);
                setFeedbackDraft(null);
                const assistantMsg: ChatMessage = {
                    id: `a-${Date.now()}`,
                    role: 'assistant',
                    text: '✅ **Feedback sent successfully.** The development team will review it. Thank you for taking the time to share this.',
                    timestamp: Date.now(),
                };
                setMessages(prev => [...prev, assistantMsg]);
                setTimeout(() => setFeedbackSent(false), 3000);
            } else {
                throw new Error('Send failed');
            }
        } catch {
            const assistantMsg: ChatMessage = {
                id: `a-${Date.now()}`,
                role: 'assistant',
                text: '⚠️ **Could not send feedback.** There may be a network issue. Your draft has been preserved — try again in a moment or copy the text manually.',
                timestamp: Date.now(),
            };
            setMessages(prev => [...prev, assistantMsg]);
        } finally {
            setFeedbackSending(false);
        }
    }, []);

    /* ── Key handler ──────────────────────────────────────────────────── */
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    /* ── Render ───────────────────────────────────────────────────────── */

    // Floating trigger button
    if (!open) {
        return (
            <button
                onClick={handleOpen}
                aria-label="Open Stape-Lee assistant"
                style={{
                    position: 'fixed',
                    bottom: '1.25rem',
                    right: '1.25rem',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.6rem 1rem',
                    background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                    color: '#f1f5f9',
                    border: 'none',
                    borderRadius: '24px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.1)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    letterSpacing: '0.01em',
                }}
                onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(0,0,0,0.2), 0 2px 6px rgba(0,0,0,0.12)';
                }}
                onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.1)';
                }}
            >
                <MessageCircle size={16} />
                Stape-Lee
            </button>
        );
    }

    // Chat panel
    return (
        <div style={{
            position: 'fixed',
            bottom: '1.25rem',
            right: '1.25rem',
            zIndex: 1000,
            width: '380px',
            maxWidth: 'calc(100vw - 2rem)',
            height: '520px',
            maxHeight: 'calc(100vh - 6rem)',
            display: 'flex',
            flexDirection: 'column',
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                padding: '0.75rem 1rem',
                background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                color: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MessageCircle size={16} />
                    <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Stape-Lee</div>
                        <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>Dashboard Assistant</div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.6rem', opacity: 0.6, background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '8px' }}>
                        {ctx.pageName}
                    </span>
                    <button
                        onClick={() => setOpen(false)}
                        aria-label="Close assistant"
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                        }}
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div
                ref={scrollRef}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    background: '#f8fafc',
                }}
            >
                {messages.map(msg => (
                    <div
                        key={msg.id}
                        style={{
                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            padding: '0.55rem 0.75rem',
                            borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                            background: msg.role === 'user'
                                ? 'linear-gradient(135deg, #1e293b, #334155)'
                                : '#ffffff',
                            color: msg.role === 'user' ? '#f1f5f9' : '#1e293b',
                            fontSize: '0.78rem',
                            lineHeight: 1.5,
                            border: msg.role === 'assistant' ? '1px solid #e2e8f0' : 'none',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                        }}
                    >
                        {renderMarkdownLight(msg.text)}
                    </div>
                ))}

                {feedbackSending && (
                    <div style={{ alignSelf: 'flex-start', fontSize: '0.72rem', color: '#64748b', padding: '0.4rem' }}>
                        Sending feedback…
                    </div>
                )}
            </div>

            {/* Input */}
            <div style={{
                padding: '0.6rem 0.75rem',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                gap: '0.4rem',
                background: '#ffffff',
                flexShrink: 0,
            }}>
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={feedbackMode ? 'Describe your feedback…' : 'Ask Stape-Lee…'}
                    style={{
                        flex: 1,
                        padding: '0.5rem 0.65rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        fontSize: '0.78rem',
                        outline: 'none',
                        transition: 'border-color 0.2s ease',
                        background: '#f8fafc',
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = '#94a3b8'}
                    onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                />
                <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    aria-label="Send message"
                    style={{
                        padding: '0.5rem',
                        background: input.trim() ? 'linear-gradient(135deg, #1e293b, #334155)' : '#e2e8f0',
                        color: input.trim() ? '#f1f5f9' : '#94a3b8',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: input.trim() ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.2s ease',
                    }}
                >
                    <Send size={16} />
                </button>
            </div>
        </div>
    );
}

/* ── Lightweight markdown renderer ───────────────────────────────────────── */

function renderMarkdownLight(text: string): React.ReactNode {
    // Split by lines and process bold markers
    const parts = text.split(/(\*\*[^*]+\*\*)/g);

    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        // Handle backtick code
        const codeParts = part.split(/(`[^`]+`)/g);
        if (codeParts.length > 1) {
            return codeParts.map((cp, j) => {
                if (cp.startsWith('`') && cp.endsWith('`')) {
                    return (
                        <code key={`${i}-${j}`} style={{
                            background: '#f1f5f9',
                            padding: '1px 4px',
                            borderRadius: '3px',
                            fontSize: '0.74rem',
                            fontFamily: 'monospace',
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
