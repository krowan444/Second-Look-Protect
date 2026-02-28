import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { getSupabase } from '../lib/supabaseClient';

export function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const supabase = getSupabase();
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            if (authError) {
                setError(authError.message);
            }
            // On success, DashboardApp's onAuthStateChange will pick up the session
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
                    <p className="dashboard-login-sub">Sign in to your dashboard</p>
                </div>

                {/* Error */}
                {error && <div className="dashboard-login-error">{error}</div>}

                {/* Form */}
                <form className="dashboard-login-form" onSubmit={handleSubmit}>
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
                        <label className="dashboard-login-label" htmlFor="dash-password">
                            Password
                        </label>
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
                        disabled={loading}
                    >
                        {loading ? 'Signing in…' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}
