-- Seed Reading Curriculum from Gideon paper tracker
-- Structure: Level > Series > Booklets (A, B, C, D...)

-- Get the Reading subject ID
DO $$
DECLARE
  reading_id UUID;
  math_id UUID;
  level_id UUID;
  series_id UUID;
BEGIN
  SELECT id INTO reading_id FROM subjects WHERE slug = 'reading';
  SELECT id INTO math_id FROM subjects WHERE slug = 'math';

  -- ============================================
  -- READING CURRICULUM
  -- ============================================

  -- Level: C-2 (Early Reading)
  INSERT INTO curriculum_levels (id, subject_id, name, passing_threshold, sort_order)
  VALUES (gen_random_uuid(), reading_id, 'C-2', 3, 1)
  RETURNING id INTO level_id;

  INSERT INTO series (id, level_id, name, sort_order) VALUES (gen_random_uuid(), level_id, 'Discovery Readers', 1) RETURNING id INTO series_id;
  INSERT INTO booklets (series_id, name, sort_order) VALUES
    (series_id, 'A', 1), (series_id, 'B', 2), (series_id, 'C', 3), (series_id, 'D', 4);

  INSERT INTO series (id, level_id, name, sort_order) VALUES (gen_random_uuid(), level_id, 'Word Whiz', 2) RETURNING id INTO series_id;
  INSERT INTO booklets (series_id, name, sort_order) VALUES
    (series_id, 'A', 1), (series_id, 'B', 2), (series_id, 'C', 3), (series_id, 'D', 4);

  -- Level: D-1 (Developing Reading)
  INSERT INTO curriculum_levels (id, subject_id, name, passing_threshold, sort_order)
  VALUES (gen_random_uuid(), reading_id, 'D-1', 3, 2)
  RETURNING id INTO level_id;

  INSERT INTO series (id, level_id, name, sort_order) VALUES (gen_random_uuid(), level_id, 'Adventure Readers', 1) RETURNING id INTO series_id;
  INSERT INTO booklets (series_id, name, sort_order) VALUES
    (series_id, 'A', 1), (series_id, 'B', 2), (series_id, 'C', 3), (series_id, 'D', 4), (series_id, 'E', 5);

  INSERT INTO series (id, level_id, name, sort_order) VALUES (gen_random_uuid(), level_id, 'Sight Words', 2) RETURNING id INTO series_id;
  INSERT INTO booklets (series_id, name, sort_order) VALUES
    (series_id, 'A', 1), (series_id, 'B', 2), (series_id, 'C', 3);

  -- Level: D-2 (Fluency Building)
  INSERT INTO curriculum_levels (id, subject_id, name, passing_threshold, sort_order)
  VALUES (gen_random_uuid(), reading_id, 'D-2', 3, 3)
  RETURNING id INTO level_id;

  INSERT INTO series (id, level_id, name, sort_order) VALUES (gen_random_uuid(), level_id, 'Story Readers', 1) RETURNING id INTO series_id;
  INSERT INTO booklets (series_id, name, sort_order) VALUES
    (series_id, 'A', 1), (series_id, 'B', 2), (series_id, 'C', 3), (series_id, 'D', 4), (series_id, 'E', 5);

  INSERT INTO series (id, level_id, name, sort_order) VALUES (gen_random_uuid(), level_id, 'Vocabulary Builders', 2) RETURNING id INTO series_id;
  INSERT INTO booklets (series_id, name, sort_order) VALUES
    (series_id, 'A', 1), (series_id, 'B', 2), (series_id, 'C', 3), (series_id, 'D', 4);

  -- Level: E-1 (Comprehension)
  INSERT INTO curriculum_levels (id, subject_id, name, passing_threshold, sort_order)
  VALUES (gen_random_uuid(), reading_id, 'E-1', 3, 4)
  RETURNING id INTO level_id;

  INSERT INTO series (id, level_id, name, sort_order) VALUES (gen_random_uuid(), level_id, 'Chapter Readers', 1) RETURNING id INTO series_id;
  INSERT INTO booklets (series_id, name, sort_order) VALUES
    (series_id, 'A', 1), (series_id, 'B', 2), (series_id, 'C', 3), (series_id, 'D', 4);

  INSERT INTO series (id, level_id, name, sort_order) VALUES (gen_random_uuid(), level_id, 'Test Takers', 2) RETURNING id INTO series_id;
  INSERT INTO booklets (series_id, name, sort_order) VALUES
    (series_id, 'A', 1), (series_id, 'B', 2), (series_id, 'C', 3);

  -- Level: E-2 (Advanced Reading)
  INSERT INTO curriculum_levels (id, subject_id, name, passing_threshold, sort_order)
  VALUES (gen_random_uuid(), reading_id, 'E-2', 2, 5)
  RETURNING id INTO level_id;

  INSERT INTO series (id, level_id, name, sort_order) VALUES (gen_random_uuid(), level_id, 'Advanced Readers', 1) RETURNING id INTO series_id;
  INSERT INTO booklets (series_id, name, sort_order) VALUES
    (series_id, 'A', 1), (series_id, 'B', 2), (series_id, 'C', 3), (series_id, 'D', 4), (series_id, 'E', 5);

  -- ============================================
  -- MATH CURRICULUM (Placeholder structure)
  -- ============================================

  -- Level: Oral Facts
  INSERT INTO curriculum_levels (id, subject_id, name, passing_threshold, sort_order)
  VALUES (gen_random_uuid(), math_id, 'Oral Facts', 3, 1)
  RETURNING id INTO level_id;

  INSERT INTO series (id, level_id, name, sort_order) VALUES (gen_random_uuid(), level_id, 'Addition', 1) RETURNING id INTO series_id;
  INSERT INTO booklets (series_id, name, sort_order) VALUES
    (series_id, 'A', 1), (series_id, 'B', 2), (series_id, 'C', 3);

  INSERT INTO series (id, level_id, name, sort_order) VALUES (gen_random_uuid(), level_id, 'Subtraction', 2) RETURNING id INTO series_id;
  INSERT INTO booklets (series_id, name, sort_order) VALUES
    (series_id, 'A', 1), (series_id, 'B', 2), (series_id, 'C', 3);

  -- Level: Arithmetic
  INSERT INTO curriculum_levels (id, subject_id, name, passing_threshold, sort_order)
  VALUES (gen_random_uuid(), math_id, 'Arithmetic', 3, 2)
  RETURNING id INTO level_id;

  INSERT INTO series (id, level_id, name, sort_order) VALUES (gen_random_uuid(), level_id, 'Multiplication', 1) RETURNING id INTO series_id;
  INSERT INTO booklets (series_id, name, sort_order) VALUES
    (series_id, 'A', 1), (series_id, 'B', 2), (series_id, 'C', 3), (series_id, 'D', 4);

  INSERT INTO series (id, level_id, name, sort_order) VALUES (gen_random_uuid(), level_id, 'Division', 2) RETURNING id INTO series_id;
  INSERT INTO booklets (series_id, name, sort_order) VALUES
    (series_id, 'A', 1), (series_id, 'B', 2), (series_id, 'C', 3), (series_id, 'D', 4);

  -- Level: Word Problems
  INSERT INTO curriculum_levels (id, subject_id, name, passing_threshold, sort_order)
  VALUES (gen_random_uuid(), math_id, 'Word Problems', 3, 3)
  RETURNING id INTO level_id;

  INSERT INTO series (id, level_id, name, sort_order) VALUES (gen_random_uuid(), level_id, 'Basic Problems', 1) RETURNING id INTO series_id;
  INSERT INTO booklets (series_id, name, sort_order) VALUES
    (series_id, 'A', 1), (series_id, 'B', 2), (series_id, 'C', 3);

END $$;
