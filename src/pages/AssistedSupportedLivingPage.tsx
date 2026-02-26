import React from 'react';
import { Navbar } from '../components/Navbar';
import { Button } from '../components/Button';
import {
    Shield, CheckCircle, Eye, FileText,
    Users, ArrowRight, ArrowLeft, Heart,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   Assisted / Supported Living Environment Page
   ═══════════════════════════════════════════════════════════════════════════ */

export function AssistedSupportedLivingPage() {
    return (
        <>
            <style>{`
                .asl-page { background: #ffffff; }
                .asl-card {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 1.5rem;
                }
                .asl-step {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 1.25rem 1.5rem;
                    display: flex;
                    gap: 1rem;
                    align-items: flex-start;
                }
                .asl-step-num {
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

            <div className="asl-page min-h-screen">
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
                            <Heart style={{ width: '13px', height: '13px' }} />
                            Supported Living Environments
                        </span>

                        <h1 style={{
                            fontFamily: "'Merriweather', serif",
                            color: '#0B1E36',
                            fontSize: 'clamp(1.5rem, 3vw, 2.1rem)',
                            fontWeight: 700,
                            marginBottom: '1.25rem',
                            lineHeight: 1.25,
                        }}>
                            Safeguarding support that protects residents while respecting independence
                        </h1>

                        <p style={{
                            color: '#475569',
                            fontSize: '1.05rem',
                            lineHeight: 1.7,
                            maxWidth: '600px',
                            margin: '0 auto 1.5rem',
                        }}>
                            Helping support teams respond calmly to evolving scam risks through structured guidance that preserves autonomy, choice and dignity.
                        </p>

                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '2rem' }}>
                            Designed for supported living environments where independence and safeguarding work together.
                        </p>

                        <Button
                            variant="primary"
                            size="md"
                            as="a"
                            href="/example-safeguarding-environment"
                            style={{ fontSize: '0.92rem' }}
                        >
                            Explore how this fits supported living
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
                            The evolving safeguarding reality within supported living
                        </h2>
                        <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>
                            Residents in supported living environments often manage their own finances, communication and digital interactions &mdash; creating valuable independence but also exposure to increasingly sophisticated scams.
                        </p>
                        <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>
                            Support teams may need to provide reassurance without overstepping autonomy or introducing unnecessary restriction.
                        </p>
                        <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.7 }}>
                            Structured safeguarding support allows teams to offer calm guidance while maintaining resident independence and professional boundaries.
                        </p>
                    </section>

                    {/* ── SECTION 3: How It Works ──────────────────────────── */}
                    <section style={{
                        marginBottom: '3rem',
                        paddingTop: '2.5rem',
                        borderTop: '1px solid #e2e8f0',
                    }}>
                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '1.25rem', textAlign: 'center' }}>
                            Designed to support independence without intrusive monitoring.
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
                            <div className="asl-step">
                                <span className="asl-step-num">1</span>
                                <div>
                                    <h3 style={{ color: '#0B1E36', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                        Concern identified
                                    </h3>
                                    <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.55 }}>
                                        Resident or support worker flags uncertainty.
                                    </p>
                                </div>
                            </div>
                            <div className="asl-step">
                                <span className="asl-step-num">2</span>
                                <div>
                                    <h3 style={{ color: '#0B1E36', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                        Calm guidance returned
                                    </h3>
                                    <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.55 }}>
                                        Human-reviewed recommendations help clarify next steps.
                                    </p>
                                </div>
                            </div>
                            <div className="asl-step">
                                <span className="asl-step-num">3</span>
                                <div>
                                    <h3 style={{ color: '#0B1E36', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                        Oversight strengthened
                                    </h3>
                                    <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.55 }}>
                                        Insights support safeguarding awareness without restricting resident choice.
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
                            Supporting confidence across supported living environments
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="asl-card">
                                <Heart style={{ width: '20px', height: '20px', color: '#C9A84C', marginBottom: '0.75rem' }} />
                                <h3 style={{ color: '#0B1E36', fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                    Independence supported
                                </h3>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.55 }}>
                                    Provide safeguarding clarity while maintaining resident autonomy.
                                </p>
                            </div>
                            <div className="asl-card">
                                <Users style={{ width: '20px', height: '20px', color: '#C9A84C', marginBottom: '0.75rem' }} />
                                <h3 style={{ color: '#0B1E36', fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                    Staff reassurance
                                </h3>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.55 }}>
                                    Offer consistent responses when residents seek guidance.
                                </p>
                            </div>
                            <div className="asl-card">
                                <Shield style={{ width: '20px', height: '20px', color: '#C9A84C', marginBottom: '0.75rem' }} />
                                <h3 style={{ color: '#0B1E36', fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                    Respectful escalation
                                </h3>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.55 }}>
                                    Clear pathways that maintain dignity while ensuring safety.
                                </p>
                            </div>
                            <div className="asl-card">
                                <Eye style={{ width: '20px', height: '20px', color: '#C9A84C', marginBottom: '0.75rem' }} />
                                <h3 style={{ color: '#0B1E36', fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                    Organisational awareness
                                </h3>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.55 }}>
                                    Recognise emerging risks without surveillance-heavy systems.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* ── SECTION 5: Ethical Alignment ─────────────────────── */}
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
                                Safeguarding that respects autonomy
                            </h3>
                            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '0.75rem' }}>
                                Second Look Protect is designed to enhance safeguarding confidence without removing resident decision-making.
                            </p>
                            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65 }}>
                                The aim is clarity and reassurance &mdash; not restriction.
                            </p>
                        </div>
                    </section>

                    {/* ── SECTION 6: Adoption ─────────────────────────────── */}
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
                                Introduced gradually and responsibly
                            </h3>
                            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65 }}>
                                Supported living environments can explore structured safeguarding through small evaluation phases, allowing teams to assess alignment without operational disruption.
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
                            Explore how structured safeguarding could support your supported living environment
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
