/* ═══════════════════════════════════════════════════════════════════════════
   Stape-Lee — Brain (Contextual Intelligence Engine)
   ═══════════════════════════════════════════════════════════════════════════
   Takes a user message + page context + session memory and returns smart,
   evidence-grounded responses with suggested follow-up chips.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { PageContext } from './usePageContext';
import {
    productOverview,
    valuePropositions,
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
    type: 'answer' | 'feedback_draft' | 'feedback_clarify' | 'unknown';
    action?: 'start_feedback' | 'show_send_button';
    chips?: string[];
}

/* ── Session memory ──────────────────────────────────────────────────────── */

export class SessionMemory {
    lastIntent: string = '';
    lastTopic: string = '';
    feedbackInProgress: boolean = false;
    feedbackClarified: boolean = false;
    questionsAsked: number = 0;
    currentGoal: string = '';
    topicsDiscussed: string[] = [];

    recordIntent(intent: string, topic: string) {
        this.lastIntent = intent;
        this.lastTopic = topic;
        this.questionsAsked++;
        if (topic && !this.topicsDiscussed.includes(topic)) {
            this.topicsDiscussed.push(topic);
        }
    }

    reset() {
        this.lastIntent = '';
        this.lastTopic = '';
        this.feedbackInProgress = false;
        this.feedbackClarified = false;
        this.questionsAsked = 0;
        this.currentGoal = '';
        this.topicsDiscussed = [];
    }
}

/* ── Chip helpers ────────────────────────────────────────────────────────── */

function pageChips(ctx: PageContext): string[] {
    return pageGuides[ctx.section]?.chips ?? ['What is this page?', 'What should I do next?', 'Send feedback'];
}

function followUpChips(topic: string, ctx: PageContext): string[] {
    switch (topic) {
        case 'page_explain':
            return ['What should I do next?', 'Tips for this page', 'Send feedback'];
        case 'next_step':
            return ['Explain this page', 'Tips', 'Case lifecycle'];
        case 'status':
            return ['What should I do next?', 'Explain risk levels', 'Send feedback'];
        case 'workflow':
            return ['What should I do next?', 'Case lifecycle', 'Send feedback'];
        case 'lifecycle':
            return ['How do I submit a case?', 'How do I review a case?', 'Send feedback'];
        case 'product':
            return ['How does it help with inspections?', 'Show me the workflow value', 'Send feedback'];
        case 'value':
            return ['Show another angle', 'What is this page for?', 'Send feedback'];
        default:
            return pageChips(ctx).slice(0, 3);
    }
}

/* ── Main function ───────────────────────────────────────────────────────── */

