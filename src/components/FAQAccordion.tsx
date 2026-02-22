import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

interface FAQItem {
    question: string;
    answer: React.ReactNode;
}

interface FAQGroup {
    category: string;
    items: FAQItem[];
}

const FAQ_GROUPS: FAQGroup[] = [
    {
        category: 'How It Works',
        items: [
            {
                question: 'What exactly is a "Second Look"?',
                answer: (
                    <>
                        It&rsquo;s a moment to pause before you act. When you receive a message, link, call, or invoice that feels uncertain, you forward it to us. We review it carefully, check for warning signs and behind-the-scenes indicators, and provide a clear risk assessment &mdash; along with calm guidance on what to do next.
                    </>
                ),
            },
            {
                question: 'How do I send something for review?',
                answer: (
                    <>
                        <p className="mb-3">If you can message a friend, you can use Second Look. Simply:</p>
                        <ul className="space-y-1 mb-3">
                            <li className="flex items-start gap-2"><span className="text-[#A8853C] mt-1" aria-hidden="true">→</span>Forward the email</li>
                            <li className="flex items-start gap-2"><span className="text-[#A8853C] mt-1" aria-hidden="true">→</span>Screenshot the message</li>
                            <li className="flex items-start gap-2"><span className="text-[#A8853C] mt-1" aria-hidden="true">→</span>Send the link via WhatsApp</li>
                        </ul>
                        <p>No complicated portals. No technical setup.</p>
                    </>
                ),
            },
            {
                question: 'What exactly happens when I send something?',
                answer: (
                    <>
                        One of our UK-based fraud specialists reviews the message &mdash; checking sender details, link destinations, technical markers, and language patterns.
                        <br /><br />
                        You receive a clear verdict: <strong>Safe or Scam</strong>, plus recommended next steps.
                    </>
                ),
            },
            {
                question: 'How quickly will I get a response?',
                answer: 'Most reviews are returned quickly, often within a short time of submission. Priority response is available for urgent situations.',
            },
        ],
    },
    {
        category: 'Trust & Safety',
        items: [
            {
                question: 'Is my information kept private?',
                answer: 'Yes. Anything you send for review is treated confidentially and used solely for assessment purposes. We never sell or share your information.',
            },
            {
                question: 'Do you guarantee something is 100% safe?',
                answer: 'No service can offer 100% certainty in an evolving digital world. We provide a professional risk assessment based on clear indicators. If there is any doubt, our advice will always prioritise caution and verification through official channels.',
            },
            {
                question: 'What if you get it wrong?',
                answer: 'Scams evolve quickly, which is why we assess risk carefully and explain our reasoning clearly. When in doubt, we err on the side of caution. Our goal is to reduce risk and pressure &mdash; not rush decisions.',
            },
            {
                question: 'Do you use artificial intelligence?',
                answer: 'We use modern tools behind the scenes to help identify warning signs efficiently. Every assessment is reviewed carefully before guidance is given. Our focus is clear, human guidance &mdash; not automation.',
            },
        ],
    },
    {
        category: 'Membership & Value',
        items: [
            {
                question: 'Why is there a monthly fee?',
                answer: 'Scammers don\'t take holidays. For less than £1 a day, you have a trusted second opinion before sending money or personal information. You\'re paying for prevention, clarity, and peace of mind.',
            },
            {
                question: 'What if I don\'t use it this month?',
                answer: 'That\'s good news &mdash; it means you stayed safe. Even when you don\'t submit a check, we monitor UK scam trends and provide proactive awareness. Like a smoke alarm, it may stay quiet &mdash; but it\'s there when you need it.',
            },
            {
                question: 'Can I cancel at any time?',
                answer: 'Yes. There are no long-term contracts and no complicated cancellation process. You can cancel at any time.',
            },
            {
                question: 'What if I\'ve never been scammed before?',
                answer: 'Most people who lose money to scams had never been scammed before. This service exists to protect you before a costly mistake happens.',
            },
        ],
    },
    {
        category: 'Situational Questions',
        items: [
            {
                question: 'What if I\'ve already clicked a link or sent money?',
                answer: (
                    <>
                        First &mdash; act quickly. Every member receives access to our <strong>Recovery Blueprint</strong>: a calm, step-by-step checklist covering who to contact, what to say, and how to secure your accounts.
                        <br /><br />
                        Quick action makes a difference.
                    </>
                ),
            },
            {
                question: 'How is this different from my bank\'s fraud team?',
                answer: 'Banks often step in after money has moved. We help before you act &mdash; reviewing suspicious messages, links, and invoices in advance so you can avoid the problem entirely.',
            },
            {
                question: 'Why are scams harder to spot now?',
                answer: (
                    <>
                        <p className="mb-3">Because they look real. Modern scams can:</p>
                        <ul className="space-y-1 mb-3">
                            <li className="flex items-start gap-2"><span className="text-[#A8853C] mt-1" aria-hidden="true">→</span>Use perfect English</li>
                            <li className="flex items-start gap-2"><span className="text-[#A8853C] mt-1" aria-hidden="true">→</span>Spoof legitimate phone numbers</li>
                            <li className="flex items-start gap-2"><span className="text-[#A8853C] mt-1" aria-hidden="true">→</span>Clone voices using AI</li>
                            <li className="flex items-start gap-2"><span className="text-[#A8853C] mt-1" aria-hidden="true">→</span>Copy trusted brand websites</li>
                            <li className="flex items-start gap-2"><span className="text-[#A8853C] mt-1" aria-hidden="true">→</span>Create urgency to pressure quick decisions</li>
                        </ul>
                        <p>They are designed to catch people in the moment &mdash; not because they lack intelligence, but because they are busy or under pressure.</p>
                    </>
                ),
            },
            {
                question: 'Can I use this to protect my parents or a loved one?',
                answer: 'Yes. Many members join specifically to protect a parent or family member. Family options allow shared access and added peace of mind.',
            },
        ],
    },
    {
        category: 'Support & Contact',
        items: [
            {
                question: 'I need technical support — how do I get help?',
                answer: (
                    <>
                        Email our support team at{' '}
                        <a
                            href="mailto:support@secondlookprotect.co.uk"
                            className="text-[#A8853C] underline underline-offset-2 hover:text-[#C9A84C] transition-colors"
                        >
                            support@secondlookprotect.co.uk
                        </a>{' '}
                        and include your name, the email you signed up with, and a brief description of the issue. We&rsquo;ll get back to you as soon as possible.
                    </>
                ),
            },
            {
                question: 'How do I contact you for general enquiries?',
                answer: (
                    <>
                        For general questions, partnerships, or billing queries, email us at{' '}
                        <a
                            href="mailto:hello@secondlookprotect.co.uk"
                            className="text-[#A8853C] underline underline-offset-2 hover:text-[#C9A84C] transition-colors"
                        >
                            hello@secondlookprotect.co.uk
                        </a>
                        . You can also call us directly — details are shown above.
                    </>
                ),
            },
        ],
    },
];

