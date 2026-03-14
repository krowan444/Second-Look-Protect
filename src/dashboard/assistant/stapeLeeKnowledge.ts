/* ═══════════════════════════════════════════════════════════════════════════
   Stape-Lee — Structured Product Knowledge Base
   ═══════════════════════════════════════════════════════════════════════════
   Single source of truth for what Stape-Lee knows about Second Look
   Protect. Extended with value propositions, page-specific chips, and
   deeper contextual guidance.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Product overview ────────────────────────────────────────────────────── */

export const productOverview = {
    name: 'Second Look Protect',
    tagline: 'Safeguarding intelligence for care homes and supported living',
    description:
        'Second Look Protect helps care organisations manage safeguarding concerns. ' +
        'Staff submit incidents (phone scam attempts, suspicious contacts, financial concerns) ' +
        'and administrators review, triage, and close cases with full audit trails. ' +
        'The platform includes AI-assisted triage, number intelligence, executive alerts, ' +
        'compliance reporting, and multi-organisation management.',
    audience: 'Care home managers, safeguarding leads, compliance officers, and super administrators.',
};

/* ── Value propositions (multi-angle product understanding) ──────────────── */

export const valuePropositions: Record<string, { title: string; description: string }> = {
    oversight: {
        title: 'Operational Oversight',
        description:
            'Second Look Protect gives managers a real-time view of all safeguarding activity. ' +
            'Instead of waiting for paper reports or email chains, you can see what\'s happening now — ' +
            'which cases are open, who needs attention, and where your team\'s response is healthy or falling behind.',
    },
    inspection: {
        title: 'Inspection Readiness',
        description:
            'The platform keeps a permanent, auditable record of every safeguarding action. ' +
            'When regulators visit, you can produce inspection-ready packs instantly — showing that your ' +
            'organisation responds promptly, documents thoroughly, and handles concerns professionally.',
    },
    workflow: {
        title: 'Safeguarding Workflow',
        description:
            'Every concern follows a clear path: submission → AI triage → admin review → decision → closure. ' +
            'This structured workflow ensures nothing slips through the cracks. Staff don\'t need to remember ' +
            'what to do — the system guides them through each step.',
    },
    protection: {
        title: 'Resident Protection',
        description:
            'At its core, Second Look Protect exists to keep vulnerable people safe. ' +
            'By making it easy to report, fast to triage, and clear to act on safeguarding concerns, ' +
            'the platform helps organisations catch threats early and respond effectively.',
    },
    intelligence: {
        title: 'Built-In Intelligence',
        description:
            'The platform uses AI triage to assess risk automatically, number intelligence to check ' +
            'suspicious phone numbers, pattern detection to spot repeat incidents, and executive alerts ' +
            'to surface urgent situations to leadership — all without manual effort.',
    },
    connection: {
        title: 'How Pages Connect',
        description:
            'Staff submit cases → AI triages them → admins review in the queue → cases close with decisions. ' +
            'The overview shows the health of this entire flow. Reports capture it for compliance. ' +
            'Settings let each user control their own notifications. Everything feeds into a single, auditable record.',
    },
};

/* ── Page guides ─────────────────────────────────────────────────────────── */

export interface PageGuide {
    name: string;
    route: string;
    description: string;
    value: string;
    actions: string[];
    tips: string[];
    chips: string[];
}

