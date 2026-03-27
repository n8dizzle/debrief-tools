-- GideonTrack Initial Schema
-- Apply this to a new Supabase project

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SUBJECTS
-- ============================================
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#4F46E5',
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO subjects (name, slug, color, sort_order) VALUES
  ('Reading', 'reading', '#3B82F6', 1),
  ('Math', 'math', '#F97316', 2);

-- ============================================
-- CURRICULUM: Levels > Series > Booklets
-- ============================================
CREATE TABLE curriculum_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  passing_threshold INTEGER NOT NULL DEFAULT 3,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(subject_id, name)
);

CREATE TABLE series (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level_id UUID NOT NULL REFERENCES curriculum_levels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  passing_threshold_override INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(level_id, name)
);

CREATE TABLE booklets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  passing_threshold_override INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(series_id, name)
);

-- ============================================
-- USERS (admin, tutor, parent)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'tutor', 'parent')),
  password_hash TEXT, -- Only for parents
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- STUDENTS
-- ============================================
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  date_of_birth DATE,
  enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_status ON students(status);

-- ============================================
-- PARENT-STUDENT LINKS (many-to-many)
-- ============================================
CREATE TABLE parent_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'Parent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(parent_id, student_id)
);

-- ============================================
-- TUTOR-STUDENT LINKS
-- ============================================
CREATE TABLE tutor_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tutor_id, student_id)
);

-- ============================================
-- SESSION LOGS (one row per rep)
-- ============================================
CREATE TABLE session_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  booklet_id UUID NOT NULL REFERENCES booklets(id) ON DELETE CASCADE,
  tutor_id UUID NOT NULL REFERENCES users(id),
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  rep_number INTEGER NOT NULL,
  mistakes INTEGER NOT NULL CHECK (mistakes >= 0),
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_logs_student ON session_logs(student_id, session_date DESC);
CREATE INDEX idx_session_logs_booklet ON session_logs(student_id, booklet_id);

-- ============================================
-- STUDENT BOOKLET PROGRESS (cached status per booklet)
-- ============================================
CREATE TABLE student_booklet_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  booklet_id UUID NOT NULL REFERENCES booklets(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'passed', 'skipped')),
  date_pulled DATE NOT NULL DEFAULT CURRENT_DATE,
  date_passed DATE,
  total_reps INTEGER NOT NULL DEFAULT 0,
  best_score INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, booklet_id)
);

-- ============================================
-- STUDENT POSITIONS (current booklet per subject)
-- ============================================
CREATE TABLE student_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  current_booklet_id UUID NOT NULL REFERENCES booklets(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, subject_id)
);

-- ============================================
-- Helper function to update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER students_updated_at BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER student_positions_updated_at BEFORE UPDATE ON student_positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER student_booklet_progress_updated_at BEFORE UPDATE ON student_booklet_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
