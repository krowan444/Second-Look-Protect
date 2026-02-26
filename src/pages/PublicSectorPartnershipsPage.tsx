import React from 'react';
import { Navbar } from '../components/Navbar';
import { Button } from '../components/Button';
import {
    Shield, Eye, FileText, Users,
    ArrowRight, ArrowLeft, Landmark, TrendingUp,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   Public Sector & Partnerships Environment Page
   ═══════════════════════════════════════════════════════════════════════════ */

export function PublicSectorPartnershipsPage() {
    return (
        <>
            <style>{`
                .psp-page { background: #ffffff; }
                .psp-card {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 1.5rem;
                }
                .psp-step {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 1.25rem 1.5rem;
                    display: flex;
                    gap: 1rem;
                    align-items: flex-start;
                }
                .psp-step-num {
                    background: #0B1E36;
                    color: #C9A84C;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 0.85rem;
                    flex-shrink: 0;
                }
            `}</style>

            <div className="psp-page min-h-screen">
                <Navbar onGetProtection={() => {
                    window.location.href = '/get-protection';
                }} />

                {/* ── SECTION 1: Hero ──────────────────────────────────────── */}
                <header style={{
                    background: 'linear-gradient(165deg, #F4F6F8 0%, #EEF1F5 40%, #F9F9F7 100%)',
                    borderBottom: '1px solid #e2e8f0',
                    padding: '5rem 0 3rem',
                }}>
                    <div className="max-w-4xl mx-auto px-6 md:px-10" style={{ textAlign: 'center' }}>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.75rem',
                            color: '#64748b',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '9999px',
                            padding: '5px 14px',
                            fontWeight: 500,
                            marginBottom: '1.5rem',
                        }}>
                            <Landmark style={{ width: '13px', height: '13px' }} />
                            Public Sector &amp; Partnerships
                        </span>

                        <h1 style={{
                            fontFamily: "'Merriweather', serif",
                            color: '#0B1E36',
                            fontSize: 'clamp(1.5rem, 3vw, 2.1rem)',
                            fontWeight: 700,
                            marginBottom: '1.25rem',
                            lineHeight: 1.25,
                        }}>
                            Structured safeguarding visibility for public sector and partnership environments
                        </h1>

                        <p style={{
                            color: '#475569',
                            fontSize: '1.05rem',
                            lineHeight: 1.7,
                            maxWidth: '600px',
                            margin: '0 auto 1.5rem',
                        }}>
                            Supporting organisations responding to evolving scam risks through clear documentation, calm escalation pathways and governance-ready insight.
                        </p>

                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '2rem' }}>
                            Designed for safeguarding leads, oversight teams and multi-agency environments.
                        </p>

                        <Button
                            variant="primary"
                            size="md"
                            as="a"
                            href="/example-safeguarding-environment"
                            style={{ fontSize: '0.92rem' }}
                        >
                            Explore how this fits public sector environments
                            <ArrowRight style={{ width: '16px', height: '16px' }} />
                        </Button>
                    </div>
                </header>

                {/* ── Main content ─────────────────────────────────────────── */}
                <main className="max-w-4xl mx-auto px-6 md:px-10" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>

                    {/* ── SECTION 2: Context ───────────────────────────────── */}
                    <section style={{ marginBottom: '3rem' }}>
                        <h2 style={{
                            fontFamily: "'Merriweather', serif",
                            color: '#0B1E36',
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            marginBottom: '1rem',
                        }}>
                            Strengthening oversight in an evolving risk landscape
                        </h2>
                        <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>
                            Public sector teams and partnership environments increasingly encounter scam-related concerns affecting vulnerable individuals across communities.
                        </p>
                        <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>
                            As digital threats become more sophisticated &mdash; including AI-enabled impersonation and complex social engineering &mdash; maintaining structured visibility becomes essential for consistent safeguarding oversight.
                        </p>
                        <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.7 }}>
                            Introducing calm, structured workflows helps strengthen documentation, support internal reporting and provide clearer visibility across services.
                        </p>
                    </section>

                    {/* ── SECTION 3: How It Works ──────────────────────────── */}
                    <section style={{
                        marginBottom: '3rem',
                        paddingTop: '2.5rem',
                        borderTop: '1px solid #e2e8f0',
                    }}>
                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '1.25rem', textAlign: 'center' }}>
                            Designed to align with existing safeguarding frameworks and oversight structures.
                        </p>
                        <h2 style={{
                            fontFamily: "'Merriweather', serif",
                            color: '#0B1E36',
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            marginBottom: '1.5rem',
                            textAlign: 'center',
                        }}>
                            How it works in practice
                        </h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="psp-step">
                                <span className="psp-step-num">1</span>
                                <div>
                                    <h3 style={{ color: '#0B1E36', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                        Concern recorded
                                    </h3>
                                    <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.55 }}>
                                        A case is logged following a reported suspicious interaction.
                                    </p>
                                </div>
                            </div>
                            <div className="psp-step">
                                <span className="psp-step-num">2</span>
                                <div>
                                    <h3 style={{ color: '#0B1E36', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                        Guidance provided
                                    </h3>
                                    <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.55 }}>
                                        Human-reviewed recommendations support consistent, proportionate responses.
                                    </p>
                                </div>
                            </div>
                            <div className="psp-step">
                                <span className="psp-step-num">3</span>
                                <div>
                                    <h3 style={{ color: '#0B1E36', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                        Organisational insight generated
                                    </h3>
                                    <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.55 }}>
                                        Structured case data contributes to trend awareness and safeguarding reporting.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ── SECTION 4: Outcomes ──────────────────────────────── */}
                    <section style={{
                        marginBottom: '3rem',
                        paddingTop: '2.5rem',
                        borderTop: '1px solid #e2e8f0',
                    }}>
                        <h2 style={{
                            fontFamily: "'Merriweather', serif",
                            color: '#0B1E36',
                            fontSize: '1.15rem',
                            fontWeight: 700,
                            marginBottom: '1.5rem',
                            textAlign: 'center',
                        }}>
                            What this delivers for public sector and partnership environments
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="psp-card">
                                <FileText style={{ width: '20px', height: '20px', color: '#C9A84C', marginBottom: '0.75rem' }} />
                                <h3 style={{ color: '#0B1E36', fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                    Governance-ready documentation
                                </h3>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.55 }}>
                                    Maintain structured records suitable for internal review and oversight discussions.
                                </p>
                            </div>
                            <div className="psp-card">
                                <Shield style={{ width: '20px', height: '20px', color: '#C9A84C', marginBottom: '0.75rem' }} />
                                <h3 style={{ color: '#0B1E36', fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                    Clear escalation pathways
                                </h3>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.55 }}>
                                    Support proportionate responses aligned with safeguarding responsibilities.
                                </p>
                            </div>
                            <div className="psp-card">
                                <TrendingUp style={{ width: '20px', height: '20px', color: '#C9A84C', marginBottom: '0.75rem' }} />
                                <h3 style={{ color: '#0B1E36', fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                    Trend visibility across services
                                </h3>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.55 }}>
                                    Recognise emerging scam patterns affecting vulnerable communities.
                                </p>
                            </div>
                            <div className="psp-card">
                                <Eye style={{ width: '20px', height: '20px', color: '#C9A84C', marginBottom: '0.75rem' }} />
                                <h3 style={{ color: '#0B1E36', fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                    Structured reporting support
                                </h3>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.55 }}>
                                    Assist safeguarding leads in communicating risk exposure clearly and confidently.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* ── SECTION 5: Alignment ────────────────────────────── */}
                    <section style={{
                        marginBottom: '2.5rem',
                        paddingTop: '2rem',
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
                                Designed to complement existing safeguarding and regulatory frameworks
                            </h3>
                            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '0.75rem' }}>
                                Second Look Protect does not replace statutory responsibilities, professional judgement or safeguarding policy.
                            </p>
                            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65 }}>
                                It provides structured visibility and calm guidance to support existing governance structures as risks evolve.
                            </p>
                        </div>
                    </section>

                    {/* ── SECTION 6: Implementation ───────────────────────── */}
                    <section style={{ marginBottom: '2.5rem' }}>
                        <div style={{
                            background: '#ffffff',
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
                                Introduced in a measured and responsible way
                            </h3>
                            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '0.75rem' }}>
                                Public sector environments may begin with a limited evaluation phase to assess operational alignment, reporting integration and safeguarding value before broader implementation.
                            </p>
                            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65 }}>
                                No immediate structural change required.
                            </p>
                        </div>
                    </section>

                    {/* ── SECTION 7: Final CTA ────────────────────────────── */}
                    <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
                        <Button
                            variant="primary"
                            size="md"
                            as="a"
                            href="/example-safeguarding-environment"
                            style={{ fontSize: '0.92rem' }}
                        >
                            Explore how structured safeguarding visibility could support your organisation
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
