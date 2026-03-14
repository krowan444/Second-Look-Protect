import React, { useState } from 'react';
import { Shield, ArrowLeft, Loader2, Mail } from 'lucide-react';
import { getSupabase } from '../lib/supabaseClient';

type LoginView = 'login' | 'forgot';

/* ── Client-side cooldown so the user can't hammer the button ─────────────── */
const COOLDOWN_SECONDS = 60;

export function LoginPage() {
    const [view, setView] = useState<LoginView>('login');

    // ── Login state ────────────────────────────────────────────────────────
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState<string | null>(null);
    const [loginLoading, setLoginLoading] = useState(false);

    // ── Forgot-password state ──────────────────────────────────────────────
    const [resetEmail, setResetEmail] = useState('');
    const [resetSent, setResetSent] = useState(false);
    const [resetError, setResetError] = useState<string | null>(null);
    const [resetLoading, setResetLoading] = useState(false);
    const [cooldownSec, setCooldownSec] = useState(0);

    /* ── Login handler ────────────────────────────────────────────────────── */
    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setLoginError(null);
        setLoginLoading(true);
        try {
            const supabase = getSupabase();
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });
            if (authError) setLoginError(authError.message);
        } catch (err) {
            setLoginError(err instanceof Error ? err.message : 'An unexpected error occurred.');
        } finally {
            setLoginLoading(false);
        }
    }

    /* ── Start cooldown timer ─────────────────────────────────────────────── */
    function startCooldown() {
        setCooldownSec(COOLDOWN_SECONDS);
        const interval = setInterval(() => {
            setCooldownSec(prev => {
                if (prev <= 1) { clearInterval(interval); return 0; }
                return prev - 1;
            });
        }, 1000);
    }

    /* ── Reset-request handler ────────────────────────────────────────────── */
    async function handleResetRequest(e: React.FormEvent) {
        e.preventDefault();
        if (cooldownSec > 0 || resetLoading) return;
        setResetError(null);
        setResetLoading(true);
        try {
            const resp = await fetch('/api/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resetEmail.trim() }),
            });

            if (resp.status === 429) {
                const data = await resp.json().catch(() => null);
                const waitMin = data?.retryAfterSec
                    ? Math.ceil(data.retryAfterSec / 60)
                    : 15;
                setResetError(
                    `Too many attempts. Please wait ${waitMin} minute${waitMin !== 1 ? 's' : ''} before trying again.`
                );
                return;
            }

            // For any other response (including errors), show success — never disclose
            setResetSent(true);
            startCooldown();
        } catch {
            // Network error — show a neutral message, still don't disclose anything
            setResetError('Something went wrong. Please check your connection and try again.');
        } finally {
            setResetLoading(false);
        }
    }

    /* ── Switch to forgot view ────────────────────────────────────────────── */
    function goToForgot() {
        setResetEmail(email); // pre-fill with whatever they typed in login
        setResetSent(false);
        setResetError(null);
        setView('forgot');
    }

    /* ── Switch back to login ─────────────────────────────────────────────── */
    function goToLogin() {
        setLoginError(null);
        setView('login');
    }

    /* ══════════════════════════════════════════════════════════════════════
       RENDER — LOGIN VIEW
    ══════════════════════════════════════════════════════════════════════ */
    if (view === 'login') {
        return (
            <div className="dashboard-login">
                <div className="dashboard-login-card">
                    {/* Brand */}
                    <div className="dashboard-login-brand">
                        <div className="dashboard-login-logo">
                            <Shield size={24} color="#C9A84C" />
                        </div>
                        <h1 className="dashboard-login-title">Second Look Protect</h1>
                        <p className="dashboard-login-sub">Sign in to your dashboard</p>
                    </div>

                    {/* Error */}
                    {loginError && <div className="dashboard-login-error">{loginError}</div>}

                    {/* Form */}
                    <form className="dashboard-login-form" onSubmit={handleLogin}>
                        <div className="dashboard-login-field">
                            <label className="dashboard-login-label" htmlFor="dash-email">
                                Email address
                            </label>
                            <input
                                id="dash-email"
                                className="dashboard-login-input"
                                type="email"
                                autoComplete="email"
                                placeholder="you@organisation.co.uk"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="dashboard-login-field">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
                                <label className="dashboard-login-label" htmlFor="dash-password" style={{ margin: 0 }}>
                                    Password
                                </label>
                                <button
                                    type="button"
                                    onClick={goToForgot}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        fontSize: '0.78rem',
                                        color: '#C9A84C',
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                        fontWeight: 500,
                                        textDecoration: 'underline',
                                        textUnderlineOffset: '2px',
                                    }}
                                >
                                    Forgot password?
                                </button>
                            </div>
                            <input
                                id="dash-password"
                                className="dashboard-login-input"
                                type="password"
                                autoComplete="current-password"
                                placeholder="••••••••"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            className="dashboard-login-submit"
                            disabled={loginLoading}
                        >
                            {loginLoading ? 'Signing in…' : 'Sign In'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
       RENDER — FORGOT PASSWORD VIEW
    ══════════════════════════════════════════════════════════════════════ */
    return (
        <div className="dashboard-login">
            <div className="dashboard-login-card">
                {/* Brand */}
                <div className="dashboard-login-brand">
                    <div className="dashboard-login-logo">
                        <Shield size={24} color="#C9A84C" />
                    </div>
                    <h1 className="dashboard-login-title">Reset your password</h1>
                    <p className="dashboard-login-sub">
                        Enter your email address and we'll send you a reset link.
                    </p>
                </div>

                {/* ── Success state ──────────────────────────────────────── */}
                {resetSent ? (
                    <div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.75rem',
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderRadius: '10px',
                            padding: '1rem 1.1rem',
                            marginBottom: '1.25rem',
                        }}>
                            <Mail size={18} style={{ color: '#16a34a', flexShrink: 0, marginTop: '1px' }} />
                            <div>
                                <p style={{ margin: '0 0 0.25rem', fontSize: '0.88rem', fontWeight: 600, color: '#15803d' }}>
                                    Reset link sent
                                </p>
                                <p style={{ margin: 0, fontSize: '0.82rem', color: '#166534', lineHeight: 1.55 }}>
                                    If an account matches that email, a password reset link has been sent. Please check your inbox.
                                </p>
                            </div>
                        </div>

                        {/* Resend after cooldown */}
                        <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
                            {cooldownSec > 0 ? (
                                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
                                    Resend available in {cooldownSec}s
                                </p>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => { setResetSent(false); setResetError(null); }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '0.82rem',
                                        color: '#C9A84C',
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                        textDecoration: 'underline',
                                        textUnderlineOffset: '2px',
                                    }}
                                >
                                    Resend reset link
                                </button>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={goToLogin}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                background: 'none',
                                border: 'none',
                                fontSize: '0.82rem',
                                color: '#64748b',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                padding: 0,
                                margin: '0.25rem auto 0',
                            }}
                        >
                            <ArrowLeft size={14} /> Back to sign in
                        </button>
                    </div>
                ) : (
                    /* ── Request form ──────────────────────────────────────── */
                    <>
                        {resetError && <div className="dashboard-login-error">{resetError}</div>}

                        <form className="dashboard-login-form" onSubmit={handleResetRequest}>
                            <div className="dashboard-login-field">
                                <label className="dashboard-login-label" htmlFor="reset-email">
                                    Email address
                                </label>
                                <input
                                    id="reset-email"
                                    className="dashboard-login-input"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="you@organisation.co.uk"
                                    required
                                    value={resetEmail}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                />
                            </div>

                            <button
                                type="submit"
                                className="dashboard-login-submit"
                                disabled={resetLoading || cooldownSec > 0}
                            >
                                {resetLoading
                                    ? <><Loader2 size={15} className="dsf-spinner" style={{ marginRight: '0.4rem' }} /> Sending…</>
                                    : cooldownSec > 0
                                        ? `Resend in ${cooldownSec}s`
                                        : 'Send Reset Link'}
                            </button>
                        </form>

                        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                            <button
                                type="button"
                                onClick={goToLogin}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '0.82rem',
                                    color: '#64748b',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                }}
                            >
                                <ArrowLeft size={14} /> Back to sign in
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