/* ─── Accordion item ──────────────────────────────────────────────────────── */

interface FAQAccordionItemProps {
    item: FAQItem;
    globalIndex: number;
    isOpen: boolean;
    onToggle: () => void;
}

function FAQAccordionItem({ item, globalIndex, isOpen, onToggle }: FAQAccordionItemProps) {
    const panelId = `faq-panel-${globalIndex}`;
    const triggerId = `faq-trigger-${globalIndex}`;

    return (
        <div className="border-b border-slate-200 last:border-0">
            <h3>
                <button
                    id={triggerId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={onToggle}
                    className="w-full flex items-center justify-between gap-4 py-5 text-left text-[#0B1E36] font-semibold text-base
                        hover:text-[#1A3354] transition-colors duration-200
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-inset rounded-sm"
                >
                    <span>{item.question}</span>
                    <span className="shrink-0 text-[#A8853C]" aria-hidden="true">
                        {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </span>
                </button>
            </h3>

            <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                hidden={!isOpen}
            >
                <div className="pb-5 text-slate-600 text-base leading-relaxed max-w-prose">
                    {typeof item.answer === 'string' ? <p>{item.answer}</p> : item.answer}
                </div>
            </div>
        </div>
    );
}

/* ─── Main export ─────────────────────────────────────────────────────────── */

export function FAQAccordion() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    // Flatten all items with a global index for aria IDs
    let globalCounter = 0;

    return (
        <div aria-label="Frequently asked questions">
            {FAQ_GROUPS.map((group) => (
                <div key={group.category} className="mb-10 last:mb-0">
                    {/* Category label */}
                    <p className="text-xs font-semibold tracking-widest uppercase text-[#A8853C] mb-4 pb-3 border-b border-[#C9A84C]/20">
                        {group.category}
                    </p>

                    <div role="list" aria-label={`${group.category} questions`}>
                        {group.items.map((item) => {
                            const idx = globalCounter++;
                            return (
                                <div key={item.question} role="listitem">
                                    <FAQAccordionItem
                                        item={item}
                                        globalIndex={idx}
                                        isOpen={openIndex === idx}
                                        onToggle={() => setOpenIndex(openIndex === idx ? null : idx)}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
