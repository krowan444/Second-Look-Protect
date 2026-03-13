/* ═══════════════════════════════════════════════════════════════════════════
   Stape-Lee — Brain (Contextual Intelligence Engine)
   ═══════════════════════════════════════════════════════════════════════════
   Takes a user message + page context and returns smart, evidence-grounded
   responses. Uses keyword matching, page awareness, and the structured
   knowledge base to give specific, practical answers.
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
    if (/^(hi|hello|hey|good morning|good afternoon|good evening|yo|hiya)\b/.test(q)) {
        const guide = pageGuides[context.section];
        const firstAction = guide?.tips?.[0] ? `\n\n💡 Quick tip for this page: ${guide.tips[0]}` : '';
        return {
            text: `Hey! You're on **${context.pageName}**.${context.caseId ? ` Viewing case \`${context.caseId.slice(0, 8)}…\`` : ''}\n\nI can explain this page, guide you through a task, answer questions about statuses or workflows, or draft feedback for the dev team.${firstAction}`,
            type: 'answer',
        };
    }

    // ── 2. "What is this page?" / "Where am I?" ────────────────────────
    if (/what.*(this page|page is this)|where am i|explain this page|what am i looking at|what.*(here|this)/.test(q)) {
        return deepPageExplanation(context);
    }

    // ── 3. "What can I do here?" ────────────────────────────────────────
    if (/what can i do|what actions|what.*(available|possible)|help me with this/.test(q) && !/submit|send|feedback/.test(q)) {
        return contextualActions(context);
    }

    // ── 4. Status / risk / decision glossary ────────────────────────────
    for (const [key, entry] of Object.entries(statusGlossary)) {
        if (q.includes(key) || q.includes(entry.label.toLowerCase())) {
            const pageContext = context.section === 'cases' || context.section === 'cases/detail'
                ? '\n\nOn this page, you can filter or sort by status to find cases in this state.'
                : context.section === 'review-queue'
                    ? '\n\nThe review queue shows cases that need attention — look for this status in the list.'
                    : '';
            return {
                text: `**${entry.label}** — ${entry.meaning}\n\nColour: ${entry.colour} indicator.${pageContext}`,
                type: 'answer',
            };
        }
    }

    for (const [key, entry] of Object.entries(riskGlossary)) {
        if (q.includes(`${key} risk`) || (q.includes(key) && /risk|level|severity|danger/.test(q))) {
            return {
                text: `**${key.charAt(0).toUpperCase() + key.slice(1)} Risk** — ${entry.meaning}\n\nColour: ${entry.colour} indicator.\n\nRisk levels are assigned by the AI triage and can be adjusted by an admin during review.`,
                type: 'answer',
            };
        }
    }

    for (const [key, meaning] of Object.entries(decisionGlossary)) {
        if (q.includes(key) || q.includes(key.replace('_', ' '))) {
            return {
                text: `**${key.replace('_', ' ')}** — ${meaning}\n\nThis decision is set when an admin closes a case. It's the final determination based on the evidence reviewed.`,
                type: 'answer',
            };
        }
    }

    // ── 5. "What does X mean?" (generic status catch) ───────────────────
    if (/what does .+ mean|what is .+ status|explain .+ status/.test(q)) {
        return { text: statusOverview(), type: 'answer' };
    }

    // ── 6. Workflow guides ──────────────────────────────────────────────
    if (/how.*(submit|create|report|raise|make).*(case|incident)|submit a case/.test(q)) {
        return workflowAnswer('submitCase', context);
    }
    if (/how.*(review|triage|assess).*(case|incident)|review a case/.test(q)) {
        return workflowAnswer('reviewCase', context);
    }
    if (/how.*(close|resolve|finish|complete).*(case|incident)|close a case/.test(q)) {
        return workflowAnswer('closeCase', context);
    }
    if (/how.*(generate|create|run|make).*(report|inspection|pack)/.test(q)) {
        return workflowAnswer('generateReport', context);
    }

    // ── 7. Case lifecycle ──────────────────────────────────────────────
    if (/case lifecycle|case flow|case process|stages|what happens.*(case|after|next)|how.*(case.*work|process work)/.test(q)) {
        const currentStep = context.section === 'submit' ? 'You\'re at **Step 1** right now — submitting a case.' :
            context.section === 'cases/detail' ? 'You\'re viewing a case detail page — typically **Steps 3–6** happen here.' :
                context.section === 'review-queue' ? 'The review queue is where **Step 3 (Admin Review)** happens.' : '';
        return {
            text: '**Case Lifecycle**\n\n' +
                caseLifecycle.map(s => `**${s.step}.** ${s.title} — ${s.description}`).join('\n\n') +
                (currentStep ? `\n\n📍 ${currentStep}` : ''),
            type: 'answer',
        };
    }

    // ── 8. "What should I do next?" ────────────────────────────────────
    if (/what.*(should|do).*(next|now)|next step|what now|what.*(first|priority)/.test(q)) {
        return smartNextStep(context);
    }

    // ── 9. Product overview ────────────────────────────────────────────
    if (/what is (second look|this product|this app|this system|slp|the platform)/.test(q)) {
        return {
            text: `**${productOverview.name}** — ${productOverview.tagline}\n\n${productOverview.description}\n\nBuilt for: ${productOverview.audience}`,
            type: 'answer',
        };
    }

    // ── 10. Developer feedback ─────────────────────────────────────────
    if (/feedback|bug report|feature request|suggestion|report.*(issue|problem|bug)|something.*(wrong|broken)|send.*(dev|developer|team)/.test(q)) {
        return {
            text: `I can draft structured feedback for the dev team. I'll auto-fill the page you're on (**${context.pageName}**) and detect the type from your description.\n\nDescribe the issue, suggestion, or feedback and I'll prepare a draft for you to review before sending.`,
            type: 'feedback_draft',
            action: 'start_feedback',
        };
    }

    // ── 11. Tips for current page ──────────────────────────────────────
    if (/tip|advice|hint|best practice|pro tip/.test(q)) {
        return contextualTips(context);
    }

    // ── 12. Explain simply / ELI5 ──────────────────────────────────────
    if (/explain.*(simply|easy|basic|plain)|eli5|in simple terms|dumb it down/.test(q)) {
        return simpleExplanation(context);
    }

    // ── 13. "Look at first" / priority ─────────────────────────────────
    if (/what.*(look|check|focus|priorit)|most important|where.*(start|begin)/.test(q)) {
        return whatToLookAt(context);
    }

    // ── 14. Colours / meaning of colours ───────────────────────────────
    if (/colou?r|green|amber|red|orange|what.*(mean|indicate).*(badge|dot|indicator)/.test(q)) {
        return {
            text: `**Colour Language in Second Look Protect**\n\n🟢 **Green** — Healthy, on track, low risk, resolved.\n🟡 **Amber** — Needs monitoring, medium risk, building queue.\n🔴 **Red** — Urgent, high/critical risk, immediate action needed.\n🔵 **Blue** — New or informational, neutral status.\n\nThese colours are used consistently across KPI cards, risk badges, age indicators, and alert severity throughout the dashboard.`,
            type: 'answer',
        };
    }

    // ── 15. Thank you ──────────────────────────────────────────────────
    if (/^(thanks|thank you|cheers|ta|great|perfect|nice one|brilliant)\b/.test(q)) {
        return { text: 'Glad I could help! Ask me anything else about the dashboard.', type: 'answer' };
    }

    // ── 16. Fallback ───────────────────────────────────────────────────
    return contextualFallback(context);
}

/* ── Deep page explanation ───────────────────────────────────────────────── */

