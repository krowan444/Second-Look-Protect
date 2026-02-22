import React from 'react';
import { Shield } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export function PrivacyPolicyPage({ onBack }: Props) {
    return (
        <div className="min-h-screen bg-slate-50 selection:bg-[#C9A84C]/30 selection:text-[#0B1E36]">
            {/* Minimal nav header */}
            <header className="bg-[#0B1E36] border-b border-white/8 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-6 md:px-10 h-[72px] flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="text-slate-400 hover:text-white transition-colors duration-200 text-sm flex items-center gap-2"
                        aria-label="Go back to homepage"
                    >
                        ← Back
                    </button>
                    <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-[#C9A84C]" aria-hidden="true" />
                        <span className="text-white font-semibold" style={{ fontFamily: "'Merriweather', serif" }}>
                            Second Look Protect
                        </span>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-3xl mx-auto px-6 md:px-10 py-16 md:py-20">
                <div className="mb-10">
                    <p className="text-[#C9A84C] text-xs font-semibold tracking-widest uppercase mb-3">Legal</p>
                    <h1
                        className="text-[#0B1E36] mb-4"
                        style={{ fontFamily: "'Merriweather', serif" }}
                    >
                        Privacy Policy
                    </h1>
                    <p className="text-slate-500 text-sm">Last updated: February 2026</p>
                </div>

                {/* Safety Note */}
                <div className="bg-[#112540] border-l-4 border-[#C9A84C] rounded-xl p-6 mb-10">
                    <p className="text-white font-semibold text-base">
                        🔒 Important: Second Look Protect will <span className="text-[#C9A84C]">never</span> ask you for passwords, bank PINs, or one-time passcodes.
                    </p>
                </div>

                <div className="space-y-10 text-slate-700 text-base leading-relaxed">

                    <section>
                        <h2 className="text-[#0B1E36] text-xl font-semibold mb-3" style={{ fontFamily: "'Merriweather', serif" }}>1. Who We Are</h2>
                        <p>
                            Second Look Protect Ltd (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is a UK-based, independent verification service registered in England and Wales (Company No. 15847293). We are registered with the UK Information Commissioner&rsquo;s Office (ICO).
                        </p>
                        <p className="mt-3">
                            This Privacy Policy explains how we collect, use, store, and protect your personal information when you use our website and services at{' '}
                            <a href="https://www.secondlookprotect.co.uk" className="text-[#A8853C] hover:text-[#C9A84C] transition-colors duration-200">
                                www.secondlookprotect.co.uk
                            </a>.
                        </p>
                        <p className="mt-3">
                            For any privacy queries, please contact us at:{' '}
                            <a href="mailto:hello@secondlookprotect.co.uk" className="text-[#A8853C] hover:text-[#C9A84C] transition-colors duration-200">
                                hello@secondlookprotect.co.uk
                            </a>{' '}or{' '}
                            <a href="mailto:support@secondlookprotect.co.uk" className="text-[#A8853C] hover:text-[#C9A84C] transition-colors duration-200">
                                support@secondlookprotect.co.uk
                            </a>
                        </p>
                    </section>

                    <section>
                        <h2 className="text-[#0B1E36] text-xl font-semibold mb-3" style={{ fontFamily: "'Merriweather', serif" }}>2. What Data We Collect</h2>
                        <p>We may collect the following personal data when you use our service:</p>
                        <ul className="mt-4 space-y-2 list-none">
                            {[
                                'Name and email address (required to create and manage your account)',
                                'Phone number, if you choose to provide it',
                                'Uploaded images, screenshots, links, and messages that you submit for review',
                                'Basic technical data including IP address, device type, and browser type — collected for security and fraud prevention purposes',
                                'Billing information processed securely through our payment provider, Stripe',
                            ].map((item) => (
                                <li key={item} className="flex items-start gap-3">
                                    <span className="text-[#C9A84C] font-bold mt-0.5">→</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-[#0B1E36] text-xl font-semibold mb-3" style={{ fontFamily: "'Merriweather', serif" }}>3. Why We Collect It</h2>
                        <p>We collect your personal data for the following purposes:</p>
                        <ul className="mt-4 space-y-2 list-none">
                            {[
                                'To provide the Second Look Protect service — reviewing suspicious messages, websites, and links on your behalf and delivering a clear risk assessment',
                                'To manage your account and subscription',
                                'To provide customer and technical support',
                                'To improve and develop our service based on usage patterns',
                                'To prevent fraud and ensure the security of our systems',
                                'To comply with our legal obligations under UK law',
                            ].map((item) => (
                                <li key={item} className="flex items-start gap-3">
                                    <span className="text-[#C9A84C] font-bold mt-0.5">→</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-[#0B1E36] text-xl font-semibold mb-3" style={{ fontFamily: "'Merriweather', serif" }}>4. How We Store and Protect Your Data</h2>
                        <p>
                            We take the security of your personal data seriously. Your data is stored on secure, encrypted infrastructure provided by our trusted technology partners. We apply appropriate technical and organisational measures to protect your data against unauthorised access, loss, or disclosure.
                        </p>
                        <p className="mt-3 font-medium text-[#0B1E36]">
                            We do not sell your personal data to any third party. Ever.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-[#0B1E36] text-xl font-semibold mb-3" style={{ fontFamily: "'Merriweather', serif" }}>5. Who We Share Data With</h2>
                        <p>
                            We only share your personal data with trusted third-party providers where it is strictly necessary to operate our service. These providers include:
                        </p>
                        <ul className="mt-4 space-y-2 list-none">
                            {[
                                'Stripe — our payment processor, for handling subscription billing securely',
                                'Supabase — our database and storage provider, for securely storing account and submission data',
                                'Vercel — our hosting provider, for delivering the website and its API functions',
                            ].map((item) => (
                                <li key={item} className="flex items-start gap-3">
                                    <span className="text-[#C9A84C] font-bold mt-0.5">→</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                        <p className="mt-4">
                            All third-party providers are required to handle your data in accordance with applicable data protection laws. We do not share your data with any other organisations unless required to do so by law.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-[#0B1E36] text-xl font-semibold mb-3" style={{ fontFamily: "'Merriweather', serif" }}>6. How Long We Keep Your Data</h2>
                        <p>
                            We retain your personal data only for as long as is necessary to provide our service and meet our legal obligations. When your account is closed, we will delete or anonymise your personal data within a reasonable period, unless we are required by law to retain it for longer.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-[#0B1E36] text-xl font-semibold mb-3" style={{ fontFamily: "'Merriweather', serif" }}>7. Your Rights (UK GDPR)</h2>
                        <p>Under UK GDPR, you have the following rights regarding your personal data:</p>
                        <ul className="mt-4 space-y-2 list-none">
                            {[
                                'Right of access — you can request a copy of the personal data we hold about you',
                                'Right to rectification — you can ask us to correct inaccurate or incomplete data',
                                'Right to erasure — you can request that we delete your personal data, subject to legal requirements',
                                'Right to restriction — you can ask us to restrict how we process your data in certain circumstances',
                                'Right to object — you can object to certain types of processing of your data',
                                'Right to data portability — where applicable, you can request your data in a portable format',
                            ].map((item) => (
                                <li key={item} className="flex items-start gap-3">
                                    <span className="text-[#C9A84C] font-bold mt-0.5">→</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                        <p className="mt-4">
                            To exercise any of these rights, please contact us at{' '}
                            <a href="mailto:hello@secondlookprotect.co.uk" className="text-[#A8853C] hover:text-[#C9A84C] transition-colors duration-200">
                                hello@secondlookprotect.co.uk
                            </a>. We will respond within 30 days. You also have the right to lodge a complaint with the Information Commissioner&rsquo;s Office (ICO) at{' '}
                            <a href="https://ico.org.uk" className="text-[#A8853C] hover:text-[#C9A84C] transition-colors duration-200" target="_blank" rel="noopener noreferrer">
                                ico.org.uk
                            </a>.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-[#0B1E36] text-xl font-semibold mb-3" style={{ fontFamily: "'Merriweather', serif" }}>8. Cookies</h2>
                        <p>
                            Our website may use essential cookies to ensure the site functions correctly. We do not use tracking or advertising cookies. By using our site, you consent to the use of essential cookies.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-[#0B1E36] text-xl font-semibold mb-3" style={{ fontFamily: "'Merriweather', serif" }}>9. Changes to This Policy</h2>
                        <p>
                            We may update this Privacy Policy from time to time. If we make significant changes, we will notify you by email or by posting a notice on our website. The &ldquo;Last updated&rdquo; date at the top of this page reflects the most recent revision.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-[#0B1E36] text-xl font-semibold mb-3" style={{ fontFamily: "'Merriweather', serif" }}>10. Contact Us</h2>
                        <p>For any questions about this Privacy Policy or how we handle your data, please get in touch:</p>
                        <div className="mt-4 space-y-2">
                            <p>
                                <span className="text-slate-500">General enquiries:</span>{' '}
                                <a href="mailto:hello@secondlookprotect.co.uk" className="text-[#A8853C] hover:text-[#C9A84C] transition-colors duration-200 font-medium">
                                    hello@secondlookprotect.co.uk
                                </a>
                            </p>
                            <p>
                                <span className="text-slate-500">Technical support:</span>{' '}
                                <a href="mailto:support@secondlookprotect.co.uk" className="text-[#A8853C] hover:text-[#C9A84C] transition-colors duration-200 font-medium">
                                    support@secondlookprotect.co.uk
                                </a>
                            </p>
                            <p>
                                <span className="text-slate-500">Company:</span> Second Look Protect Ltd, Company No. 15847293 (England &amp; Wales)
                            </p>
                        </div>
                    </section>

                </div>
            </main>

            {/* Minimal footer */}
            <footer className="bg-[#0A1C32] text-slate-400 py-8 border-t border-white/8 text-center text-sm">
                <p>© {new Date().getFullYear()} Second Look Protect Ltd. All rights reserved.</p>
                <div className="flex justify-center gap-6 mt-3">
                    <button onClick={onBack} className="hover:text-white transition-colors duration-200">Home</button>
                    <a href="/support" onClick={(e) => { e.preventDefault(); onBack(); }} className="hover:text-white transition-colors duration-200">Support</a>
                </div>
            </footer>
        </div>
    );
}
