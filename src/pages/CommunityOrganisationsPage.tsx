import React from 'react';
import { Navbar } from '../components/Navbar';
import { Button } from '../components/Button';
import {
    Shield, Eye, Users, FileText,
    ArrowRight, ArrowLeft, Heart,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   Community Organisations Environment Page
   ═══════════════════════════════════════════════════════════════════════════ */

export function CommunityOrganisationsPage() {
    return (
        <>
            <style>{`
                .co-page { background: #ffffff; }
                .co-card {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 1.5rem;
                }
                .co-step {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 1.25rem 1.5rem;
                    display: flex;
                    gap: 1rem;
                    align-items: flex-start;
                }
                .co-step-num {
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

            <div className="co-page min-h-screen">
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
                            <Users style={{ width: '13px', height: '13px' }} />
                            Community Organisations
                        </span>

                        <h1 style={{
                            fontFamily: "'Merriweather', serif",
                            color: '#0B1E36',
                            fontSize: 'clamp(1.5rem, 3vw, 2.1rem)',
                            fontWeight: 700,
                            marginBottom: '1.25rem',
                            lineHeight: 1.25,
                        }}>
                            Safeguarding support for community organisations
                        </h1>

                        <p style={{
                            color: '#475569',
                            fontSize: '1.05rem',
                            lineHeight: 1.7,
                            maxWidth: '600px',
                            margin: '0 auto 1.5rem',
                        }}>
                            Helping community teams respond calmly to evolving scam risks through clear guidance, simple escalation pathways and structured safeguarding visibility.
                        </p>

                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '2rem' }}>
                            Designed for front-line support teams, outreach services and community-led organisations.
                        </p>

                        <Button
                            variant="primary"
                            size="md"
                            as="a"
                            href="/example-safeguarding-environment"
                            style={{ fontSize: '0.92rem' }}
                        >
                            Explore how this fits community organisations
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
                            Supporting people where scams often surface first
                        </h2>
                        <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>
                            Community organisations often become the first place people turn when something feels suspicious &mdash; whether through outreach work, advice sessions, wellbeing support or informal conversations.
                        </p>
                        <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>
                            As scam tactics become more sophisticated, concerns may be handled across different staff, volunteers or channels, making it harder to maintain consistency, documentation or clear escalation.
                        </p>
                        <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.7 }}>
                            Introducing calm structure helps teams provide reassurance, support safer decision-making and maintain clearer safeguarding visibility.
                        </p>
                    </section>

                    {/* ── SECTION 3: How It Works ──────────────────────────── */}
                    <section style={{
                        marginBottom: '3rem',
                        paddingTop: '2.5rem',
                        borderTop: '1px solid #e2e8f0',
                    }}>
                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '1.25rem', textAlign: 'center' }}>
                            Designed to integrate naturally into community support and safeguarding processes.
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
                            <div className="co-step">
                                <span className="co-step-num">1</span>
                                <div>
                                    <h3 style={{ color: '#0B1E36', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                        Concern raised
                                    </h3>
                                    <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.55 }}>
                                        A service user, volunteer or team member flags a suspicious call, message or online interaction.
                                    </p>
                                </div>
                            </div>
                            <div className="co-step">
                                <span className="co-step-num">2</span>
                                <div>
                                    <h3 style={{ color: '#0B1E36', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                        Guidance returned
                                    </h3>
                                    <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.55 }}>
                                        Human-reviewed recommendations provide calm next steps and escalation clarity.
                                    </p>
                                </div>
                            </div>
                            <div className="co-step">
                                <span className="co-step-num">3</span>
                                <div>
                                    <h3 style={{ color: '#0B1E36', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                        Safeguarding visibility
                                    </h3>
                                    <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.55 }}>
                                        Cases contribute to structured awareness, helping teams recognise patterns and support safer responses.
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
                            What this delivers for community organisations
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="co-card">
                                <Heart style={{ width: '20px', height: '20px', color: '#C9A84C', marginBottom: '0.75rem' }} />
                                <h3 style={{ color: '#0B1E36', fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                    Consistent reassurance
                                </h3>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.55 }}>
                                    Provide calm guidance when people feel uncertain or pressured.
                                </p>
                            </div>
                            <div className="co-card">
                                <Shield style={{ width: '20px', height: '20px', color: '#C9A84C', marginBottom: '0.75rem' }} />
                                <h3 style={{ color: '#0B1E36', fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                    Clear escalation pathways
                                </h3>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.55 }}>
                                    Understand when to involve safeguarding leads, families or external services.
                                </p>
                            </div>
                            <div className="co-card">
                                <Users style={{ width: '20px', height: '20px', color: '#C9A84C', marginBottom: '0.75rem' }} />
                                <h3 style={{ color: '#0B1E36', fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                    Volunteer and staff support
                                </h3>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.55 }}>
                                    Enable consistent responses across teams with simple structured guidance.
                                </p>
                            </div>
                            <div className="co-card">
                                <Eye style={{ width: '20px', height: '20px', color: '#C9A84C', marginBottom: '0.75rem' }} />
                                <h3 style={{ color: '#0B1E36', fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                    Safeguarding visibility
                                </h3>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.55 }}>
                                    Maintain clearer documentation and awareness without adding complexity.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* ── SECTION 5: Procedural Alignment ─────────────────── */}
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
                                Designed to complement safeguarding responsibilities
                            </h3>
                            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '0.75rem' }}>
                                Second Look Protect does not replace professional judgement or safeguarding procedures.
                            </p>
                            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65 }}>
                                It provides additional structure and calm guidance &mdash; supporting consistent responses as risks evolve.
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
                            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '0.75rem' }}>
                                Community organisations can begin with a small evaluation phase, allowing teams to explore fit with existing support services before wider use.
                            </p>
                            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65 }}>
                                No immediate operational disruption required.
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
                            Explore how structured safeguarding could support your community service
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