function deepPageExplanation(ctx: PageContext): StapeLeeResponse {
    const guide = pageGuides[ctx.section];
    if (!guide) {
        return {
            text: `You're on **${ctx.pageName}**. I don't have a detailed guide for this page yet, but I can answer specific questions about statuses, workflows, or anything else you need help with.`,
            type: 'answer',
        };
    }

    let text = `**${guide.name}**\n\n${guide.description}`;

    if (ctx.caseId) {
        text += `\n\nYou're viewing case \`${ctx.caseId.slice(0, 8)}…\` — the full detail view shows the AI triage report, audit timeline, evidence, and admin actions.`;
    }

    // Add what to look at first
    text += '\n\n**What to look at first:**';
    if (ctx.section === 'overview') {
        text += '\n• Check the executive alerts at the top — any red ones need immediate action.\n• Scan the KPI cards for amber/red indicators.\n• Review the "Awaiting Review" queue count.';
    } else if (ctx.section === 'cases/detail') {
        text += '\n• Read the case summary for the key facts.\n• Check the AI triage report for risk assessment.\n• Look at any evidence attachments.\n• Review the audit timeline for history.';
    } else if (ctx.section === 'review-queue') {
        text += '\n• Start from the top — highest priority cases appear first.\n• Look for "Needs Review" flags.\n• Red-highlighted cases are high risk.';
    } else if (ctx.section === 'cases') {
        text += '\n• Use the filters to narrow by status or risk level.\n• Cases marked "Needs Review" should be prioritised.';
    } else if (ctx.section === 'submit') {
        text += '\n• Choose the right submission type for your concern.\n• Phone number submissions trigger automatic intelligence.\n• Fill in as much detail as possible — the AI triage uses everything you provide.';
    } else {
        text += '\n• ' + (guide.tips[0] || 'Explore the available actions on this page.');
    }

    return { text, type: 'answer' };
}

