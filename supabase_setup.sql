-- ============================================================
-- Life OS — Supabase database setup
-- Run this in the Supabase SQL editor
-- ============================================================

-- habits table
create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  icon text not null,
  color text not null,
  config jsonb default '{}',
  rest_days int[] default '{}',
  min_done_for_complete int default 1,
  sort_order int default 0
);

-- habit_logs table
create table if not exists habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_key text not null,
  log_date date not null,
  done boolean default false,
  is_rest_day boolean default false,
  payload jsonb default '{}',
  logged_at timestamptz default now(),
  unique(habit_key, log_date)
);

-- goals table
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null,
  color text not null,
  progress_pct int default 0 check (progress_pct >= 0 and progress_pct <= 100),
  target_date date,
  label text,
  status text default 'active',
  sort_order int default 0
);

-- Phase 3b: Masters research foundation
create table if not exists countries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  flag_emoji text not null,
  added_at timestamptz default now(),
  static_research jsonb,
  dynamic_research jsonb,
  static_researched_at timestamptz,
  dynamic_refreshed_at timestamptz,
  personal_notes text default ''
);

create table if not exists universities (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  name text not null,
  city text,
  added_at timestamptz default now(),
  static_research jsonb,
  dynamic_research jsonb,
  static_researched_at timestamptz,
  dynamic_refreshed_at timestamptz,
  personal_notes text default '',
  unique(country_id, name)
);

create table if not exists research_sources (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('country','university')),
  entity_id uuid not null,
  citation_index int not null,
  source_url text not null,
  source_title text not null,
  source_type text default 'web'
    check (source_type in ('official','reddit','quora','news','ranking','web')),
  created_at timestamptz default now()
);

-- ============================================================
-- Seed habits
-- ============================================================

insert into habits (key, name, icon, color, config, rest_days, min_done_for_complete, sort_order)
values
  (
    'gym',
    'Gym',
    'barbell',
    '#f59e0b',
    '{
      "workout_types": [
        {"key": "Push", "subtitle": "Chest · Sho · Tri"},
        {"key": "Pull", "subtitle": "Back · Biceps"},
        {"key": "Legs", "subtitle": "Legs · Abs"},
        {"key": "Cardio", "subtitle": "Endurance"}
      ]
    }',
    '{0}',
    1,
    1
  ),
  (
    'japanese',
    'Japanese',
    'language',
    '#3b82f6',
    '{
      "subtasks": [
        {"key": "anki", "label": "Anki"},
        {"key": "duolingo", "label": "Duolingo"},
        {"key": "study", "label": "Study session"}
      ]
    }',
    '{}',
    2,
    2
  ),
  (
    'dsa',
    'DSA',
    'code',
    '#a855f7',
    '{
      "difficulties": ["easy", "med", "hard"]
    }',
    '{}',
    1,
    3
  )
on conflict (key) do nothing;

-- ============================================================
-- Seed goals
-- Dates are relative to 2026-06-07
-- IIL: 7 weeks out = 2026-07-26
-- Internship: 5 months out = 2026-11-07
-- Masters research: no target date
-- Research paper: 2026-11-30
-- ============================================================

insert into goals (name, icon, color, progress_pct, target_date, label, status, sort_order)
values
  ('IIL startup',       'rocket',            '#993C1D', 8,  '2026-07-26', '7 wks',      'active', 1),
  ('Internship',        'building-factory',  '#185FA5', 16, '2026-11-07', 'month 1/6',  'active', 2),
  ('Masters research',  'school',            '#3B6D11', 2,  null,         'starting',   'active', 3),
  ('Research paper',    'file-text',         '#854F0B', 5,  '2026-11-30', 'Nov 30',     'active', 4)
on conflict do nothing;

-- ============================================================
-- Seed Masters countries
-- ============================================================

