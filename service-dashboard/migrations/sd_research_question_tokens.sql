-- Ask-the-tech magic links: a tokenized public answer page for research questions.
-- Applied to prod 2026-07-01 via Supabase Management API (statement-by-statement — the
-- Mgmt API silently no-ops a script that begins with a comment block; run these bare).

ALTER TABLE sd_research_questions
  ADD COLUMN IF NOT EXISTS answer_token text,   -- 48-char unguessable token for /q/[token]
  ADD COLUMN IF NOT EXISTS answered_via text;   -- 'tech_link' when answered via the public page

CREATE UNIQUE INDEX IF NOT EXISTS idx_sd_research_questions_token
  ON sd_research_questions(answer_token) WHERE answer_token IS NOT NULL;