export function askStapeLee(message: string, context: PageContext, memory?: SessionMemory): StapeLeeResponse {
    const q = message.toLowerCase().trim();
    const mem = memory ?? new SessionMemory();

    // ── 1. Greeting ─────────────────────────────────────────────────────
    if (/^(hi|hello|hey|good morning|good afternoon|good evening|yo|hiya)\b/.test(q)) {
        mem.recordIntent('greeting', 'greeting');
        const guide = pageGuides[context.section];
        return {
            text: `Hey! You're on **${context.pageName}**.${context.caseId ? ` Viewing case \`${context.caseId.slice(0, 8)}…\`` : ''}\n\nI know this dashboard inside out — I can explain what's here, guide you through tasks, answer questions about statuses and workflows, or help draft feedback for the dev team.`,
            type: 'answer',
            chips: pageChips(context),
        };
    }

    // ── 2. "What is this page?" / "Where am I?" ────────────────────────
    if (/what.*(this page|page is this)|where am i|explain this page|what am i looking at|what.*(here|this)/.test(q)) {
        mem.recordIntent('page_explain', context.section);
        return deepPageExplanation(context);
    }

    // ── 3. "What can I do here?" ────────────────────────────────────────
    if (/what can i do|what actions|what.*(available|possible)|help me with this/.test(q) && !/submit|send|feedback/.test(q)) {
        mem.recordIntent('actions', context.section);
        return contextualActions(context);
    }

    // ── 4. Status / risk / decision glossary ────────────────────────────
    for (const [key, entry] of Object.entries(statusGlossary)) {
        if (q.includes(key) || q.includes(entry.label.toLowerCase())) {
            mem.recordIntent('status_lookup', key);
            const pageContext = context.section === 'cases' || context.section === 'cases/detail'
                ? '\n\nOn this page, you can filter or sort by status to find cases in this state.'
                : context.section === 'review-queue'
                    ? '\n\nThe review queue shows cases that need attention — look for this status in the list.'
                    : '';
            return {
                text: `**${entry.label}** — ${entry.meaning}\n\nColour: ${entry.colour} indicator.${pageContext}`,
                type: 'answer',
                chips: followUpChips('status', context),
            };
        }
    }

    for (const [key, entry] of Object.entries(riskGlossary)) {
        if (q.includes(`${key} risk`) || (q.includes(key) && /risk|level|severity|danger/.test(q))) {
            mem.recordIntent('risk_lookup', key);
            return {
                text: `**${key.charAt(0).toUpperCase() + key.slice(1)} Risk** — ${entry.meaning}\n\nColour: ${entry.colour} indicator.\n\nRisk levels are assigned by the AI triage and can be adjusted by an admin during review. Getting risk right is important — it affects queue priority and inspection reporting.`,
                type: 'answer',
                chips: ['What do other risk levels mean?', 'How do I review a case?', 'Send feedback'],
            };
        }
    }

    for (const [key, meaning] of Object.entries(decisionGlossary)) {
        if (q.includes(key) || q.includes(key.replace('_', ' '))) {
            mem.recordIntent('decision_lookup', key);
            return {
                text: `**${key.replace('_', ' ')}** — ${meaning}\n\nThis decision is set when an admin closes a case. It's the final determination based on the evidence reviewed. Correct decisions improve your organisation's safeguarding data quality and reporting accuracy.`,
                type: 'answer',
                chips: ['How do I close a case?', 'Case lifecycle', 'Send feedback'],
            };
        }
    }

    // ── 5. "What does X mean?" (generic status catch) ───────────────────
    if (/what does .+ mean|what is .+ status|explain .+ status/.test(q)) {
        mem.recordIntent('status_overview', 'status');
        return { text: statusOverview(), type: 'answer', chips: followUpChips('status', context) };
    }

    // ── 6. Workflow guides ──────────────────────────────────────────────
    if (/how.*(submit|create|report|raise|make).*(case|incident)|submit a case/.test(q)) {
        mem.recordIntent('workflow', 'submitCase');
        return workflowAnswer('submitCase', context);
    }
    if (/how.*(review|triage|assess).*(case|incident)|review a case|triage/.test(q)) {
        mem.recordIntent('workflow', 'reviewCase');
        return workflowAnswer('reviewCase', context);
    }
    if (/how.*(close|resolve|finish|complete).*(case|incident)|close a case/.test(q)) {
        mem.recordIntent('workflow', 'closeCase');
        return workflowAnswer('closeCase', context);
    }
    if (/how.*(generate|create|run|make).*(report|inspection|pack)/.test(q)) {
        mem.recordIntent('workflow', 'generateReport');
        return workflowAnswer('generateReport', context);
    }

    // ── 7. Case lifecycle ──────────────────────────────────────────────
    if (/case lifecycle|case flow|case process|stages|what happens.*(case|after|next)|how.*(case.*work|process work)/.test(q)) {
        mem.recordIntent('lifecycle', 'lifecycle');
        const currentStep = context.section === 'submit' ? 'You\'re at **Step 1** right now — submitting a case.' :
            context.section === 'cases/detail' ? 'You\'re viewing a case detail page — typically **Steps 3–6** happen here.' :
                context.section === 'review-queue' ? 'The review queue is where **Step 3 (Admin Review)** happens.' : '';
        return {
            text: '**Case Lifecycle**\n\n' +
                caseLifecycle.map(s => `**${s.step}.** ${s.title} — ${s.description}`).join('\n\n') +
                (currentStep ? `\n\n📍 ${currentStep}` : ''),
            type: 'answer',
            chips: followUpChips('lifecycle', context),
        };
    }

    // ── 8. "What should I do next?" ────────────────────────────────────
    if (/what.*(should|do).*(next|now)|next step|what now|what.*(first|priority)/.test(q)) {
        mem.recordIntent('next_step', context.section);
        return smartNextStep(context);
    }

    // ── 9. Product overview & value questions ──────────────────────────
    if (/what is (second look|this product|this app|this system|slp|the platform)/.test(q)) {
        mem.recordIntent('product', 'overview');
        return {
            text: `**${productOverview.name}** — ${productOverview.tagline}\n\n${productOverview.description}\n\nBuilt for: ${productOverview.audience}\n\nI can explain the value from different angles — oversight, inspection readiness, workflow, or resident protection.`,
            type: 'answer',
            chips: ['Oversight value', 'Inspection readiness', 'Workflow value', 'Resident protection'],
        };
    }

    // ── 9b. Value proposition questions ─────────────────────────────────
    if (/oversight|operational value|why.*(dashboard|this)/.test(q)) {
        mem.recordIntent('value', 'oversight');
        return valueAnswer('oversight', context);
    }
    if (/inspection|regulator|compliance|audit/.test(q) && !/pack|report|generate/.test(q)) {
        mem.recordIntent('value', 'inspection');
        return valueAnswer('inspection', context);
    }
    if (/workflow value|how.*(help|work).*(team|staff|organisation)|why.*structure/.test(q)) {
        mem.recordIntent('value', 'workflow');
        return valueAnswer('workflow', context);
    }
    if (/protect|resident|vulnerable|safe/.test(q) && !/second look/.test(q)) {
        mem.recordIntent('value', 'protection');
        return valueAnswer('protection', context);
    }
    if (/intelligence|ai|triage value|smart|pattern/.test(q) && !/triage report|explain.*triage/.test(q)) {
        mem.recordIntent('value', 'intelligence');
        return valueAnswer('intelligence', context);
    }
    if (/how.*connect|how.*pages.*work.*together|connection|flow between/.test(q)) {
        mem.recordIntent('value', 'connection');
        return valueAnswer('connection', context);
    }
    if (/another angle|different angle|show.*more/.test(q)) {
        // Show a value angle the user hasn't seen yet
        const unseen = Object.keys(valuePropositions).filter(k => !mem.topicsDiscussed.includes(k));
        const key = unseen.length > 0 ? unseen[0] : 'oversight';
        mem.recordIntent('value', key);
        return valueAnswer(key, context);
    }

    // ── 10. Developer feedback ─────────────────────────────────────────
    if (/feedback|bug report|feature request|feature idea|suggestion|report.*(issue|problem|bug)|something.*(wrong|broken)|send.*(dev|developer|team)/.test(q)) {
        mem.recordIntent('feedback', 'start');
        mem.feedbackInProgress = true;
        return {
            text: `I can draft structured feedback for the dev team. I'll auto-fill the page you're on (**${context.pageName}**) and detect the type from your description.\n\nDescribe the issue, suggestion, or idea and I'll prepare a clear draft for you to review before sending.`,
            type: 'feedback_draft',
            action: 'start_feedback',
            chips: ['Bug Report', 'Feature Request', 'UX Feedback'],
        };
    }

    // ── 11. Tips for current page ──────────────────────────────────────
    if (/tip|advice|hint|best practice|pro tip|efficient|faster/.test(q)) {
        mem.recordIntent('tips', context.section);
        return contextualTips(context);
    }

    // ── 12. Explain simply / ELI5 ──────────────────────────────────────
    if (/explain.*(simply|easy|basic|plain)|eli5|in simple terms|dumb it down/.test(q)) {
        mem.recordIntent('simple', context.section);
        return simpleExplanation(context);
    }

    // ── 13. "Look at first" / priority ─────────────────────────────────
    if (/what.*(look|check|focus|priorit)|most important|where.*(start|begin)/.test(q)) {
        mem.recordIntent('priority', context.section);
        return whatToLookAt(context);
    }

    // ── 14. Summarise case ─────────────────────────────────────────────
    if (/summarise|summary|sum up|key facts|brief/.test(q) && (context.section === 'cases/detail' || context.caseId)) {
        mem.recordIntent('summarise', 'case');
        return {
            text: `To summarise this case:\n\n**1.** Check the **Case Summary** card at the top — it has the key facts.\n**2.** The **AI Triage Report** gives the risk assessment and pattern analysis.\n**3.** Look at **Evidence** for any attachments.\n**4.** The **Audit Timeline** shows the full history.\n\nI can't read the case data directly, but these sections give you everything at a glance.`,
            type: 'answer',
            chips: ['What should I check first?', 'Explain the triage report', 'How do I close this case?'],
        };
    }

    // ── 15. Triage report questions ────────────────────────────────────
    if (/triage report|ai report|ai triage|explain.*triage/.test(q)) {
        mem.recordIntent('triage_explain', 'triage');
        return {
            text: '**AI Triage Report**\n\nThe triage report is generated automatically when a case is submitted. It analyses the details you provided and assigns:\n\n• **Risk Level** — how urgent the concern is (Low → Critical)\n• **Category** — what type of concern (phone scam, email phishing, etc.)\n• **Pattern Notes** — any indicators the AI detected\n\nFor phone cases, it also runs **number intelligence** — checking the phone number against known databases.\n\nThe triage is a starting point — admins should always verify and adjust if needed.',
            type: 'answer',
            chips: ['What do risk levels mean?', 'How do I review a case?', 'Send feedback'],
        };
    }

    // ── 16. "How healthy" / organisation health ────────────────────────
    if (/how healthy|health|how.*(doing|performing)|organisation.*(status|state)/.test(q)) {
        mem.recordIntent('health', context.section);
        return {
            text: `**Assessing your organisation's health:**\n\nLook at these indicators on the Overview page:\n\n🟢 **Green KPIs** — targets met, queue clear, responses on time\n🟡 **Amber KPIs** — some areas need monitoring or are falling behind\n🔴 **Red KPIs** — urgent issues that need immediate attention\n\nThe **Visual mode** ring charts give you an at-a-glance health summary.\n\nKey metrics to watch:\n• **Review queue depth** — should stay low\n• **Closure time** — should be within your target window\n• **Documentation completeness** — all cases should have decisions`,
            type: 'answer',
            chips: ['Switch to Visual mode', 'What should I do next?', 'Send feedback'],
        };
    }

    // ── 17. Visual mode questions ──────────────────────────────────────
    if (/visual mode|ring chart|kpi ring|chart|standard mode|display mode/.test(q)) {
        mem.recordIntent('visual_mode', 'overview');
        return {
            text: '**Display Modes**\n\nThe Overview page has two modes you can toggle:\n\n**Standard** — The traditional card-based view with numbers and status indicators.\n\n**Visual** — Adds ring chart KPIs that show your performance at a glance:\n• Overall Health\n• Closure on Target\n• Triage on Target\n• Documentation Completeness\n• Scam Rate\n• Review Queue\n\nEach ring uses green / amber / red to show whether you\'re within target. Toggle between them using the pill buttons in the top-right of the Overview page.',
            type: 'answer',
            chips: ['What do the thresholds mean?', 'How healthy is my org?', 'Send feedback'],
        };
    }

    // ── 18. Colours / meaning of colours ───────────────────────────────
    if (/colou?r|green|amber|red|orange|what.*(mean|indicate).*(badge|dot|indicator)/.test(q)) {
        mem.recordIntent('colours', 'colours');
        return {
            text: `**Colour Language in Second Look Protect**\n\n🟢 **Green** — Healthy, on track, low risk, resolved.\n🟡 **Amber** — Needs monitoring, medium risk, building queue.\n🔴 **Red** — Urgent, high/critical risk, immediate action needed.\n🔵 **Blue** — New or informational, neutral status.\n\nThese colours are used consistently across KPI cards, risk badges, age indicators, ring charts, and alert severity throughout the dashboard.`,
            type: 'answer',
            chips: ['Explain risk levels', 'Explain statuses', 'Send feedback'],
        };
    }

    // ── 19. Thank you ──────────────────────────────────────────────────
    if (/^(thanks|thank you|cheers|ta|great|perfect|nice one|brilliant)\b/.test(q)) {
        return {
            text: 'Glad I could help! I\'m here whenever you need guidance on the dashboard.',
            type: 'answer',
            chips: pageChips(context).slice(0, 3),
        };
    }

    // ── 20. Fallback ───────────────────────────────────────────────────
    mem.recordIntent('unknown', '');
    return contextualFallback(context, mem);
}