/* ── Contextual actions ──────────────────────────────────────────────────── */

function contextualActions(ctx: PageContext): StapeLeeResponse {
    const guide = pageGuides[ctx.section];
    if (!guide) {
        return {
            text: `On **${ctx.pageName}**, explore the available options. I can help with specific questions if you describe what you're trying to do.`,
            type: 'answer',
        };
    }

    let text = `**What you can do on ${guide.name}:**\n\n` +
        guide.actions.map(a => `• ${a}`).join('\n');

    // Add contextual suggestion
    if (ctx.section === 'overview') {
        text += '\n\n💡 **Suggested action:** Check the "Cases Awaiting Review" section — if the queue is growing, start reviewing cases to keep response times healthy.';
    } else if (ctx.section === 'cases/detail' && ctx.caseId) {
        text += '\n\n💡 **Suggested action:** Start by reading the AI triage report, then review any evidence before making your admin decision.';
    } else if (ctx.section === 'review-queue') {
        text += '\n\n💡 **Suggested action:** Work from top to bottom — the queue is sorted by priority. Open the first case and review it.';
    }

    return { text, type: 'answer' };
}

/* ── Contextual tips ─────────────────────────────────────────────────────── */

function contextualTips(ctx: PageContext): StapeLeeResponse {
    const guide = pageGuides[ctx.section];
    if (!guide || guide.tips.length === 0) {
        return { text: `No specific tips for this page yet. Try asking "what should I do next?" for contextual guidance.`, type: 'answer' };
    }

    const text = `**Tips for ${guide.name}:**\n\n` +
        guide.tips.map(t => `💡 ${t}`).join('\n\n');
    return { text, type: 'answer' };
}

/* ── Workflow answer ─────────────────────────────────────────────────────── */

function workflowAnswer(key: string, ctx: PageContext): StapeLeeResponse {
    const wf = workflowGuides[key];
    if (!wf) return { text: 'I don\'t have a guide for that yet — try describing what you need help with.', type: 'unknown' };

    let text = `**${wf.title}**\n\n` +
        wf.steps.map((s, i) => `**${i + 1}.** ${s}`).join('\n');

    // Contextual hint
    if (key === 'submitCase' && ctx.section === 'submit') {
        text += '\n\n📍 You\'re already on the Submit page — go ahead and choose a submission type to get started.';
    } else if (key === 'submitCase' && ctx.section !== 'submit') {
        text += '\n\n📍 Navigate to **"Submit Case"** from the sidebar or the button in the top bar to start.';
    } else if (key === 'reviewCase' && ctx.section === 'cases/detail') {
        text += '\n\n📍 You\'re already viewing a case — scroll down to read the triage report and evidence.';
    } else if (key === 'reviewCase' && ctx.section === 'review-queue') {
        text += '\n\n📍 You\'re in the review queue — click any case to open its detail page and start reviewing.';
    }

    return { text, type: 'answer' };
}

