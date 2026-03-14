import React, { useState } from 'react';
import { Shield, Lock, CheckCircle2, ArrowLeft } from 'lucide-react';
import { getSupabase } from '../lib/supabaseClient';

interface SetPasswordPageProps {
    onComplete: () => void;
    /** true when triggered by a PASSWORD_RECOVERY event (reset flow),
     *  false/undefined when triggered by a new-user invite accept */
    isReset?: boolean;
}

export function SetPasswordPage({ onComplete, isReset = false }: SetPasswordPageProps) {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [linkExpired, setLinkExpired] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (password !== confirm) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            const supabase = getSupabase();
            const { error: updateError } = await supabase.auth.updateUser({ password });

            if (updateError) {
                // Detect expired / invalid token errors
                const msg = updateError.message?.toLowerCase() ?? '';
                if (
                    msg.includes('expired') ||
                    msg.includes('invalid') ||
                    msg.includes('token') ||
                    msg.includes('otp') ||
                    updateError.status === 401 ||
                    updateError.status === 403
                ) {
                    setLinkExpired(true);
                } else {
                    setError(updateError.message);
                }
            } else {
                setDone(true);
                // Let the caller know after a brief moment so success state is visible
                setTimeout(() => onComplete(), 2000);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    }

    /* ── Heading / subtext differ between reset and invite flows ─────────── */
    const heading = isReset ? 'Reset your password' : 'Activate your account';
    const subtext = isReset
        ? 'Choose a new password for your account.'
        : 'Set your password to activate your account';
    const infoText = isReset
        ? 'Your new password will take effect immediately. You can sign in right away after setting it.'
        : 'Choose a secure password. You will use this email and password to sign in from now on.';

    /* ── Expired-link state ───────────────────────────────────────────────── */
    if (linkExpired) {
        return (
            <div className="dashboard-login">
                <div className="dashboard-login-card">
                    <div className="dashboard-login-brand">
                        <div className="dashboard-login-logo">
                            <Shield size={24} color="#C9A84C" />
                        </div>
                        <h1 className="dashboard-login-title">Link expired</h1>
                        <p className="dashboard-login-sub">This password reset link is no longer valid.</p>
                    </div>

                    <div style={{
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '10px',
                        padding: '1rem 1.1rem',
                        marginBottom: '1.25rem',
                        fontSize: '0.85rem',
                        color: '#991b1b',
                        lineHeight: 1.55,
                    }}>
                        Reset links expire after a short time for security. Please request a new one from the sign-in page.
                    </div>

                    <a
                        href="/dashboard"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem',
                            width: '100%',
                            padding: '0.7rem',
                            background: '#C9A84C',
                            color: '#fff',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            fontSize: '0.88rem',
                            fontWeight: 600,
                            fontFamily: 'inherit',
                            boxSizing: 'border-box',
                        }}
                    >
                        <ArrowLeft size={15} /> Back to sign in
                    </a>
                </div>
            </div>
        );
    }

    /* ── Success state ────────────────────────────────────────────────────── */
    if (done) {
        return (
            <div className="dashboard-login">
                <div className="dashboard-login-card">
                    <div className="dashboard-login-brand">
                        <div className="dashboard-login-logo">
                            <Shield size={24} color="#C9A84C" />
                        </div>
                        <h1 className="dashboard-login-title">Password updated</h1>
                        <p className="dashboard-login-sub">
                            {isReset ? 'Your password has been reset successfully.' : 'Your account is now active.'}
                        </p>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '10px',
                        padding: '1rem 1.1rem',
                        marginBottom: '1.25rem',
                    }}>
                        <CheckCircle2 size={20} style={{ color: '#16a34a', flexShrink: 0 }} />
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#15803d', lineHeight: 1.5 }}>
                            {isReset
                                ? 'Done — signing you in now…'
                                : 'Your account is active. Signing you in…'}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    /* ── Main form ────────────────────────────────────────────────────────── */
    return (
        <div className="dashboard-login">
            <div className="dashboard-login-card">
                {/* Brand */}
                <div className="dashboard-login-brand">
                    <div className="dashboard-login-logo">
                        <Shield size={24} color="#C9A84C" />
                    </div>
                    <h1 className="dashboard-login-title">{heading}</h1>
                    <p className="dashboard-login-sub">{subtext}</p>
                </div>

                {/* Info banner */}
                <div style={{
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    fontSize: '13px',
                    color: '#0369a1',
                    lineHeight: '1.5',
                }}>
                    <Lock size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span>{infoText}</span>
                </div>

                {/* Error */}
                {error && <div className="dashboard-login-error">{error}</div>}

                {/* Form */}
                <form className="dashboard-login-form" onSubmit={handleSubmit}>
                    <div className="dashboard-login-field">
                        <label className="dashboard-login-label" htmlFor="set-password">
                            New password
                        </label>
                        <input
                            id="set-password"
                            className="dashboard-login-input"
                            type="password"
                            autoComplete="new-password"
                            placeholder="At least 8 characters"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <div className="dashboard-login-field">
                        <label className="dashboard-login-label" htmlFor="confirm-password">
                            Confirm password
                        </label>
                        <input
                            id="confirm-password"
                            className="dashboard-login-input"
                            type="password"
                            autoComplete="new-password"
                            placeholder="Re-enter password"
                            required
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        className="dashboard-login-submit"
                        disabled={loading}
                    >
                        {loading
                            ? (isReset ? 'Resetting…' : 'Setting password…')
                            : (isReset ? 'Reset Password' : 'Set Password & Continue')}
                    </button>
                </form>
            </div>
        </div>
    );
}
