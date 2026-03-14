import React, { useState } from 'react';
import { Shield, Lock } from 'lucide-react';
import { getSupabase } from '../lib/supabaseClient';

interface SetPasswordPageProps {
    onComplete: () => void;
}

export function SetPasswordPage({ onComplete }: SetPasswordPageProps) {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

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
                setError(updateError.message);
            } else {
                onComplete();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="dashboard-login">
            <div className="dashboard-login-card">
                {/* Brand */}
                <div className="dashboard-login-brand">
                    <div className="dashboard-login-logo">
                        <Shield size={24} color="#C9A84C" />
                    </div>
                    <h1 className="dashboard-login-title">Second Look Protect</h1>
                    <p className="dashboard-login-sub">Set your password to activate your account</p>
                </div>

                {/* Info */}
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
                    <span>Choose a secure password. You will use this email and password to sign in from now on.</span>
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
                        {loading ? 'Setting password\u2026' : 'Set Password & Continue'}
                    </button>
                </form>
            </div>
        </div>
    );
}
