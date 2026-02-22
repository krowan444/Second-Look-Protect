import React from 'react';
import { Shield } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export function TermsOfServicePage({ onBack }: Props) {
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
                        Terms of Service
                    </h1>
                    <p className="text-slate-500 text-sm">Last updated: February 2026</p>
                </div>

                {/* Intro */}
                <div className="bg-slate-100 rounded-xl p-6 mb-10">
                    <p className="text-slate-700 text-base leading-relaxed">
                        Second Look Protect provides a subscription-based digital support service offering general guidance and second opinions on suspicious online messages, emails, websites, and communications to help users improve online safety awareness and confidence. By using our service, you agree to these Terms of Service.
                    </p>
                </div>

                <div className="space-y-10 text-slate-700 text-base leading-relaxed">

                    <section>
                        <h2 className="text-[#0B1E36] text-xl font-semibold mb-3" style={{ fontFamily: "'Merriweather', serif" }}>1. Service Scope</h2>
                        <p className="mb-4">
                            Second Look Protect offers guidance and educational support to help you identify suspicious communications and improve your online safety awareness.
                        </p>
                        <div className="bg-[#112540] border-l-4 border-[#C9A84C] rounded-xl p-6">
                            <p className="text-white font-semibold mb-3">Please note: our service does not constitute:</p>
                            <ul className="space-y-2 text-slate-300">
                                {[
                                    'Financial advice or regulated financial services',
                                    'Legal advice or legal representation',
                                    'Insurance or indemnification against loss',
                                    'A guarantee of fraud prevention or loss recovery',
                                ].map((item) => (
                                    <li key={item} className="flex items-start gap-3">
                                        <span className="text-[#C9A84C] font-bold mt-0.5">→</span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <p className="mt-4">
                            Second Look Protect Ltd is not authorised or regulated by the Financial Conduct Authority (FCA). All guidance is provided in good faith for informational and educational purposes only.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-[#0B1E36] text-xl font-semibold mb-3" style={{ fontFamily: "'Merriweather', serif" }}>2. User Responsibilities</h2>
                        <p className="mb-4">By using our service, you agree that:</p>
                        <ul className="space-y-2 list-none">
                            {[
                                'You will not submit any content that is illegal, harmful, abusive, threatening, defamatory, or otherwise objectionable',
                                'You will not share passwords, PIN numbers, security codes, or other sensitive credentials with us or through our service — we will never ask for these',
                                'You will use the service only for lawful purposes and in accordance with these Terms',
                                'You are responsible for maintaining the confidentiality of your account details',
                            ].map((item) => (
                                <li key={item} className="flex items-start gap-3">
                                    <span className="text-[#C9A84C] font-bold mt-0.5">→</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-[#0B1E36] text-xl font-semibold mb-3" style={{ fontFamily: "'Merriweather', serif" }}>3. Payments and Subscriptions</h2>
                        <ul className="space-y-2 list-none">
                            {[
                                'Subscriptions are billed on a recurring basis (monthly or annually) and renew automatically at the end of each billing period',
                                'You may cancel your subscription at any time by emailing us or using the cancellation method provided to you at signup',
                                'Cancellation takes effect at the end of the current billing period — you retain access to the service until that date',
                                'Prices are displayed in GBP and are inclusive of any applicable taxes',
                                'Payment is processed securely by Stripe — we do not store your payment card details',
                            ].map((item) => (
                                <li key={item} className="flex items-start gap-3">
                                    <span className="text-[#C9A84C] font-bold mt-0.5">→</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-[#0B1E36] text-xl font-semibold mb-3" style={{ fontFamily: "'Merriweather', serif" }}>4. Refund Policy</h2>
                        <p>
                            Refunds are handled on a case-by-case basis in accordance with UK consumer law. Where you believe you are entitled to a refund, please contact us at{' '}
                            <a href="mailto:hello@secondlookprotect.co.uk" className="text-[#A8853C] hover:text-[#C9A84C] transition-colors duration-200">
                                hello@secondlookprotect.co.uk
                            </a>{' '}
                            and we will review your request. This does not affect your statutory rights as a consumer under UK law.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-[#0B1E36] text-xl font-semibold mb-3" style={{ fontFamily: "'Merriweather', serif" }}>5. Limitation of Liability</h2>
                        <p className="mb-3">
                            All guidance provided by Second Look Protect is given in good faith and to the best of our knowledge at the time of review. However:
                        </p>
                        <ul className="space-y-2 list-none">
                            {[
                                'Users remain solely responsible for any decisions or actions taken based on our guidance',
                                'We cannot guarantee that our assessments will identify every threat or prevent every instance of fraud',
                                'To the extent permitted by law, Second Look Protect Ltd shall not be liable for any direct, indirect, incidental, or consequential losses or damages arising from use of the service',
                            ].map((item) => (
                                <li key={item} className="flex items-start gap-3">
                                    <span className="text-[#C9A84C] font-bold mt-0.5">→</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                        <p className="mt-4 text-sm text-slate-500">
                            Nothing in these Terms limits your statutory rights as a consumer under UK law.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-[#0B1E36] text-xl font-semibold mb-3" style={{ fontFamily: "'Merriweather', serif" }}>6. Privacy</h2>
                        <p>
                            Your use of our service is also governed by our{' '}
                            <a
                                href="/privacy-policy"
                                className="text-[#A8853C] hover:text-[#C9A84C] transition-colors duration-200 font-medium"
                            >
                                Privacy Policy
                            </a>
                            , which explains how we collect, use, and protect your personal data in accordance with UK GDPR.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-[#0B1E36] text-xl font-semibold mb-3" style={{ fontFamily: "'Merriweather', serif" }}>7. Changes to These Terms</h2>
                        <p>
                            We may update these Terms of Service from time to time. If we make significant changes, we will notify you by email or by posting a notice on our website. Your continued use of the service after such changes constitutes your acceptance of the updated Terms.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-[#0B1E36] text-xl font-semibold mb-3" style={{ fontFamily: "'Merriweather', serif" }}>8. Governing Law</h2>
                        <p>
                            These Terms of Service are governed by and construed in accordance with the laws of England and Wales. Any disputes arising from these Terms or your use of our service shall be subject to the exclusive jurisdiction of the courts of England and Wales.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-[#0B1E36] text-xl font-semibold mb-3" style={{ fontFamily: "'Merriweather', serif" }}>9. Contact Us</h2>
                        <p>If you have any questions about these Terms of Service, please get in touch:</p>
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
                                <span className="text-slate-500">Phone:</span>{' '}
                                <a href="tel:01604385888" className="text-[#A8853C] hover:text-[#C9A84C] transition-colors duration-200 font-medium">
                                    01604 385888
                                </a>
                            </p>
                            <p className="mt-3 text-sm text-slate-500">
                                Second Look Protect Ltd · Company No. 15847293 (England &amp; Wales)<br />
                                Registered Office: 71–75 Shelton Street, Covent Garden, London, WC2H 9JQ
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
                    <a href="/privacy-policy" className="hover:text-white transition-colors duration-200">Privacy Policy</a>
                    <a href="/support" className="hover:text-white transition-colors duration-200">Support</a>
                </div>
            </footer>
        </div>
    );
}