insert into countries (name, flag_emoji)
select name, flag_emoji
from (
  values
    ('United Kingdom', '🇬🇧'),
    ('United States', '🇺🇸'),
    ('Japan', '🇯🇵'),
    ('Singapore', '🇸🇬'),
    ('Germany', '🇩🇪'),
    ('Canada', '🇨🇦'),
    ('Austria', '🇦🇹'),
    ('Netherlands', '🇳🇱')
) as seed(name, flag_emoji)
where not exists (
  select 1 from countries where countries.name = seed.name
);

-- ============================================================
-- Phase 2: Gym Workout Tracker
-- ============================================================

-- exercises table (global library; workout_type_tags controls which drawers show it)
create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  weight_type text not null check (weight_type in ('barbell', 'dumbbell', 'cable', 'reps', 'time')),
  primary_workout_type text not null,
  workout_type_tags text[] not null default '{}',
  created_at timestamptz default now()
);

-- exercise_logs table (one row per exercise per day)
create table if not exists exercise_logs (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references exercises(id) on delete cascade,
  log_date date not null default current_date,
  sets jsonb not null default '[]',
  logged_at timestamptz default now(),
  unique(exercise_id, log_date)
);

-- ============================================================
-- Row Level Security — anon full access (personal app, no auth)
-- ============================================================

alter table habits        enable row level security;
alter table habit_logs    enable row level security;
alter table goals         enable row level security;
alter table countries     enable row level security;
alter table universities  enable row level security;
alter table research_sources enable row level security;
alter table exercises     enable row level security;
alter table exercise_logs enable row level security;

create policy "anon_all_habits"        on habits        for all to anon using (true) with check (true);
create policy "anon_all_habit_logs"    on habit_logs    for all to anon using (true) with check (true);
create policy "anon_all_goals"         on goals         for all to anon using (true) with check (true);
create policy "anon_all_countries"     on countries     for all to anon using (true) with check (true);
create policy "anon_all_universities"  on universities  for all to anon using (true) with check (true);
create policy "anon_all_research_sources" on research_sources for all to anon using (true) with check (true);
create policy "anon_all_exercises"     on exercises     for all to anon using (true) with check (true);
create policy "anon_all_exercise_logs" on exercise_logs for all to anon using (true) with check (true);

-- ============================================================
-- Migration: category-scoped exercise logs
-- Run these in order in the Supabase SQL editor ONCE
-- ============================================================

-- 1. Add workout_type column (idempotent)
-- ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS workout_type text NOT NULL DEFAULT '';

-- 2. Backfill existing rows with the exercise's primary_workout_type
-- UPDATE exercise_logs el
-- SET workout_type = e.primary_workout_type
-- FROM exercises e
-- WHERE el.exercise_id = e.id;

-- 3. Replace the old unique constraint with one that includes workout_type
-- ALTER TABLE exercise_logs
-- DROP CONSTRAINT IF EXISTS exercise_logs_exercise_id_log_date_key;

-- ALTER TABLE exercise_logs
-- ADD CONSTRAINT exercise_logs_exercise_id_log_date_workout_type_key
-- UNIQUE (exercise_id, log_date, workout_type);

-- ============================================================
-- Migration: cable exercise plate shape
-- Converts old sets payloads:
--   { "plates": 3, "mini": 1, "reps": 10 }
-- to:
--   { "big": 3, "medium": 0, "small": 1, "reps": 10 }
-- Run once in the Supabase SQL editor after deploying the matching frontend.
-- ============================================================

UPDATE exercise_logs
SET sets = (
  SELECT jsonb_agg(
    CASE
      WHEN s ? 'plates' THEN
        jsonb_build_object(
          'big', COALESCE((s->>'plates')::int, 0),
          'medium', 0,
          'small', COALESCE((s->>'mini')::int, 0),
          'reps', COALESCE((s->>'reps')::int, 0)
        )
      ELSE s
    END
  )
  FROM jsonb_array_elements(sets) s
)
WHERE sets::text LIKE '%"plates"%';
