-- Add selectable options and a server-side answer key for generated quiz items.
ALTER TABLE study_items
  ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE study_items
  ADD COLUMN IF NOT EXISTS correct_option_indices INTEGER[] NOT NULL DEFAULT '{}';
