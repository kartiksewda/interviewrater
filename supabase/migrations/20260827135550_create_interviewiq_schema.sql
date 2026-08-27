/*
# Create InterviewIQ schema (single-tenant, no auth)

1. New Tables
- `questions`: interview question bank, 3 roles (sde1, bank_po, mba_gdpi)
  - id (uuid PK), role (text), question_text (text), category (text)
- `sessions`: one row per user attempt
  - id (uuid PK), name, contact, role, question_id (FK questions), created_at,
    paid (bool default false), payment_id (text nullable), plan (text nullable),
    access_expires_at (timestamptz nullable)
- `transcripts`: transcript for a session
  - id (uuid PK), session_id (FK sessions), raw_text (text), audio_url (text nullable)
- `reports`: full structured LLM report for a session
  - id (uuid PK), session_id (FK sessions), report_json (jsonb), created_at
2. Security
- RLS enabled on all tables.
- No-auth app: anon + authenticated CRUD allowed (data intentionally shared/public
  for v1; sessions are keyed by UUID which acts as a capability token).
3. Notes
- No users table. No auth.uid() usage.
- Indexes on sessions(question_id), transcripts(session_id), reports(session_id).
*/

CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('sde1','bank_po','mba_gdpi')),
  question_text text NOT NULL,
  category text NOT NULL DEFAULT 'behavioral'
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact text NOT NULL,
  role text NOT NULL CHECK (role IN ('sde1','bank_po','mba_gdpi')),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid boolean NOT NULL DEFAULT false,
  payment_id text,
  plan text CHECK (plan IN ('single','monthly')),
  access_expires_at timestamptz
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  raw_text text NOT NULL,
  audio_url text
);

ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  report_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_questions_role ON questions(role);
CREATE INDEX IF NOT EXISTS idx_sessions_question_id ON sessions(question_id);
CREATE INDEX IF NOT EXISTS idx_sessions_contact ON sessions(contact);
CREATE INDEX IF NOT EXISTS idx_transcripts_session_id ON transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_reports_session_id ON reports(session_id);

-- Policies: no-auth app, anon + authenticated full CRUD
-- questions
DROP POLICY IF EXISTS "anon_select_questions" ON questions;
CREATE POLICY "anon_select_questions" ON questions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_questions" ON questions;
CREATE POLICY "anon_insert_questions" ON questions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_questions" ON questions;
CREATE POLICY "anon_update_questions" ON questions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_questions" ON questions;
CREATE POLICY "anon_delete_questions" ON questions FOR DELETE TO anon, authenticated USING (true);

-- sessions
DROP POLICY IF EXISTS "anon_select_sessions" ON sessions;
CREATE POLICY "anon_select_sessions" ON sessions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_sessions" ON sessions;
CREATE POLICY "anon_insert_sessions" ON sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_sessions" ON sessions;
CREATE POLICY "anon_update_sessions" ON sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_sessions" ON sessions;
CREATE POLICY "anon_delete_sessions" ON sessions FOR DELETE TO anon, authenticated USING (true);

-- transcripts
DROP POLICY IF EXISTS "anon_select_transcripts" ON transcripts;
CREATE POLICY "anon_select_transcripts" ON transcripts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_transcripts" ON transcripts;
CREATE POLICY "anon_insert_transcripts" ON transcripts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_transcripts" ON transcripts;
CREATE POLICY "anon_update_transcripts" ON transcripts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_transcripts" ON transcripts;
CREATE POLICY "anon_delete_transcripts" ON transcripts FOR DELETE TO anon, authenticated USING (true);

-- reports
DROP POLICY IF EXISTS "anon_select_reports" ON reports;
CREATE POLICY "anon_select_reports" ON reports FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_reports" ON reports;
CREATE POLICY "anon_insert_reports" ON reports FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_reports" ON reports;
CREATE POLICY "anon_update_reports" ON reports FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_reports" ON reports;
CREATE POLICY "anon_delete_reports" ON reports FOR DELETE TO anon, authenticated USING (true);
