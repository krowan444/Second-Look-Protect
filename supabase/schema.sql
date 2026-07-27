-- ═══════════════════════════════════════════════════════════════════
-- Second Look Protect v2 — Supabase schema
--
-- Safe to run more than once. If you already have a working database,
-- just run the whole file again: everything is "if not exists" or an
-- idempotent add-column, so nothing is dropped and no data is lost.
-- ═══════════════════════════════════════════════════════════════════

-- ── Scam-check submissions from the public form ─────────────────────
create table if not exists submissions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null,
  email         text not null,
  phone         text,
  channel       text not null default 'email',      -- how they want the report: email | whatsapp | both
  category      text not null default 'message',    -- message | email | phone_call | letter | website | other
  description   text not null,                      -- what happened, in their words
  pasted_text   text,                               -- the suspicious message pasted in
  details       jsonb not null default '{}',        -- type-specific answers (caller number, URL…)
  image_paths   jsonb not null default '[]',        -- storage paths of uploaded screenshots
  member_status text not null default 'free',       -- member | free | free_used  (snapshot at submission)
  status        text not null default 'new',        -- new | analyzing | awaiting_review | sent | dismissed
  sent_at       timestamptz
);

-- Chase reminders: the last nudge stage sent, in minutes (0 = none yet).
-- Used by api/reminders.js so each of the 30/60/90-minute pings fires once.
alter table submissions add column if not exists reminder_stage integer not null default 0;

-- Speeds up the reminder sweep, which looks for open, older submissions.
create index if not exists submissions_open_idx on submissions (created_at) where status not in ('sent', 'dismissed');

-- ── AI-generated draft reports (one per submission) ──────────────────
create table if not exists ai_reports (
  id               uuid primary key default gen_random_uuid(),
  submission_id    uuid not null references submissions(id) on delete cascade,
  created_at       timestamptz not null default now(),
  verdict          text not null,                   -- likely_scam | suspicious | likely_safe | insufficient_info
  risk_level       text not null,                   -- low | medium | high | critical
  headline         text not null,                   -- one-line customer-facing verdict
  explanation      text not null,                   -- plain-English customer-facing explanation
  indicators       jsonb not null default '[]',     -- warning signs found
  actions          jsonb not null default '[]',     -- what the customer should do now
  extracted_links  jsonb not null default '[]',
  extracted_phones jsonb not null default '[]',
  corroboration    jsonb,                           -- Gemini web-research layer output
  ocr_text         text,                            -- text pulled from screenshots
  confidence       numeric,
  model            text,
  raw              jsonb                            -- full raw AI output for reference
);
create unique index if not exists ai_reports_submission_idx on ai_reports(submission_id);

-- ── Peace of Mind members (kept in sync by the Stripe webhook) ───────
create table if not exists members (
  id                     uuid primary key default gen_random_uuid(),
  email                  text not null unique,
  stripe_customer_id     text,
  stripe_subscription_id text,
  status                 text not null default 'active',  -- active | past_due | canceled
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ── AI Safety Talk enquiries (charities, community groups, business) ─
create table if not exists talk_enquiries (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  org_name         text not null,
  org_type         text not null default 'other',   -- charity | community | corporate | school | public_sector | other
  contact_name     text not null,
  email            text not null,
  phone            text,
  audience_size    text,
  preferred_format text,                            -- in_person | online | either
  preferred_date   text,
  location         text,
  budget           text,
  message          text,
  hear_about       text,
  status           text not null default 'new',     -- new | contacted | quoted | booked | closed
  notes            text
);
create index if not exists talk_enquiries_created_idx on talk_enquiries (created_at desc);

-- ── Row Level Security ───────────────────────────────────────────────
-- All public traffic goes through serverless functions using the
-- service-role key, so tables stay locked to anonymous users.
-- The authenticated role = Kieran's admin login for the review page.
alter table submissions     enable row level security;
alter table ai_reports      enable row level security;
alter table members         enable row level security;
alter table talk_enquiries  enable row level security;

-- Policies are dropped first so re-running this file never errors.
drop policy if exists "Admin read submissions"    on submissions;
drop policy if exists "Admin update submissions"  on submissions;
drop policy if exists "Admin read reports"        on ai_reports;
drop policy if exists "Admin update reports"      on ai_reports;
drop policy if exists "Admin read members"        on members;
drop policy if exists "Admin read talk enquiries" on talk_enquiries;
drop policy if exists "Admin update talk enquiries" on talk_enquiries;

create policy "Admin read submissions"      on submissions    for select to authenticated using (true);
create policy "Admin update submissions"    on submissions    for update to authenticated using (true);
create policy "Admin read reports"          on ai_reports     for select to authenticated using (true);
create policy "Admin update reports"        on ai_reports     for update to authenticated using (true);
create policy "Admin read members"          on members        for select to authenticated using (true);
create policy "Admin read talk enquiries"   on talk_enquiries for select to authenticated using (true);
create policy "Admin update talk enquiries" on talk_enquiries for update to authenticated using (true);

-- ═══════════════════════════════════════════════════════════════════
-- STORAGE (do in the Dashboard, not SQL):
--   1. Storage → New bucket → name: "uploads" → Public: ON
--   2. Policy: allow INSERT for role "anon" (uploads only, no listing)
-- ADMIN LOGIN (do in the Dashboard):
--   Authentication → Users → Add user → hello@secondlookprotect.co.uk + password
-- ═══════════════════════════════════════════════════════════════════
