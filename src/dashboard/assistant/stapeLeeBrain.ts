/* ═══════════════════════════════════════════════════════════════════════════
   Stape-Lee — Brain (Contextual Intelligence Engine)
   ═══════════════════════════════════════════════════════════════════════════
   Takes a user message + page context + session memory and returns smart,
   evidence-grounded responses with suggested follow-up chips.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { PageContext } from './usePageContext';
import type { PageDataSnapshot } from './StapeLeeDataContext';
import { findMetricDef } from './metricDefinitions';
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

export type ActiveTask =
    | 'page_explain' | 'next_step' | 'tips' | 'workflow' | 'lifecycle'
    | 'case_summary' | 'resident_guidance' | 'triage_explain'
    | 'status_lookup' | 'risk_lookup' | 'health' | 'value'
    | 'feedback' | 'prioritise' | 'find_case' | 'filters'
    | 'product' | 'simple_explain' | '';

export class SessionMemory {
    /* What Stape-Lee was last doing */
    activeTask: ActiveTask = '';
    lastIntent: string = '';
    lastTopic: string = '';
    lastResponseText: string = '';

    /* Feedback flow state */
    feedbackInProgress: boolean = false;
    feedbackClarified: boolean = false;

    /* Conversation depth */
    questionsAsked: number = 0;
    topicsDiscussed: string[] = [];

    /* Page & case binding for the current conversation thread */
    boundPage: string = '';
    boundCaseId: string = '';

    recordIntent(intent: string, topic: string) {
        this.lastIntent = intent;
        this.lastTopic = topic;
        this.questionsAsked++;
        if (topic && !this.topicsDiscussed.includes(topic)) {
            this.topicsDiscussed.push(topic);
        }
    }

    recordTask(task: ActiveTask) {
        this.activeTask = task;
    }

    recordResponse(text: string) {
        this.lastResponseText = text;
    }

    bindContext(page: string, caseId?: string) {
        this.boundPage = page;
        if (caseId) this.boundCaseId = caseId;
    }

    reset() {
        this.activeTask = '';
        this.lastIntent = '';
        this.lastTopic = '';
        this.lastResponseText = '';
        this.feedbackInProgress = false;
        this.feedbackClarified = false;
        this.questionsAsked = 0;
        this.topicsDiscussed = [];
        this.boundPage = '';
        this.boundCaseId = '';
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

/* ── Follow-up detection ─────────────────────────────────────────────────── */

function detectFollowUp(q: string, mem: SessionMemory, ctx: PageContext): StapeLeeResponse | null {
    // Only activate if there's an active conversation history
    if (!mem.lastIntent && !mem.activeTask) return null;

    // ── "Make it shorter / simpler" — rewrite the last response ─────
    if (/^(make it |)(shorter|simpler|briefer|more concise|less wordy|trim it|shorten)/.test(q)) {
        if (mem.lastResponseText) {
            // Produce a condensed version of the last response
            const condensed = condenseResponse(mem.lastResponseText);
            mem.recordIntent('simplify', mem.lastTopic);
            return {
                text: condensed,
                type: 'answer',
                chips: mem.activeTask === 'case_summary'
                    ? ['Draft resident guidance', 'What should I do next?', 'Send feedback']
                    : pageChips(ctx).slice(0, 3),
            };
        }
    }

    // ── "Explain more simply / in plain english" — ELI5 the last topic ──
    if (/^(explain|say|put).*(simpl|plain|basic|easy|clearer)/.test(q) || q === 'eli5') {
        if (mem.lastTopic || mem.activeTask) {
            mem.recordIntent('simple', mem.lastTopic || ctx.section);
            return simpleExplanation(ctx);
        }
    }

    // ── "Continue / go on / what next / and then?" — advance the task ──
    if (/^(continue|go on|and then|what next|what('s| is) next|next|carry on|keep going)\b/.test(q)) {
        mem.recordIntent('continue', mem.lastTopic);

        // After a page explanation → next steps
        if (mem.activeTask === 'page_explain' || mem.activeTask === 'tips') {
            return smartNextStep(ctx);
        }
        // After next steps → tips
        if (mem.activeTask === 'next_step') {
            return contextualTips(ctx);
        }
        // After case summary → what to do next on the case
        if (mem.activeTask === 'case_summary' || mem.activeTask === 'triage_explain') {
            return smartNextStep(ctx);
        }
        // After workflow guide → next logical workflow
        if (mem.activeTask === 'workflow') {
            if (mem.lastTopic === 'submitCase') return workflowAnswer('reviewCase', ctx);
            if (mem.lastTopic === 'reviewCase') return workflowAnswer('closeCase', ctx);
            return smartNextStep(ctx);
        }
        // After lifecycle → how to submit
        if (mem.activeTask === 'lifecycle') {
            return workflowAnswer('submitCase', ctx);
        }
        // Generic fallback for continue
        return smartNextStep(ctx);
    }

    // ── "Turn into / draft resident guidance" after case summary ─────
    if (/resident.*guidance|turn.*guidance|guidance/.test(q) && mem.activeTask === 'case_summary') {
        mem.recordIntent('resident_guidance', 'case');
        // Re-route to resident guidance handler
        return null; // Let the main pattern matcher handle it
    }

    // ── "What should I look at" — after any explanation ──────────────
    if (/^what.*(look|check|focus)/.test(q) && mem.activeTask) {
        mem.recordIntent('priority', ctx.section);
        return whatToLookAt(ctx);
    }

    // ── "Explain more / tell me more / go deeper" ───────────────────
    if (/^(explain|tell).*(more|detail|deeper|further)|^more (detail|info)|^go deeper/.test(q)) {
        if (mem.activeTask === 'page_explain') {
            // Show actions after page explanation
            return contextualActions(ctx);
        }
        if (mem.activeTask === 'case_summary' || mem.activeTask === 'triage_explain') {
            return {
                text: '**Going deeper on this case:**\n\nHere\'s what to examine more closely:\n\n**Evidence** — Open each attachment and look for scam indicators: urgency language, impersonation, suspicious URLs/domains, QR codes, or requests for personal/financial info.\n\n**Number Intelligence** — If this is a phone case, check the intelligence report for carrier info, spam reports, and known associations.\n\n**Audit Timeline** — Review the full history of actions taken. This is what inspectors will look at.\n\n**Triage Accuracy** — Compare the AI\'s risk assessment with your own judgement. Adjust if needed — the AI is a starting point, not a final answer.',
                type: 'answer',
                chips: ['Draft resident guidance', 'How do I close this case?', 'Send feedback'],
            };
        }
        if (mem.activeTask === 'value') {
            // Show another value angle
            const unseen = Object.keys(valuePropositions).filter(k => !mem.topicsDiscussed.includes(k));
            const key = unseen.length > 0 ? unseen[0] : 'oversight';
            mem.recordIntent('value', key);
            return valueAnswer(key, ctx);
        }
        return null; // No specific follow-up, let main matchers handle
    }

    return null; // Not a follow-up — let regular pattern matching proceed
}

/* ── Condense a response (for "make it shorter") ─────────────────────────── */

function condenseResponse(text: string): string {
    // Split into lines, keep bold headers and first sentence of each section
    const lines = text.split('\n').filter(l => l.trim());
    const condensed: string[] = [];
    let sectionCount = 0;

    for (const line of lines) {
        const trimmed = line.trim();
        // Keep headers/bold lines
        if (trimmed.startsWith('**') || trimmed.startsWith('#') || trimmed.startsWith('🔴') || trimmed.startsWith('🟡') || trimmed.startsWith('🟢') || trimmed.startsWith('🔵') || trimmed.startsWith('📍')) {
            condensed.push(trimmed);
            sectionCount++;
        }
        // Keep bullet points but truncate long ones
        else if (trimmed.startsWith('•') || trimmed.startsWith('-') || /^\*\*\d/.test(trimmed)) {
            if (trimmed.length > 80) {
                condensed.push(trimmed.slice(0, 77) + '…');
            } else {
                condensed.push(trimmed);
            }
        }
        // Keep first line if it's the opening sentence
        else if (sectionCount === 0 && condensed.length === 0) {
            const firstSentence = trimmed.split(/\.\s/)[0];
            condensed.push(firstSentence + (firstSentence.endsWith('.') ? '' : '.'));
        }
    }

    return condensed.length > 0 ? condensed.join('\n') : text.split('\n').slice(0, 3).join('\n') + '\n\n_(Shortened)_';
}


/* ── Cross-page topic detection ──────────────────────────────────────────── */

interface TopicMatch {
    section: string;           // key into pageGuides
    label: string;             // human-friendly name
}

const TOPIC_PATTERNS: [RegExp, TopicMatch][] = [
    // Overview
    [/\b(overview|safeguarding overview|overview page|dashboard overview|main dashboard|health overview)\b/,
     { section: 'overview', label: 'Safeguarding Overview' }],
    // Submit
    [/\b(submit|submit.*case|submit.*page|submission page|report.*concern|raise.*case|make.*case)\b/,
     { section: 'submit', label: 'Submit a Case' }],
    // Cases list
    [/\b(cases list|cases page|all cases|case list|browse cases|case table)\b/,
     { section: 'cases', label: 'Cases' }],
    // Case detail
    [/\b(case detail|case view|single case|case page|detail page|case breakdown|full case)\b/,
     { section: 'cases/detail', label: 'Case Detail' }],
    // My Cases
    [/\b(my cases|my submissions)\b/,
     { section: 'my-cases', label: 'My Cases' }],
    // Review Queue
    [/\b(review queue|review.*queue|queue|needs review|admin queue|triage queue)\b/,
     { section: 'review-queue', label: 'Review Queue' }],
    // Reports
    [/\b(reports?|monthly report|inspection pack|safeguarding report|compliance report|generate.*report|report page)\b/,
     { section: 'reports', label: 'Reports' }],
    // Settings
    [/\b(settings|notification settings|preferences|email settings|notification preferences|settings page)\b/,
     { section: 'settings', label: 'Settings' }],
    // Inspection mode
    [/\b(inspection mode|inspector view|regulator view)\b/,
     { section: 'inspection', label: 'Inspection Mode' }],
    // Org users
    [/\b(users|team members|org users|manage users|user management|staff list)\b/,
     { section: 'org-users', label: 'Organisation Users' }],
    // Group Dashboard
    [/\b(group dashboard|multi.*org|super admin|global view|all organi[sz]ations)\b/,
     { section: 'group-dashboard', label: 'Group Dashboard' }],
];

/**
 * Detect whether the user is asking about a different area of the dashboard.
 * Returns the matched section key if the topic differs from the current page,
 * or null if the question is about the current page / no specific topic detected.
 */
function detectCrossPageTopic(q: string, currentSection: string): TopicMatch | null {
    for (const [pattern, match] of TOPIC_PATTERNS) {
        if (pattern.test(q) && match.section !== currentSection) {
            return match;
        }
    }
    return null;
}

/**
 * Build a rich cross-page answer using the knowledge base for the target section.
 */
function crossPageAnswer(target: TopicMatch, currentPageName: string, ctx: PageContext): StapeLeeResponse {
    const guide = pageGuides[target.section];
    if (!guide) {
        return {
            text: `I know about **${target.label}**, but I don't have a detailed guide for it yet. Ask me anything else!`,
            type: 'answer',
            chips: pageChips(ctx).slice(0, 3),
        };
    }

    const contextNote = `You're currently on **${currentPageName}**, but here's how **${guide.name}** works:\n\n`;
    const actions = guide.actions.length > 0
        ? `\n\n**What you can do there:**\n${guide.actions.map(a => `• ${a}`).join('\n')}`
        : '';
    const tips = guide.tips.length > 0
        ? `\n\n**Tips:**\n${guide.tips.map(t => `• ${t}`).join('\n')}`
        : '';

    return {
        text: `${contextNote}${guide.description}\n\n**Why it matters:** ${guide.value}${actions}${tips}`,
        type: 'answer',
        chips: [
            ...guide.chips.slice(0, 2),
            'Send feedback',
        ],
    };
}

export function askStapeLee(message: string, context: PageContext, memory?: SessionMemory, pageData?: PageDataSnapshot | null): StapeLeeResponse {
    const q = message.toLowerCase().trim();
    const mem = memory ?? new SessionMemory();

    // Bind page/case context every turn
    mem.bindContext(context.section, context.caseId);

    // ── Reply wrapper: records task + response into session memory ────
    function reply(resp: StapeLeeResponse, task?: ActiveTask): StapeLeeResponse {
        if (task) mem.recordTask(task);
        mem.recordResponse(resp.text);
        return resp;
    }

    // ── 0. Follow-up detection ──────────────────────────────────────────
    // Intercept short continuations that only make sense in context of the
    // previous turn. Must come before all pattern matchers.
    const followUp = detectFollowUp(q, mem, context);
    if (followUp) return reply(followUp, mem.activeTask);

    // ── 0b. Cross-page topic detection ──────────────────────────────────
    // If the user is explicitly asking about a different area of the dashboard,
    // answer that topic directly instead of falling back to the current page.
    // Only activate for questions that feel like "tell me about X" / "what is X" /
    // "how does X work" — not for short keywords that happen to match.
    if (
        /tell me about|what is|how does|explain|how do i|what.*(page|section)|show me|describe/.test(q) ||
        q.length > 12  // longer questions are more likely to be intentional topic queries
    ) {
        const crossTopic = detectCrossPageTopic(q, context.section);
        if (crossTopic) {
            mem.recordIntent('cross_page', crossTopic.section);
            return reply(crossPageAnswer(crossTopic, context.pageName, context), 'page_explain');
        }
    }

    // ── 1. Greeting ─────────────────────────────────────────────────────
    if (/^(hi|hello|hey|good morning|good afternoon|good evening|yo|hiya)\b/.test(q)) {
        mem.recordIntent('greeting', 'greeting');
        const guide = pageGuides[context.section];
        return reply({
            text: `Hey! You're on **${context.pageName}**.${context.caseId ? ` Viewing case \`${context.caseId.slice(0, 8)}…\`` : ''}\n\nI know this dashboard inside out — I can explain what's here, guide you through tasks, answer questions about statuses and workflows, or help draft feedback for the dev team.`,
            type: 'answer',
            chips: pageChips(context),
        });
    }

    // ── 2. "What is this page?" / "Where am I?" ────────────────────────
    if (/what.*(this page|page is this)|where am i|explain this page|what am i looking at|what.*(here|this)/.test(q)) {
        mem.recordIntent('page_explain', context.section);
        return reply(deepPageExplanation(context), 'page_explain');
    }

    // ── 2b. DATA-GROUNDED answers (live page data) ────────────────────
    const dataAnswer = tryDataGroundedAnswer(q, context, pageData ?? null);
    if (dataAnswer) {
        mem.recordIntent('data_query', context.section);
        return reply(dataAnswer, 'data_query');
    }

    // ── 3. "What can I do here?" ────────────────────────────────────────
    if (/what can i do|what actions|what.*(available|possible)|help me with this/.test(q) && !/submit|send|feedback/.test(q)) {
        mem.recordIntent('actions', context.section);
        return reply(contextualActions(context), 'page_explain');
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
        return reply(workflowAnswer('submitCase', context), 'workflow');
    }
    if (/how.*(review|triage|assess).*(case|incident)|review a case|triage/.test(q)) {
        mem.recordIntent('workflow', 'reviewCase');
        return reply(workflowAnswer('reviewCase', context), 'workflow');
    }
    if (/how.*(close|resolve|finish|complete).*(case|incident)|close a case/.test(q)) {
        mem.recordIntent('workflow', 'closeCase');
        return reply(workflowAnswer('closeCase', context), 'workflow');
    }
    if (/how.*(generate|create|run|make).*(report|inspection|pack)/.test(q)) {
        mem.recordIntent('workflow', 'generateReport');
        return reply(workflowAnswer('generateReport', context), 'workflow');
    }

    // ── 7. Case lifecycle ──────────────────────────────────────────────
    if (/case lifecycle|case flow|case process|stages|what happens.*(case|after|next)|how.*(case.*work|process work)/.test(q)) {
        mem.recordIntent('lifecycle', 'lifecycle');
        const currentStep = context.section === 'submit' ? 'You\'re at **Step 1** right now — submitting a case.' :
            context.section === 'cases/detail' ? 'You\'re viewing a case detail page — typically **Steps 3–6** happen here.' :
                context.section === 'review-queue' ? 'The review queue is where **Step 3 (Admin Review)** happens.' : '';
        return reply({
            text: '**Case Lifecycle**\n\n' +
                caseLifecycle.map(s => `**${s.step}.** ${s.title} — ${s.description}`).join('\n\n') +
                (currentStep ? `\n\n📍 ${currentStep}` : ''),
            type: 'answer',
            chips: followUpChips('lifecycle', context),
        }, 'lifecycle');
    }

    // ── 8. "What should I do next?" ────────────────────────────────────
    if (/what.*(should|do).*(next|now)|next step|what now|what.*(first|priority)/.test(q)) {
        mem.recordIntent('next_step', context.section);
        return reply(smartNextStep(context), 'next_step');
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
        return reply(valueAnswer('oversight', context), 'value');
    }
    if (/inspection|regulator|compliance|audit/.test(q) && !/pack|report|generate/.test(q)) {
        mem.recordIntent('value', 'inspection');
        return reply(valueAnswer('inspection', context), 'value');
    }
    if (/workflow value|how.*(help|work).*(team|staff|organisation)|why.*structure/.test(q)) {
        mem.recordIntent('value', 'workflow');
        return reply(valueAnswer('workflow', context), 'value');
    }
    if (/protect|resident|vulnerable|safe/.test(q) && !/second look/.test(q)) {
        mem.recordIntent('value', 'protection');
        return reply(valueAnswer('protection', context), 'value');
    }
    if (/intelligence|ai|triage value|smart|pattern/.test(q) && !/triage report|explain.*triage/.test(q)) {
        mem.recordIntent('value', 'intelligence');
        return reply(valueAnswer('intelligence', context), 'value');
    }
    if (/how.*connect|how.*pages.*work.*together|connection|flow between/.test(q)) {
        mem.recordIntent('value', 'connection');
        return reply(valueAnswer('connection', context), 'value');
    }
    if (/another angle|different angle|show.*more/.test(q)) {
        // Show a value angle the user hasn't seen yet
        const unseen = Object.keys(valuePropositions).filter(k => !mem.topicsDiscussed.includes(k));
        const key = unseen.length > 0 ? unseen[0] : 'oversight';
        mem.recordIntent('value', key);
        return reply(valueAnswer(key, context), 'value');
    }

    // ── 10. Developer feedback ─────────────────────────────────────────
    if (/feedback|bug report|feature request|feature idea|suggestion|report.*(issue|problem|bug)|something.*(wrong|broken)|send.*(dev|developer|team)/.test(q)) {
        mem.recordIntent('feedback', 'start');
        mem.feedbackInProgress = true;
        return reply({
            text: `I can draft structured feedback for the dev team. I'll auto-fill the page you're on (**${context.pageName}**) and detect the type from your description.\n\nDescribe the issue, suggestion, or idea and I'll prepare a clear draft for you to review before sending.`,
            type: 'feedback_draft',
            action: 'start_feedback',
            chips: ['Bug Report', 'Feature Request', 'UX Feedback'],
        }, 'feedback');
    }

    // ── 11. Tips for current page ──────────────────────────────────────
    if (/tip|advice|hint|best practice|pro tip|efficient|faster/.test(q)) {
        mem.recordIntent('tips', context.section);
        return reply(contextualTips(context), 'tips');
    }

    // ── 12. Explain simply / ELI5 ──────────────────────────────────────
    if (/explain.*(simply|easy|basic|plain)|eli5|in simple terms|dumb it down/.test(q)) {
        mem.recordIntent('simple', context.section);
        return reply(simpleExplanation(context), 'simple_explain');
    }

    // ── 13. "Look at first" / priority ─────────────────────────────────
    if (/what.*(look|check|focus|priorit)|most important|where.*(start|begin)/.test(q)) {
        mem.recordIntent('priority', context.section);
        return reply(whatToLookAt(context), 'next_step');
    }

    // ── 14. Summarise case ─────────────────────────────────────────────
    if (/summarise|summary|sum up|key facts|brief/.test(q) && (context.section === 'cases/detail' || context.caseId)) {
        mem.recordIntent('summarise', 'case');
        return reply({
            text: `To summarise this case:\n\n**1.** Check the **Case Summary** card at the top — it has the key facts.\n**2.** The **AI Triage Report** gives the risk assessment and pattern analysis.\n**3.** Look at **Evidence** for any attachments.\n**4.** The **Audit Timeline** shows the full history.\n\nI can't read the case data directly, but these sections give you everything at a glance.`,
            type: 'answer',
            chips: ['What should I check first?', 'Explain the triage report', 'How do I close this case?'],
        }, 'case_summary');
    }

    // ── 15. Triage report questions ────────────────────────────────────
    if (/triage report|ai report|ai triage|explain.*triage/.test(q)) {
        mem.recordIntent('triage_explain', 'triage');
        return reply({
            text: '**AI Triage Report**\n\nThe triage report is generated automatically when a case is submitted. It analyses the details you provided and assigns:\n\n• **Risk Level** — how urgent the concern is (Low → Critical)\n• **Category** — what type of concern (phone scam, email phishing, etc.)\n• **Pattern Notes** — any indicators the AI detected\n\nFor phone cases, it also runs **number intelligence** — checking the phone number against known databases.\n\nThe triage is a starting point — admins should always verify and adjust if needed.',
            type: 'answer',
            chips: ['What do risk levels mean?', 'How do I review a case?', 'Send feedback'],
        }, 'triage_explain');
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

    // ── 19. Summarise alerts ──────────────────────────────────────────
    if (/summarise.*alert|alert.*summar|explain.*alert/.test(q)) {
        mem.recordIntent('alerts', 'overview');
        return {
            text: '**Executive Alerts**\n\nAlerts appear at the top of the Overview page and flag situations that need leadership attention:\n\n🔴 **Critical/High** — A high-risk or critical case has been submitted, or the review queue has grown beyond target.\n🟡 **Medium** — Response times are slipping, or a pattern of repeat incidents has been detected.\n🔵 **Informational** — New cases submitted, or a weekly summary is available.\n\nAlerts are auto-generated by the system based on case data. Red alerts should be addressed first.',
            type: 'answer',
            chips: ['What needs attention first?', 'Explain these KPIs', 'Send feedback'],
        };
    }

    // ── 19b. Explain KPIs ─────────────────────────────────────────────
    if (/explain.*kpi|kpi|what.*kpi|these kpi|key performance/.test(q)) {
        mem.recordIntent('kpis', 'overview');
        return {
            text: '**KPI Cards on the Overview**\n\nThe KPI cards show your safeguarding performance this month:\n\n• **Total Cases** — how many concerns were submitted\n• **High Risk** — cases flagged as high or critical severity\n• **Awaiting Review** — cases that still need admin attention\n• **Closure Rate** — percentage of cases resolved\n\nIn **Visual mode**, these expand into ring charts showing:\n• Overall Health, Closure on Target, Triage Speed, Documentation Completeness, Scam Rate, and Queue Depth.\n\nGreen = on track, Amber = needs monitoring, Red = behind target.',
            type: 'answer',
            chips: ['What needs attention first?', 'Explain system status', 'Send feedback'],
        };
    }

    // ── 19c. System status ────────────────────────────────────────────
    if (/system status|explain.*status.*system|explain system/.test(q)) {
        mem.recordIntent('system_status', 'overview');
        return {
            text: '**System Status**\n\nThe Overview page shows your organisation\'s safeguarding system health through several indicators:\n\n**KPI Cards** — Current month numbers for cases, risk levels, and queue depth.\n**Executive Alerts** — Auto-generated warnings when things need attention.\n**Residents Needing Attention** — Individuals with repeat incidents.\n**Cases Awaiting Review** — Your active workload.\n\nIf all indicators are green, your system is running healthily. Amber or red signals mean specific areas need action.',
            type: 'answer',
            chips: ['Summarise alerts', 'Explain these KPIs', 'Send feedback'],
        };
    }

    // ── 19d. Help find case ───────────────────────────────────────────
    if (/help.*find|find.*case|search.*case|right case|looking for/.test(q)) {
        mem.recordIntent('find_case', 'cases');
        return {
            text: '**Finding the Right Case**\n\nOn the Cases page, you have several ways to find a specific case:\n\n• **Search** — Use the search box to look up a case by reference number\n• **Status filter** — Filter by New, In Review, or Closed to narrow the list\n• **Risk filter** — Show only High or Critical risk cases\n• **Sort** — Sort by date, risk level, or status to find what you need\n\nIf you\'re looking for cases that need attention, filter by "Needs Review" — those haven\'t been triaged yet.',
            type: 'answer',
            chips: ['What should I open next?', 'Explain filters', 'Send feedback'],
        };
    }

    // ── 19e. Explain filters ──────────────────────────────────────────
    if (/explain.*filter|filter|how.*filter/.test(q)) {
        mem.recordIntent('filters', context.section);
        return {
            text: '**Case Filters**\n\nFilters help you narrow the case list to find what you need:\n\n• **Status** — Show only New, In Review, or Closed cases\n• **Risk Level** — Filter by Low, Medium, High, or Critical\n• **Category** — Filter by case type (phone scam, email, URL, etc.)\n\nFilters combine together — for example, you can show only High Risk + In Review cases.\n\nTip: Start with "Needs Review" to see your immediate workload.',
            type: 'answer',
            chips: ['What do these statuses mean?', 'What should I open next?', 'Send feedback'],
        };
    }

    // ── 19f. What to open next ────────────────────────────────────────
    if (/what.*open.*next|which.*case.*open|next case|should i open/.test(q)) {
        mem.recordIntent('open_next', 'cases');
        return {
            text: '**What to Open Next**\n\nPrioritise in this order:\n\n🔴 **1.** High or Critical risk cases that are still "Needs Review"\n🟡 **2.** Medium risk cases with no admin review yet\n🔵 **3.** New cases submitted today — they\'re freshest\n**4.** Older cases that have been waiting longest\n\nThe Review Queue automatically sorts by priority, so if you go there, start from the top.',
            type: 'answer',
            chips: ['Explain this page', 'Help me find the right case', 'Send feedback'],
        };
    }

    // ── 19g. Draft resident guidance ──────────────────────────────────
    if (/draft.*resident|resident.*guidance|guidance.*resident|write.*guidance|resident.*advice/.test(q)) {
        mem.recordIntent('resident_guidance', 'case');
        return reply({
            text: '**Drafting Resident Guidance**\n\nBased on the case details, here\'s a framework for resident-facing guidance:\n\n**1. Acknowledge** — Confirm you\'re aware of the concern and taking it seriously.\n**2. Advise** — Give clear, simple advice on what the resident should do next:\n  • Do not respond to the suspicious contact\n  • Do not share personal or financial information\n  • Report any further contact to staff immediately\n**3. Reassure** — Let them know the situation is being handled and their safety is the priority.\n**4. Document** — Record the guidance given in the case notes for the audit trail.\n\nAdapt the specifics based on the triage report and evidence for this case.',
            type: 'answer',
            chips: ['Summarise this case', 'What should I do next?', 'Send feedback'],
        }, 'resident_guidance');
    }

    // ── 19h. Help prioritise ─────────────────────────────────────────
    if (/help.*prioriti|prioriti|how.*prioriti/.test(q)) {
        mem.recordIntent('prioritise', context.section);
        return reply({
            text: '**Prioritising Cases**\n\nUse this framework to decide what needs attention first:\n\n🔴 **Immediate** — Critical or High risk cases that are unreviewed\n🟡 **Soon** — Medium risk cases and cases waiting more than 24 hours\n🟢 **Routine** — Low risk cases and cases already in review\n\n**Queue health tip:** If your Awaiting Review count is above 5, focus on clearing the queue before other tasks. Response time is one of the key metrics inspectors look at.\n\nThe Review Queue auto-sorts by priority — working top to bottom is usually the best approach.',
            type: 'answer',
            chips: ['What should I review first?', 'Explain this page', 'Send feedback'],
        }, 'prioritise');
    }

    // ── 19i. Awaiting review meaning ─────────────────────────────────
    if (/awaiting review|what.*awaiting|needs review.*mean/.test(q)) {
        mem.recordIntent('awaiting_review', 'review-queue');
        return {
            text: '**Awaiting Review**\n\n"Awaiting Review" means a case has been submitted and AI-triaged, but no admin has reviewed it yet.\n\nThese cases need a human to:\n• Confirm the AI\'s risk assessment\n• Review any evidence\n• Add notes or adjust the category\n• Eventually close the case with a decision\n\nA high "Awaiting Review" count means your response time is at risk — keeping this low demonstrates strong safeguarding practice to inspectors.',
            type: 'answer',
            chips: ['What should I review first?', 'Help me prioritise', 'Send feedback'],
        };
    }

    // ── 19j. Report purpose ──────────────────────────────────────────
    if (/report purpose|what.*report.*for|purpose.*report|summarise.*report/.test(q)) {
        mem.recordIntent('report_purpose', 'reports');
        return {
            text: '**Report Types in Second Look Protect**\n\n**Monthly Summary** — A snapshot of safeguarding activity for a given month. Shows total cases, risk breakdown, response times, and trends. Use this for internal governance meetings and to track performance over time.\n\n**Inspection Pack** — A structured, formal document designed for regulatory inspectors. It includes case statistics, compliance health indicators, and evidence of your organisation\'s safeguarding processes. This is the document you\'d give a CQC inspector or similar regulator.\n\nBoth reports use locked historical data, meaning they can\'t be altered after the fact — ensuring audit integrity.',
            type: 'answer',
            chips: ['Explain this page', 'Send feedback'],
        };
    }

    // ── 20. Thank you ──────────────────────────────────────────────────
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

/* ── Data-grounded answer engine ────────────────────────────────────────── */

function fmtKpis(kpis: { label: string; value: string | number; status?: string }[]): string {
    return kpis.map(k => {
        const indicator = k.status === 'danger' ? '🔴' : k.status === 'warn' ? '🟡' : k.status === 'good' ? '🟢' : '•';
        return `${indicator} **${k.label}:** ${k.value}`;
    }).join('\n');
}

function tryDataGroundedAnswer(q: string, ctx: PageContext, data: PageDataSnapshot | null): StapeLeeResponse | null {
    if (!data || data.section !== ctx.section) return null;

    const kpis = data.kpis ?? [];
    const alerts = data.alerts ?? [];
    const rows = data.tableRows ?? [];
    const insights = data.insights ?? [];

    // ── "How many" / "What's the" / number questions ────────────────────
    if (/how many|what.*(the |current |total )?(number|count|figure|amount)|tell me.*(numbers?|stats|figures|data)/.test(q)) {
        if (kpis.length === 0) return null;
        const orgLine = data.organisationName ? `\n\n*Viewing: ${data.organisationName}*` : '';
        const filterLine = data.activeFilters ? `\n*Filters: ${data.activeFilters}*` : '';
        return {
            text: `**Current numbers on ${ctx.pageName}:**\n\n${fmtKpis(kpis)}${orgLine}${filterLine}`,
            type: 'answer',
            chips: ['What needs attention?', 'Explain these metrics', 'Send feedback'],
        };
    }

    // ── Summarise / what's showing / overview of this page's data ─────
    if (/summar|what.*(show|display)|give me.*(overview|rundown|breakdown)|data.*(summary|overview)|page.*(summary|data)/.test(q)) {
        const parts: string[] = [];
        if (kpis.length > 0) parts.push(`**Key metrics:**\n${fmtKpis(kpis)}`);
        if (alerts.length > 0) {
            const alertLines = alerts.slice(0, 5).map(a => {
                const sev = a.severity === 'critical' || a.severity === 'high' ? '🔴' : a.severity === 'medium' ? '🟡' : '🔵';
                return `${sev} ${a.title}${a.description ? ` — ${a.description}` : ''}`;
            }).join('\n');
            parts.push(`**Alerts (${alerts.length}):**\n${alertLines}`);
        }
        if (rows.length > 0) {
            const topRows = rows.slice(0, 5).map(r => `• **${r.label}**`).join('\n');
            parts.push(`**Top items (${rows.length} total):**\n${topRows}`);
        }
        if (insights.length > 0) parts.push(`**Insights:** ${insights.join(' ')}`);
        if (parts.length === 0) return null;
        const orgLine = data.organisationName ? `\n\n*Viewing: ${data.organisationName}*` : '';
        return {
            text: `**Summary of ${ctx.pageName}:**\n\n${parts.join('\n\n')}${orgLine}`,
            type: 'answer',
            chips: ['What needs attention?', 'Explain a metric', 'Send feedback'],
        };
    }

    // ── Health / performance / how are we doing ───────────────────────
    if (/how healthy|health|how.*(doing|performing)|organisation.*(status|state)|how.*we/.test(q)) {
        if (kpis.length === 0) return null;
        const dangerKpis = kpis.filter(k => k.status === 'danger');
        const warnKpis = kpis.filter(k => k.status === 'warn');
        const goodKpis = kpis.filter(k => k.status === 'good');

        let assessment = '';
        if (dangerKpis.length > 0) {
            assessment = `🔴 **Needs attention.** ${dangerKpis.length} metric${dangerKpis.length > 1 ? 's are' : ' is'} in the red zone:\n${dangerKpis.map(k => `  • ${k.label}: ${k.value}`).join('\n')}`;
        } else if (warnKpis.length > 0) {
            assessment = `🟡 **Monitoring needed.** ${warnKpis.length} metric${warnKpis.length > 1 ? 's are' : ' is'} in amber:\n${warnKpis.map(k => `  • ${k.label}: ${k.value}`).join('\n')}`;
        } else if (goodKpis.length > 0) {
            assessment = `🟢 **Looking healthy.** All key metrics are in the green zone.`;
        } else {
            assessment = `Current metrics:\n${fmtKpis(kpis)}`;
        }

        return {
            text: `**Health Assessment (${ctx.pageName}):**\n\n${assessment}\n\n${fmtKpis(kpis)}`,
            type: 'answer',
            chips: ['What should I do next?', 'Explain a metric', 'Send feedback'],
        };
    }

    // ── Summarise alerts ─────────────────────────────────────────────
    if (/alert|warning|issue|flag|concern/.test(q) && alerts.length > 0) {
        const alertLines = alerts.map(a => {
            const sev = a.severity === 'critical' || a.severity === 'high' ? '🔴' : a.severity === 'medium' ? '🟡' : '🔵';
            return `${sev} **${a.title}**${a.description ? `\n  ${a.description}` : ''}`;
        }).join('\n');
        return {
            text: `**Active Alerts (${alerts.length}):**\n\n${alertLines}`,
            type: 'answer',
            chips: ['What should I do first?', 'Explain these metrics', 'Send feedback'],
        };
    }

    // ── Compare homes / which home ───────────────────────────────────
    if (/which home|compar|best|worst|most|least|highest|lowest|top home|bottom home/.test(q) && rows.length > 0) {
        const topRows = rows.slice(0, 5).map((r, i) => {
            const vals = Object.entries(r).filter(([k]) => k !== 'label').map(([k, v]) => `${k}: ${v}`).join(', ');
            return `**${i + 1}. ${r.label}** — ${vals}`;
        }).join('\n');
        return {
            text: `**Home Comparison (${ctx.pageName}):**\n\n${topRows}${rows.length > 5 ? `\n\n_…and ${rows.length - 5} more homes_` : ''}`,
            type: 'answer',
            chips: ['Show me the numbers', 'What needs attention?', 'Send feedback'],
        };
    }

    // ── Explain a specific metric ────────────────────────────────────
    if (/what.*(mean|is|does)|explain|define|describe/.test(q)) {
        // Try to find a KPI that matches the question
        const matchedKpi = kpis.find(k => q.includes(k.label.toLowerCase()));
        const metricDef = findMetricDef(q);
        if (matchedKpi && metricDef) {
            const statusHint = matchedKpi.status === 'danger'
                ? `\n\n🔴 **Current status:** This is in the red zone. ${metricDef.bad}`
                : matchedKpi.status === 'warn'
                    ? `\n\n🟡 **Current status:** This is in amber. ${metricDef.bad}`
                    : matchedKpi.status === 'good'
                        ? `\n\n🟢 **Current status:** This is healthy. ${metricDef.good}`
                        : '';
            return {
                text: `**${metricDef.label}: ${matchedKpi.value}**\n\n${metricDef.definition}${statusHint}`,
                type: 'answer',
                chips: ['Show all numbers', 'What needs attention?', 'Send feedback'],
            };
        }
        if (metricDef) {
            // Find value from KPIs even if label didn't match exactly
            const bestKpi = kpis.find(k => k.label.toLowerCase().includes(metricDef.label.toLowerCase().split(' ')[0]));
            const valLine = bestKpi ? `\n\n**Current value:** ${bestKpi.value}` : '';
            return {
                text: `**${metricDef.label}**\n\n${metricDef.definition}\n\n✅ Good: ${metricDef.good}\n⚠️ Bad: ${metricDef.bad}${valLine}`,
                type: 'answer',
                chips: ['Show all numbers', 'What needs attention?', 'Send feedback'],
            };
        }
    }

    // ── "What needs attention" / "what's wrong" / priority ───────────
    if (/needs? attention|what.*(wrong|concern|worry|issue|problem|urgent)|priorit|fix|action/.test(q)) {
        const dangerKpis = kpis.filter(k => k.status === 'danger');
        const warnKpis = kpis.filter(k => k.status === 'warn');
        const critAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'high');

        if (dangerKpis.length === 0 && warnKpis.length === 0 && critAlerts.length === 0) {
            return {
                text: `🟢 **Nothing urgent right now.** All metrics on ${ctx.pageName} look healthy.\n\nKeep monitoring regularly — I'll flag any issues when they appear.`,
                type: 'answer',
                chips: ['Show me the numbers', 'What should I do next?', 'Send feedback'],
            };
        }

        const parts: string[] = [];
        if (critAlerts.length > 0) {
            parts.push(`🔴 **${critAlerts.length} urgent alert${critAlerts.length > 1 ? 's' : ''}:**\n${critAlerts.map(a => `  • ${a.title}`).join('\n')}`);
        }
        if (dangerKpis.length > 0) {
            parts.push(`🔴 **${dangerKpis.length} metric${dangerKpis.length > 1 ? 's' : ''} in red:**\n${dangerKpis.map(k => `  • ${k.label}: ${k.value}`).join('\n')}`);
        }
        if (warnKpis.length > 0) {
            parts.push(`🟡 **${warnKpis.length} metric${warnKpis.length > 1 ? 's' : ''} in amber:**\n${warnKpis.map(k => `  • ${k.label}: ${k.value}`).join('\n')}`);
        }

        return {
            text: `**Needs Attention (${ctx.pageName}):**\n\n${parts.join('\n\n')}`,
            type: 'answer',
            chips: ['What should I do first?', 'Explain these metrics', 'Send feedback'],
        };
    }

    return null;
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
    // Last-resort cross-page attempt — maybe the user mentioned a topic loosely
    const looseMatch = detectCrossPageTopic(mem.lastIntent || '', ctx.section);
    if (looseMatch) {
        return crossPageAnswer(looseMatch, ctx.pageName, ctx);
    }

    const guide = pageGuides[ctx.section];
    const pageHint = guide
        ? `You're on **${guide.name}** — ${guide.description.split('.')[0]}.`
        : `You're on **${ctx.pageName}**.`;

    // If user has asked several questions, expand the help offer
    const extraContext = mem.questionsAsked > 2
        ? `\n\nWe've covered a few topics this session. Would you like a specific workflow guide, or would you like to send feedback about something?`
        : '';

    return {
        text: `I'm not entirely sure what you're asking. ${pageHint}\n\nI can help with any part of the dashboard — **Overview**, **Cases**, **Reports**, **Review Queue**, **Settings**, workflows, statuses, and more. Just ask!${extraContext}`,
        type: 'unknown',
        chips: [
            'Explain Overview',
            'Tell me about Reports',
            'How does the Review Queue work?',
            ...pageChips(ctx).slice(0, 2),
            'Send feedback',
        ],
    };
}
