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
        category: 'Platform & Purpose',
        items: [
            {
                question: 'What is Second Look Protect for?',
                answer: 'Second Look Protect helps care homes and care groups record suspicious incidents, review scam related safeguarding concerns, track actions, and maintain clearer oversight. It is designed to support teams protecting vulnerable residents and to strengthen reporting for governance and inspection.',
            },
            {
                question: 'Who is the platform designed for?',
                answer: 'Second Look Protect is designed for care home managers, safeguarding leads, compliance managers, operations leaders, and care groups that need a more structured way to handle scam related safeguarding concerns and maintain oversight.',
            },
            {
                question: 'Is this only for one care home, or can it support groups?',
                answer: 'It can support both single site providers and multi site care groups. For larger organisations, the platform can help leadership teams maintain clearer visibility across services and monitor safeguarding pressure more effectively.',
            },
        ],
    },
    {
        category: 'Recording & Reviewing',
        items: [
            {
                question: 'What kinds of concerns can be recorded?',
                answer: 'Teams can record suspicious calls, emails, text messages, payment requests, impersonation attempts, questionable links, screenshots, and wider financial abuse related concerns. The aim is to create one clear place to log and review issues before risk escalates.',
            },
            {
                question: 'How does the workflow support safeguarding teams?',
                answer: 'The platform supports a clearer safeguarding process by helping staff raise concerns, managers review risk, teams record decisions, and organisations maintain a stronger audit trail. This makes follow up and oversight more consistent.',
            },
            {
                question: 'Can staff use it without complex training?',
                answer: 'The platform is designed to be clear and practical for real world use. Staff should be able to record concerns in a structured way without needing advanced technical knowledge.',
            },
            {
                question: 'What if a concern turns out to be low risk?',
                answer: 'That still has value. Recording low concern incidents helps organisations show that concerns were reviewed properly, supports pattern tracking, and creates a clearer history if similar issues happen again.',
            },
        ],
    },
    {
        category: 'Governance & Intelligence',
        items: [
            {
                question: 'How does this help with inspection readiness?',
                answer: 'Second Look Protect helps organisations maintain clearer records of concerns, reviews, actions, and reporting. This supports stronger governance and makes it easier to evidence oversight when internal leadership or inspectors need to see how concerns are being managed.',
            },
            {
                question: 'Can this help with repeated targeting or wider patterns?',
                answer: 'Yes. One of the benefits of structured concern recording is that organisations can build a clearer picture over time, including repeated issues, repeated resident targeting, and wider operational pressure.',
            },
            {
                question: 'Does the platform replace professional safeguarding judgement?',
                answer: 'No. Second Look Protect is there to support teams with structure, visibility, and consistency. It does not replace safeguarding judgement, internal procedures, or management decision making. Final decisions remain with the organisation.',
            },
            {
                question: 'How is AI used in the platform?',
                answer: 'AI is used as a supporting layer to help teams review information more clearly and consistently. It is there to assist early assessment and triage, while human oversight and organisational judgement remain in control.',
            },
        ],
    },
    {
        category: 'Support & Next Steps',
        items: [
            {
                question: 'How do we get started?',
                answer: 'The best starting point is a demo. This gives your organisation a practical walkthrough of how the platform works and helps you decide whether it fits your safeguarding and reporting needs.',
            },
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
                        and include your name, your organisation, and a brief description of the issue. We&rsquo;ll get back to you as soon as possible.
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
                        . You can also call us directly.
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
