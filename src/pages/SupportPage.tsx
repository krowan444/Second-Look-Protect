import React from 'react';
import { Shield } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export function SupportPage({ onBack }: Props) {
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
                    <p className="text-[#C9A84C] text-xs font-semibold tracking-widest uppercase mb-3">Help &amp; Assistance</p>
                    <h1
                        className="text-[#0B1E36] mb-4"
                        style={{ fontFamily: "'Merriweather', serif" }}
                    >
                        Support
                    </h1>
                    <p className="text-slate-600 text-lg leading-relaxed">
                        Need help or have a question? Contact us using the details below.
                    </p>
                </div>

                {/* Safety Note */}
                <div className="bg-[#112540] border-l-4 border-[#C9A84C] rounded-xl p-6 mb-10">
                    <p className="text-white font-semibold text-base">
                        🔒 We will <span className="text-[#C9A84C]">never</span> ask for passwords, bank PINs, or one-time passcodes.
                    </p>
                </div>

                {/* Contact Cards */}
                <div className="grid sm:grid-cols-2 gap-5 mb-12">

                    {/* General Enquiries */}
                    <a
                        href="mailto:hello@secondlookprotect.co.uk"
                        className="group flex flex-col gap-3 bg-white rounded-xl p-7 border border-slate-100 shadow-sm hover:shadow-md hover:border-[#C9A84C]/40 transition-all duration-200"
                        aria-label="Email general enquiries"
                    >
                        <div className="w-12 h-12 rounded-full bg-[#C9A84C]/10 flex items-center justify-center group-hover:bg-[#C9A84C]/20 transition-colors">
                            <span className="text-xl" aria-hidden="true">✉</span>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">General Enquiries</p>
                            <p className="text-[#0B1E36] font-semibold text-sm break-all">hello@secondlookprotect.co.uk</p>
                            <p className="text-slate-400 text-xs mt-1">Questions, billing, and general help</p>
                        </div>
                    </a>

                    {/* Technical Support */}
                    <a
                        href="mailto:support@secondlookprotect.co.uk"
                        className="group flex flex-col gap-3 bg-white rounded-xl p-7 border border-slate-100 shadow-sm hover:shadow-md hover:border-[#C9A84C]/40 transition-all duration-200"
                        aria-label="Email technical support"
                    >
                        <div className="w-12 h-12 rounded-full bg-[#C9A84C]/10 flex items-center justify-center group-hover:bg-[#C9A84C]/20 transition-colors">
                            <span className="text-xl" aria-hidden="true">🛠</span>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Technical Support</p>
                            <p className="text-[#0B1E36] font-semibold text-sm break-all">support@secondlookprotect.co.uk</p>
                            <p className="text-slate-400 text-xs mt-1">Account access, technical issues</p>
                        </div>
                    </a>

                    {/* Landline */}
                    <a
                        href="tel:01604385888"
                        className="group flex flex-col gap-3 bg-white rounded-xl p-7 border border-slate-100 shadow-sm hover:shadow-md hover:border-[#C9A84C]/40 transition-all duration-200"
                        aria-label="Call office on 01604 385888"
                    >
                        <div className="w-12 h-12 rounded-full bg-[#C9A84C]/10 flex items-center justify-center group-hover:bg-[#C9A84C]/20 transition-colors">
                            <span className="text-xl" aria-hidden="true">📞</span>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Office Line</p>
                            <p className="text-[#0B1E36] font-semibold text-base">01604 385888</p>
                            <p className="text-slate-400 text-xs mt-1">Office telephone</p>
                        </div>
                    </a>

                    {/* Mobile */}
                    <a
                        href="tel:07907614821"
                        className="group flex flex-col gap-3 bg-white rounded-xl p-7 border border-slate-100 shadow-sm hover:shadow-md hover:border-[#C9A84C]/40 transition-all duration-200"
                        aria-label="Call or WhatsApp 07907 614821"
                    >
                        <div className="w-12 h-12 rounded-full bg-[#C9A84C]/10 flex items-center justify-center group-hover:bg-[#C9A84C]/20 transition-colors">
                            <span className="text-xl" aria-hidden="true">📱</span>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Mobile / WhatsApp</p>
                            <p className="text-[#0B1E36] font-semibold text-base">07907 614821</p>
                            <p className="text-slate-400 text-xs mt-1">Call or WhatsApp</p>
                        </div>
                    </a>
                </div>

                {/* Response times */}
                <div className="bg-slate-100 rounded-xl p-6 text-center">
                    <p className="text-slate-600 text-base">
                        We aim to respond as soon as possible.
                    </p>
                    <p className="text-slate-500 text-sm mt-2 italic">
                        Mon – Sat · 8am – 8pm · Typical response within 1 hour during operating hours.
                    </p>
                </div>
            </main>

            {/* Minimal footer */}
            <footer className="bg-[#0A1C32] text-slate-400 py-8 border-t border-white/8 text-center text-sm">
                <p>© {new Date().getFullYear()} Second Look Protect Ltd. All rights reserved.</p>
                <div className="flex justify-center gap-6 mt-3">
                    <button onClick={onBack} className="hover:text-white transition-colors duration-200">Home</button>
                    <a href="/privacy-policy" onClick={(e) => { e.preventDefault(); onBack(); }} className="hover:text-white transition-colors duration-200">Privacy Policy</a>
                </div>
            </footer>
        </div>
    );
}