export const pageGuides: Record<string, PageGuide> = {
    overview: {
        name: 'Safeguarding Overview',
        route: 'overview',
        description:
            'Your command centre. Shows this month\'s key metrics, executive alerts, ' +
            'high-risk cases, residents needing attention, and the review queue at a glance. ' +
            'The Visual mode adds ring chart KPIs for at-a-glance performance health.',
        value:
            'This page tells you whether your safeguarding operation is healthy. ' +
            'Green indicators mean you\'re on track, amber means something needs monitoring, and ' +
            'red means urgent action is required. For inspectors, this page demonstrates that your ' +
            'organisation actively monitors its safeguarding performance.',
        actions: [
            'View KPI cards or Visual mode ring charts',
            'Check executive alerts for urgent situations',
            'See residents needing attention (repeat incidents)',
            'Jump to cases awaiting review',
            'Switch between Standard and Visual display modes',
        ],
        tips: [
            'Green means healthy and on track.',
            'Amber means something needs monitoring.',
            'Red means urgent action is needed.',
            'The "Awaiting Review" card shows queue pressure — aim to keep it low.',
            'Try Visual mode if you prefer seeing ring charts over numbers.',
        ],
        chips: [
            'Explain this page',
            'Explain system status',
            'Summarise alerts',
            'What needs attention first?',
            'Explain these KPIs',
            'Send feedback',
        ],
    },
    submit: {
        name: 'Submit a Case',
        route: 'submit',
        description:
            'Report a safeguarding concern. You can submit via phone number lookup, ' +
            'email paste, URL check, screenshot upload, or manual entry. Each method ' +
            'gathers different evidence automatically.',
        value:
            'This is the starting point for every safeguarding concern. The more detail you provide, ' +
            'the better the AI triage works. Phone number submissions automatically trigger number intelligence. ' +
            'Quick, structured submissions mean faster responses and cleaner audit trails.',
        actions: [
            'Choose submission type',
            'Enter concern details',
            'Upload evidence (screenshots, documents)',
            'Submit case for review',
        ],
        tips: [
            'Phone number submissions trigger automatic number intelligence.',
            'Email submissions can auto-extract key details from pasted email content.',
            'Screenshot submissions run OCR to extract text from images.',
            'All submissions are logged with a full audit trail.',
            'More detail = better AI triage = faster resolution.',
        ],
        chips: [
            'How do I submit a case?',
            'What submission type should I choose?',
            'What happens after I submit?',
            'Explain case lifecycle',
            'Send feedback',
        ],
    },
    cases: {
        name: 'Cases',
        route: 'cases',
        description:
            'Browse all submitted cases. Filter by status, risk level, or category. ' +
            'Click any case to open its full detail page. The table shows evidence count ' +
            'and needs-review status for quick triage prioritisation.',
        value:
            'This is your operational view into every safeguarding concern across the organisation. ' +
            'It helps you find specific cases, monitor workload, and identify patterns. ' +
            'Good case management here directly supports compliance and inspection readiness.',
        actions: [
            'Filter cases by status, risk, or category',
            'Search by reference',
            'Open case detail',
            'View triage status and evidence count',
        ],
        tips: [
            '"Needs Review" cases have not been triaged yet — prioritise those.',
            'You can filter to see only open, closed, or high-risk cases.',
            'Red risk badges indicate high or critical severity.',
        ],
        chips: [
            'Explain this page',
            'What do these statuses mean?',
            'Help me find the right case',
            'What should I open next?',
            'Explain filters',
            'Send feedback',
        ],
    },
    'cases/detail': {
        name: 'Case Detail',
        route: 'cases/:id',
        description:
            'The full view of a single case. Shows the case summary, AI triage report, ' +
            'audit timeline, evidence attachments, number intelligence, and admin actions. ' +
            'Closed cases also show a Case Completion Snapshot with performance metrics.',
        value:
            'This is where safeguarding decisions are made. Everything you need to assess a concern ' +
            'is gathered in one place — the AI analysis, the evidence, and the full history. ' +
            'Every action you take here is permanently recorded in the audit timeline, ' +
            'which is essential for inspection readiness.',
        actions: [
            'Review case summary',
            'Read AI triage report',
            'View evidence attachments',
            'Check number intelligence (if phone case)',
            'Review audit timeline',
            'Update status or risk level',
            'Add compliance notes',
            'Close the case with a decision',
        ],
        tips: [
            'The Case Completion Snapshot appears only for closed cases.',
            'You can re-run number intelligence if the first result was weak.',
            'All changes are logged in the audit timeline.',
            'Read the AI triage report before making your decision — it catches things humans might miss.',
        ],
        chips: [
            'Summarise this case',
            'What should I do next?',
            'Explain this status',
            'Explain triage',
            'Draft resident guidance',
            'Send feedback',
        ],
    },
    'my-cases': {
        name: 'My Cases',
        route: 'my-cases',
        description: 'Cases you personally submitted. A filtered view of your own submissions so you can track outcomes.',
        value:
            'This page gives you visibility into what happened with the concerns you raised. ' +
            'You can see whether each case has been reviewed, what risk level was assigned, ' +
            'and whether it\'s been closed. It helps close the loop on your safeguarding vigilance.',
        actions: ['View your cases', 'Track status of your submissions'],
        tips: ['This only shows cases you submitted — not all organisational cases.'],
        chips: [
            'What happened with my cases?',
            'How do I submit a new case?',
            'Explain case statuses',
            'Send feedback',
        ],
    },
    'review-queue': {
        name: 'Review Queue',
        route: 'review-queue',
        description:
            'Cases needing admin attention. Sorted by priority — high-risk and unreviewed cases appear first.',
        value:
            'This is the heartbeat of your safeguarding operation. A growing queue means response times are ' +
            'slipping — inspectors look at this. An empty queue means your team is responsive and on top of things. ' +
            'Aim to clear this daily for the best outcomes.',
        actions: ['Triage cases', 'Assign risk levels', 'Move cases to reviewed status'],
        tips: [
            'Work from top to bottom — highest priority is at the top.',
            'Cases with no triage are flagged as "Needs Review".',
            'Keeping the queue low demonstrates strong safeguarding practice.',
        ],
        chips: [
            'Explain this page',
            'Help me prioritise',
            'What does awaiting review mean?',
            'What should I review first?',
            'Send feedback',
        ],
    },
    reports: {
        name: 'Reports',
        route: 'reports',
        description:
            'Generate safeguarding reports for compliance and governance. Includes monthly summaries ' +
            'and inspection-ready packs formatted for regulatory review.',
        value:
            'Reports are your compliance backbone. Monthly summaries show safeguarding trends over time. ' +
            'Inspection packs are structured to give regulators exactly what they need. ' +
            'Both use locked historical data so the record is immutable and audit-safe.',
        actions: ['Generate monthly report', 'Create inspection pack', 'Download PDF', 'Email report'],
        tips: [
            'Inspection packs are formatted specifically for regulatory review.',
            'Reports use locked historical data for audit integrity.',
            'You can email reports directly to recipients from this page.',
        ],
        chips: [
            'Explain this page',
            'What is this report for?',
            'Summarise report purpose',
            'Send feedback',
        ],
    },
    settings: {
        name: 'Settings',
        route: 'settings',
        description: 'Manage your profile, notification preferences, and account settings.',
        value:
            'Your notification settings control what emails you receive — new case alerts, review notifications, ' +
            'weekly digests. Setting these correctly means you stay informed without being overwhelmed. ' +
            'Your preferences only affect you, not other users.',
        actions: ['Update profile', 'Change notification preferences', 'Manage email settings'],
        tips: ['Email notification preferences control what you receive — not what others receive.'],
        chips: [
            'Explain notification settings',
            'What emails will I get?',
            'Send feedback',
        ],
    },
    inspection: {
        name: 'Inspection Mode',
        route: 'inspection',
        description:
            'A read-only view of the dashboard designed for regulatory inspectors. ' +
            'Shows compliance health indicators and key metrics without editing controls.',
        value:
            'This mode lets you confidently share the dashboard with inspectors. ' +
            'They can see everything relevant without risk of accidental edits. ' +
            'Compliance indicators show at a glance whether your safeguarding practice meets targets.',
        actions: ['Review compliance status', 'View inspection-ready data'],
        tips: ['This is a view-only mode — no data can be edited here.'],
        chips: [
            'Explain inspection mode',
            'What do inspectors see?',
            'Send feedback',
        ],
    },
    platform: {
        name: 'Platform Overview (Super Admin)',
        route: 'platform',
        description: 'Cross-organisation summary showing total cases, orgs, and high-risk activity across the platform.',
        value:
            'For super administrators managing multiple organisations, this is the top-level command view. ' +
            'It surfaces cross-org patterns, highlights which organisations have high-risk activity, ' +
            'and helps you allocate attention where it\'s needed most.',
        actions: ['View platform-wide metrics', 'Monitor all organisations', 'Compare org performance'],
        tips: ['Only visible to super administrators.'],
        chips: [
            'Platform summary',
            'Which orgs need attention?',
            'Send feedback',
        ],
    },
};

