# Supabase Setup — Second Look Protect

## 1. Environment Variables

Add to `.env.local` (dev) and Vercel → Settings → Environment Variables (production):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

> **Note:** This is a Vite project. Env vars must be prefixed `VITE_` to be exposed to the browser.

---

## 2. Database — Run in Supabase SQL Editor

```sql
-- Create submissions table
create table if not exists submissions (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  name        text,
  email       text,
  message     text,
  image_path  text,
  image_url   text,
  status      text        default 'new'
);

-- Enable Row Level Security
alter table submissions enable row level security;

-- Allow anonymous users to INSERT
create policy "Allow anon insert"
  on submissions
  for insert
  to anon
  with check (true);

-- Allow anonymous users to UPDATE (needed to write image_url after upload)
create policy "Allow anon update"
  on submissions
  for update
  to anon
  using (true);
```

---

## 3. Storage — Supabase Dashboard

1. Go to **Storage** → **New bucket**
2. Name: `uploads`
3. **Public bucket**: ✅ enabled (so public URLs work without signing)
4. Add Storage Policy:
   - Policy name: `Allow anon uploads`
   - Allowed operation: `INSERT`
   - Target roles: `anon`
   - No condition required (or restrict to `submissions/` prefix if desired)

---

## 4. How to Test

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to `/get-protection` → select "Upload a screenshot" → click Continue | Step 2 shows file input |
| 2 | Choose an image file | Thumbnail preview appears |
| 3 | Click Submit | Button shows "Submitting…", then success screen |
| 4 | Supabase → Table Editor → `submissions` | New row with `image_url` populated |
| 5 | Supabase → Storage → `uploads` | File at `submissions/<id>/<timestamp>-<filename>` |

---

## 5. Submission Flow (code logic)

```
A) INSERT into submissions {} → get id
B) Upload file to uploads/submissions/<id>/<ts>-<filename>
C) Get public URL from storage
D) UPDATE submissions SET image_path, image_url WHERE id = <id>
E) setSubmitted(true) → success screen
```
