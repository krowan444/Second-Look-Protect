import React, { useState, useEffect } from 'react';
import { Shield, Menu, X } from 'lucide-react';
import { Button } from './Button';

const NAV_LINKS = [
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Plans', href: '#pricing' },
    { label: 'Reviews', href: '#testimonials' },
    { label: 'FAQ', href: '#faq' },
];

export function Navbar() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setIsScrolled(window.scrollY > 40);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    /* Trap focus and close on Escape */
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
            <header
                role="banner"
                className={[
                    'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
                    isScrolled
                        ? 'bg-[#112540]/98 backdrop-blur-md shadow-lg py-4'
                        : 'bg-[#112540] py-5',
                ].join(' ')}
            >
                <div className="max-w-6xl mx-auto px-6 md:px-10 flex items-center justify-between">
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
                        <Button variant="secondary" size="md"
                            className="border-white/30 text-white hover:bg-white hover:text-[#0B1E36]"
                            as="a" href="#pricing"
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

            {/* Mobile menu */}
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
                    <div className="mt-10">
                        <Button variant="primary" size="lg" className="w-full justify-center bg-[#C9A84C] text-[#0B1E36] hover:bg-[#D9BC78] border-0"
                            as="a" href="#pricing"
                        >
                            Get Protection
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
}
