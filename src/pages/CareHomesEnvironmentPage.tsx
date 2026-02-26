import React from 'react';
import { Navbar } from '../components/Navbar';
import { Button } from '../components/Button';
import {
    Shield, CheckCircle, Eye, FileText,
    Users, ArrowRight, ArrowLeft, AlertTriangle, Settings,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   Care Homes Environment Page
   ═══════════════════════════════════════════════════════════════════════════ */

export function CareHomesEnvironmentPage() {
    return (
        <>
            <style>{`
                .care-env-page { background: #ffffff; }
                .care-env-card {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 1.5rem;
                }
                .care-env-step {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 1.25rem 1.5rem;
                    display: flex;
                    gap: 1rem;
                    align-items: flex-start;
                }
                .care-env-step-num {
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

            <div className="care-env-page min-h-screen">
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
                            <Shield style={{ width: '13px', height: '13px' }} />
                            Care Home Environments
                        </span>

                        <h1 style={{
                            fontFamily: "'Merriweather', serif",
                            color: '#0B1E36',
                            fontSize: 'clamp(1.5rem, 3vw, 2.1rem)',
                            fontWeight: 700,
                            marginBottom: '1.25rem',
                            lineHeight: 1.25,
                        }}>
                            Structured safeguarding support for modern care home environments
                        </h1>

                        <p style={{
                            color: '#475569',
                            fontSize: '1.05rem',
                            lineHeight: 1.7,
                            maxWidth: '600px',
                            margin: '0 auto 1.5rem',
                        }}>
                            Helping safeguarding leads and care teams respond calmly to increasingly sophisticated scam risks through clear visibility, human-reviewed guidance and structured oversight.
                        </p>

                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '2rem' }}>
                            Designed with real safeguarding workflows in mind.
                        </p>

                        <Button
                            variant="primary"
                            size="md"
                            as="a"
                            href="/example-safeguarding-environment"
                            style={{ fontSize: '0.92rem' }}
                        >
                            Explore how this works in care homes
                            <ArrowRight style={{ width: '16px', height: '16px' }} />
                        </Button>
                    </div>
                </header>

                {/* ── Main content ─────────────────────────────────────────── */}
                <main className="max-w-4xl mx-auto px-6 md:px-10" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>

                    {/* ── SECTION 2: Changing Nature ───────────────────────── */}
                    <section style={{ marginBottom: '3rem' }}>
                        <h2 style={{
                            fontFamily: "'Merriweather', serif",
                            color: '#0B1E36',
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            marginBottom: '1rem',
                        }}>
                            The changing nature of resident safeguarding
                        </h2>
                        <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>
                            Care homes increasingly support residents facing highly convincing impersonation attempts, fraudulent communications and evolving digital threats.
                        </p>
                        <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>
                            While staff often respond thoughtfully, managing these concerns informally can make it harder to maintain consistent visibility, recognise emerging patterns or support structured oversight across teams.
                        </p>
                        <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.7 }}>
                            Introducing calm structure helps strengthen safeguarding clarity without altering professional judgement or existing procedures.
                        </p>
                    </section>

                    {/* ── SECTION 3: How It Works ──────────────────────────── */}
                    <section style={{
                        marginBottom: '3rem',
                        paddingTop: '2.5rem',
                        borderTop: '1px solid #e2e8f0',
                    }}>
                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '1.25rem', textAlign: 'center' }}>
                            Designed to integrate naturally into existing safeguarding workflows.
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
                            <div className="care-env-step">
                                <span className="care-env-step-num">1</span>
                                <div>
                                    <h3 style={{ color: '#0B1E36', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                        Concern raised
                                    </h3>
                                    <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.55 }}>
                                        Resident or staff identifies suspicious interaction.
                                    </p>
                                </div>
                            </div>
                            <div className="care-env-step">
                                <span className="care-env-step-num">2</span>
                                <div>
                                    <h3 style={{ color: '#0B1E36', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                        Structured guidance provided
                                    </h3>
                                    <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.55 }}>
                                        Clear human-reviewed recommendations support decision-making.
                                    </p>
                                </div>
                            </div>
                            <div className="care-env-step">
                                <span className="care-env-step-num">3</span>
                                <div>
                                    <h3 style={{ color: '#0B1E36', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                        Oversight strengthened
                                    </h3>
                                    <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.55 }}>
                                        Cases contribute to organisational visibility and safeguarding insight.
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
                            Supporting safeguarding confidence across the organisation
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="care-env-card">
                                <Eye style={{ width: '20px', height: '20px', color: '#C9A84C', marginBottom: '0.75rem' }} />
                                <h3 style={{ color: '#0B1E36', fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                    Clear safeguarding visibility
                                </h3>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.55 }}>
                                    Maintain structured awareness without reliance on fragmented communication.
                                </p>
                            </div>
                            <div className="care-env-card">
                                <Users style={{ width: '20px', height: '20px', color: '#C9A84C', marginBottom: '0.75rem' }} />
                                <h3 style={{ color: '#0B1E36', fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                    Staff reassurance and clarity
                                </h3>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.55 }}>
                                    Provide measured guidance when responding to resident concerns.
                                </p>
                            </div>
                            <div className="care-env-card">
                                <Shield style={{ width: '20px', height: '20px', color: '#C9A84C', marginBottom: '0.75rem' }} />
                                <h3 style={{ color: '#0B1E36', fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                    Resident trust and reassurance
                                </h3>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.55 }}>
                                    Support vulnerable individuals through calm, consistent responses.
                                </p>
                            </div>
                            <div className="care-env-card">
                                <FileText style={{ width: '20px', height: '20px', color: '#C9A84C', marginBottom: '0.75rem' }} />
                                <h3 style={{ color: '#0B1E36', fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                    Governance-ready documentation
                                </h3>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.55 }}>
                                    Retain structured records that support oversight discussions and safeguarding reviews.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* ── SECTION 5: Complement Existing Frameworks ───────── */}
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
                                Designed to complement existing safeguarding frameworks
                            </h3>
                            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '0.75rem' }}>
                                Second Look Protect does not replace safeguarding procedures or professional expertise.
                            </p>
                            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65 }}>
                                Instead, it provides additional structure &mdash; helping teams maintain visibility and confidence as risks evolve.
                            </p>
                        </div>
                    </section>

                    {/* ── SECTION 6: Introduced at Your Pace ──────────────── */}
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
                                Introduced at a pace that suits your organisation
                            </h3>
                            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '0.75rem' }}>
                                Many care homes begin by exploring how structured visibility fits alongside existing processes before wider adoption.
                            </p>
                            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65 }}>
                                This allows safeguarding leads to assess alignment calmly without immediate change.
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
                            Explore how structured safeguarding could support your care environment
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
