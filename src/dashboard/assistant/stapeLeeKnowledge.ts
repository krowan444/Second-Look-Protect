/* ═══════════════════════════════════════════════════════════════════════════
   Stape-Lee — Structured Product Knowledge Base
   ═══════════════════════════════════════════════════════════════════════════
   This module is the single source of truth for what Stape-Lee knows about
   the Second Look Protect dashboard. It can be extended later from a folder,
   JSON file, or admin-managed data source.
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

/* ── Page guides ─────────────────────────────────────────────────────────── */

export interface PageGuide {
    name: string;
    route: string;
    description: string;
    actions: string[];
    tips: string[];
}

export const pageGuides: Record<string, PageGuide> = {
    overview: {
        name: 'Safeguarding Overview',
        route: 'overview',
        description:
            'Your command centre. Shows this month\'s key metrics, executive alerts, ' +
            'high-risk cases, residents needing attention, and the review queue at a glance.',
        actions: ['View KPI cards', 'Check executive alerts', 'See residents needing attention', 'Jump to cases awaiting review'],
        tips: [
            'Green means healthy and on track.',
            'Amber means something needs monitoring.',
            'Red means urgent action is needed.',
            'The "Awaiting Review" card shows queue pressure — aim to keep it low.',
        ],
    },
    submit: {
        name: 'Submit a Case',
        route: 'submit',
        description:
            'Report a safeguarding concern. You can submit via phone number lookup, ' +
            'email paste, URL check, or manual entry. Each method gathers different evidence automatically.',
        actions: ['Choose submission type', 'Enter details', 'Submit case for review'],
        tips: [
            'Phone number submissions trigger automatic number intelligence.',
            'Email submissions can auto-extract key details from pasted email content.',
            'All submissions are logged with a full audit trail.',
        ],
    },
    cases: {
        name: 'Cases',
        route: 'cases',
        description:
            'Browse all submitted cases. Filter by status, risk level, or category. ' +
            'Click any case to open its full detail page.',
        actions: ['Filter cases', 'Search by reference', 'Open case detail', 'View triage status'],
        tips: [
            '"Needs Review" cases have not been triaged yet.',
            'You can filter to see only open, closed, or high-risk cases.',
        ],
    },
    'cases/detail': {
        name: 'Case Detail',
        route: 'cases/:id',
        description:
            'The full view of a single case. Shows the case summary, AI triage report, ' +
            'audit timeline, evidence, number intelligence, and admin actions.',
        actions: [
            'Review case summary',
            'Read AI triage report',
            'View audit timeline',
            'Update status or risk level',
            'Add compliance notes',
            'Close the case',
        ],
        tips: [
            'The Case Completion Snapshot appears only for closed cases.',
            'You can re-run number intelligence if the first result was weak.',
            'All changes are logged in the audit timeline.',
        ],
    },
    'my-cases': {
        name: 'My Cases',
        route: 'my-cases',
        description: 'Cases you personally submitted. A filtered view of your own submissions.',
        actions: ['View your cases', 'Track status of your submissions'],
        tips: ['This only shows cases you submitted — not all organisational cases.'],
    },
    'review-queue': {
        name: 'Review Queue',
        route: 'review-queue',
        description:
            'Cases needing admin attention. Sorted by priority — high-risk and unreviewed cases appear first.',
        actions: ['Triage cases', 'Assign risk levels', 'Move cases to reviewed status'],
        tips: [
            'Work from top to bottom — highest priority is at the top.',
            'Cases with no triage are flagged as "Needs Review".',
        ],
    },
    reports: {
        name: 'Reports',
        route: 'reports',
        description:
            'Generate safeguarding reports for compliance and governance. Includes monthly summaries ' +
            'and inspection-ready packs.',
        actions: ['Generate monthly report', 'Create inspection pack', 'Download PDF'],
        tips: [
            'Inspection packs are formatted for regulatory review.',
            'Reports use locked historical data for audit integrity.',
        ],
    },
    settings: {
        name: 'Settings',
        route: 'settings',
        description: 'Manage your profile, notification preferences, and account settings.',
        actions: ['Update profile', 'Change notification preferences', 'Manage email settings'],
        tips: ['Email notification preferences control what you receive — not what others receive.'],
    },
    inspection: {
        name: 'Inspection Mode',
        route: 'inspection',
        description:
            'A read-only view of the dashboard designed for regulatory inspectors. ' +
            'Shows compliance health indicators and key metrics without editing controls.',
        actions: ['Review compliance status', 'View inspection-ready data'],
        tips: ['This is a view-only mode — no data can be edited here.'],
    },
    platform: {
        name: 'Platform Overview (Super Admin)',
        route: 'platform',
        description: 'Cross-organisation summary showing total cases, orgs, and high-risk activity across the platform.',
        actions: ['View platform-wide metrics', 'Monitor all organisations'],
        tips: ['Only visible to super administrators.'],
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
            'Choose a submission type: Phone Number, Email, URL, or Manual.',
            'Fill in the required details about the safeguarding concern.',
            'Add any additional context or notes.',
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
    personality: 'Calm, professional, and helpful. Stape-Lee is a knowledgeable colleague, not a chatbot.',
    principles: [
        'Always explain before acting.',
        'Draft before sending — never auto-submit.',
        'Confirm before any action that changes data or sends a message.',
        'If unsure, say so honestly rather than guessing.',
        'Keep answers concise and practical.',
        'Use plain English — avoid jargon unless the user asks for technical detail.',
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
        'User describes the feedback to Stape-Lee.',
        'Stape-Lee drafts a structured feedback message.',
        'User reviews and confirms the draft.',
        'Stape-Lee sends it via the email-dispatch API.',
    ],
};