/* ── Deep page explanation ───────────────────────────────────────────────── */

function deepPageExplanation(ctx: PageContext): StapeLeeResponse {
    const guide = pageGuides[ctx.section];
    if (!guide) {
        return {
            text: `You're on **${ctx.pageName}**. I don't have a detailed guide for this page yet, but I can answer specific questions about statuses, workflows, or anything else you need help with.`,
            type: 'answer',
            chips: ['What should I do next?', 'Send feedback'],
        };
    }

    let text = `**${guide.name}**\n\n${guide.description}`;

    if (ctx.caseId) {
        text += `\n\nYou're viewing case \`${ctx.caseId.slice(0, 8)}…\` — the full detail view shows the AI triage report, audit timeline, evidence, and admin actions.`;
    }

    // Add value context
    text += `\n\n**Why this matters:** ${guide.value}`;

    // Add what to look at first
    text += '\n\n**What to look at first:**';
    if (ctx.section === 'overview') {
        text += '\n• Check the executive alerts at the top — any red ones need immediate action.\n• Scan the KPI cards for amber/red indicators.\n• Review the "Awaiting Review" queue count.\n• Try Visual mode for ring chart health checks.';
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

    return { text, type: 'answer', chips: followUpChips('page_explain', ctx) };
}

/* ── Contextual actions ──────────────────────────────────────────────────── */

function contextualActions(ctx: PageContext): StapeLeeResponse {
    const guide = pageGuides[ctx.section];
    if (!guide) {
        return {
            text: `On **${ctx.pageName}**, explore the available options. I can help with specific questions if you describe what you're trying to do.`,
            type: 'answer',
            chips: ['Send feedback'],
        };
    }

    let text = `**What you can do on ${guide.name}:**\n\n` +
        guide.actions.map(a => `• ${a}`).join('\n');

    // Add contextual suggestion
    if (ctx.section === 'overview') {
        text += '\n\n💡 **Suggested action:** Check the "Cases Awaiting Review" section — if the queue is growing, start reviewing cases to keep response times healthy. Healthy response times look good at inspection.';
    } else if (ctx.section === 'cases/detail' && ctx.caseId) {
        text += '\n\n💡 **Suggested action:** Start by reading the AI triage report, then review any evidence before making your admin decision. Every action you take is permanently recorded.';
    } else if (ctx.section === 'review-queue') {
        text += '\n\n💡 **Suggested action:** Work from top to bottom — the queue is sorted by priority. Open the first case and review it. Daily clearing shows strong safeguarding practice.';
    }

    return { text, type: 'answer', chips: followUpChips('page_explain', ctx) };
}

/* ── Contextual tips ─────────────────────────────────────────────────────── */

function contextualTips(ctx: PageContext): StapeLeeResponse {
    const guide = pageGuides[ctx.section];
    if (!guide || guide.tips.length === 0) {
        return {
            text: `No specific tips for this page yet. Try asking "what should I do next?" for contextual guidance.`,
            type: 'answer',
            chips: ['What should I do next?', 'Send feedback'],
        };
    }

    const text = `**Tips for ${guide.name}:**\n\n` +
        guide.tips.map(t => `💡 ${t}`).join('\n\n');
    return { text, type: 'answer', chips: followUpChips('next_step', ctx) };
}

/* ── Workflow answer ─────────────────────────────────────────────────────── */

function workflowAnswer(key: string, ctx: PageContext): StapeLeeResponse {
    const wf = workflowGuides[key];
    if (!wf) return { text: 'I don\'t have a guide for that yet — try describing what you need help with.', type: 'unknown', chips: pageChips(ctx) };

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

    return { text, type: 'answer', chips: followUpChips('workflow', ctx) };
}

/* ── Value answer ────────────────────────────────────────────────────────── */

function valueAnswer(key: string, ctx: PageContext): StapeLeeResponse {
    const vp = valuePropositions[key];
    if (!vp) return { text: 'I can explain the value of Second Look Protect from several angles — try asking about oversight, inspection readiness, workflow, or resident protection.', type: 'answer', chips: ['Oversight value', 'Inspection readiness', 'Workflow value'] };

    const remaining = Object.keys(valuePropositions).filter(k => k !== key);
    const nextChips = remaining.slice(0, 2).map(k => valuePropositions[k].title);

    return {
        text: `**${vp.title}**\n\n${vp.description}`,
        type: 'answer',
        chips: [...nextChips, 'What is this page for?'],
    };
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
    const chips = followUpChips('next_step', ctx);
    switch (ctx.section) {
        case 'overview':
            return {
                text: '**On the Overview page, check these in order:**\n\n**1.** Executive alerts — any red alerts need immediate action.\n**2.** KPI cards — look for amber/red indicators.\n**3.** Cases Awaiting Review — if the count is high, start reviewing.\n**4.** Residents Needing Attention — follow up on repeat-incident residents.\n\nIf everything looks green, you\'re in good shape. Healthy metrics here show inspectors that your organisation is responsive and well-managed.',
                type: 'answer',
                chips,
            };
        case 'submit':
            return {
                text: '**On the Submit page:**\n\n**1.** Choose a submission type that matches the concern.\n**2.** Fill in all the details — more detail means better AI triage.\n**3.** Upload any evidence you have (screenshots, photos, documents).\n**4.** Submit — the system will auto-triage and create the case.\n\nAfter submitting, you\'ll be able to track the case from "My Cases". Quick, detailed submissions lead to faster resolutions.',
                type: 'answer',
                chips,
            };
        case 'cases':
            return {
                text: '**On the Cases page:**\n\n**1.** Filter for "Needs Review" to see cases that need attention first.\n**2.** Check high-risk cases — they\'re colour-coded red.\n**3.** Click a case to open its full detail page and review it.\n\nYou can also use the search to find a specific case by reference.',
                type: 'answer',
                chips,
            };
        case 'cases/detail':
            return {
                text: `**Reviewing case \`${ctx.caseId?.slice(0, 8) ?? ''}…\`:**\n\n**1.** Read the case summary — what happened and who was involved.\n**2.** Check the AI triage report — risk level, category, pattern.\n**3.** Review evidence attachments if any.\n**4.** Read the audit timeline for activity history.\n**5.** Make your decision — update status, add notes, or close the case.\n\nIf the case is high risk, consider escalating to your safeguarding lead. Every action here is permanently recorded in the audit trail.`,
                type: 'answer',
                chips: ['Summarise this case', 'Explain the triage report', 'How do I close a case?'],
            };
        case 'review-queue':
            return {
                text: '**In the Review Queue:**\n\n**1.** Start from the top — highest priority first.\n**2.** Click the first case to open its detail page.\n**3.** Review the AI triage report and any evidence.\n**4.** Set the correct risk level and category.\n**5.** Add notes and move to the next case.\n\nAim to clear the queue daily — this demonstrates strong safeguarding practice and keeps response times within target.',
                type: 'answer',
                chips,
            };
        case 'reports':
            return {
                text: '**On the Reports page:**\n\n**1.** Choose Monthly Summary or Inspection Pack.\n**2.** Select the period and organisation.\n**3.** Generate the report — it uses locked historical data.\n**4.** Download the PDF or share via email.\n\nInspection packs are formatted specifically for regulatory review and demonstrate your compliance posture.',
                type: 'answer',
                chips,
            };
        case 'settings':
            return {
                text: '**On Settings:**\n\nReview your notification preferences — these control which emails you receive (new cases, reviews, weekly digests).\n\nYour preferences only affect your own notifications, not other users. Setting these correctly keeps you informed without being overwhelmed.',
                type: 'answer',
                chips,
            };
        default:
            return {
                text: `You're on **${ctx.pageName}**. Explore the available options, or ask me a specific question about what you'd like to do.`,
                type: 'answer',
                chips: pageChips(ctx),
            };
    }
}

/* ── What to look at first ───────────────────────────────────────────────── */

function whatToLookAt(ctx: PageContext): StapeLeeResponse {
    const chips = followUpChips('next_step', ctx);
    switch (ctx.section) {
        case 'overview':
            return {
                text: '**Priority order on the Overview:**\n\n🔴 **First:** Executive alerts — especially any marked critical or high severity.\n🟡 **Second:** Cases Awaiting Review count — aim to keep this low.\n🟢 **Third:** KPI cards — check "High Risk" and "Awaiting Review" for amber/red.\n📊 **Fourth:** Residents Needing Attention — repeat incidents need follow-up.',
                type: 'answer',
                chips,
            };
        case 'cases/detail':
            return {
                text: `**Priority for this case${ctx.caseId ? ` (\`${ctx.caseId.slice(0, 8)}…\`)` : ''}:**\n\n**1.** Case Summary — key facts at the top.\n**2.** AI Triage Report — risk level and pattern analysis.\n**3.** Evidence — any attached screenshots or documents.\n**4.** Audit Timeline — full history of what's happened.\n**5.** Admin Actions — make your decision.`,
                type: 'answer',
                chips: ['Summarise this case', 'Explain the triage report', 'How do I close a case?'],
            };
        case 'review-queue':
            return {
                text: '**In the Review Queue:**\n\nThe list is pre-sorted by priority. Start with the **first case at the top** — it\'s the most urgent. Red badges indicate high risk. Look for cases with the longest wait time first.',
                type: 'answer',
                chips,
            };
        default:
            return {
                text: `On **${ctx.pageName}**, start with the most prominent data at the top of the page. If you see red or amber indicators, those need attention first.\n\nAsk me "what should I do next?" for step-by-step guidance.`,
                type: 'answer',
                chips: pageChips(ctx).slice(0, 3),
            };
    }
}

/* ── Simple explanation ──────────────────────────────────────────────────── */

function simpleExplanation(ctx: PageContext): StapeLeeResponse {
    const guide = pageGuides[ctx.section];
    if (!guide) {
        return {
            text: `**${ctx.pageName}** — This is part of the Second Look Protect dashboard, used by care organisations to keep their residents safe from scams and safeguarding risks.`,
            type: 'answer',
            chips: pageChips(ctx).slice(0, 3),
        };
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
    return { text: `**${guide.name}** (in plain English)\n\n${simple}`, type: 'answer', chips: followUpChips('page_explain', ctx) };
}

/* ── Contextual fallback ─────────────────────────────────────────────────── */

function contextualFallback(ctx: PageContext, mem: SessionMemory): StapeLeeResponse {
    const guide = pageGuides[ctx.section];
    const pageHint = guide
        ? `You're on **${guide.name}** — ${guide.description.split('.')[0]}.`
        : `You're on **${ctx.pageName}**.`;

    // If user has asked several questions, be more helpful
    const extraContext = mem.questionsAsked > 2
        ? `\n\nWe've covered a few topics this session. Would you like a specific workflow guide, or would you like to send feedback about something?`
        : '';

    return {
        text: `I'm not quite sure what you mean. ${pageHint}${extraContext}`,
        type: 'unknown',
        chips: pageChips(ctx),
    };
}