/* ── Status overview ─────────────────────────────────────────────────────── */

function statusOverview(): string {
    const lines = Object.entries(statusGlossary).map(
        ([key, e]) => `• **${e.label}** — ${e.meaning} (${e.colour})`
    );
    return `**Status Glossary**\n\n${lines.join('\n')}\n\n**Risk Levels:** Low (green), Medium (amber), High (red), Critical (red).\n**Decisions:** Scam, Not Scam — set when a case is closed.`;
}

/* ── Smart next step ─────────────────────────────────────────────────────── */

function smartNextStep(ctx: PageContext): StapeLeeResponse {
    switch (ctx.section) {
        case 'overview':
            return {
                text: '**On the Overview page, check these in order:**\n\n**1.** Executive alerts — any red alerts need immediate action.\n**2.** KPI cards — look for amber/red indicators.\n**3.** Cases Awaiting Review — if the count is high, start reviewing.\n**4.** Residents Needing Attention — follow up on repeat-incident residents.\n\nIf everything looks green, you\'re in good shape. Consider generating a monthly report if one is due.',
                type: 'answer',
            };
        case 'submit':
            return {
                text: '**On the Submit page:**\n\n**1.** Choose a submission type that matches the concern.\n**2.** Fill in all the details — more detail means better AI triage.\n**3.** Upload any evidence you have (screenshots, photos).\n**4.** Submit — the system will auto-triage and create the case.\n\nAfter submitting, you\'ll be able to track the case from "My Cases".',
                type: 'answer',
            };
        case 'cases':
            return {
                text: '**On the Cases page:**\n\n**1.** Filter for "Needs Review" to see cases that need attention first.\n**2.** Check high-risk cases — they\'re colour-coded red.\n**3.** Click a case to open its full detail page and review it.\n\nYou can also use the search to find a specific case by reference.',
                type: 'answer',
            };
        case 'cases/detail':
            return {
                text: `**Reviewing case \`${ctx.caseId?.slice(0, 8) ?? ''}…\`:**\n\n**1.** Read the case summary — what happened and who was involved.\n**2.** Check the AI triage report — risk level, category, pattern.\n**3.** Review evidence attachments if any.\n**4.** Read the audit timeline for activity history.\n**5.** Make your decision — update status, add notes, or close the case.\n\nIf the case is high risk, consider escalating to your safeguarding lead.`,
                type: 'answer',
            };
        case 'review-queue':
            return {
                text: '**In the Review Queue:**\n\n**1.** Start from the top — highest priority first.\n**2.** Click the first case to open its detail page.\n**3.** Review the AI triage report and any evidence.\n**4.** Set the correct risk level and category.\n**5.** Add notes and move to the next case.\n\nAim to clear the queue daily to maintain healthy response times.',
                type: 'answer',
            };
        case 'reports':
            return {
                text: '**On the Reports page:**\n\n**1.** Choose Monthly Summary or Inspection Pack.\n**2.** Select the period and organisation.\n**3.** Generate the report — it uses locked historical data.\n**4.** Download the PDF or share via email.\n\nInspection packs are formatted specifically for regulatory review.',
                type: 'answer',
            };
        case 'settings':
            return {
                text: '**On Settings:**\n\nReview your notification preferences — these control which emails you receive (new cases, reviews, weekly digests).\n\nYour preferences only affect your own notifications, not other users.',
                type: 'answer',
            };
        default:
            return {
                text: `You\'re on **${ctx.pageName}**. Explore the available options, or ask me a specific question about what you\'d like to do.\n\nCommon actions:\n• "How do I submit a case?"\n• "How do I review a case?"\n• "What does this status mean?"`,
                type: 'answer',
            };
    }
}

/* ── What to look at first ───────────────────────────────────────────────── */

