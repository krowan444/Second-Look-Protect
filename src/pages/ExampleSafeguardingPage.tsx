import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import {
    Shield, AlertTriangle, CheckCircle, FileText, BarChart3,
    TrendingUp, Download, Phone, Globe, UserCheck, Clock,
    ArrowLeft, ArrowRight, Eye, ClipboardList,
} from 'lucide-react';
import { Button } from '../components/Button';

/* ─── Demo data ──────────────────────────────────────────────────────────── */

const DASHBOARD_CARDS = [
    { label: 'Active cases', value: '4', icon: Shield, accent: '#C9A84C' },
    { label: 'Cases this month', value: '12', icon: FileText, accent: '#3b82f6' },
    { label: 'Pending reviews', value: '2', icon: Clock, accent: '#f59e0b' },
    { label: 'Resolved this month', value: '10', icon: CheckCircle, accent: '#22c55e' },
];

const SCAM_TYPES = [
    { type: 'Bank impersonation', count: 5, pct: 42 },
    { type: 'Delivery scam SMS', count: 3, pct: 25 },
    { type: 'HMRC phishing', count: 2, pct: 17 },
    { type: 'Romance / social', count: 1, pct: 8 },
    { type: 'Other', count: 1, pct: 8 },
];

const CHECKLIST = [
    'Do not call back the number provided',
    'Verify via official bank website or 159',
    'Inform safeguarding lead immediately',
    'Log incident in safeguarding register',
    'Monitor resident for distress or repeat contact',
];

const MONTHLY_CATEGORIES = [
    { category: 'Bank & financial impersonation', count: 5 },
    { category: 'Delivery / courier scams', count: 3 },
    { category: 'Government impersonation (HMRC, DWP)', count: 2 },
    { category: 'Romance & social engineering', count: 1 },
    { category: 'Tech support scams', count: 1 },
];

const TRENDS = [
    'AI-generated voice calls impersonating family members are increasing across care settings.',
    'QR code phishing in printed materials (fake NHS letters) reported in 3 UK regions.',
    'WhatsApp-based "friend in need" scams continue to target older adults.',
];

/* ─── Tab type ───────────────────────────────────────────────────────────── */
type TabId = 'dashboard' | 'case' | 'report';

/* ─── Scoped styles ──────────────────────────────────────────────────────── */
const SCOPED_STYLES = `
  .demo-env-page {
    min-height: 100vh;
    background: #f8fafc;
  }
  .demo-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(201,168,76,0.08);
    border: 1px solid rgba(201,168,76,0.18);
    border-radius: 999px;
    padding: 5px 14px;
    font-size: 0.78rem;
    color: #A8853C;
    font-weight: 600;
    letter-spacing: 0.04em;
  }
  .demo-tab-bar {
    display: flex;
    gap: 0;
    border-bottom: 2px solid #e2e8f0;
    margin-bottom: 2rem;
    overflow-x: auto;
  }
  .demo-tab {
    padding: 12px 24px;
    font-size: 0.9rem;
    font-weight: 600;
    color: #64748b;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.2s, border-color 0.2s;
  }
  .demo-tab:hover {
    color: #0B1E36;
  }
  .demo-tab.active {
    color: #0B1E36;
    border-bottom-color: #C9A84C;
  }
  .demo-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 1.5rem;
  }
  .demo-stat-card {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }
  .demo-stat-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .demo-risk-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 16px;
    border-radius: 999px;
    font-size: 0.82rem;
    font-weight: 600;
  }
  .demo-risk-high {
    background: rgba(239,68,68,0.08);
    color: #dc2626;
    border: 1px solid rgba(239,68,68,0.2);
  }
  .demo-checklist-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 0;
    color: #334155;
    font-size: 0.9rem;
    line-height: 1.5;
  }
  .demo-bar-track {
    height: 8px;
    background: #f1f5f9;
    border-radius: 999px;
    overflow: hidden;
  }
  .demo-bar-fill {
    height: 100%;
    border-radius: 999px;
    background: #C9A84C;
    transition: width 0.6s ease;
  }
  .demo-notice {
    background: rgba(201,168,76,0.06);
    border: 1px solid rgba(201,168,76,0.15);
    border-radius: 10px;
    padding: 14px 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.85rem;
    color: #64748b;
  }
  .demo-reassurance {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }
  .demo-reassurance span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: #f1f5f9;
    border-radius: 999px;
    padding: 5px 14px;
    font-size: 0.78rem;
    color: #64748b;
    font-weight: 500;
  }
  @media (max-width: 640px) {
    .demo-tab { padding: 10px 16px; font-size: 0.82rem; }
  }
`;

