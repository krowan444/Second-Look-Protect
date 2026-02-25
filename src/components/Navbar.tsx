import React, { useState, useEffect } from 'react';
import { Shield, Menu, X, Phone, Smartphone, Mail } from 'lucide-react';
import { Button } from './Button';

const OFFICE = '01604385888';
const MOBILE = '07907614821';
const OFFICE_DISPLAY = '01604 385888';
const MOBILE_DISPLAY = '07907 614821';

const NAV_LINKS = [
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Plans', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
];

interface NavbarProps {
    onGetProtection?: () => void;
}

export function Navbar({ onGetProtection }: NavbarProps) {
    const [isScrolled, setIsScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [isLandscapeShrunk, setIsLandscapeShrunk] = useState(false);

    useEffect(() => {
        const onScroll = () => setIsScrolled(window.scrollY > 40);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    /* Mobile-landscape scroll shrink */
    useEffect(() => {
        const mq = window.matchMedia('(max-height: 500px) and (orientation: landscape)');
        const update = () => {
            setIsLandscapeShrunk(mq.matches && window.scrollY > 10);
        };
        window.addEventListener('scroll', update, { passive: true });
        mq.addEventListener('change', update);
        update();
        return () => {
            window.removeEventListener('scroll', update);
            mq.removeEventListener('change', update);
        };
    }, []);

    useEffect(() => {
        if (!menuOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [menuOpen]);

    const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        if (href.startsWith('#')) {
            e.preventDefault();
            const el = document.querySelector(href);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
            setMenuOpen(false);
        }
    };

    return (
        <>
            {/* ── Fixed header wrapper (contact bar + nav) ───────────────── */}
            <header
                role="banner"
                className={[
                    'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
                    isScrolled
                        ? 'bg-[#112540]/98 backdrop-blur-md shadow-lg'
                        : 'bg-[#112540]',
                    isLandscapeShrunk ? 'landscape-shrunk' : '',
                ].join(' ')}
            >
                {/* ── Top contact announcement bar (desktop only) ─────────── */}
                <div className="hidden md:block bg-[#0A1C32] border-b border-white/8">
                    <div className="max-w-6xl mx-auto px-6 md:px-10 py-2 flex items-center gap-6 text-xs text-slate-400">
                        <a
                            href={`tel:${OFFICE}`}
                            className="flex items-center gap-1.5 hover:text-[#C9A84C] transition-colors duration-200"
                            aria-label={`Call our office on ${OFFICE_DISPLAY}`}
                        >
                            <Phone className="w-3 h-3 text-[#C9A84C]" aria-hidden="true" />
                            <span className="text-slate-500">Office:</span>
                            <span className="text-slate-300 font-medium">{OFFICE_DISPLAY}</span>
                        </a>

                        <span className="w-px h-3 bg-white/15" aria-hidden="true" />

                        <a
                            href={`tel:${MOBILE}`}
                            className="flex items-center gap-1.5 hover:text-[#C9A84C] transition-colors duration-200"
                            aria-label={`Call or WhatsApp our mobile on ${MOBILE_DISPLAY}`}
                        >
                            <Smartphone className="w-3 h-3 text-[#C9A84C]" aria-hidden="true" />
                            <span className="text-slate-500">Mobile&nbsp;/&nbsp;WhatsApp:</span>
                            <span className="text-slate-300 font-medium">{MOBILE_DISPLAY}</span>
                        </a>

                        <span className="w-px h-3 bg-white/15" aria-hidden="true" />

                        <a
                            href="mailto:hello@secondlookprotect.co.uk"
                            className="flex items-center gap-1.5 hover:text-[#C9A84C] transition-colors duration-200"
                            aria-label="Email hello@secondlookprotect.co.uk"
                        >
                            <Mail className="w-3 h-3 text-[#C9A84C]" aria-hidden="true" />
                            <span className="text-slate-300 font-medium">hello@secondlookprotect.co.uk</span>
                        </a>

                        <span className="ml-auto text-slate-600 italic text-[11px]">
                            Speak directly with a real person — no call centres.
                        </span>
                    </div>
                </div>

                {/* ── Main nav row ────────────────────────────────────────── */}
                <div
                    className={[
                        'max-w-6xl mx-auto px-6 md:px-10 flex items-center justify-between',
                        isScrolled ? 'py-4' : 'py-5',
                    ].join(' ')}
                >
                    {/* Brand */}
                    <a
                        href="#"
                        className="flex items-center gap-3 text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#C9A84C] rounded-sm"
                        aria-label="Second Look Protect — Return to top"
                    >
                        <Shield className="w-7 h-7 text-[#C9A84C]" aria-hidden="true" />
                        <span className="text-lg font-semibold tracking-tight" style={{ fontFamily: "'Merriweather', serif" }}>
                            Second Look Protect
                        </span>
                    </a>

                    {/* Desktop nav */}
                    <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-8">
                        {NAV_LINKS.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                onClick={(e) => handleNavClick(e, link.href)}
                                className="text-slate-300 hover:text-white text-base font-medium transition-colors duration-200
                  focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#C9A84C] rounded-sm px-1"
                            >
                                {link.label}
                            </a>
                        ))}
                        <Button
                            variant="secondary"
                            size="md"
                            className="btn-gold-gradient"
                            onClick={onGetProtection}
                        >
                            Get Protection
                        </Button>
                    </nav>

                    {/* Mobile hamburger */}
                    <button
                        aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                        aria-expanded={menuOpen}
                        aria-controls="mobile-menu"
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="md:hidden text-white p-2 rounded-md
              focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#C9A84C]"
                    >
                        {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </header>

            {/* ── Mobile fullscreen menu ──────────────────────────────────── */}
            {menuOpen && (
                <div
                    id="mobile-menu"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Navigation menu"
                    className="fixed inset-0 z-40 bg-[#112540] flex flex-col pt-24 px-6 pb-10"
                >
                    <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
                        {NAV_LINKS.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                onClick={(e) => handleNavClick(e, link.href)}
                                className="text-white text-2xl font-medium py-4 border-b border-white/10
                  hover:text-[#C9A84C] transition-colors duration-200
                  focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#C9A84C] rounded-sm"
                                style={{ fontFamily: "'Merriweather', serif" }}
                            >
                                {link.label}
                            </a>
                        ))}
                    </nav>

                    {/* Contact details inside mobile menu */}
                    <div className="mt-8 space-y-3 text-sm">
                        <a href={`tel:${OFFICE}`} className="flex items-center gap-2 text-slate-300 hover:text-[#C9A84C] transition-colors">
                            <Phone className="w-4 h-4 text-[#C9A84C]" aria-hidden="true" />
                            Office: {OFFICE_DISPLAY}
                        </a>
                        <a href={`tel:${MOBILE}`} className="flex items-center gap-2 text-slate-300 hover:text-[#C9A84C] transition-colors">
                            <Smartphone className="w-4 h-4 text-[#C9A84C]" aria-hidden="true" />
                            Mobile / WhatsApp: {MOBILE_DISPLAY}
                        </a>
                    </div>

                    <div className="mt-10">
                        <Button variant="primary" size="lg" className="w-full justify-center bg-[#C9A84C] text-[#0B1E36] hover:bg-[#D9BC78] border-0"
                            onClick={onGetProtection}
                        >
                            Get Protection
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Sticky mobile FAB — single primary action ────────────────── */}
            <div className="md:hidden fixed bottom-6 right-4 z-50 home-fab-old">
                <button
                    onClick={onGetProtection}
                    aria-label="Get Protection"
                    className="fab-pulse btn-gold-gradient flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-sm active:scale-95"
                >
                    <Shield className="w-4 h-4 text-white" aria-hidden="true" />
                    Get Protection
                </button>
            </div>
        </>
    );
}