/* ── Status & label glossary ─────────────────────────────────────────────── */

export const statusGlossary: Record<string, { label: string; meaning: string; colour: string }> = {
    submitted: { label: 'New', meaning: 'Case has been submitted and is waiting for its first review.', colour: 'blue' },
    new: { label: 'New', meaning: 'Same as submitted — the case is freshly created.', colour: 'blue' },
    in_review: { label: 'In Review', meaning: 'An admin is actively reviewing this case.', colour: 'amber' },
    closed: { label: 'Closed', meaning: 'The case has been resolved and closed by an admin.', colour: 'green' },
};

export const riskGlossary: Record<string, { meaning: string; colour: string }> = {
    low: { meaning: 'Minimal concern. Routine monitoring only.', colour: 'green' },
    medium: { meaning: 'Some concern. Should be reviewed within normal timelines.', colour: 'amber' },
    high: { meaning: 'Significant concern. Requires prompt attention and action.', colour: 'red' },
    critical: { meaning: 'Immediate risk. Must be addressed urgently.', colour: 'red' },
};

export const decisionGlossary: Record<string, string> = {
    scam: 'The reported contact or activity was identified as a scam or fraud attempt.',
    not_scam: 'The reported contact or activity was verified as legitimate — not a scam.',
};

/* ── Case lifecycle ──────────────────────────────────────────────────────── */