/* ═══════════════════════════════════════════════════════════════════════════
   Tab: Dashboard Overview
   ═══════════════════════════════════════════════════════════════════════════ */
function DashboardTab() {
    return (
        <div>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: '2rem' }}>
                {DASHBOARD_CARDS.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.label} className="demo-card demo-stat-card">
                            <div className="demo-stat-icon" style={{ background: `${card.accent}12` }}>
                                <Icon style={{ width: '20px', height: '20px', color: card.accent }} />
                            </div>
                            <div>
                                <p style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500, marginBottom: '2px' }}>{card.label}</p>
                                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0B1E36', lineHeight: 1 }}>{card.value}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Common scam types */}
            <div className="demo-card" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{
                    fontFamily: "'Merriweather', serif",
                    color: '#0B1E36',
                    fontSize: '1rem',
                    fontWeight: 600,
                    marginBottom: '1.25rem',
                }}>
                    Common scam types this month
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {SCAM_TYPES.map((s) => (
                        <div key={s.type}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 500 }}>{s.type}</span>
                                <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{s.count} cases ({s.pct}%)</span>
                            </div>
                            <div className="demo-bar-track">
                                <div className="demo-bar-fill" style={{ width: `${s.pct}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <p style={{ fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center' }}>Last updated: Demo data</p>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Tab: Example Case
   ═══════════════════════════════════════════════════════════════════════════ */
function ExampleCaseTab() {
    return (
        <div>
            {/* Case header */}
            <div className="demo-card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                    <AlertTriangle style={{ width: '20px', height: '20px', color: '#dc2626' }} />
                    <h3 style={{
                        fontFamily: "'Merriweather', serif",
                        color: '#0B1E36',
                        fontSize: '1.05rem',
                        fontWeight: 600,
                    }}>
                        Bank impersonation call reported
                    </h3>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '1rem' }}>
                    <span className="demo-risk-badge demo-risk-high">
                        <AlertTriangle style={{ width: '14px', height: '14px' }} />
                        High Risk
                    </span>
                    <span style={{ fontSize: '0.82rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock style={{ width: '14px', height: '14px' }} /> Submitted 2 hours ago
                    </span>
                </div>

                <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Submission description</p>
                    <p style={{ color: '#334155', fontSize: '0.9rem', lineHeight: 1.65 }}>
                        Resident received a phone call from someone claiming to be from their bank. The caller stated there was suspicious activity on their account and asked the resident to confirm their sort code, account number, and a one-time passcode. The resident felt pressured but paused and reported to staff.
                    </p>
                </div>

                <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '80px', height: '60px', borderRadius: '6px',
                        background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        <Phone style={{ width: '24px', height: '24px', color: '#94a3b8' }} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 500 }}>Call screenshot / evidence</p>
                        <p style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>caller_id_screenshot.png</p>
                    </div>
                </div>
            </div>

            {/* Second Look response */}
            <div className="demo-card" style={{ marginBottom: '1.5rem', borderLeft: '3px solid #C9A84C' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                    <Shield style={{ width: '18px', height: '18px', color: '#C9A84C' }} />
                    <h3 style={{
                        fontFamily: "'Merriweather', serif",
                        color: '#0B1E36',
                        fontSize: '1rem',
                        fontWeight: 600,
                    }}>
                        Second Look Response
                    </h3>
                </div>

                <div style={{ background: '#fefce8', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem', border: '1px solid rgba(201,168,76,0.15)' }}>
                    <p style={{ color: '#334155', fontSize: '0.9rem', lineHeight: 1.65 }}>
                        <strong>Assessment:</strong> This is a classic bank impersonation scam (also known as &ldquo;vishing&rdquo;). Legitimate banks will never ask for a full account number, sort code, or one-time passcode over the phone. The urgency and pressure described are strong indicators of social engineering.
                    </p>
                </div>

                <p style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Recommended actions</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '1.5rem' }}>
                    {CHECKLIST.map((item, i) => (
                        <div key={i} className="demo-checklist-item">
                            <CheckCircle style={{ width: '16px', height: '16px', color: '#22c55e', flexShrink: 0, marginTop: '2px' }} />
                            {item}
                        </div>
                    ))}
                </div>

                <Button
                    variant="secondary"
                    size="md"
                    onClick={() => { }}
                    style={{ fontSize: '0.85rem' }}
                >
                    <Download style={{ width: '16px', height: '16px' }} />
                    Download PDF summary (demo)
                </Button>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Tab: Monthly Insight Report
   ═══════════════════════════════════════════════════════════════════════════ */
function MonthlyReportTab() {
    return (
        <div>
            {/* Summary stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" style={{ marginBottom: '2rem' }}>
                <div className="demo-card" style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '2rem', fontWeight: 700, color: '#0B1E36' }}>12</p>
                    <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Incidents this month</p>
                </div>
                <div className="demo-card" style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '2rem', fontWeight: 700, color: '#0B1E36' }}>83%</p>
                    <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Resolved within 4 hours</p>
                </div>
                <div className="demo-card" style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '2rem', fontWeight: 700, color: '#0B1E36' }}>0</p>
                    <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Financial losses</p>
                </div>
            </div>

            {/* Top categories */}
            <div className="demo-card" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{
                    fontFamily: "'Merriweather', serif",
                    color: '#0B1E36',
                    fontSize: '1rem',
                    fontWeight: 600,
                    marginBottom: '1.25rem',
                }}>
                    Top scam categories
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {MONTHLY_CATEGORIES.map((cat, i) => (
                        <div key={cat.category} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{
                                width: '24px', height: '24px', borderRadius: '6px',
                                background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.75rem', fontWeight: 700, color: '#64748b', flexShrink: 0,
                            }}>{i + 1}</span>
                            <span style={{ flex: 1, fontSize: '0.88rem', color: '#334155' }}>{cat.category}</span>
                            <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>{cat.count}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Emerging trends */}
            <div className="demo-card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                    <TrendingUp style={{ width: '18px', height: '18px', color: '#C9A84C' }} />
                    <h3 style={{
                        fontFamily: "'Merriweather', serif",
                        color: '#0B1E36',
                        fontSize: '1rem',
                        fontWeight: 600,
                    }}>
                        Emerging trends
                    </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {TRENDS.map((trend, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <span style={{ color: '#C9A84C', marginTop: '2px', flexShrink: 0 }}>→</span>
                            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.6 }}>{trend}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Suggested training */}
            <div className="demo-card" style={{ marginBottom: '1.5rem', borderLeft: '3px solid #3b82f6' }}>
                <h3 style={{
                    fontFamily: "'Merriweather', serif",
                    color: '#0B1E36',
                    fontSize: '1rem',
                    fontWeight: 600,
                    marginBottom: '0.75rem',
                }}>
                    Suggested training focus
                </h3>
                <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65 }}>
                    Based on this month&rsquo;s activity, we recommend refresher training on <strong>recognising phone-based bank impersonation</strong> and <strong>verifying caller identity</strong>. These two categories accounted for <strong>67%</strong> of all submissions.
                </p>
            </div>

            <div style={{ textAlign: 'center' }}>
                <Button
                    variant="secondary"
                    size="md"
                    onClick={() => { }}
                    style={{ fontSize: '0.85rem' }}
                >
                    <Download style={{ width: '16px', height: '16px' }} />
                    Export PDF report (demo)
                </Button>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Page Export
   ═══════════════════════════════════════════════════════════════════════════ */
export function ExampleSafeguardingPage() {
    const [activeTab, setActiveTab] = useState<TabId>('dashboard');

    function handleGetProtection() {
        window.location.href = '/get-protection';
    }

    const TABS: { id: TabId; label: string }[] = [
        { id: 'dashboard', label: 'Dashboard Overview' },
        { id: 'case', label: 'Example Case' },
        { id: 'report', label: 'Monthly Insight Report' },
    ];

    return (
        <>
            <style>{SCOPED_STYLES}</style>
            <div className="demo-env-page">
                <Navbar onGetProtection={handleGetProtection} />

                {/* Header */}
                <header style={{
                    background: '#ffffff',
                    borderBottom: '1px solid #e2e8f0',
                    padding: '5rem 0 3rem',
                }}>
                    <div className="max-w-4xl mx-auto px-6 md:px-10" style={{ textAlign: 'center' }}>
                        <span className="demo-badge">
                            <Shield style={{ width: '13px', height: '13px' }} />
                            Demo Environment
                        </span>

                        <h1 style={{
                            fontFamily: "'Merriweather', serif",
                            color: '#0B1E36',
                            fontSize: 'clamp(1.6rem, 3.2vw, 2.5rem)',
                            fontWeight: 700,
                            marginTop: '1.25rem',
                            marginBottom: '1rem',
                            lineHeight: 1.25,
                        }}>
                            Example Safeguarding Dashboard
                        </h1>

                        <p style={{
                            color: '#475569',
                            fontSize: '1.05rem',
                            lineHeight: 1.7,
                            maxWidth: '600px',
                            margin: '0 auto 1.5rem',
                        }}>
                            Explore how Second Look Protect supports organisations through clear case tracking, human-reviewed guidance and safeguarding insight.
                        </p>

                        <div className="demo-notice" style={{ maxWidth: '420px', margin: '0 auto 1.5rem' }}>
                            <Shield style={{ width: '16px', height: '16px', color: '#C9A84C', flexShrink: 0 }} />
                            This is a view-only demonstration.
                        </div>

                        <div className="demo-reassurance">
                            <span><UserCheck style={{ width: '13px', height: '13px' }} /> Human-reviewed guidance</span>
                            <span><Shield style={{ width: '13px', height: '13px' }} /> Built for safeguarding workflows</span>
                            <span><Globe style={{ width: '13px', height: '13px' }} /> Designed for care environments</span>
                        </div>

                        <p style={{
                            color: '#94a3b8',
                            fontSize: '0.88rem',
                            marginTop: '1.25rem',
                        }}>
                            Designed for safeguarding leads, care managers and support teams.
                        </p>
                    </div>
                </header>

                {/* Main content */}
                <main className="max-w-4xl mx-auto px-6 md:px-10" style={{ padding: '2rem 1.5rem 4rem' }}>

                    {/* Scenario framing */}
                    <div style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '1.25rem 1.5rem',
                        marginBottom: '2rem',
                    }}>
                        <p style={{
                            color: '#94a3b8',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            marginBottom: '8px',
                        }}>
                            Example scenario
                        </p>
                        <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.65 }}>
                            A resident receives a suspicious call claiming to be from their bank.
                            Staff upload the details into Second Look Protect &rarr; clear human-reviewed guidance is returned &rarr; the incident contributes to monthly safeguarding insight to help identify emerging risks.
                        </p>
                    </div>

                    {/* Tab bar */}
                    <div className="demo-tab-bar">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                className={`demo-tab${activeTab === tab.id ? ' active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    {activeTab === 'dashboard' && <DashboardTab />}
                    {activeTab === 'case' && <ExampleCaseTab />}
                    {activeTab === 'report' && <MonthlyReportTab />}

                    {/* What this delivers */}
                    <section style={{
                        marginTop: '3rem',
                        paddingTop: '2.5rem',
                        borderTop: '1px solid #e2e8f0',
                    }}>
                        <h2 style={{
                            fontFamily: "'Merriweather', serif",
                            color: '#0B1E36',
                            textAlign: 'center',
                            marginBottom: '2rem',
                            fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)',
                            fontWeight: 600,
                        }}>
                            What this delivers for your organisation
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div className="demo-card">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                    <Eye style={{ width: '18px', height: '18px', color: '#C9A84C' }} />
                                    <h3 style={{ fontFamily: "'Merriweather', serif", color: '#0B1E36', fontSize: '0.95rem', fontWeight: 600 }}>
                                        Clear safeguarding visibility
                                    </h3>
                                </div>
                                <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.6 }}>
                                    See all reported concerns in one place with structured tracking and status clarity.
                                </p>
                            </div>
                            <div className="demo-card">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                    <UserCheck style={{ width: '18px', height: '18px', color: '#C9A84C' }} />
                                    <h3 style={{ fontFamily: "'Merriweather', serif", color: '#0B1E36', fontSize: '0.95rem', fontWeight: 600 }}>
                                        Human-reviewed guidance
                                    </h3>
                                </div>
                                <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.6 }}>
                                    Receive calm, plain-language responses designed to support real safeguarding decisions.
                                </p>
                            </div>
                            <div className="demo-card">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                    <BarChart3 style={{ width: '18px', height: '18px', color: '#C9A84C' }} />
                                    <h3 style={{ fontFamily: "'Merriweather', serif", color: '#0B1E36', fontSize: '0.95rem', fontWeight: 600 }}>
                                        Monthly safeguarding insight
                                    </h3>
                                </div>
                                <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.6 }}>
                                    Identify patterns, emerging scam types and areas requiring additional awareness.
                                </p>
                            </div>
                            <div className="demo-card">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                    <ClipboardList style={{ width: '18px', height: '18px', color: '#C9A84C' }} />
                                    <h3 style={{ fontFamily: "'Merriweather', serif", color: '#0B1E36', fontSize: '0.95rem', fontWeight: 600 }}>
                                        Audit-ready documentation
                                    </h3>
                                </div>
                                <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.6 }}>
                                    Maintain structured records that support governance, reporting and safeguarding oversight.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Authority Layer — Governance awareness */}
                    <section style={{
                        marginTop: '2.5rem',
                        paddingTop: '2rem',
                        paddingBottom: '0.5rem',
                        borderTop: '1px solid #e2e8f0',
                    }}>
                        <div style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            padding: '1.5rem 1.75rem',
                        }}>
                            <h3 style={{
                                fontFamily: "'Merriweather', serif",
                                color: '#0B1E36',
                                fontSize: '0.95rem',
                                fontWeight: 600,
                                marginBottom: '0.75rem',
                            }}>
                                Safeguarding governance support
                            </h3>
                            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '1rem' }}>
                                Second Look Protect is designed to support existing safeguarding structures within care and supported living environments. Case records are structured clearly, guidance is human-reviewed, and insight reporting is designed to assist oversight, supervision and governance discussions.
                            </p>
                            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '1rem' }}>
                                Designed to complement existing safeguarding policies and reporting procedures &mdash; not replace them.
                            </p>
                            <p style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.55, marginBottom: '0.75rem' }}>
                                Second Look Protect provides safeguarding guidance and organisational insight. Final safeguarding decisions remain with your designated leads and management team.
                            </p>
                            <p style={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.5 }}>
                                Built with privacy-conscious design and sensitive information handling in mind.
                            </p>
                        </div>
                    </section>

                    {/* Procurement Calm Layer */}
                    <div style={{
                        marginTop: '1.5rem',
                        padding: '1.5rem 1.75rem',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                    }}>
                        <h3 style={{
                            fontFamily: "'Merriweather', serif",
                            color: '#0B1E36',
                            fontSize: '0.92rem',
                            fontWeight: 600,
                            marginBottom: '0.75rem',
                        }}>
                            Designed to fit into existing safeguarding processes
                        </h3>
                        <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '0.75rem' }}>
                            Second Look Protect is designed to support &mdash; not replace &mdash; existing safeguarding policies, reporting procedures and professional roles.
                        </p>
                        <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '1.25rem' }}>
                            The platform works alongside current workflows, helping staff respond to modern scam risks while maintaining established oversight structures. Organisations remain fully in control of decision-making and safeguarding actions.
                        </p>
                        <p style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.55, marginBottom: '0.5rem' }}>
                            No complex setup required. Designed for simple adoption within care environments.
                        </p>
                        <p style={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.5 }}>
                            Pilot environments can be introduced gradually to evaluate fit within your organisation.
                        </p>
                    </div>

                    {/* Founder Credibility Anchor */}
                    <div style={{
                        marginTop: '1.5rem',
                        padding: '1.5rem 1.75rem',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                    }}>
                        <h3 style={{
                            fontFamily: "'Merriweather', serif",
                            color: '#0B1E36',
                            fontSize: '0.92rem',
                            fontWeight: 600,
                            marginBottom: '0.75rem',
                        }}>
                            Responsible development and oversight
                        </h3>
                        <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '0.75rem' }}>
                            Second Look Protect has been developed with a focus on practical safeguarding realities within care and supported living environments.
                        </p>
                        <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '0.75rem' }}>
                            The platform is overseen directly to ensure guidance remains responsible, context-aware and aligned with safeguarding best practice.
                        </p>
                        <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '1.25rem' }}>
                            Organisations exploring implementation can discuss fit, oversight and operational alignment before adoption.
                        </p>
                        <p style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.55, marginBottom: '0.5rem' }}>
                            Developed in the UK with care environments in mind.
                        </p>
                        <p style={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.5 }}>
                            Enquiries regarding organisational implementation are handled directly.
                        </p>
                    </div>

                    {/* Board Ready Layer */}
                    <div style={{
                        marginTop: '1.5rem',
                        padding: '1.5rem 1.75rem',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                    }}>
                        <h3 style={{
                            fontFamily: "'Merriweather', serif",
                            color: '#0B1E36',
                            fontSize: '0.92rem',
                            fontWeight: 600,
                            marginBottom: '0.75rem',
                        }}>
                            Suitable for safeguarding oversight and board-level review
                        </h3>
                        <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '0.75rem' }}>
                            Second Look Protect is designed to provide structured safeguarding visibility without altering existing governance frameworks.
                        </p>
                        <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '0.75rem' }}>
                            The platform supports clearer incident tracking, trend identification and operational awareness &mdash; enabling safeguarding leads to provide informed updates within management and trustee discussions.
                        </p>
                        <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '1.25rem' }}>
                            Implementation can be introduced gradually, allowing organisations to evaluate alignment with internal policies and reporting standards.
                        </p>
                        <p style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.55, marginBottom: '0.5rem' }}>
                            By centralising modern scam-related concerns into a structured workflow, organisations can reduce reactive handling and strengthen proactive safeguarding awareness.
                        </p>
                        <p style={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.5 }}>
                            Designed with sensitivity to safeguarding responsibilities, accountability structures and organisational oversight.
                        </p>
                    </div>

                    {/* Regulatory Conscious Layer */}
                    <div style={{
                        marginTop: '1.5rem',
                        padding: '1.5rem 1.75rem',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                    }}>
                        <h3 style={{
                            fontFamily: "'Merriweather', serif",
                            color: '#0B1E36',
                            fontSize: '0.92rem',
                            fontWeight: 600,
                            marginBottom: '0.75rem',
                        }}>
                            Designed with regulated care environments in mind
                        </h3>
                        <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '0.75rem' }}>
                            Second Look Protect has been developed with awareness of the structured safeguarding responsibilities present within regulated care and supported living environments.
                        </p>
                        <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '1.25rem' }}>
                            The platform supports clear documentation, structured workflows and responsible oversight &mdash; helping organisations respond to evolving scam risks while maintaining alignment with existing safeguarding expectations.
                        </p>
                        <p style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.55, marginBottom: '0.5rem' }}>
                            Designed to complement established safeguarding procedures and professional judgement.
                        </p>
                        <p style={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.5 }}>
                            The system provides guidance and organisational insight while respecting the professional responsibilities of safeguarding leads and management teams.
                        </p>
                    </div>

                    {/* Calm conversion CTA */}
                    <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
                        <Button
                            variant="secondary"
                            size="md"
                            as="a"
                            href="/organisations"
                            style={{ fontSize: '0.88rem' }}
                        >
                            Explore how this would work for your organisation
                            <ArrowRight style={{ width: '16px', height: '16px' }} />
                        </Button>
                    </div>

                    {/* Back link */}
                    <div style={{ textAlign: 'center', marginTop: '3rem' }}>
                        <Button
                            variant="secondary"
                            size="md"
                            as="a"
                            href="/organisations"
                            style={{ fontSize: '0.88rem' }}
                        >
                            <ArrowLeft style={{ width: '16px', height: '16px' }} />
                            Back to organisations
                        </Button>
                    </div>
                </main>

                {/* Footer */}
                <footer style={{
                    background: '#0B1E36',
                    color: '#94a3b8',
                    padding: '2rem 0',
                    textAlign: 'center',
                    fontSize: '0.82rem',
                }}>
                    <p>&copy; {new Date().getFullYear()} Second Look Protect. All rights reserved.</p>
                </footer>
            </div>
        </>
    );
}
