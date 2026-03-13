/* ═══════════════════════════════════════════════════════════════════════════
   Stape-Lee — Brain (Local Prompt-Matching Engine)
   ═══════════════════════════════════════════════════════════════════════════
   Takes a user message + page context and returns a structured response by
   matching keywords against the knowledge base. No external AI API needed.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { PageContext } from './usePageContext';
import {
    productOverview,
    pageGuides,
    statusGlossary,
    riskGlossary,
    decisionGlossary,
    caseLifecycle,
    workflowGuides,
    toneRules,
    feedbackStructure,
} from './stapeLeeKnowledge';

/* ── Response types ──────────────────────────────────────────────────────── */

export interface StapeLeeResponse {
    text: string;
    type: 'answer' | 'feedback_draft' | 'unknown';
    action?: 'start_feedback';
}

/* ── Main function ───────────────────────────────────────────────────────── */

export function askStapeLee(message: string, context: PageContext): StapeLeeResponse {
    const q = message.toLowerCase().trim();

    // ── 1. Greeting ─────────────────────────────────────────────────────
    if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(q)) {
        return {
            text: `Hello! I'm Stape-Lee, your dashboard assistant. You're currently on the **${context.pageName}** page. How can I help you?`,
            type: 'answer',
        };
    }

    // ── 2. "What is this page?" / "Where am I?" ────────────────────────
    if (/what.*(this page|page is this)|where am i|explain this page|what am i looking at/.test(q)) {
        return pageExplanation(context);
    }

    // ── 3. "What can I do here?" ────────────────────────────────────────
    if (/what can i do|what actions|what.*(available|possible)|help me/.test(q) && !/submit|send|feedback/.test(q)) {
        return pageActions(context);
    }

    // ── 4. Status / risk / decision glossary ────────────────────────────
    for (const [key, entry] of Object.entries(statusGlossary)) {
        if (q.includes(key) || q.includes(entry.label.toLowerCase())) {
            return {
                text: `**${entry.label}** (status: \`${key}\`)\n\n${entry.meaning}\n\nColour indicator: ${entry.colour}.`,
                type: 'answer',
            };
        }
    }

    for (const [key, entry] of Object.entries(riskGlossary)) {
        if (q.includes(`${key} risk`) || (q.includes(key) && /risk|level|severity/.test(q))) {
            return {
                text: `**${key.charAt(0).toUpperCase() + key.slice(1)} Risk**\n\n${entry.meaning}\n\nColour indicator: ${entry.colour}.`,
                type: 'answer',
            };
        }
    }

    for (const [key, meaning] of Object.entries(decisionGlossary)) {
        if (q.includes(key) || q.includes(key.replace('_', ' '))) {
            return {
                text: `**${key.replace('_', ' ')}** — ${meaning}`,
                type: 'answer',
            };
        }
    }

    // ── 5. "What does X mean?" (generic status catch) ───────────────────
    if (/what does .+ mean|what is .+ status|explain .+ status/.test(q)) {
        return {
            text: statusOverview(),
            type: 'answer',
        };
    }

    // ── 6. Workflow guides ──────────────────────────────────────────────
    if (/how.*(submit|create|report|raise).*(case|incident)/.test(q)) {
        return workflowAnswer('submitCase');
    }
    if (/how.*(review|triage).*(case|incident)/.test(q)) {
        return workflowAnswer('reviewCase');
    }
    if (/how.*(close|resolve).*(case|incident)/.test(q)) {
        return workflowAnswer('closeCase');
    }
    if (/how.*(generate|create|run).*(report|inspection)/.test(q)) {
        return workflowAnswer('generateReport');
    }

    // ── 7. Case lifecycle ──────────────────────────────────────────────
    if (/case lifecycle|case flow|case process|stages|what happens.*(case|after)/.test(q)) {
        return {
            text: '**Case Lifecycle**\n\n' +
                caseLifecycle.map(s => `**${s.step}. ${s.title}** — ${s.description}`).join('\n\n'),
            type: 'answer',
        };
    }

    // ── 8. "What should I do next?" ────────────────────────────────────
    if (/what.*(should|do).*(next|now)|next step|what now/.test(q)) {
        return nextStepAdvice(context);
    }

    // ── 9. Product overview ────────────────────────────────────────────
    if (/what is (second look|this product|this app|this system|slp)/.test(q)) {
        return {
            text: `**${productOverview.name}**\n\n${productOverview.description}\n\n*${productOverview.tagline}*`,
            type: 'answer',
        };
    }

    // ── 10. Developer feedback ─────────────────────────────────────────
    if (/feedback|bug|feature request|suggestion|report.*(issue|problem)|something.*(wrong|broken)/.test(q)) {
        return {
            text: 'I can help you send feedback to the development team. I\'ll draft a structured message for you to review before sending.\n\nPlease describe the feedback — is it a **Bug Report**, **Feature Request**, **UX Feedback**, or **General** comment?',
            type: 'feedback_draft',
            action: 'start_feedback',
        };
    }

    // ── 11. Tips for current page ──────────────────────────────────────
    if (/tip|advice|hint|best practice/.test(q)) {
        return pageTips(context);
    }

    // ── 12. Explain simply / ELI5 ──────────────────────────────────────
    if (/explain.*(simply|easy|basic|plain)|eli5|in simple terms/.test(q)) {
        return simpleExplanation(context);
    }

    // ── 13. Fallback ───────────────────────────────────────────────────
    return {
        text: `I'm not sure I understand that. Here are some things I can help with:\n\n` +
            `• **"What is this page?"** — I'll explain where you are\n` +
            `• **"How do I submit a case?"** — Step-by-step guidance\n` +
            `• **"What does submitted mean?"** — Status glossary\n` +
            `• **"What should I do next?"** — Contextual advice\n` +
            `• **"Send feedback"** — Draft a message for the dev team\n` +
            `• **"Case lifecycle"** — How cases flow through the system\n\n` +
            `You're currently on the **${context.pageName}** page.`,
        type: 'unknown',
    };
}