function whatToLookAt(ctx: PageContext): StapeLeeResponse {
    switch (ctx.section) {
        case 'overview':
            return {
                text: '**Priority order on the Overview:**\n\n🔴 **First:** Executive alerts — especially any marked critical or high severity.\n🟡 **Second:** Cases Awaiting Review count — aim to keep this low.\n🟢 **Third:** KPI cards — check "High Risk" and "Awaiting Review" for amber/red.\n📊 **Fourth:** Residents Needing Attention — repeat incidents need follow-up.',
                type: 'answer',
            };
        case 'cases/detail':
            return {
                text: `**Priority for this case${ctx.caseId ? ` (\`${ctx.caseId.slice(0, 8)}…\`)` : ''}:**\n\n**1.** Case Summary — key facts at the top.\n**2.** AI Triage Report — risk level and pattern analysis.\n**3.** Evidence — any attached screenshots or documents.\n**4.** Audit Timeline — full history of what's happened.\n**5.** Admin Actions — make your decision.`,
                type: 'answer',
            };
        case 'review-queue':
            return {
                text: '**In the Review Queue:**\n\nThe list is pre-sorted by priority. Start with the **first case at the top** — it\'s the most urgent. Red badges indicate high risk. Look for cases with the longest wait time first.',
                type: 'answer',
            };
        default:
            return {
                text: `On **${ctx.pageName}**, start with the most prominent data at the top of the page. If you see red or amber indicators, those need attention first.\n\nAsk me "what should I do next?" for step-by-step guidance.`,
                type: 'answer',
            };
    }
}

/* ── Simple explanation ──────────────────────────────────────────────────── */

function simpleExplanation(ctx: PageContext): StapeLeeResponse {
    const guide = pageGuides[ctx.section];
    if (!guide) {
        return { text: `**${ctx.pageName}** — This is part of the Second Look Protect dashboard, used by care organisations to keep their residents safe from scams and safeguarding risks.`, type: 'answer' };
    }

    const simpleDescriptions: Record<string, string> = {
        overview: 'This is your home page. It shows you the most important things happening right now — alerts, key numbers, and which cases need your attention. Green means good, amber means keep an eye on it, red means act now.',
        submit: 'This is where you report a safeguarding concern. Pick what kind of concern it is, fill in the details, and submit. The system will automatically check the details and create a case for an admin to review.',
        cases: 'This is a list of all the reported concerns. You can filter to find specific ones. Click any case to see its full details.',
        'cases/detail': 'This shows everything about one specific case — what happened, what the AI thinks about it, any evidence attached, and what actions have been taken. Admins can update the status, add notes, or close the case here.',
        'my-cases': 'These are the cases you personally reported. You can track what\'s happened with them since you submitted them.',
        'review-queue': 'This is the admin\'s work queue — cases that need someone to look at them. Work from top to bottom, starting with the most urgent ones.',
        reports: 'Generate official reports about safeguarding activity. These are used for compliance and when inspectors visit.',
        settings: 'Your personal settings — things like which email notifications you want to receive.',
    };

    const simple = simpleDescriptions[ctx.section] || guide.description;
    return { text: `**${guide.name}** (in plain English)\n\n${simple}`, type: 'answer' };
}

/* ── Contextual fallback ─────────────────────────────────────────────────── */

function contextualFallback(ctx: PageContext): StapeLeeResponse {
    const guide = pageGuides[ctx.section];
    const pageHint = guide
        ? `You're on **${guide.name}** — ${guide.description.split('.')[0]}.`
        : `You're on **${ctx.pageName}**.`;

    return {
        text: `I'm not sure what you mean. ${pageHint}\n\nHere's what I can help with:\n\n• **"What is this page?"** — I'll explain where you are and what to do\n• **"What should I do next?"** — Step-by-step guidance\n• **"What does [status] mean?"** — Status and risk glossary\n• **"How do I submit a case?"** — Workflow guide\n• **"Send feedback"** — Draft a message for the dev team\n• **"Tips"** — Page-specific best practices`,
        type: 'unknown',
    };
}
