/* ═══════════════════════════════════════════════════════════════════════════
   Stape-Lee — Premium Right-Edge Assistant Panel
   ═══════════════════════════════════════════════════════════════════════════
   A branded, context-aware assistant docked to the right edge of the
   dashboard. Features a cartoon stapler character, typing indicator,
   polished chat UX, and evidence of real page intelligence.
   ═══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, ArrowRight } from 'lucide-react';
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

/* ── Stapler Character SVG ───────────────────────────────────────────────── */

function StaplerIcon({ size = 28 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Base / bottom jaw */}
            <rect x="8" y="38" width="48" height="10" rx="4" fill="#475569" />
            <rect x="10" y="40" width="44" height="6" rx="3" fill="#64748b" />
            {/* Top jaw / arm — angled slightly open */}
            <path d="M12 38 L12 26 Q12 22 16 22 L52 22 Q56 22 56 26 L56 38" fill="#1e293b" />
            <path d="M14 36 L14 27 Q14 24 17 24 L53 24 Q55 24 55 27 L55 36" fill="#334155" />
            {/* Hinge circle */}
            <circle cx="12" cy="38" r="3.5" fill="#0f172a" />
            <circle cx="12" cy="38" r="2" fill="#475569" />
            {/* Eyes */}
            <ellipse cx="30" cy="30" rx="3.5" ry="4" fill="white" />
            <ellipse cx="42" cy="30" rx="3.5" ry="4" fill="white" />
            {/* Pupils */}
            <ellipse cx="31" cy="31" rx="1.8" ry="2.2" fill="#0f172a" />
            <ellipse cx="43" cy="31" rx="1.8" ry="2.2" fill="#0f172a" />
            {/* Eye shine */}
            <circle cx="29.5" cy="29" r="1" fill="white" opacity="0.9" />
            <circle cx="41.5" cy="29" r="1" fill="white" opacity="0.9" />
            {/* Subtle smile */}
            <path d="M33 35 Q36 37.5 39 35" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            {/* Staple slot on base */}
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
            <style>{`
                @keyframes stapeleeDot {
                    0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
                    30% { opacity: 1; transform: translateY(-3px); }
                }
            `}</style>
        </div>
    );
}

/* ── Slide animation keyframes ───────────────────────────────────────────── */

const SLIDE_STYLES = `
    @keyframes stapeleeSlideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes stapeleeTabPulse {
        0%, 100% { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        50% { box-shadow: 0 2px 12px rgba(30,41,59,0.15); }
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

    const ctx = usePageContext(currentPath);

    /* ── Auto-scroll on new message ──────────────────────────────────── */
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

    /* ── Welcome message on first open ───────────────────────────────── */
    const handleOpen = useCallback(() => {
        setOpen(true);
        if (messages.length === 0) {
            setMessages([{
                id: 'welcome',
                role: 'assistant',
                text: `Hey — I'm Stape-Lee, your dashboard assistant.\n\nYou're on **${ctx.pageName}**. I can explain what's here, guide you through tasks, or help draft feedback for the dev team.\n\nTry:\n• "What is this page?"\n• "What should I do next?"\n• "Send developer feedback"`,
                timestamp: Date.now(),
            }]);
        }
    }, [messages.length, ctx.pageName]);

    /* ── Add assistant reply with thinking delay ─────────────────────── */
    const addAssistantReply = useCallback((text: string, action?: string) => {
        setIsThinking(true);
        const delay = 350 + Math.random() * 400; // 350–750ms natural feel
        setTimeout(() => {
            setIsThinking(false);
            if (action === 'start_feedback') setFeedbackMode(true);
            setMessages(prev => [...prev, {
                id: `a-${Date.now()}`,
                role: 'assistant',
                text,
                timestamp: Date.now(),
            }]);
        }, delay);
    }, []);

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

        // Feedback draft description
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
                `Here's your draft:\n\n**Type:** ${draft.category}\n**Page:** ${draft.page}\n**Priority:** ${draft.priority}\n**Message:** ${draft.description}\n\nSay **"send"** to submit it to the dev team, or **"cancel"** to discard.`
            );
            return;
        }

        // Feedback confirmation
        if (feedbackDraft) {
            if (/^(yes|send|confirm|go ahead|do it|submit|ok)\b/i.test(text)) {
                sendFeedback(feedbackDraft);
                return;
            } else if (/^(no|cancel|edit|change|redo)\b/i.test(text)) {
                setFeedbackDraft(null);
                addAssistantReply('Feedback discarded. Ask me anything else, or say "feedback" to start again.');
                return;
            }
        }

        // Normal knowledge-base query
        const response = askStapeLee(text, ctx);
        addAssistantReply(response.text, response.action);
    }, [input, ctx, feedbackMode, feedbackDraft, isThinking, addAssistantReply]);

    /* ── Send feedback via email-dispatch ─────────────────────────────── */
    const sendFeedback = useCallback(async (draft: FeedbackDraft) => {
        setFeedbackSending(true);
        setIsThinking(true);
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
            setFeedbackDraft(null);
            if (res.ok) {
                addAssistantReply('✓ **Feedback sent.** The dev team will review it — thanks for sharing.');
            } else {
                throw new Error('fail');
            }
        } catch {
            addAssistantReply('⚠ **Couldn\'t send that.** Check your connection and try again, or copy the message manually.');
        } finally {
            setFeedbackSending(false);
        }
    }, [addAssistantReply]);

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

            {/* ── Right-edge launcher tab (closed state) ─────────────────── */}
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
                        gap: '0.3rem',
                        padding: '0.6rem 0.45rem 0.65rem',
                        background: 'linear-gradient(180deg, #1e293b 0%, #334155 100%)',
                        color: '#f1f5f9',
                        border: 'none',
                        borderRadius: '10px 0 0 10px',
                        cursor: 'pointer',
                        boxShadow: '-2px 2px 10px rgba(0,0,0,0.1)',
                        transition: 'padding 0.2s ease, box-shadow 0.2s ease',
                        writingMode: 'vertical-rl',
                        animation: 'stapeleeTabPulse 3s ease-in-out infinite',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.paddingRight = '0.6rem';
                        e.currentTarget.style.boxShadow = '-3px 2px 14px rgba(0,0,0,0.15)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.paddingRight = '0.45rem';
                        e.currentTarget.style.boxShadow = '-2px 2px 10px rgba(0,0,0,0.1)';
                    }}
                >
                    <span style={{ writingMode: 'initial' }}>
                        <StaplerIcon size={24} />
                    </span>
                    <span style={{
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                    }}>
                        Help
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
                    width: '340px',
                    maxWidth: '85vw',
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#ffffff',
                    borderLeft: '1px solid #e2e8f0',
                    boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
                    animation: 'stapeleeSlideIn 0.25s ease-out',
                }}>

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
                                <div style={{ fontSize: '0.6rem', opacity: 0.6 }}>Dashboard Assistant</div>
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
                                    {renderMarkdownLight(msg.text)}
                                </div>
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