/* ── Helper builders ─────────────────────────────────────────────────────── */

function pageExplanation(ctx: PageContext): StapeLeeResponse {
    const guide = pageGuides[ctx.section];
    if (!guide) {
        return {
            text: `You're on the **${ctx.pageName}** page. I don't have a detailed guide for this page yet, but I'm here to help if you have specific questions.`,
            type: 'answer',
        };
    }

    let text = `**${guide.name}**\n\n${guide.description}`;
    if (ctx.caseId) {
        text += `\n\nYou're viewing case \`${ctx.caseId.slice(0, 8)}…\``;
    }
    return { text, type: 'answer' };
}

function pageActions(ctx: PageContext): StapeLeeResponse {
    const guide = pageGuides[ctx.section];
    if (!guide) {
        return {
            text: `On the **${ctx.pageName}** page you can explore the available options. Ask me about a specific action and I'll try to help.`,
            type: 'answer',
        };
    }

    const text = `**What you can do on ${guide.name}:**\n\n` +
        guide.actions.map(a => `• ${a}`).join('\n');
    return { text, type: 'answer' };
}

function pageTips(ctx: PageContext): StapeLeeResponse {
    const guide = pageGuides[ctx.section];
    if (!guide || guide.tips.length === 0) {
        return { text: `I don't have specific tips for this page yet. Try asking "what can I do here?" instead.`, type: 'answer' };
    }

    const text = `**Tips for ${guide.name}:**\n\n` +
        guide.tips.map(t => `💡 ${t}`).join('\n\n');
    return { text, type: 'answer' };
}

function workflowAnswer(key: string): StapeLeeResponse {
    const wf = workflowGuides[key];
    if (!wf) return { text: 'I don\'t have a guide for that yet.', type: 'unknown' };

    const text = `**${wf.title}**\n\n` +
        wf.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
    return { text, type: 'answer' };
}

function statusOverview(): string {
    const lines = Object.entries(statusGlossary).map(
        ([key, e]) => `• **${e.label}** (\`${key}\`) — ${e.meaning}`
    );
    return `**Status Glossary**\n\n${lines.join('\n')}\n\n` +
        `**Risk Levels:** ${Object.keys(riskGlossary).join(', ')}.\n` +
        `**Decisions:** ${Object.keys(decisionGlossary).map(k => k.replace('_', ' ')).join(', ')}.`;
}

function nextStepAdvice(ctx: PageContext): StapeLeeResponse {
    switch (ctx.section) {
        case 'overview':
            return { text: 'From the **Overview**, check if there are any executive alerts or cases awaiting review. If the queue looks clear, you\'re in good shape!', type: 'answer' };
        case 'submit':
            return { text: 'You\'re on the **Submit Case** page. Choose a submission type and fill in the details. Once submitted, the case will be automatically triaged.', type: 'answer' };
        case 'cases':
            return { text: 'You\'re browsing **Cases**. Look for any that say "Needs Review" — those should be prioritised. Click a case to open its detail page.', type: 'answer' };
        case 'cases/detail':
            return {
                text: `You're viewing a **case detail** page${ctx.caseId ? ` (case \`${ctx.caseId.slice(0, 8)}…\`)` : ''}. ` +
                    'Next steps: review the AI triage report, check any evidence, and decide whether to update the status, add notes, or close the case.',
                type: 'answer',
            };
        case 'review-queue':
            return { text: 'You\'re in the **Review Queue**. Work through cases from top to bottom — highest priority first. Click a case to review it.', type: 'answer' };
        case 'reports':
            return { text: 'You\'re on the **Reports** page. Choose a report type and time period, then generate it. You can download the PDF or share it directly.', type: 'answer' };
        default:
            return { text: `You're on the **${ctx.pageName}** page. Explore what's available or ask me a specific question about what you'd like to do.`, type: 'answer' };
    }
}

function simpleExplanation(ctx: PageContext): StapeLeeResponse {
    const guide = pageGuides[ctx.section];
    if (!guide) {
        return { text: `This is the **${ctx.pageName}** page. It's part of the Second Look Protect dashboard where care organisations manage safeguarding concerns.`, type: 'answer' };
    }

    // Build a simpler version
    const simple = guide.description
        .replace(/AI-assisted triage/g, 'automatic checking')
        .replace(/audit trail/g, 'activity log')
        .replace(/compliance/g, 'record-keeping');

    return { text: `**${guide.name}** (in plain English)\n\n${simple}`, type: 'answer' };
}