export const caseLifecycle = [
    { step: 1, title: 'Submission', description: 'A staff member submits a safeguarding concern via the dashboard.' },
    { step: 2, title: 'Auto-Triage', description: 'The AI triage system analyses the case and assigns an initial risk level and category.' },
    { step: 3, title: 'Admin Review', description: 'An administrator reviews the case, confirms or adjusts the risk level, and adds any notes.' },
    { step: 4, title: 'Investigation', description: 'If needed, further evidence is gathered — number intelligence, email analysis, or manual checks.' },
    { step: 5, title: 'Decision', description: 'The admin marks the case as scam or not scam based on the evidence.' },
    { step: 6, title: 'Closure', description: 'The case is closed with a full audit trail. A Case Completion Snapshot shows performance metrics.' },
];

/* ── Workflow guides ─────────────────────────────────────────────────────── */

export const workflowGuides: Record<string, { title: string; steps: string[] }> = {
    submitCase: {
        title: 'How to Submit a Case',
        steps: [
            'Navigate to "Submit Case" from the sidebar or top bar.',
            'Choose a submission type: Phone Number, Email, URL, Screenshot, or Manual.',
            'Fill in the required details about the safeguarding concern.',
            'Add any additional context, notes, or evidence files.',
            'Click "Submit" — the case will be created and AI triage will run automatically.',
        ],
    },
    reviewCase: {
        title: 'How to Review a Case',
        steps: [
            'Go to "Cases" or "Review Queue" from the sidebar.',
            'Click on a case to open its detail page.',
            'Read the AI triage report and any evidence gathered.',
            'Confirm or adjust the risk level and category.',
            'Add compliance notes if needed.',
            'If the case is resolved, close it with a final decision.',
        ],
    },
    closeCase: {
        title: 'How to Close a Case',
        steps: [
            'Open the case detail page.',
            'Review all evidence, triage, and notes.',
            'Set the final decision (Scam / Not Scam).',
            'Set the outcome and any closing notes.',
            'Click "Close Case" — a Case Completion Snapshot will appear showing response metrics.',
        ],
    },
    generateReport: {
        title: 'How to Generate a Report',
        steps: [
            'Navigate to "Reports" from the sidebar.',
            'Choose the report type: Monthly Summary or Inspection Pack.',
            'Select the time period.',
            'Click "Generate" to create the report.',
            'Download the PDF or share via email.',
        ],
    },
};

/* ── Tone & safety rules ─────────────────────────────────────────────────── */

export const toneRules = {
    personality: 'Calm, professional, and helpful. Stape-Lee is a knowledgeable product operator — not a chatbot.',
    principles: [
        'Always explain before acting.',
        'Draft before sending — never auto-submit.',
        'Confirm before any action that changes data or sends a message.',
        'If unsure, say so honestly rather than guessing.',
        'Keep answers concise and practical.',
        'Use plain English — avoid jargon unless the user asks for technical detail.',
        'Explain the value and purpose behind actions, not just how to do them.',
        'Connect answers to real outcomes — inspection readiness, resident safety, team efficiency.',
    ],
    safetyRules: [
        'Never reveal internal system architecture or database details.',
        'Never fabricate case data or statistics.',
        'Never auto-close, auto-submit, or auto-send without explicit user confirmation.',
        'Always make it clear when you are drafting vs performing an action.',
    ],
};

/* ── Developer feedback structure ────────────────────────────────────────── */

export const feedbackStructure = {
    description: 'Users can send structured feedback to the development team via Stape-Lee.',
    fields: [
        { name: 'category', label: 'Type', options: ['Bug Report', 'Feature Request', 'UX Feedback', 'General'] },
        { name: 'page', label: 'Page', description: 'Auto-filled from current page context.' },
        { name: 'description', label: 'Description', description: 'A clear description of the issue or suggestion.' },
        { name: 'priority', label: 'Priority', options: ['Low', 'Medium', 'High'] },
    ],
    flow: [
        'User triggers feedback (via chip or keyword).',
        'Stape-Lee asks a clarifying question if the description is vague.',
        'Stape-Lee drafts a structured feedback message.',
        'User reviews and clicks Send or Discard.',
        'Stape-Lee sends it via the email-dispatch API.',
    ],
    clarifyingQuestions: [
        'Can you describe what you expected to happen vs what actually happened?',
        'Which part of the page was this about?',
        'Is this a problem you see every time, or did it happen just once?',
        'How important is this to your workflow — is it blocking you?',
    ],
};
